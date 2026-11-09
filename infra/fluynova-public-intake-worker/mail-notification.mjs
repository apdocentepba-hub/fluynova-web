/**
 * FLUYNOVA — Paso 06A, laboratorio de notificación.
 * Este archivo NO está invocado por fetch/scheduled del Worker público.
 * Un envío remoto requiere aprobación, binding Email Service y remitente
 * verificado; nada de eso se configura aquí.
 */
const DESTINATION='contacto.fluynova@gmail.com';
const LEAD_ID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
function clean(value,max=5000) {
 return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}
export function formatLeadNotice(lead,from) {
 if(!lead||!LEAD_ID.test(String(lead.id||'')))throw Error('INVALID_LEAD_ID');
 if(typeof from!=='string'||!EMAIL.test(from)||from.includes('\n')||from.includes('\r'))
   throw Error('MAIL_SENDER_NOT_VERIFIED');
 const email=clean(lead.email,180);
 if(!EMAIL.test(email))throw Error('INVALID_LEAD_EMAIL');
 const created=clean(lead.received_at,40);
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(created))
   throw Error('INVALID_RECEIPT_DATE');
 const text=[
  'FLUYNOVA — nueva consulta guardada en D1',
  '',
  'Código de recepción: '+lead.id,
  'Fecha registrada: '+created,
  'Nombre: '+clean(lead.name,100),
  'Email de contacto: '+email,
  'Organización: '+clean(lead.organization,120),
  'Servicio: '+clean(lead.category,100),
  'Consulta:',
  clean(lead.message,5000),
  '',
  'Aviso interno: la respuesta HTTP del formulario confirma D1, NO este correo.',
  'Este aviso no certifica entrega al destinatario.'
 ].join('\n');
 return Object.freeze({
  from,to:DESTINATION,
  subject:'FLUYNOVA | Consulta guardada '+lead.id,
  text
 });
}

const CLAIM_SQL="UPDATE lead_mail_outbox SET state='sending', attempts=attempts+1, "+
 "updated_at=? WHERE lead_id=? AND state='pending' RETURNING lead_id,attempts";
const READ_SQL="SELECT l.id,l.received_at,l.name,l.email,l.organization,l.category,l.message "+
 "FROM leads l INNER JOIN lead_mail_outbox o ON o.lead_id=l.id WHERE l.id=?";
const ACCEPT_SQL="UPDATE lead_mail_outbox SET state='accepted', provider_message_id=?, "+
 "updated_at=? WHERE lead_id=? AND state='sending'";
const UNCERTAIN_SQL="UPDATE lead_mail_outbox SET state='uncertain', "+
 "updated_at=? WHERE lead_id=? AND state='sending'";

/**
 * Un SOLO intento por ejecución. Estado 'uncertain' no se reintenta
 * automáticamente si el proveedor pudo aceptarlo y la respuesta se perdió.
 * 'accepted' significa aceptación por el proveedor, NO entrega al buzón.
 */
export async function dispatchOnePendingNotice({
 db,emailBinding,from,enabled=false,now=()=>new Date().toISOString()
}={}) {
 if(enabled!==true)return Object.freeze({state:'disabled',providerAccepted:false,mailDelivered:false});
 if(!db||typeof db.prepare!=='function')throw Error('MAIL_DATABASE_NOT_CONFIGURED');
 if(!emailBinding||typeof emailBinding.send!=='function')
   throw Error('MAIL_BINDING_NOT_CONFIGURED');
 if(typeof from!=='string'||!EMAIL.test(from))throw Error('MAIL_SENDER_NOT_VERIFIED');
 const pending=await db.prepare(
   "SELECT lead_id FROM lead_mail_outbox WHERE state='pending' ORDER BY created_at LIMIT 1"
 ).first();
 if(!pending?.lead_id)
   return Object.freeze({state:'empty',providerAccepted:false,mailDelivered:false});
 const claimed=await db.prepare(CLAIM_SQL).bind(now(),pending.lead_id).first();
 if(!claimed?.lead_id)
   return Object.freeze({state:'already-claimed',providerAccepted:false,mailDelivered:false});
 const leadId=claimed.lead_id;
 try {
  const lead=await db.prepare(READ_SQL).bind(leadId).first();
  const message=formatLeadNotice(lead,from);
  // ÚNICA llamada externa posible; este módulo no se ejecuta en el Worker.
  const result=await emailBinding.send(message);
  if(typeof result?.messageId!=='string'||!result.messageId.trim())
    throw Error('MAIL_PROVIDER_ACCEPTANCE_NOT_CONFIRMED');
  const changed=await db.prepare(ACCEPT_SQL)
    .bind(result.messageId,now(),leadId).run();
  if(changed?.success!==true||Number(changed.meta?.changes)!==1)
    throw Error('MAIL_ACCEPTANCE_STATE_NOT_PERSISTED');
  return Object.freeze({state:'accepted',leadId,providerAccepted:true,mailDelivered:false});
 }catch {
  // Error ambiguo: el proveedor pudo aceptar el correo. NO reintentar.
  try{await db.prepare(UNCERTAIN_SQL).bind(now(),leadId).run()}catch{}
  return Object.freeze({state:'uncertain',leadId,providerAccepted:false,mailDelivered:false});
 }
}

/**
 * Usar SOLO desde un consumidor autenticado de Cloudflare Event
 * Subscriptions/Queues, NUNCA desde fetch público. La carga por sí sola
 * no autentica al remitente; el acceso a Queue debe verificarse al configurar.
 * 'message.delivered' acredita aceptación por el servidor SMTP destinatario,
 * NO ubicación en la bandeja de entrada del usuario.
 */
export async function recordVerifiedDeliveryEvent({db,event,enabled=false,now=()=>new Date().toISOString()}={}) {
 if(enabled!==true)return Object.freeze({state:'disabled',mailDelivered:false});
 if(!db||typeof db.prepare!=='function')throw Error('MAIL_DATABASE_NOT_CONFIGURED');
 if(event?.type!=='cf.email.sending.message.delivered'||
    event?.source?.type!=='email.sending'||
    event?.payload?.terminal!==true||
    event?.payload?.delivery?.status!=='delivered'||
    String(event?.payload?.recipient||'').toLowerCase()!==DESTINATION) {
  return Object.freeze({state:'ignored',mailDelivered:false});
 }
 const messageId=event?.payload?.messageId;
 if(typeof messageId!=='string'||messageId.length<8||messageId.length>256||
    /[\u0000-\u001f\u007f]/.test(messageId))
  return Object.freeze({state:'ignored',mailDelivered:false});
 const result=await db.prepare(
   "UPDATE lead_mail_outbox SET state='delivered',updated_at=? "+
   "WHERE provider_message_id=? AND state='accepted' RETURNING lead_id"
 ).bind(now(),messageId).first();
 if(!result?.lead_id)return Object.freeze({state:'unknown-message',mailDelivered:false});
 return Object.freeze({state:'delivered',leadId:result.lead_id,mailDelivered:true});
}
