import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import worker,{createPublicHandler} from '../infra/fluynova-public-intake-worker/index.mjs';

const URL='https://candidate.example.invalid/api/contact';
const cfg=JSON.parse(readFileSync(
  fileURLToPath(new URL('../infra/fluynova-public-intake-worker/wrangler.jsonc',import.meta.url)),'utf8'));
const req=(path='/api/contact',method='POST')=>new Request(
  'https://candidate.example.invalid'+path,{method,body:method==='POST'?'{}':undefined});
const safe={...cfg.vars};

test('es Worker diferente, sin rutas, sin workers.dev, D1 ni secretos',()=>{
  assert.equal(cfg.name,'fluynova-public-intake-candidate');
  assert.notEqual(cfg.name,'fluynova-contact-staging-only');
  assert.equal(cfg.workers_dev,false);
  for(const key of ['routes','route','d1_databases','triggers','account_id'])
    assert.equal(cfg[key],undefined,key+' no debe configurarse');
  assert.equal(cfg.vars.ENABLE_PUBLIC_INTAKE,'false');
  assert.equal(cfg.vars.ENABLE_CONTACT_SUBMISSIONS,'false');
  assert.equal(cfg.vars.ALLOWED_ORIGINS,'https://fluynova-staging.invalid');
  assert.equal(cfg.vars.TURNSTILE_HOSTNAMES,'fluynova-staging.invalid');
  for(const key of ['TURNSTILE_SECRET_KEY','RATE_HASH_SECRET','cf_api_token','service_role'])
    assert.equal(JSON.stringify(cfg).includes(key),false);
  assert.equal(typeof worker.fetch,'function');
  assert.equal(worker.scheduled,undefined,'no exportar cron público');
});
test('ningún endpoint de lectura o administración alcanza la lógica de contacto',async()=>{
  let calls=0;
  const handler=createPublicHandler({contactHandler:async()=>{calls++;return new Response('UNSAFE')}});
  for(const path of ['/','/health','/admin','/api/leads','/api/contact/','/metrics',
                     '/api/contact?next=/admin']){
    const response=await handler(req(path),{
      ENABLE_PUBLIC_INTAKE:'true',ENABLE_CONTACT_SUBMISSIONS:'true'});
    assert.equal(response.status,path.startsWith('/api/contact?')?200:404);
  }
  // Query strings NO convierten la ruta /api/contact en otra ruta;
  // el handler interno recibe la query si el backend la permite.
  assert.equal(calls,1);
});
test('otros métodos HTTP nunca alcanzan el backend',async()=>{
  let calls=0;
  const handler=createPublicHandler({contactHandler:async()=>{calls++;return new Response('bad')}});
  for(const method of ['GET','HEAD','PUT','DELETE','PATCH']){
    const result=await handler(req('/api/contact',method),{
      ENABLE_PUBLIC_INTAKE:'true',ENABLE_CONTACT_SUBMISSIONS:'true'});
    assert.equal(result.status,405);
  }
  assert.equal(calls,0);
});
test('ambas compuertas deben estar explícitamente encendidas; 503 sin CORS',async()=>{
  let calls=0;
  const handler=createPublicHandler({contactHandler:async()=>{calls++;return new Response('bad')}});
  for(const first of [undefined,'false','TRUE','1','true']){
    for(const second of [undefined,'false','TRUE','1','true']){
      if(first==='true'&&second==='true')continue;
      const response=await handler(req(),{
        ENABLE_PUBLIC_INTAKE:first,ENABLE_CONTACT_SUBMISSIONS:second});
      assert.equal(response.status,503,first+'/'+second);
      assert.equal((await response.json()).error,'CONTACT_UNAVAILABLE');
      assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
      assert.equal(response.headers.get('Cache-Control'),'no-store');
    }
  }
  assert.equal(calls,0);
});
test('solo con doble activación delega POST y OPTIONS; no abre otras funciones',async()=>{
  const received=[];
  const handler=createPublicHandler({contactHandler:async(req,env)=>{
    received.push({method:req.method,env});return new Response('OK',{status:201})}});
  const env={ENABLE_PUBLIC_INTAKE:'true',ENABLE_CONTACT_SUBMISSIONS:'true'};
  assert.equal((await handler(req(),env)).status,201);
  assert.equal((await handler(req('/api/contact','OPTIONS'),env)).status,201);
  assert.deepEqual(received.map(r=>r.method),['POST','OPTIONS']);
  assert.equal(received[0].env,env);
});
