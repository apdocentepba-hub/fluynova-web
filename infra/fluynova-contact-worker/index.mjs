/**
 * FLUYNOVA | receptor de consultas Cloudflare Worker + D1.
 * CANDIDATO NO DESPLEGADO. No reutilizar bases de APDocentePBA.
 * La confirmación se devuelve SOLO después de persistir la consulta en D1.
 * Requiere bindings propios DB, TURNSTILE_SECRET_KEY y RATE_HASH_SECRET.
 */
const MAX_BYTES = 16_384;
const CATEGORIES = new Set([
  'Automatizar tareas','Desarrollar software','Crear página web / catálogo digital',
  'Conectar herramientas / datos','Inteligencia artificial','Otro / no estoy seguro'
]);
const ISO_HOUR = 3_600_000;
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const LIMIT_PER_HOUR = 5;

export function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim())
    .filter(s=>{try{const u=new URL(s);return u.origin===s&&u.protocol==='https:'}catch{return false}}));
}
function headers(origin) {
  return {
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'content-type',
    'Access-Control-Max-Age':'600',
    'Vary':'Origin',
    'Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff',
  };
}
function json(body,status,origin) {
  return new Response(JSON.stringify(body),{
    status,headers:origin?headers(origin):{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
function clean(value,max) {
  if(typeof value!=='string')return '';
  return value.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max+1);
}
export function validateLead(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))return {error:'JSON inválido'};
  const value={
    name:clean(data.name,100),email:clean(data.email,180).toLowerCase(),
    organization:clean(data.organization,120),
    category:clean(data.category,100),message:clean(data.message,5000),
    deadline:clean(data.deadline,100),stage:clean(data.stage,100),
    budget:clean(data.budget,100),
    source:clean(data.origen_fuente,90),medium:clean(data.origen_canal,90),
    campaign:clean(data.origen_campania,90),creative:clean(data.origen_mensaje,90)
  };
  if(value.name.length<2||value.name.length>100)return {error:'Nombre inválido'};
  if(value.email.length<5||value.email.length>180||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.email))return {error:'Correo inválido'};
  if(!CATEGORIES.has(value.category))return {error:'Categoría inválida'};
  if(value.message.length<15||value.message.length>5000)return {error:'Mensaje inválido'};
  if(value.organization.length>120)return {error:'Organización inválida'};
  if(data.consent!==true)return {error:'Se requiere consentimiento'};
  if(![value.source,value.medium,value.campaign,value.creative].every(x=>!x||/^[a-zA-Z0-9_.-]{1,90}$/.test(x)))return {error:'Atribución inválida'};
  if(![value.deadline,value.stage,value.budget].every(x=>x.length<=100))return {error:'Campos opcionales inválidos'};
  return {value};
}
async function boundedJson(req) {
  const length=Number(req.headers.get('content-length')||0);
  if(!Number.isSafeInteger(length)||length>MAX_BYTES||length<0)throw Error('TOO_LARGE');
  if(!req.body)throw Error('BAD_JSON');
  const reader=req.body.getReader();const chunks=[];let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BYTES)throw Error('TOO_LARGE');
      chunks.push(value);
    }
  }finally{try{await reader.cancel()}catch{}reader.releaseLock()}
  const bytes=new Uint8Array(size);let pos=0;
  for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
  catch{throw Error('BAD_JSON')}
}
async function anonymizeIp(req,secret) {
  const ip=req.headers.get('cf-connecting-ip');
  if(!ip||ip.length>80)throw Error('NO_CLIENT_IP');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const buf=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip));
  return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function verifyTurnstile(token,ip,env,fetcher){
  if(typeof token!=='string'||token.length<1||token.length>2048)return false;
  const form=new FormData();
  form.set('secret',env.TURNSTILE_SECRET_KEY);
  form.set('response',token);
  form.set('remoteip',ip);
  // La verificación remota debe finalizar: falla cerrado ante demoras o caída de Siteverify.
  // AbortSignal.timeout se crea dentro del handler para respetar Workers runtime.
  const response=await fetcher(SITEVERIFY,{
    method:'POST',body:form,signal:AbortSignal.timeout(5_000)
  });
  if(!response.ok)throw Error('SITEVERIFY_UNAVAILABLE');
  const result=await response.json();
  if(result.success!==true || result.action!=='contact')return false;
  const acceptedHostnames=String(env.TURNSTILE_HOSTNAMES||'').split(',')
    .map(s=>s.trim().toLowerCase()).filter(Boolean);
  return acceptedHostnames.length>0&&acceptedHostnames.includes(String(result.hostname||'').toLowerCase());
}
async function consumeRate(db,hash,now) {
  const bucket=Math.floor(now/ISO_HOUR);
  const result=await db.prepare(
    'INSERT INTO lead_rate_limit (fingerprint, hour_bucket, hits) VALUES (?, ?, 1) '+
    'ON CONFLICT(fingerprint, hour_bucket) DO UPDATE SET hits=hits+1 RETURNING hits'
  ).bind(hash,bucket).first();
  if(!result||typeof result.hits!=='number')throw Error('RATE_DB_FAILED');
  return result.hits<=LIMIT_PER_HOUR;
}
async function storeLead(db,item,id,at) {
  const result=await db.prepare(
    'INSERT INTO leads (id, received_at, name, email, organization, category, message, '+
    'deadline, stage, budget, source, medium, campaign, creative, consent_at, status) '+
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id,at,item.name,item.email,item.organization,item.category,item.message,
    item.deadline,item.stage,item.budget,item.source,item.medium,item.campaign,
    item.creative,at,'Nuevo').run();
  if(result?.success!==true)throw Error('STORAGE_NOT_CONFIRMED');
}
// Solo el Worker PUBLICO usará esta capa de idempotencia.
// En el Worker privado, ausente ENABLE_PUBLIC_INTAKE, se conserva storeLead().
// Nunca se debe crear la tabla faltante desde una petición HTTP.
const REQUEST_ID_V4=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function macLeadPayload(value,secret) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,
   new TextEncoder().encode('fluynova-lead-v1:'+JSON.stringify(value)));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const DEDUPE_SELECT='SELECT d.lead_id,d.payload_mac,d.fingerprint '+
 'FROM lead_idempotency d INNER JOIN leads l ON l.id=d.lead_id WHERE d.request_id=?';
