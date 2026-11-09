/**
 * Integración de receptor público separado: workerd + D1 LOCAL real.
 * Sin dominio, claves reales ni Cloudflare remoto; Siteverify es interceptado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
import {dispatchOnePendingNotice,recordVerifiedDeliveryEvent,recordVerifiedBounceEvent,markStaleSendingUncertain} from '../infra/fluynova-public-intake-worker/mail-notification.mjs';
import {readMailAdminSnapshot,renderOfflineMailAdminHtml} from '../infra/fluynova-public-intake-worker/mail-admin-report.mjs';

const ENTRY=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/index.mjs',import.meta.url));
const WORKER_DIR=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/',import.meta.url));
const SCHEMA=fileURLToPath(new URL('../infra/fluynova-contact-worker/schema.sql',import.meta.url));
const IDEMPOTENCY_SCHEMA=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/idempotency.schema.sql',import.meta.url));
const MAIL_SCHEMA=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/mail-outbox.schema.sql',import.meta.url));
const ENDPOINT='https://public-candidate.invalid/api/contact';
const ORIGIN='https://fluynova-lab.invalid';
const fakeLead={
 name:'Consulta Ficticia',email:'intake-test@example.invalid',
 organization:'Laboratorio ficticio',
 category:'Crear página web / catálogo digital',
 message:'Necesito un catálogo de prueba con datos inexistentes y sin correo.',
 consent:true,website:'',turnstile_token:'fake-ci-turnstile',
 request_id:'65d37f9e-1500-44cd-b3ab-4cc8dbec6b9d'
};
function request(data=fakeLead,{url=ENDPOINT,method='POST',origin=ORIGIN}={}){
 const headers={origin,'content-type':'application/json','cf-connecting-ip':'203.0.113.53'};
 const request={method,headers};
 if(method==='POST')request.body=JSON.stringify(data);
 return {url,request};
}
async function makeRuntime(bundle,flags,{siteverifySuccess=true,createLeads=true,createIdempotency=true,createMailOutbox=true}={}){
 const fetchMock=createFetchMock();
 fetchMock.disableNetConnect();
 fetchMock.get('https://challenges.cloudflare.com')
  .intercept({method:'POST',path:'/turnstile/v0/siteverify'})
  .reply(200,JSON.stringify({success:siteverifySuccess,action:'contact',hostname:'fluynova-lab.invalid'})).persist();
 const mf=new Miniflare({
  modules:true,scriptPath:bundle,cf:false,fetchMock,
  d1Databases:{DB:'fluynova-public-local-only'},
  bindings:{
   ENABLE_PUBLIC_INTAKE:flags.public,
   ENABLE_CONTACT_SUBMISSIONS:flags.contact,
   ENABLE_MAIL_OUTBOX:flags.mail==='true'?'true':'false',
   ALLOWED_ORIGINS:ORIGIN,
   TURNSTILE_HOSTNAMES:'fluynova-lab.invalid',
   TURNSTILE_SECRET_KEY:'TEST_SECRET_NEVER_REAL',
   RATE_HASH_SECRET:'TEST_HMAC_ISOLATED_NEVER_REAL'
  }
 });
 const db=await mf.getD1Database('DB');
 const statements=(await readFile(SCHEMA,'utf8')).replace(/^--.*$/gm,'')
  .split(';').map(x=>x.trim()).filter(Boolean);
 if(createIdempotency){
  const dedupe=(await readFile(IDEMPOTENCY_SCHEMA,'utf8')).replace(/^--.*$/gm,'')
    .split(';').map(x=>x.trim()).filter(Boolean);
  statements.push(...dedupe);
 }
 if(createMailOutbox) {
  const mail=(await readFile(MAIL_SCHEMA,'utf8')).replace(/^--.*$/gm,'')
    .split(';').map(x=>x.trim()).filter(Boolean);
  statements.push(...mail);
 }
 for(const sql of statements){
  if(!createLeads && (/^CREATE TABLE IF NOT EXISTS leads\b/i.test(sql)||
     /^CREATE INDEX IF NOT EXISTS leads_/i.test(sql)))continue;
  await db.prepare(sql).run();
 }
 return {mf,db};
}
test('workerd+D1 real local: puertas cerradas, ninguna API privada y POST confirmado tras SQL',async()=>{
 // workerd rechaza módulos ubicados fuera del directorio base (por ejemplo /tmp).
 const dir=await mkdtemp(join(WORKER_DIR,'.fluynova-ci-intake-'));
 try{
  const bundle=join(dir,'worker.mjs');
  await build({entryPoints:[ENTRY],outfile:bundle,bundle:true,format:'esm',
    platform:'browser',logLevel:'silent'});
  for(const flags of [
   {public:'false',contact:'false'},
   {public:'true',contact:'false'},
   {public:'false',contact:'true'}
  ]){
   const {mf,db}=await makeRuntime(bundle,flags);
   try{
    const {url,request:args}=request();
    const result=await mf.dispatchFetch(url,args);
    assert.equal(result.status,503,JSON.stringify(flags));
    assert.equal((await result.json()).error,'CONTACT_UNAVAILABLE');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal((await mf.dispatchFetch('https://public-candidate.invalid/admin')).status,404);
    assert.equal((await mf.dispatchFetch('https://public-candidate.invalid/health')).status,404);
   }finally{await mf.dispose()}
  }
  // CAPTCHA inválido: Siteverify se llama de verdad al mock; no se crea ninguna fila.
  {
   const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true'},
     {siteverifySuccess:false});
   try{
    const {url,request:args}=request();
    const rejected=await mf.dispatchFetch(url,args);
    assert.equal(rejected.status,403);
    assert.equal((await rejected.json()).error,'CAPTCHA_FAILED');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_rate_limit').first()).n,0);
    console.log('PUBLIC_INTAKE_CAPTCHA_REJECT_PASS: stored=false, rate_limit_writes=false');
   }finally{await mf.dispose()}
  }
  // D1 funcional para rate limit pero sin tabla leads: nunca confirmar falsamente.
  {
   const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true'},
     {createLeads:false});
   try{
    const {url,request:args}=request();
    const rejected=await mf.dispatchFetch(url,args);
    assert.equal(rejected.status,503);
    assert.equal((await rejected.json()).error,'PERSISTENCE_UNAVAILABLE');
    const tables=await db.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='leads'"
    ).first();
    assert.equal(tables.n,0);
    console.log('PUBLIC_INTAKE_DB_FAILURE_PASS: confirms=false, leads_table_absent=true');
   }finally{await mf.dispose()}
  }
  // Sin migración D1 idempotente, no se puede prometer almacenamiento.
  {
   const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true'},
     {createIdempotency:false});
   try{
    const {url,request:args}=request();
    const rejected=await mf.dispatchFetch(url,args);
    assert.equal(rejected.status,503);
    assert.equal((await rejected.json()).error,'PERSISTENCE_UNAVAILABLE');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_rate_limit').first()).n,0);
    console.log('IDEMPOTENCY_MIGRATION_MISSING_FAIL_CLOSED_PASS');
   }finally{await mf.dispose()}
  }
  // Reintentos simultáneos: dos respuestas válidas, una sola fila persistida.
  {
   const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true'});
   try{
    const {url}=request();
    const results=await Promise.all([
      mf.dispatchFetch(url,request().request),
      mf.dispatchFetch(url,request().request)
    ]);
    const bodies=await Promise.all(results.map(x=>x.json()));
    assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);
    assert.equal(bodies[0].id,bodies[1].id);
    assert.equal(bodies[0].stored,true);
    assert.equal(bodies[1].stored,true);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_idempotency').first()).n,1);
    console.log('PUBLIC_INTAKE_CONCURRENT_IDEMPOTENCY_PASS: one_lead=true');
   }finally{await mf.dispose()}
  }
  const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true'});
  try{
   const {url,request:args}=request();
   const invalid=await mf.dispatchFetch(url,request(fakeLead,{origin:'https://intruder.invalid'}).request);
   assert.equal(invalid.status,403);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
   const noRead=await mf.dispatchFetch('https://public-candidate.invalid/api/leads');
   assert.equal(noRead.status,404);
   const noHealth=await mf.dispatchFetch('https://public-candidate.invalid/health');
   assert.equal(noHealth.status,404);
   assert.equal((await mf.dispatchFetch(url,{method:'GET'})).status,405);
   const preflight=await mf.dispatchFetch(url,{method:'OPTIONS',headers:{origin:ORIGIN}});
   assert.equal(preflight.status,204);
   const saved=await mf.dispatchFetch(url,args);
   const body=await saved.json();
   assert.equal(saved.status,201,JSON.stringify(body));
   assert.equal(body.stored,true);
   assert.equal(body.delivery,'database');
   const row=await db.prepare('SELECT email,category,consent_at,status FROM leads WHERE id=?')
    .bind(body.id).first();
   assert.ok(row);
   assert.equal(row.email,'intake-test@example.invalid');
   assert.equal(row.status,'Nuevo');
   assert.equal(row.category,'Crear página web / catálogo digital');
   assert.ok(row.consent_at);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);
   const retry=await mf.dispatchFetch(url,request().request);
   assert.equal(retry.status,200,'Un reintento devuelve el ID existente');
   const repeated=await retry.json();
   assert.equal(repeated.id,body.id);
   assert.equal(repeated.duplicate,true);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_rate_limit').first()).n,1,
     'Un reintento confirmado no vuelve a consumir cuota');
   const changed=await mf.dispatchFetch(url,request({
     ...fakeLead,message:'Contenido distinto con la MISMA clave de intento'
   }).request);
   assert.equal(changed.status,409,'Clave repetida con contenido distinto es conflicto');
   assert.equal((await changed.json()).error,'IDEMPOTENCY_CONFLICT');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);
   const another=await mf.dispatchFetch(url,request({
     ...fakeLead,request_id:'8de76a69-b343-4322-9788-8429e542111a'
   }).request);
   assert.equal(another.status,201,'Otro ID representa nueva consulta legítima');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,2);
   // Verificar en Workerd + D1 LOCAL el scheduled real, sin modificar leads.
   const maintenanceAt=Date.UTC(2026,10,8,4,0,0);
   const currentHour=Math.floor(maintenanceAt/3_600_000);
   for(const [fingerprint,hour] of [
     ['ci-expired-hmac',currentHour-49],['ci-fresh-hmac',currentHour-48]
   ]){
    const inserted=await db.prepare(
      'INSERT INTO lead_rate_limit(fingerprint,hour_bucket,hits) VALUES(?,?,?)'
    ).bind(fingerprint,hour,1).run();
    assert.equal(inserted.success,true);
   }
   const staleId='2e4bc9d5-637f-4fad-a092-908304727a31';
   await db.prepare(
     'INSERT INTO lead_idempotency (request_id,payload_mac,fingerprint,lead_id,created_at) VALUES (?,?,?,?,?)'
   ).bind(staleId,'stale-test-hmac','stale-test-ip','stale-lead-ref',
     new Date(maintenanceAt-8*24*3_600_000).toISOString()).run();
   // La clave reciente debe conservarse; la vieja de 8 días debe caducar.
   const backgroundWorker=await mf.getWorker();
   const cronResult=await backgroundWorker.scheduled({
    scheduledTime:new Date(maintenanceAt),cron:'0 * * * *'
   });
   assert.equal(cronResult?.outcome,'ok',JSON.stringify(cronResult));
   assert.equal((await db.prepare(
     "SELECT COUNT(*) AS n FROM lead_rate_limit WHERE fingerprint='ci-expired-hmac'"
   ).first()).n,0,'El cron elimina bucket expirado');
   assert.equal((await db.prepare(
     "SELECT COUNT(*) AS n FROM lead_rate_limit WHERE fingerprint='ci-fresh-hmac'"
   ).first()).n,1,'El cron conserva bucket vigente');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,2,
     'El cron jamás borra consultas guardadas');
   assert.equal((await db.prepare(
     'SELECT COUNT(*) AS n FROM lead_idempotency WHERE request_id=?'
   ).bind(staleId).first()).n,0,'Eliminar clave idempotente de 8 días');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_idempotency').first()).n,2,
     'Conservar claves vigentes');
   console.log('PUBLIC_INTAKE_LOCAL_PASS: workerd=true, d1_local=true, siteverify_mock=true, scheduled_d1_local=true, remote=false');
  }finally{await mf.dispose()}
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('Workerd + D1 LOCAL: aviso encolado junto con lead; proveedor simulado nunca implica entrega',async()=>{
 const dir=await mkdtemp(join(WORKER_DIR,'.fluynova-mail-lab-'));
 try{
  const bundle=join(dir,'worker.mjs');
  await build({entryPoints:[ENTRY],outfile:bundle,bundle:true,format:'esm',
    platform:'browser',logLevel:'silent'});
  // Falta esquema de mail: el INSERT de lead y la reserva de UUID se revierten.
  {
   const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true',mail:'true'},
     {createMailOutbox:false});
   try{
    const {url,request:args}=request();
    const rejected=await mf.dispatchFetch(url,args);
    assert.equal(rejected.status,503);
    assert.equal((await rejected.json()).error,'PERSISTENCE_UNAVAILABLE');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_idempotency').first()).n,0);
   }finally{await mf.dispose()}
  }
  const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true',mail:'true'});
  try{
   const {url,request:args}=request();
   const response=await mf.dispatchFetch(url,args);
   const stored=await response.json();
   assert.equal(response.status,201,JSON.stringify(stored));
   assert.equal(stored.stored,true);
   assert.equal(stored.delivery,'database','El formulario no declara entrega por email');
   const queue=await db.prepare('SELECT lead_id,state,attempts FROM lead_mail_outbox').first();
   assert.equal(queue.lead_id,stored.id);
   assert.equal(queue.state,'pending');
   assert.equal(queue.attempts,0);
   const retry=await mf.dispatchFetch(url,request().request);
   assert.equal(retry.status,200);
   assert.equal((await retry.json()).id,stored.id);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_mail_outbox').first()).n,1);

   let calls=0,payload;
   const mockEmail={async send(x){calls++;payload=x;return {messageId:'ci-accepted-only-123'}}};
   const options={db,emailBinding:mockEmail,from:'avisos@fluynova.invalid',
     now:()=> '2026-11-09T10:30:00.000Z'};
   const disabled=await dispatchOnePendingNotice({...options,enabled:false});
   assert.equal(disabled.state,'disabled');
   assert.equal(calls,0);
   const done=await dispatchOnePendingNotice({...options,enabled:true});
   assert.equal(done.state,'accepted');
   assert.equal(done.providerAccepted,true);
   assert.equal(done.mailDelivered,false);
   assert.equal(calls,1);
   assert.equal(payload.to,'contacto.fluynova@gmail.com');
   assert.match(payload.subject,/FLUYNOVA/);
   assert.match(payload.text,/intake-test@example.invalid/);
   assert.equal(payload.html,undefined);
   const outbox=await db.prepare('SELECT state,attempts,provider_message_id FROM lead_mail_outbox').first();
   assert.equal(outbox.state,'accepted');
   assert.equal(outbox.attempts,1);
   assert.equal(outbox.provider_message_id,'ci-accepted-only-123');
   assert.equal((await dispatchOnePendingNotice({...options,enabled:true})).state,'empty');
   assert.equal(calls,1,'Nunca duplicar el aviso aceptado');

   // Sólo evento SMTP terminal de una Queue AUTENTICADA permite decir Delivered.
   const event={
     type:'cf.email.sending.message.delivered',
     source:{type:'email.sending',domain:'fluynova.invalid'},
     payload:{terminal:true,messageId:'ci-accepted-only-123',
       recipient:'contacto.fluynova@gmail.com',delivery:{status:'delivered'}}
   };
   const forged=await recordVerifiedDeliveryEvent({
     db,enabled:true,event:{...event,payload:{...event.payload,recipient:'intruder@example.invalid'}}
   });
   assert.equal(forged.state,'ignored');
   assert.equal((await db.prepare('SELECT state FROM lead_mail_outbox WHERE lead_id=?')
     .bind(stored.id).first()).state,'accepted');
   const disabledEvent=await recordVerifiedDeliveryEvent({db,enabled:false,event});
   assert.equal(disabledEvent.state,'disabled');
   const delivery=await recordVerifiedDeliveryEvent({db,enabled:true,event});
   assert.equal(delivery.state,'delivered');
   assert.equal(delivery.mailDelivered,true,'SMTP receptor aceptó el correo según Queue');
   assert.equal((await db.prepare('SELECT state FROM lead_mail_outbox WHERE lead_id=?')
     .bind(stored.id).first()).state,'delivered');
   assert.equal((await recordVerifiedDeliveryEvent({db,enabled:true,event})).state,
     'unknown-message','Un evento repetido no vuelve a modificar');
   assert.equal(calls,1,'La verificación SMTP nunca envía otro mail');

   // Fallo ambiguo: el proveedor pudo aceptar el mensaje antes del error.
   const second=await mf.dispatchFetch(url,request({
     ...fakeLead,request_id:'b09297e9-9360-41b9-8e63-0b2aeb3e7b03'
   }).request);
   assert.equal(second.status,201);
   const failed=await dispatchOnePendingNotice({
     ...options,enabled:true,
     emailBinding:{async send(){calls++;throw Error('TEST_PROVIDER_TIMEOUT_AFTER_ACCEPTANCE')}}
   });
   assert.equal(failed.state,'uncertain');
   assert.equal(failed.mailDelivered,false);
   assert.equal((await db.prepare(
     "SELECT COUNT(*) AS n FROM lead_mail_outbox WHERE state='uncertain'"
   ).first()).n,1);
   assert.equal((await dispatchOnePendingNotice({...options,enabled:true})).state,'empty');
   assert.equal(calls,2,'Una respuesta ambigua no se reintenta automáticamente');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,2);
   console.log('FLUYNOVA_MAIL_OUTBOX_LOCAL_PASS: leads=2, email_mock_calls=2, accepted_not_delivered=true, ambiguous_no_retry=true');
  }finally{await mf.dispose()}
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('Workerd+D1 LOCAL: cola sending interrumpida pasa a revisión y rebote SMTP no se reenvía',async()=>{
 const dir=await mkdtemp(join(WORKER_DIR,'.fluynova-mail-stale-lab-'));
 try{
  const bundle=join(dir,'worker.mjs');
  await build({entryPoints:[ENTRY],outfile:bundle,bundle:true,format:'esm',
    platform:'browser',logLevel:'silent'});
  const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true',mail:'true'});
  try{
   const uuids=[
    fakeLead.request_id,
    'b09297e9-9360-41b9-8e63-0b2aeb3e7b03',
    'e27ee346-aeb0-43ad-95c6-81e179c2b4de',
    'c1023a3b-8c86-4c9e-bf65-09f1f3bb9159'
   ];
   for(const request_id of uuids){
    const {url,request:args}=request({...fakeLead,request_id});
    const result=await mf.dispatchFetch(url,args);
    assert.equal(result.status,201,await result.text());
   }
   assert.equal((await db.prepare(
    "SELECT COUNT(*) AS n FROM lead_mail_outbox WHERE state='pending'"
   ).first()).n,4);

   let emailCalls=0;
   const mockEmail={async send(){emailCalls++;return {messageId:'bounce-provider-ci-0001'}}};
   const options={db,emailBinding:mockEmail,from:'avisos@fluynova.invalid',
     enabled:true,now:()=> '2026-11-09T12:00:00.000Z'};
   const sent=await dispatchOnePendingNotice(options);
   assert.equal(sent.state,'accepted');
   assert.equal(emailCalls,1);

   const event={
    type:'cf.email.sending.message.bounced',
    source:{type:'email.sending',domain:'fluynova.invalid'},
    payload:{terminal:true,messageId:'bounce-provider-ci-0001',
      recipient:'contacto.fluynova@gmail.com',delivery:{status:'bounced'}}
   };
   assert.equal((await recordVerifiedBounceEvent({db,event,enabled:false})).state,'disabled');
   const mismatched=await recordVerifiedBounceEvent({db,enabled:true,
    event:{...event,payload:{...event.payload,recipient:'another@example.invalid'}}});
   assert.equal(mismatched.state,'ignored');
   const bounced=await recordVerifiedBounceEvent({db,event,enabled:true});
   assert.equal(bounced.state,'bounced');
   assert.equal(bounced.mailDelivered,false);
   assert.equal(bounced.leadId,sent.leadId);
   assert.equal((await recordVerifiedBounceEvent({db,event,enabled:true})).state,
    'unknown-message','Evento duplicado no cambia la cola');
   const storedBounce=await db.prepare(
    'SELECT state,attempts FROM lead_mail_outbox WHERE lead_id=?'
   ).bind(sent.leadId).first();
   assert.deepEqual(storedBounce,{state:'bounced',attempts:1});

   const pending=(await db.prepare(
    "SELECT lead_id FROM lead_mail_outbox WHERE state='pending' ORDER BY lead_id"
   ).all()).results;
   assert.equal(pending.length,3);
   const old=pending[0].lead_id, fresh=pending[1].lead_id, untouched=pending[2].lead_id;
   await db.prepare(
    "UPDATE lead_mail_outbox SET state='sending',updated_at=? WHERE lead_id=?"
   ).bind('2026-11-09T10:00:00.000Z',old).run();
   await db.prepare(
    "UPDATE lead_mail_outbox SET state='sending',updated_at=? WHERE lead_id=?"
   ).bind('2026-11-09T11:55:00.000Z',fresh).run();
   const disabled=await markStaleSendingUncertain({db,enabled:false});
   assert.equal(disabled.marked,0);
   await assert.rejects(
    markStaleSendingUncertain({db,enabled:true,olderThanMinutes:0}),
    /MAIL_STALE_WINDOW_INVALID/);
   const result=await markStaleSendingUncertain({db,enabled:true,
    now:()=> '2026-11-09T12:00:00.000Z',olderThanMinutes:30});
   assert.equal(result.marked,1);
   assert.equal(result.state,'review-needed');
   assert.equal(result.mailDelivered,false);
   const statuses=(await db.prepare(
    "SELECT lead_id,state FROM lead_mail_outbox WHERE lead_id IN (?,?,?)"
   ).bind(old,fresh,untouched).all()).results;
   const byId=new Map(statuses.map(row=>[row.lead_id,row.state]));
   assert.equal(byId.get(old),'uncertain','Antiguo sending exige revisión');
   assert.equal(byId.get(fresh),'sending','Sending reciente no debe alterarse');
   assert.equal(byId.get(untouched),'pending','Un envío aún pendiente no debe alterarse');
   assert.equal((await markStaleSendingUncertain({
    db,enabled:true,now:()=> '2026-11-09T12:00:00.000Z'
   })).marked,0);
   assert.equal(emailCalls,1,'El reconciliador nunca llama al proveedor');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,4);
   console.log('FLUYNOVA_MAIL_STALE_BOUNCE_LOCAL_PASS: bounced=1, stale_to_uncertain=1, sends=1, leads=4, remote=false');
  }finally{await mf.dispose()}
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('D1 LOCAL: resumen administrativo de estados reales sin datos personales ni HTTP',async()=>{
 const dir=await mkdtemp(join(WORKER_DIR,'.fluynova-admin-local-'));
 try{
  const bundle=join(dir,'worker.mjs');
  await build({entryPoints:[ENTRY],outfile:bundle,bundle:true,
   format:'esm',platform:'browser',logLevel:'silent'});
  const {mf,db}=await makeRuntime(bundle,{public:'true',contact:'true',mail:'true'});
  try{
   const ids=[
    fakeLead.request_id,
    'b09297e9-9360-41b9-8e63-0b2aeb3e7b03',
    'e27ee346-aeb0-43ad-95c6-81e179c2b4de',
    'c1023a3b-8c86-4c9e-bf65-09f1f3bb9159'
   ];
   const leadIds=[];
   for(const request_id of ids) {
    const {url,request:args}=request({...fakeLead,request_id});
    const response=await mf.dispatchFetch(url,args);
    const body=await response.json();
    assert.equal(response.status,201,JSON.stringify(body));
    leadIds.push(body.id);
   }
   for(const [id,state] of [
    [leadIds[0],'delivered'],
    [leadIds[1],'uncertain'],
    [leadIds[2],'bounced']
   ]) {
    const r=await db.prepare('UPDATE lead_mail_outbox SET state=? WHERE lead_id=?')
      .bind(state,id).run();
    assert.equal(r.success,true);
   }
   const queries=[];
   const aggregateOnlyDb={prepare(sql){queries.push(sql);return db.prepare(sql)}};
   const snapshot=await readMailAdminSnapshot(aggregateOnlyDb,{
    now:()=> '2026-11-09T14:15:00.000Z'
   });
   assert.deepEqual(snapshot.counts,{
    pending:1,sending:0,accepted:0,delivered:1,bounced:1,uncertain:1
   });
   assert.equal(snapshot.total,4);
   assert.equal(snapshot.needsReview,2);
   assert.deepEqual(queries,[
    'SELECT state, COUNT(*) AS total FROM lead_mail_outbox GROUP BY state ORDER BY state'
   ]);
   const html=renderOfflineMailAdminHtml(snapshot);
   for(const sensitive of ['intake-test@example.invalid','Consulta Ficticia',
    'Necesito un catálogo','203.0.113.53',...leadIds])
    assert.equal(html.includes(sensitive),false,'No exponer '+sensitive);
   assert.equal(html.includes('<script'),false);
   assert.equal((await mf.dispatchFetch('https://public-candidate.invalid/admin')).status,404);
   assert.equal((await mf.dispatchFetch('https://public-candidate.invalid/api/admin/mail')).status,404);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,4,
    'El informe nunca borra consultas');
   console.log('FLUYNOVA_ADMIN_SUMMARY_D1_LOCAL_PASS: rows=4, states=6, review=2, pii=false, public_route=404');
  }finally{await mf.dispose()}
 }finally{await rm(dir,{recursive:true,force:true})}
});
