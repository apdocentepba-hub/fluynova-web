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

const ENTRY=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/index.mjs',import.meta.url));
const WORKER_DIR=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/',import.meta.url));
const SCHEMA=fileURLToPath(new URL('../infra/fluynova-contact-worker/schema.sql',import.meta.url));
const ENDPOINT='https://public-candidate.invalid/api/contact';
const ORIGIN='https://fluynova-lab.invalid';
const fakeLead={
 name:'Consulta Ficticia',email:'intake-test@example.invalid',
 organization:'Laboratorio ficticio',
 category:'Crear página web / catálogo digital',
 message:'Necesito un catálogo de prueba con datos inexistentes y sin correo.',
 consent:true,website:'',turnstile_token:'fake-ci-turnstile'
};
function request(data=fakeLead,{url=ENDPOINT,method='POST',origin=ORIGIN}={}){
 const headers={origin,'content-type':'application/json','cf-connecting-ip':'203.0.113.53'};
 const request={method,headers};
 if(method==='POST')request.body=JSON.stringify(data);
 return {url,request};
}
async function makeRuntime(bundle,flags,{siteverifySuccess=true,createLeads=true}={}){
 const fetchMock=createFetchMock();
 fetchMock.disableNetConnect();
 fetchMock.get('https://challenges.cloudflare.com')
  .intercept({method:'POST',path:'/turnstile/v0/siteverify'})
  .reply(200,JSON.stringify({success:siteverifySuccess,action:'contact',hostname:'fluynova-lab.invalid'}));
 const mf=new Miniflare({
  modules:true,scriptPath:bundle,cf:false,fetchMock,
  d1Databases:{DB:'fluynova-public-local-only'},
  bindings:{
   ENABLE_PUBLIC_INTAKE:flags.public,
   ENABLE_CONTACT_SUBMISSIONS:flags.contact,
   ALLOWED_ORIGINS:ORIGIN,
   TURNSTILE_HOSTNAMES:'fluynova-lab.invalid',
   TURNSTILE_SECRET_KEY:'TEST_SECRET_NEVER_REAL',
   RATE_HASH_SECRET:'TEST_HMAC_ISOLATED_NEVER_REAL'
  }
 });
 const db=await mf.getD1Database('DB');
 const statements=(await readFile(SCHEMA,'utf8')).replace(/^--.*$/gm,'')
  .split(';').map(x=>x.trim()).filter(Boolean);
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
   console.log('PUBLIC_INTAKE_LOCAL_PASS: workerd=true, d1_local=true, siteverify_mock=true, remote=false');
  }finally{await mf.dispose()}
 }finally{await rm(dir,{recursive:true,force:true})}
});
