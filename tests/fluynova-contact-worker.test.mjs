import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,allowedOrigins,validateLead,scheduled} from '../infra/fluynova-contact-worker/index.mjs';

const ORIGIN='https://fluynova.example';
const ENDPOINT='https://contact-fluynova.example.workers.dev/api/contact';
const LEAD=Object.freeze({
 name:'Cliente de prueba',email:'prueba@example.invalid',
 organization:'Prueba',category:'Crear página web / catálogo digital',
 message:'Necesito una página de prueba con catálogo y contacto.',
 consent:true,website:'',turnstile_token:'valid-token',
 origen_fuente:'instagram',origen_canal:'profile',
 origen_campania:'webs_202611',origen_mensaje:'webs',
});
const ENV={
 ENABLE_CONTACT_SUBMISSIONS:'true',
 ALLOWED_ORIGINS:ORIGIN,
 TURNSTILE_SECRET_KEY:'secret_only_in_test',
 TURNSTILE_HOSTNAMES:'fluynova.example',
 RATE_HASH_SECRET:'independent_test_secret',
};
function makeDb({fail=false}={}){
 const db={leads:[],rateKeys:[],hits:new Map(),queries:[]};
 db.prepare=sql=>{
  db.queries.push(sql);
  return {bind(...params){
   return {
    async first(){
     assert.match(sql,/INSERT INTO lead_rate_limit/);
     db.rateKeys.push(params[0]);
     const key=params.join('|');const next=(db.hits.get(key)||0)+1;
     db.hits.set(key,next);return {hits:next};
    },
    async run(){
     assert.match(sql,/INSERT INTO leads/);
     if(fail)return {success:false};
     db.leads.push(params);return {success:true};
    }
   }
  }};
 };
 return db;
}
function makeReq(payload=LEAD,{origin=ORIGIN,method='POST',ip='203.0.113.8',contentType='application/json'}={}){
 const headers={'Origin':origin,'CF-Connecting-IP':ip,'Content-Type':contentType};
 const options={method,headers};
 if(method!=='GET'&&method!=='OPTIONS')options.body=JSON.stringify(payload);
 return new Request(ENDPOINT,options);
}
function setup({db=makeDb(),validation={success:true,action:'contact',hostname:'fluynova.example'},env={},clock=()=>1762550000000}={}){
 let verifications=0;
 const handler=createHandler({
   fetcher:async(url,opts)=>{
    assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(opts.method,'POST');
    assert.equal(opts.body.get('secret'),ENV.TURNSTILE_SECRET_KEY);
    verifications++;
    return new Response(JSON.stringify(validation),{status:200});
   },
   clock,
   uuid:()=> 'e8b4b94c-1ddc-4e32-9964-c77d3c661c23'
 });
 return {db,env:{...ENV,DB:db,...env},handler,verifications:()=>verifications};
}
test('rechaza orígenes mal formados o sin HTTPS sin usar comodines',()=>{
 const x=allowedOrigins({ALLOWED_ORIGINS:'https://fluynova.example,http://unsafe.test,*,https://fluynova.example/path'});
 assert.equal(x.size,1);assert.equal(x.has(ORIGIN),true);
});
test('el formulario web original y categorías se validan sin guardar datos sensibles extra',()=>{
 assert.equal(validateLead(LEAD).value.category,'Crear página web / catálogo digital');
 assert.equal(validateLead({...LEAD,category:'Nada conocido'}).error,'Categoría inválida');
 assert.equal(validateLead({...LEAD,consent:false}).error,'Se requiere consentimiento');
 assert.equal(validateLead({...LEAD,email:'equivocado'}).error,'Correo inválido');
 assert.equal(validateLead({...LEAD,message:'corto'}).error,'Mensaje inválido');
});
test('acepta solamente después de guardar en D1 (POST 201 con id)',async()=>{
 const x=setup();
 const r=await x.handler(makeReq(),x.env),body=await r.json();
 assert.equal(r.status,201);assert.equal(body.ok,true);
 assert.equal(body.stored,true);assert.equal(body.delivery,'database');
 assert.equal(x.db.leads.length,1);
 assert.equal(x.db.leads[0][5],LEAD.category);
 assert.equal(x.db.leads[0][3],LEAD.email);
 assert.equal(x.verifications(),1);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.equal(r.headers.get('Cache-Control'),'no-store');
 assert.equal(x.db.rateKeys[0].includes('203.0.113.8'),false,'IP no debe almacenarse en claro');
});
test('no expone CORS a orígenes desconocidos ni toca la base',async()=>{
 const x=setup(),r=await x.handler(makeReq(LEAD,{origin:'https://other.example'}),x.env);
 assert.equal(r.status,403);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 assert.equal(x.db.leads.length,0);assert.equal(x.verifications(),0);
});
test('preflight está limitado al origen exacto y método POST',async()=>{
 const x=setup(),r=await x.handler(makeReq(undefined,{method:'OPTIONS'}),x.env);
 assert.equal(r.status,204);
 assert.equal(r.headers.get('Access-Control-Allow-Methods'),'POST, OPTIONS');
 assert.equal((await x.handler(makeReq(undefined,{method:'OPTIONS',origin:'https://other.example'}),x.env)).status,403);
});
test('health comprueba D1 solo lectura e informa que no recibe sin flag',async()=>{
 const history=[];
 const db={prepare(sql){
   history.push(sql);
   assert.match(sql,/SELECT COUNT\(\*\) AS total FROM sqlite_master/);
   return {first:async()=>({total:2})};
 }};
 const x=setup({env:{DB:db,ENABLE_CONTACT_SUBMISSIONS:'false'}});
 const result=await x.handler(new Request('https://example.invalid/health'),x.env);
 assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{databaseReady:true,accepting:false});
 assert.equal(history.length,1);
 assert.equal(x.verifications(),0);
});
test('health detecta DB rota sin escribir ni exponer detalles',async()=>{
 const x=setup({env:{DB:{prepare(){throw Error('Simulated DB failure')}}}});
 const result=await x.handler(new Request('https://example.invalid/health'),x.env);
 assert.equal(result.status,503);
 assert.deepEqual(await result.json(),{databaseReady:false,accepting:false});
});
test('flag de activación ausente o false: nunca procesa consultas reales',async()=>{
 for(const flag of [undefined,'false','TRUE','1']){
   const x=setup({env:{ENABLE_CONTACT_SUBMISSIONS:flag}});
   const r=await x.handler(makeReq(),x.env);
   assert.equal(r.status,503);
   assert.equal((await r.json()).error,'CONTACT_UNAVAILABLE');
   assert.equal(x.verifications(),0);
   assert.equal(x.db.leads.length,0);
 }
});
test('se cierra si faltan DB, CAPTCHA o secreto sin que haya envíos simulados',async()=>{
 for(const data of [{DB:null},{TURNSTILE_SECRET_KEY:''},{RATE_HASH_SECRET:''},{TURNSTILE_HOSTNAMES:''}]){
   const x=setup({env:data});
   const r=await x.handler(makeReq(),x.env);
   assert.equal(r.status,503,JSON.stringify(data));
   assert.equal(x.verifications(),0);
 }
});
test('sin consentimiento/categoría correcta o cuerpo válido no llama al proveedor',async()=>{
 const x=setup();
 for(const data of [{...LEAD,consent:false},{...LEAD,category:'intruso'}]){
  const r=await x.handler(makeReq(data),x.env);assert.equal(r.status,422);
 }
 assert.equal(x.verifications(),0);assert.equal(x.db.leads.length,0);
});
test('Turnstile expira o rechaza acción/hostname incorrecto: no se guarda',async()=>{
 for(const validation of [
  {success:false},{success:true,action:'otro',hostname:'fluynova.example'},
  {success:true,action:'contact',hostname:'phishing.example'}
 ]){
  const x=setup({validation}),r=await x.handler(makeReq(),x.env);
  assert.equal(r.status,403);assert.equal(x.db.leads.length,0);
 }
 const x=setup();
 const r=await x.handler(makeReq({...LEAD,turnstile_token:''}),x.env);
 assert.equal(r.status,403);assert.equal(x.verifications(),0);
});
test('limita a cinco consultas/hora por IP anonimizada',async()=>{
 const x=setup();
 const statuses=[];
 for(let n=0;n<6;n++){
  const r=await x.handler(makeReq(),x.env);
  statuses.push(r.status);
 }
 assert.deepEqual(statuses,[201,201,201,201,201,429]);
 assert.equal(x.db.leads.length,5);
});
test('si D1 no persiste, falla cerrado: nunca da confirmado',async()=>{
 const x=setup({db:makeDb({fail:true})});
 const r=await x.handler(makeReq(),x.env),result=await r.json();
 assert.equal(r.status,503);assert.equal(result.ok,false);assert.equal(x.db.leads.length,0);
});
test('limita tamaño del cuerpo y tipo de contenido',async()=>{
 const x=setup();
 const body={...LEAD,message:'x'.repeat(20000)};
 assert.equal((await x.handler(makeReq(body),x.env)).status,413);
 assert.equal((await x.handler(makeReq(LEAD,{contentType:'text/plain'}),x.env)).status,415);
 assert.equal(x.verifications(),0);
});
test('campos trampa no se guardan; no se finge que el correo salió',async()=>{
 const x=setup();
 const r=await x.handler(makeReq({...LEAD,website:'spam bot'}),x.env);
 assert.equal(r.status,422);
 assert.equal(x.db.leads.length,0);
 assert.equal(x.verifications(),0);
});
test('no hay API pública para ver correos o consultas',async()=>{
 const x=setup();
 const r=await x.handler(new Request('https://contact-fluynova.example.workers.dev/admin'),x.env);
 assert.equal(r.status,404);
 assert.equal(x.db.leads.length,0);
});


test('el cron elimina solo las huellas de rate-limit previas a 48 horas',async()=>{
 const queries=[],values=[];
 const db={prepare(sql){
  queries.push(sql);
  return {bind(...params){
   values.push(params);
   return {async run(){return {success:true}}};
  }};
 }};
 const hour=1762550000000;
 await scheduled({scheduledTime:hour},{DB:db});
 assert.match(queries[0],/^DELETE FROM lead_rate_limit WHERE hour_bucket < \?$/);
 assert.deepEqual(values[0],[Math.floor(hour/3_600_000)-48]);
});
test('el cron no oculta errores de D1 o reloj inválido',async()=>{
 await assert.rejects(scheduled({scheduledTime:Date.now()},{}),/D1 binding missing/);
 await assert.rejects(scheduled({scheduledTime:NaN},{DB:{}}),/Invalid scheduled time/);
 await assert.rejects(scheduled({scheduledTime:Date.now()},{DB:{
  prepare:()=>({bind:()=>({run:async()=>({success:false})})})
 }}),/cleanup not confirmed/);
});
