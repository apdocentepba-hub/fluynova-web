import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import worker,{createPublicHandler} from '../infra/fluynova-public-intake-worker/index.mjs';

const cfg=JSON.parse(readFileSync(
  fileURLToPath(new URL('../infra/fluynova-public-intake-worker/wrangler.jsonc',import.meta.url)),'utf8'));
const req=(path='/api/contact',method='POST')=>new Request(
  'https://candidate.example.invalid'+path,{method,body:method==='POST'?'{}':undefined});
const safe={...cfg.vars};

test('es Worker diferente, sin rutas, sin workers.dev, D1 ni valores de secretos',()=>{
  assert.equal(cfg.name,'fluynova-public-intake-candidate');
  assert.notEqual(cfg.name,'fluynova-contact-staging-only');
  assert.equal(cfg.workers_dev,false);
  assert.equal(cfg.preview_urls,false);
  for(const key of ['routes','route','d1_databases','triggers','account_id'])
    assert.equal(cfg[key],undefined,key+' no debe configurarse');
  assert.equal(cfg.vars.ENABLE_PUBLIC_INTAKE,'false');
  assert.equal(cfg.vars.ENABLE_CONTACT_SUBMISSIONS,'false');
  assert.equal(cfg.vars.ALLOWED_ORIGINS,'https://fluynova-staging.invalid');
  assert.equal(cfg.vars.TURNSTILE_HOSTNAMES,'fluynova-staging.invalid');
  assert.deepEqual([...cfg.secrets.required].sort(),
    ['RATE_HASH_SECRET','TURNSTILE_SECRET_KEY']);
  assert.deepEqual(Object.keys(cfg.secrets),['required']);
  for(const key of cfg.secrets.required)
    assert.equal(cfg.vars[key],undefined,'Nunca se guardan valores de secretos en vars');
  for(const key of ['cf_api_token','service_role'])
    assert.equal(JSON.stringify(cfg).includes(key),false);
  assert.equal(typeof worker.fetch,'function');
  assert.equal(typeof worker.scheduled,'function','handler disponible sin triggers remotos');
  assert.equal(cfg.triggers,undefined,'sin programar cron ni alterar Cloudflare');
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

test('scheduled: limpia solo fingerprints viejos mediante SQL parametrizado, sin leer clientes',async()=>{
 const at=Date.UTC(2026,10,8,4,0,0);
 const prepared=[];
 const db={
  prepare(statement){
   const record={statement};
   prepared.push(record);
   return {
    bind(value){
     record.cutoff=value;
     return {run:async()=>({success:true})};
    }
   };
  }
 };
 const output=await worker.scheduled({scheduledTime:at},{DB:db});
 assert.equal(output,undefined);
 assert.equal(prepared.length,2);
 assert.equal(prepared[0].statement,
   'DELETE FROM lead_rate_limit WHERE hour_bucket < ?');
 assert.equal(prepared[0].cutoff,Math.floor(at/3_600_000)-48);
 assert.equal(prepared[1].statement,
   'DELETE FROM lead_idempotency WHERE created_at < ?');
 assert.equal(prepared[1].cutoff,new Date(at-7*24*3_600_000).toISOString());
 assert.ok(prepared.every(x=>!/DELETE FROM leads\\b/.test(x.statement)));
 assert.equal(cfg.triggers,undefined);
});

test('scheduled: falla cerrado sin D1, reloj válido o confirmación de limpieza',async()=>{
 await assert.rejects(worker.scheduled({scheduledTime:Date.now()},{}),
   /D1 binding missing/);
 await assert.rejects(worker.scheduled({scheduledTime:NaN},{DB:{prepare(){throw Error('No tocar DB');}}}),
   /Invalid scheduled time/);
 const database={prepare(){return {bind(){return {run:async()=>({success:false})};}}}};
 await assert.rejects(worker.scheduled({scheduledTime:Date.UTC(2026,10,8)},{DB:database}),
   /Rate-limit cleanup not confirmed/);
 let calls=0;
 const badDedupe={
   prepare(){calls++;return {bind(){return {run:async()=>({success:calls===1})};}}}
 };
 await assert.rejects(worker.scheduled({scheduledTime:Date.UTC(2026,10,8)},{DB:badDedupe}),
   /Idempotency cleanup not confirmed/);
});