async function persistIdempotentLead(db,item,requestId,mac,fingerprint,id,at) {
 // D1 batch realiza la reserva de clave y el INSERT condicional en UNA
 // transacción. Si la escritura de leads falla, revierte también la clave.
 const out=await db.batch([
   db.prepare('INSERT INTO lead_idempotency '+
     '(request_id,payload_mac,fingerprint,lead_id,created_at) VALUES (?,?,?,?,?) '+
     'ON CONFLICT(request_id) DO NOTHING')
    .bind(requestId,mac,fingerprint,id,at),
   db.prepare('INSERT INTO leads (id, received_at, name, email, organization, category, '+
     'message, deadline, stage, budget, source, medium, campaign, creative, consent_at, status) '+
     'SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS '+
     '(SELECT 1 FROM lead_idempotency WHERE request_id=? AND lead_id=?)')
    .bind(id,at,item.name,item.email,item.organization,item.category,item.message,
      item.deadline,item.stage,item.budget,item.source,item.medium,item.campaign,
      item.creative,at,'Nuevo',requestId,id),
   db.prepare(DEDUPE_SELECT).bind(requestId)
 ]);
 if(!Array.isArray(out)||out.length!==3||out.some(x=>x?.success!==true))
   throw Error('IDEMPOTENCY_BATCH_NOT_CONFIRMED');
 const row=out[2].results?.[0];
 if(!row?.lead_id||typeof row.lead_id!=='string')
   throw Error('IDEMPOTENCY_NOT_CONFIRMED');
 return row;
}

