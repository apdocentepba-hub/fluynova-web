'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TARGETS,targetIsSafe,probe,checkAll}=require('./laboratorio-smoke.js');
const make=(status,html='FLUYNOVA',url=TARGETS[0].url)=>({status,url,headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>html});
test('cinco destinos específicos, HTTPS sin credenciales ni query privada',()=>{
 assert.equal(TARGETS.length,5);assert.ok(TARGETS.every(targetIsSafe));
 assert.equal(targetIsSafe({url:'http://example.com',expected:'X'}),false);
 assert.equal(targetIsSafe({url:'https://user:pass@fluynova-web.onrender.com/',expected:'X'}),false);
 assert.equal(targetIsSafe({url:'https://attacker.test/',expected:'X'}),false);
});
test('un HTTP 503 transitorio recuperado no se declara caída permanente',async()=>{
 let n=0;const target=TARGETS[0];
 const result=await probe(target,{fetcher:async()=>++n===1?make(503,'',target.url):make(200,'FLUYNOVA Ops',target.url),sleep:async()=>{}});
 assert.equal(result.ok,true);assert.deepEqual(result.observations,[503,200]);
});
test('HTTP 404 se registra como fallo sin reintento',async()=>{
 let called=0;const r=await probe(TARGETS[0],{fetcher:async()=>{called++;return make(404)},sleep:async()=>{}});
 assert.equal(r.ok,false);assert.equal(r.reason,'HTTP 404');assert.equal(called,1);
});
test('bloquea redirección a origen ajeno y HTML inesperado',async()=>{
 let r=await probe(TARGETS[0],{fetcher:async()=>make(200,'FLUYNOVA Ops','https://other.test/'),sleep:async()=>{}});
 assert.equal(r.ok,false);assert.equal(r.reason,'REDIRECCIÓN INESPERADA');
 r=await probe(TARGETS[0],{fetcher:async()=>make(200,'Sitio de otra empresa'),sleep:async()=>{}});
 assert.equal(r.ok,false);assert.equal(r.reason,'TÍTULO/CONTENIDO INESPERADO');
});
test('agotamiento de intentos y error de red se distinguen del contenido',async()=>{
 const r=await probe(TARGETS[0],{attempts:2,fetcher:async()=>{throw new Error('offline')},sleep:async()=>{}});
 assert.equal(r.reason,'RED/TIMEOUT');assert.equal(r.observations.length,2);
});
test('el resultado agregado no inventa éxitos de destinos que fallan',async()=>{
 const r=await checkAll({fetcher:async(url)=>make(url.includes('diagnostico')?503:200,'FLUYNOVA / Alba & Miga / Nórdica Pro / FLUYNOVA Ops',url),sleep:async()=>{}});
 assert.equal(r.length,5);assert.equal(r.filter(x=>x.ok).length,4);
 assert.equal(r.find(x=>x.label==='Diagnóstico comercial').ok,false);
});
