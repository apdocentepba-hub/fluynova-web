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

test('la allowlist rechaza otros subdominios válidos y tampering del marcador',()=>{
 assert.equal(targetIsSafe({label:'Falso',url:'https://untrusted.onrender.com/',expected:'FLUYNOVA'}),false);
 assert.equal(targetIsSafe({...TARGETS[0],expected:'cualquier texto'}),false);
 assert.equal(targetIsSafe({...TARGETS[0],url:'https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html?token=x'}),false);
 assert.equal(targetIsSafe({...TARGETS[0],url:'not a url'}),false);
});

test('las redirecciones se bloquean ANTES de seguirlas, aunque el destino sea mismo host',async()=>{
 let opts;
 const r=await probe(TARGETS[0],{fetcher:async(_url,o)=>{opts=o;return make(302,'','https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html')},sleep:async()=>{}});
 assert.equal(opts.redirect,'manual');
 assert.equal(r.reason,'REDIRECCIÓN INESPERADA');
 assert.deepEqual(r.observations,[302]);
});

test('rechaza HTML gigante declarado por Content-Length sin leerlo',async()=>{
 let read=false;
 const response={status:200,url:TARGETS[0].url,headers:{get:key=>key==='content-length'?'9999999':'text/html'},text:async()=>{read=true;return'FLUYNOVA Ops'}};
 const r=await probe(TARGETS[0],{fetcher:async()=>response,sleep:async()=>{}});
 assert.equal(r.ok,false);assert.equal(r.reason,'HTML DEMASIADO GRANDE');assert.equal(read,false);
});

test('corta el cuerpo si el stream excede el límite antes de descargarlo entero',async()=>{
 let pulls=0;
 const body=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(280000).fill(65));if(pulls>=4)controller.close();}});
 const r=await probe(TARGETS[0],{fetcher:async()=>({status:200,url:TARGETS[0].url,headers:{get:key=>key==='content-type'?'text/html':''},body}),sleep:async()=>{}});
 assert.equal(r.reason,'HTML DEMASIADO GRANDE');assert.equal(r.ok,false);
 assert.ok(pulls<=4);
});

test('la respuesta HTML pequeña por stream sigue dando PASS',async()=>{
 const bytes=new TextEncoder().encode('<html><title>FLUYNOVA Ops</title></html>');
 const body=new ReadableStream({start(c){c.enqueue(bytes);c.close()}});
 const r=await probe(TARGETS[0],{fetcher:async()=>({status:200,url:TARGETS[0].url,headers:{get:key=>key==='content-type'?'text/html':''},body}),sleep:async()=>{}});
 assert.equal(r.ok,true);
});

test('rechaza configuración sin timeout o con tiempo excesivo',async()=>{
 await assert.rejects(probe(TARGETS[0],{timeoutMs:60000}),{name:'TypeError'});
 await assert.rejects(probe(TARGETS[0],{attempts:0}),{name:'TypeError'});
});
