/**
 * FLUYNOVA — pruebas de JWT Access RS256 CRIPTOGRÁFICO real con jose,
 * Worker real Workerd y D1 SOLO LOCAL. No contacta a Cloudflare, Gmail o
 * ninguna red externa; JWKS se sirve con fetchMock.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
import {SignJWT,generateKeyPair,exportJWK} from 'jose';

const DIR=fileURLToPath(new URL('./',import.meta.url));
const ENTRY=fileURLToPath(new URL('./index.mjs',import.meta.url));
const BASE=fileURLToPath(new URL('../fluynova-contact-worker/schema.sql',import.meta.url));
const MAIL=fileURLToPath(new URL('../fluynova-public-intake-worker/mail-outbox.schema.sql',import.meta.url));
const TEAM='https://fluynova-ci.cloudflareaccess.com';
const AUD='a'.repeat(64);
const SUB='7335d417-61da-459d-899c-0a01c76a2f94';
const ENDPOINT='https://fluynova-admin-ci.invalid/api/admin/mail-summary';
let mf,db,privateKey,workerDir;
const disabledConfig={
 ADMIN_READ_ENABLED:'false',
 ACCESS_TEAM_DOMAIN:TEAM,
 ACCESS_AUD:AUD,
 ADMIN_ALLOWED_SUBJECT:SUB
};
const enabledConfig={...disabledConfig,ADMIN_READ_ENABLED:'true'};

async function setupSql(path){
 const sql=(await readFile(path,'utf8')).replace(/^--.*$/gm,'')
   .split(';').map(x=>x.trim()).filter(Boolean);
 for(const stmt of sql){
  const r=await db.prepare(stmt).run();
  assert.equal(r.success,true);
 }
}
before(async()=>{
 const pair=await generateKeyPair('RS256',{extractable:true});
 privateKey=pair.privateKey;
 const jwk=await exportJWK(pair.publicKey);
 Object.assign(jwk,{kid:'ci-admin-key-1',alg:'RS256',use:'sig'});
 const fetchMock=createFetchMock();
 fetchMock.disableNetConnect();
 fetchMock.get(TEAM)
  .intercept({method:'GET',path:'/cdn-cgi/access/certs'})
  .reply(200,JSON.stringify({keys:[jwk]}),{
   headers:{'content-type':'application/json'}
  }).persist();
 workerDir=await mkdtemp(join(DIR,'.admin-ci-'));
 const bundle=join(workerDir,'admin.mjs');
 await build({entryPoints:[ENTRY],outfile:bundle,bundle:true,
  platform:'browser',format:'esm',target:'es2022',logLevel:'silent'});
 mf=new Miniflare({
  modules:true,scriptPath:bundle,cf:false,fetchMock,
  d1Databases:{DB:'fluynova-admin-only-d1-local'},
  bindings:enabledConfig
 });
 db=await mf.getD1Database('DB');
 await setupSql(BASE);await setupSql(MAIL);
 const leadId='1b0c48d6-ad64-46e8-87e8-f758a6769c18';
 await db.prepare(
  'INSERT INTO leads(id,received_at,name,email,category,message,consent_at) VALUES(?,?,?,?,?,?,?)'
 ).bind(leadId,'2026-11-09T10:00:00Z','NOMBRE_FICTICIO_ULTRAPRIVADO',
  'supersecret-admin-ci@example.invalid','Crear página web / catálogo digital',
  'MENSAJE_SECRETO_ADMIN_CI','2026-11-09T10:00:00Z').run();
 await db.prepare(
  "INSERT INTO lead_mail_outbox(lead_id,state,attempts,created_at,updated_at) "+
  "VALUES(?, 'uncertain',0,?,?)"
 ).bind(leadId,'2026-11-09T10:00:00Z','2026-11-09T10:00:00Z').run();
});
after(async()=>{await mf?.dispose();if(workerDir)await rm(workerDir,{recursive:true,force:true})});

async function token({
 issuer=TEAM,audience=AUD,sub=SUB,type='app',expired=false,
 future=false,algorithm='RS256',key=privateKey
}={}){
 const now=Math.floor(Date.now()/1000);
 let jwt=new SignJWT({sub,type,email:'ADMIN_EMAIL_SHOULD_NOT_LEAK@example.invalid'})
  .setProtectedHeader({alg:algorithm,kid:'ci-admin-key-1',typ:'JWT'})
  .setIssuer(issuer).setAudience(audience)
  .setIssuedAt(expired?now-7200:now)
  .setNotBefore(future?now+300:now-10)
  .setExpirationTime(expired?now-3600:now+3600);
 return jwt.sign(key);
}
async function dispatch({jwt,headers={},method='GET',url=ENDPOINT}={}){
 return mf.dispatchFetch(url,{
  method,headers:{
   ...(jwt?{'cf-access-jwt-assertion':jwt}:{}),...headers
  }
 });
}
test('puertas cerradas por defecto: Wrangler no publica rutas ni D1',async()=>{
 const cfg=JSON.parse(await readFile(new URL('./wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(cfg.vars.ADMIN_READ_ENABLED,'false');
 assert.equal(cfg.workers_dev,false);
 assert.equal(cfg.preview_urls,false);
 assert.deepEqual(cfg.observability,{enabled:false});
 assert.equal(cfg.routes,undefined);
 assert.equal(cfg.route,undefined);
 assert.equal(cfg.d1_databases,undefined);
 assert.equal(cfg.vars.ACCESS_TEAM_DOMAIN,undefined);
 assert.equal(cfg.vars.ACCESS_AUD,undefined);
 assert.equal(cfg.vars.ADMIN_ALLOWED_SUBJECT,undefined);
 const source=await readFile(ENTRY,'utf8');
 assert.doesNotMatch(source,/fluynova-contact-worker\/index\.mjs/);
 assert.doesNotMatch(source,/\b(?:insert|update|delete|drop|alter)\s+.*lead_mail_outbox/i);
});

test('API separada: cero rutas de contacto, salud o admin extra; sólo GET',async()=>{
 for(const path of ['/','/api/contact','/admin','/health','/api/leads','/api/admin/mail','/api/admin/mail-summary/']){
  const r=await dispatch({url:'https://fluynova-admin-ci.invalid'+path});
  assert.equal(r.status,404,path);
 }
 assert.equal((await dispatch({url:ENDPOINT+'?export=all'})).status,404);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  const r=await dispatch({method});
  assert.equal(r.status,405,method);
 }
});

test('sin JWT, token en cookie o formato inválido: HTTP 403 y cero PII',async()=>{
 for(const opts of [
  {},{headers:{cookie:'CF_Authorization=valid-looking-cookie'}},
  {jwt:'this.is.not.a.valid.jwt'},
  {jwt:'a'.repeat(8193)}
 ]){
  const r=await dispatch(opts);
  assert.equal(r.status,403,JSON.stringify(opts).slice(0,120));
  assert.equal((await r.json()).error,'ACCESS_DENIED');
  assert.match(r.headers.get('cache-control'),/no-store/);
 }
});

test('Access JWT válido RS256: sólo contadores de D1 local, sin PII',async()=>{
 const r=await dispatch({jwt:await token()});
 assert.equal(r.status,200,await r.text().then(x=>x.slice(0,300)));
 const json=await r.json();
 assert.equal(json.ok,true);
 assert.equal(json.total,1);
 assert.equal(json.needsReview,1);
 assert.equal(json.counts.uncertain,1);
 assert.equal(json.counts.pending,0);
 assert.equal(Object.keys(json.counts).length,6);
 assert.match(r.headers.get('cache-control'),/no-store/);
 assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);
 const raw=JSON.stringify(json);
 for(const secret of ['NOMBRE_FICTICIO_ULTRAPRIVADO',
  'supersecret-admin-ci@example.invalid','MENSAJE_SECRETO_ADMIN_CI',
  'ADMIN_EMAIL_SHOULD_NOT_LEAK@example.invalid',
  '1b0c48d6-ad64-46e8-87e8-f758a6769c18',SUB])
  assert.ok(!raw.includes(secret),'No exponer '+secret);
 console.log('FLUYNOVA_ADMIN_AUTH_LOCAL_PASS: real_jwt_rs256=true, d1_local=true, pii=false, external_net=0');
});

test('JWT firmado pero de otra identidad, otra app, otro emisor o expirado es denegado',async()=>{
 for(const claims of [
  {sub:'11111111-2222-4333-8444-555555555555'},
  {issuer:'https://other-team.cloudflareaccess.com'},
  {audience:'b'.repeat(64)},
  {type:'non_identity'},
  {expired:true},
  {future:true}
 ]){
  const r=await dispatch({jwt:await token(claims)});
  assert.equal(r.status,403,JSON.stringify(claims));
  assert.equal((await r.json()).error,'ACCESS_DENIED');
 }
});

test('JWT alterado criptográficamente no permite acceso a D1',async()=>{
 const good=await token();
 const segments=good.split('.');
 const fakePayload=JSON.parse(Buffer.from(segments[1],'base64url').toString('utf8'));
 fakePayload.sub=SUB;
 fakePayload.email='another-admin@example.invalid';
 segments[1]=Buffer.from(JSON.stringify(fakePayload)).toString('base64url');
 const r=await dispatch({jwt:segments.join('.')});
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,'ACCESS_DENIED');
});

test('si falta la tabla mail, D1 falla cerrada y no devuelve métricas inventadas',async()=>{
 const drop=await db.prepare('DROP TABLE lead_mail_outbox').run();
 assert.equal(drop.success,true);
 const r=await dispatch({jwt:await token()});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'ADMIN_REPORT_UNAVAILABLE');
 await setupSql(MAIL);
});

test('no hay permisos solo por JWT: sin config o sin DB se bloquea',async()=>{
 const cfg=await readFile(ENTRY,'utf8');
 assert.ok(cfg.includes("env.ADMIN_ALLOWED_SUBJECT"));
 assert.ok(cfg.includes("env.ACCESS_AUD"));
 assert.ok(cfg.includes("env.ACCESS_TEAM_DOMAIN"));
 assert.ok(cfg.includes("env.DB?.prepare"));
 // Test de configuración fail-closed aplicado al handler JS sin un mock
 // de identidad. Se importó directo para no tocar Wrangler remoto.
 const {fetchAdmin}=await import('./index.mjs');
 const bearer=await token();
 for(const env of [
  disabledConfig,
  {...enabledConfig,ADMIN_ALLOWED_SUBJECT:''},
  {...enabledConfig,ACCESS_AUD:''},
  {...enabledConfig,ACCESS_TEAM_DOMAIN:'http://evil.invalid'},
  {...enabledConfig,DB:null}
 ]){
  const r=await fetchAdmin(new Request(ENDPOINT,{headers:{
   'Cf-Access-Jwt-Assertion':bearer
  }}),env);
  assert.equal(r.status,503);
 }
});

test('sin datos personales en errores y sin CORS habilitado',async()=>{
 const r=await dispatch({jwt:'bad.jwt.token'});
 assert.equal(r.status,403);
 assert.equal(r.headers.get('access-control-allow-origin'),null);
 assert.equal(r.headers.get('access-control-allow-credentials'),null);
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.equal(r.headers.get('x-frame-options'),'DENY');
 assert.doesNotMatch(await r.text(),/Bearer|jwk|signature|gmail|cloudflareaccess/);
});