export function createHandler({fetcher=fetch,clock=()=>Date.now(),uuid=()=>crypto.randomUUID()}={}) {
  return async function handle(request,env) {
    const url=new URL(request.url),origin=request.headers.get('origin')||'';
    const allowed=allowedOrigins(env).has(origin);
    if(url.pathname==='/health' && request.method==='GET') {
      // Solo lectura. No consulta ni devuelve clientes o secretos.
      let databaseReady=false;
      try{
        const count=await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM sqlite_master "+
          "WHERE type='table' AND name IN ('leads','lead_rate_limit')"
        ).first();
        databaseReady=Number(count?.total)===2;
      }catch{}
      const accepting=databaseReady&&env.ENABLE_CONTACT_SUBMISSIONS==='true'&&
        !!(env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_HOSTNAMES&&env.RATE_HASH_SECRET);
      return json({databaseReady,accepting},databaseReady?200:503);
    }
    if(url.pathname!=='/api/contact')return json({ok:false,error:'NOT_FOUND'},404);
    if(!allowed)return json({ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
    if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin);
    // Puerta de activación: aun con D1 y secretos presentes no recibe solicitudes
    // reales hasta que se habilite explícitamente esta variable en Cloudflare.
    if(env.ENABLE_CONTACT_SUBMISSIONS!=='true')
      return json({ok:false,error:'CONTACT_UNAVAILABLE'},503,origin);
    if(!env.DB||!env.TURNSTILE_SECRET_KEY||!env.RATE_HASH_SECRET||!env.TURNSTILE_HOSTNAMES)
      return json({ok:false,error:'CONTACT_UNAVAILABLE'},503,origin);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
      return json({ok:false,error:'UNSUPPORTED_MEDIA_TYPE'},415,origin);
    let data;
    try{data=await boundedJson(request)}
    catch(e){return json({ok:false,error:e.message==='TOO_LARGE'?'PAYLOAD_TOO_LARGE':'INVALID_JSON'},
      e.message==='TOO_LARGE'?413:400,origin)}
    // No se guardan honeypots, pero tampoco se confirma entrega real.
    if(typeof data?.website==='string'&&data.website.trim())
      return json({ok:false,error:'INVALID_REQUEST'},422,origin);
    const v=validateLead(data);
    if(v.error)return json({ok:false,error:v.error},422,origin);
    const useIdempotency=env.ENABLE_PUBLIC_INTAKE==='true';
    const requestId=data?.request_id;
    if(useIdempotency && (typeof requestId!=='string'||!REQUEST_ID_V4.test(requestId)))
      return json({ok:false,error:'INVALID_REQUEST_ID'},422,origin);
    const ip=request.headers.get('cf-connecting-ip')||'';
    let verified=false;
    try{verified=await verifyTurnstile(data.turnstile_token,ip,env,fetcher)}
    catch{return json({ok:false,error:'CAPTCHA_TEMPORARILY_UNAVAILABLE'},503,origin)}
    if(!verified)return json({ok:false,error:'CAPTCHA_FAILED'},403,origin);
    try{
      const fingerprint=await anonymizeIp(request,env.RATE_HASH_SECRET);
      if(useIdempotency){
        const mac=await macLeadPayload(v.value,env.RATE_HASH_SECRET);
        // Reintento tras una respuesta perdida: no consumir otro cupo de rate
        // limit ni registrar otra consulta si ya se confirmó D1 antes.
        const old=await env.DB.prepare(DEDUPE_SELECT).bind(requestId).first();
        if(old){
          if(old.payload_mac!==mac||old.fingerprint!==fingerprint)
            return json({ok:false,error:'IDEMPOTENCY_CONFLICT'},409,origin);
          return json({ok:true,id:old.lead_id,stored:true,
            delivery:'database',duplicate:true},200,origin);
        }
        if(!await consumeRate(env.DB,fingerprint,clock()))
          return json({ok:false,error:'TOO_MANY_REQUESTS'},429,origin);
        const id=uuid(),at=new Date(clock()).toISOString();
        const row=await persistIdempotentLead(env.DB,v.value,requestId,mac,fingerprint,id,at);
        if(row.payload_mac!==mac||row.fingerprint!==fingerprint)
          return json({ok:false,error:'IDEMPOTENCY_CONFLICT'},409,origin);
        const duplicate=row.lead_id!==id;
        return json({ok:true,id:row.lead_id,stored:true,
          delivery:'database',...(duplicate?{duplicate:true}:{})},duplicate?200:201,origin);
      }
      if(!await consumeRate(env.DB,fingerprint,clock()))
        return json({ok:false,error:'TOO_MANY_REQUESTS'},429,origin);
      const id=uuid(),at=new Date(clock()).toISOString();
      await storeLead(env.DB,v.value,id,at);
      return json({ok:true,id,stored:true,delivery:'database'},201,origin);
    }catch{
      // Nunca confirmar recepción si la persistencia o rate-limit fallaron.
      return json({ok:false,error:'PERSISTENCE_UNAVAILABLE'},503,origin);
    }
  };
}
export async function scheduled(controller,env) {
  // No almacenar indefinidamente huellas HMAC de visitantes.
  // La marca de tiempo viene del scheduler de Cloudflare, no del navegador.
  if(!env?.DB)throw Error('D1 binding missing for rate-limit cleanup');
  const when=controller?.scheduledTime;
  if(!Number.isFinite(when))throw Error('Invalid scheduled time');
  const cutoff=Math.floor(when/ISO_HOUR)-48; // Retención máxima aproximada: 48-49 horas
  const result=await env.DB.prepare(
    'DELETE FROM lead_rate_limit WHERE hour_bucket < ?'
  ).bind(cutoff).run();
  if(result?.success!==true)throw Error('Rate-limit cleanup not confirmed');
}
export default { fetch:createHandler(), scheduled };
