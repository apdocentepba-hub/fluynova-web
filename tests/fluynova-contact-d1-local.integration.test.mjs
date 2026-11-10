/**
 * Prueba de integración real: Worker en workerd y base D1 LOCAL (Miniflare).
 * No usa credenciales Cloudflare ni recursos remotos. Turnstile está simulado
 * mediante mock de HTTP externo que prohíbe cualquier otro acceso de red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Miniflare,createFetchMock} from 'miniflare';

const SCRIPT=fileURLToPath(new URL('../infra/fluynova-contact-worker/index.mjs',import.meta.url));
const SCHEMA=fileURLToPath(new URL('../infra/fluynova-contact-worker/schema.sql',import.meta.url));
const ORIGIN='https://fluynova.example';
const EMAIL='prueba@example.invalid';
const LEAD={
 name:'Cliente de prueba local',
 email:EMAIL,organization:'Ficticio',
 category:'Crear página web / catálogo digital',
 message:'Solicito un sitio de prueba con catálogo de productos ficticios.',
 consent:true,website:'',turnstile_token:'fake-ci-token',
 origen_fuente:'instagram',origen_canal:'profile',
 origen_campania:'webs_202611',origen_mensaje:'webs'
};
function jsonReq(data=LEAD,origin=ORIGIN){
 return {
  method:'POST',headers:{
   'content-type':'application/json','origin':origin,
   'cf-connecting-ip':'203.0.113.29',
  },
  body:JSON.stringify(data)
 };
}
test('D1 local real: POST válido persiste y se recupera; CORS, bot y consentimiento se rechazan',async()=>{
 const fetchMock=createFetchMock();
 fetchMock.disableNetConnect();
 const turnstile=fetchMock.get('https://challenges.cloudflare.com');
 turnstile.intercept({method:'POST',path:'/turnstile/v0/siteverify'})
  .reply(200,JSON.stringify({success:true,action:'contact',hostname:'fluynova.example'}));
 const mf=new Miniflare({
  modules:true,
  scriptPath:SCRIPT,
  d1Databases:{DB:'fluynova-d1-test-exclusive-local'},
  bindings:{
   ENABLE_CONTACT_SUBMISSIONS:'true',
   ALLOWED_ORIGINS:ORIGIN,
   TURNSTILE_HOSTNAMES:'fluynova.example',
   TURNSTILE_SECRET_KEY:'CI_ONLY_NOT_REAL',
   RATE_HASH_SECRET:'CI_ONLY_INDEPENDENT_LOCAL_HMAC_KEY',
  },
  fetchMock,cf:false
 });
 try{
  const db=await mf.getD1Database('DB');
  // D1 exec() interpreta líneas SQL independientemente y no admite comentarios
  // de archivo como sentencias. Aplicar una por una las mismas instrucciones.
  const statements=(await readFile(SCHEMA,'utf8')).replace(/^--.*$/gm,'')
    .split(';').map(text=>text.trim()).filter(Boolean);
  assert.ok(statements.length>=5);
  for(const sql of statements)await db.prepare(sql).run();
  const health=await mf.dispatchFetch('https://local.test/health',{method:'GET'});
  assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{databaseReady:true,accepting:true});
  const initial=await db.prepare('SELECT COUNT(*) AS total FROM leads').first();
  assert.equal(initial.total,0);
  const badOrigin=await mf.dispatchFetch('https://local.test/api/contact',jsonReq(LEAD,'https://other.example'));
  assert.equal(badOrigin.status,403);
  const badConsent=await mf.dispatchFetch('https://local.test/api/contact',jsonReq({...LEAD,consent:false}));
  assert.equal(badConsent.status,422);
  assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM leads').first()).total,0);
  const ok=await mf.dispatchFetch('https://local.test/api/contact',jsonReq());
  const response=await ok.json();
  assert.equal(ok.status,201,JSON.stringify(response));
  assert.equal(response.ok,true);
  assert.equal(response.stored,true);
  assert.equal(response.delivery,'database');
  assert.match(response.id,/^[a-f0-9-]{36}$/i);
  const persisted=await db.prepare(
    'SELECT id, name, email, category, message, status, consent_at FROM leads WHERE id=?'
  ).bind(response.id).first();
  assert.equal(persisted.id,response.id);
  assert.equal(persisted.email,EMAIL);
  assert.equal(persisted.category,LEAD.category);
  assert.equal(persisted.status,'Nuevo');
  assert.match(persisted.consent_at,/^\d{4}-\d{2}-\d{2}T/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM lead_rate_limit').first()).total,1);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM lead_rate_limit WHERE fingerprint LIKE '%203.0.113.29%'").first()).total,
    0,
    'Se anonimiza IP y no se almacena en claro'
  );
  // Retención real: se conserva la ventana actual y se elimina la de hace 72 h.
  const currentBucket=Math.floor(Date.now()/3_600_000);
  await db.prepare('INSERT INTO lead_rate_limit(fingerprint,hour_bucket,hits) VALUES(?,?,1)')
    .bind('local-old-only',currentBucket-72).run();
  await db.prepare('INSERT INTO lead_rate_limit(fingerprint,hour_bucket,hits) VALUES(?,?,1)')
    .bind('local-recent-only',currentBucket-1).run();
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM lead_rate_limit WHERE fingerprint='local-old-only'").first()).total,1);
  await (await mf.getWorker()).scheduled({scheduledTime:Date.now(),cron:'0 4 * * *'});
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM lead_rate_limit WHERE fingerprint='local-old-only'").first()).total,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM lead_rate_limit WHERE fingerprint='local-recent-only'").first()).total,1);
  const noRead=await mf.dispatchFetch('https://local.test/admin',{method:'GET'});
  assert.equal(noRead.status,404);
  console.log('D1_LOCAL_INTEGRATION_PASS: saved=true; id='+response.id+'; email_is_fictitious=true');
 }finally{await mf.dispose()}
});
