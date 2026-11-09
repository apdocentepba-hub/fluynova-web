import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {analyzeDocument,CopilotError,MODEL_SCHEMA} from './analysis.mjs';

const SOURCE='Factura A-0001-00000121\nProveedor: Proveedor Demo Norte\nOrden de compra: OC-1001\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
const FIELDS={
 supplier:'Proveedor Demo Norte',number:'A-0001-00000121',order:'OC-1001',
 net_cents:15000000,tax_cents:3150000,total_cents:18150000,
 explanation:'Los importes coinciden; revisar duplicado.',uncertainty:'No se verificó fuente externa.',
 evidence:['Factura A-0001-00000121','Proveedor: Proveedor Demo Norte']
};
function mockModel(data=FIELDS,opts={}) {
 let calls=0;
 const handler=async(url,init)=>{
  calls++;assert.equal(url,'http://127.0.0.1:11434/api/chat');
  assert.equal(init.method,'POST');assert.equal(init.headers['content-type'],'application/json');
  const body=JSON.parse(init.body);
  assert.equal(body.stream,false);assert.equal(body.model,'qwen3:1.7b');
  assert.deepEqual(body.format,MODEL_SCHEMA);
  assert.equal(body.messages.length,2);
  assert.match(body.messages[1].content,/Proveedor Demo Norte/);
  if(opts.unavailable)return new Response('down',{status:503});
  return new Response(JSON.stringify({message:{content:opts.raw??JSON.stringify(data)}}),{status:200});
 };
 return {handler,get calls(){return calls}};
}
test('IA devuelve extracción estructurada; duplicados se detectan por código, no IA',async()=>{
 const mock=mockModel();
 const r=await analyzeDocument(SOURCE,{fetchImpl:mock.handler});
 assert.equal(mock.calls,1);assert.equal(r.decision,'REQUIERE_REVISION_HUMANA');
 assert.equal(r.can_auto_approve,false);assert.equal(r.model_used,'qwen3:1.7b');
 assert.equal(r.extracted.total_cents,18150000);
 assert.ok(r.issues.some(x=>/duplicado/i.test(x)));
 assert.equal(r.extracted.evidence.length,2);
});
test('error de importe, orden ausente y falta de citas se señalan sin decisión automática',async()=>{
 const m=mockModel({...FIELDS,order:null,total_cents:18140000,evidence:['Texto inventado']});
 const r=await analyzeDocument(SOURCE,{fetchImpl:m.handler});
 assert.ok(r.issues.some(x=>/orden/i.test(x)));
 assert.ok(r.issues.some(x=>/Neto \+ impuestos/i.test(x)));
 assert.ok(r.issues.some(x=>/citas textuales/i.test(x)));
 assert.equal(r.extracted.evidence_rejected,1);assert.equal(r.can_auto_approve,false);
});
test('campos numéricos alucinados o estructura extra causan fallo seguro',async()=>{
 for(const malformed of [{...FIELDS,total_cents:'no es un número'},{...FIELDS,total_cents:-10},{...FIELDS,admin:true}]){
  const m=mockModel(malformed);
  await assert.rejects(analyzeDocument(SOURCE,{fetchImpl:m.handler}),
    e=>e instanceof CopilotError&&e.code==='AI_INVALID_RESPONSE'&&e.status===502);
 }
});
test('modelo no instalado responde 503, sin simular resultado',async()=>{
 const m=mockModel(FIELDS,{unavailable:true});
 await assert.rejects(analyzeDocument(SOURCE,{fetchImpl:m.handler}),
   e=>e.code==='AI_UNAVAILABLE'&&e.status===503);
});
test('timeout de inferencia es fallo explícito, nunca aprobación',async()=>{
 const hung=async(_url,init)=>new Promise((_resolve,reject)=>{
  init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
 });
 await assert.rejects(analyzeDocument(SOURCE,{fetchImpl:hung,timeoutMs:15}),
   e=>e.code==='AI_TIMEOUT'&&e.status===504);
});
test('entrada inválida bloqueada sin contactar Ollama',async()=>{
 const m=mockModel();
 for(const bad of ['hola','x'.repeat(6001),null]){
  await assert.rejects(analyzeDocument(bad,{fetchImpl:m.handler}),e=>e.code==='INVALID_DOCUMENT_LENGTH');
 }
 assert.equal(m.calls,0);
});
test('API local real: cabeceras, política origen, longitud y revisión humana',async()=>{
 let calls=0;
 const server=createApp({analyzer:async()=>{calls++;return {decision:'REQUIERE_REVISION_HUMANA',can_auto_approve:false}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const page=await fetch(base+'/');assert.equal(page.status,200);
  assert.match(await page.text(),/FLUYNOVA Copilot/);
  assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);
  const status=await (await fetch(base+'/api/status')).json();
  assert.equal(status.model_connection,'NO_VERIFICADA');
  const denied=await fetch(base+'/api/analyze',{method:'POST',headers:{'origin':'https://hostil.example','content-type':'application/json'},body:JSON.stringify({document:SOURCE})});
  assert.equal(denied.status,403);
  const wrong=await fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'text/plain'},body:SOURCE});
  assert.equal(wrong.status,415);
  const large=await fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({document:'x'.repeat(9000)})});
  assert.equal(large.status,413);
  const ok=await fetch(base+'/api/analyze',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({document:SOURCE})});
  assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{decision:'REQUIERE_REVISION_HUMANA',can_auto_approve:false});
  assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
test('la respuesta del modelo no incluye capacidades de aprobación ni escrituras externas',async()=>{
 const m=mockModel({...FIELDS,explanation:'<img src=x onerror=alert(1)>'});
 const r=await analyzeDocument(SOURCE,{fetchImpl:m.handler});
 assert.match(r.extracted.explanation,/onerror/);
 assert.equal(r.can_auto_approve,false);
 assert.ok(!Object.hasOwn(r,'approved'));
});
