import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMoneyOnly} from './verify-money.mjs';
import {createApp} from './server.mjs';

// Un OCR puede deformar dos cifras de forma compensada y mantener una suma válida.
const original='Factura ficticia control OCR\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
const wrongButBalanced='Factura ficticia control OCR\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00';

test('adversarial: suma válida de dos números equivocados NO demuestra identidad con imagen',()=>{
 const normal=verifyMoneyOnly(wrongButBalanced);
 assert.equal(normal.issues.length,0,'la aritmética sola no detecta la mutación compensada');
 assert.equal(normal.extracted.net_cents,15080000);
 assert.equal(normal.extracted.total_cents,18230000);
 const fromOcr=verifyMoneyOnly(wrongButBalanced,{
  inputOrigin:'OCR',visualReviewDeclared:true
 });
 assert.equal(fromOcr.parsed_amounts,3);
 assert.equal(fromOcr.verified_amounts,0);
 assert.equal(fromOcr.original_document_verified,false);
 assert.equal(fromOcr.visual_review_declared,true);
 assert.equal(fromOcr.can_auto_approve,false);
 assert.equal(fromOcr.amount_verification.net_cents.origin,'OCR_COTEJO_VISUAL_DECLARADO_NO_VERIFICADO');
 assert.equal(fromOcr.amount_verification.total_cents.independent_source_verified,false);
 assert.ok(fromOcr.issues.some(s=>/aun cuando la suma cierre/i.test(s)));
 assert.match(fromOcr.disclaimer,/NO certificado/);
 assert.notDeepEqual(fromOcr.extracted.net_cents,verifyMoneyOnly(original).extracted.net_cents);
});
test('adversarial: OCR sin declaración explícita se rechaza incluso con aritmética perfecta',()=>{
 assert.throws(()=>verifyMoneyOnly(original,{inputOrigin:'OCR'}),
  e=>e.code==='OCR_VISUAL_REVIEW_REQUIRED'&&e.status===422);
 assert.throws(()=>verifyMoneyOnly(original,{inputOrigin:'OCR',visualReviewDeclared:'sí'}),
  e=>e.code==='INVALID_SOURCE_PROVENANCE'&&e.status===422);
});
test('origen de texto manual mantiene contrato anterior para corpus determinista',()=>{
 const r=verifyMoneyOnly(original);
 assert.equal(r.input_origin,'TEXT');
 assert.equal(r.verified_amounts,3);
 assert.equal(r.parsed_amounts,3);
 assert.equal(r.amount_verification.total_cents.origin,'LECTURA_LITERAL_ETIQUETADA');
 assert.equal(r.can_auto_approve,false);
});
test('API exige declaración y marca importes OCR como NO verificados por el sistema',async()=>{
 let calls=0;
 const app=createApp({analyzer:async()=>{
  calls++;
  return {issues:[],can_auto_approve:false,model_used:'simulado',extracted:{}};
 }});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port;
 async function post(endpoint,payload){
  const res=await fetch(base+endpoint,{method:'POST',headers:{
    origin:base,'content-type':'application/json'
  },body:JSON.stringify(payload)});
  return {status:res.status,data:await res.json()};
 }
 try{
  const missing=await post('/api/verify-money',{
    document:wrongButBalanced,input_origin:'OCR',visual_review_declared:false
  });
  assert.equal(missing.status,422);
  assert.equal(missing.data.error,'OCR_VISUAL_REVIEW_REQUIRED');
  const exact=await post('/api/verify-money',{
    document:wrongButBalanced,input_origin:'OCR',visual_review_declared:true
  });
  assert.equal(exact.status,200);
  assert.equal(exact.data.input_origin,'OCR');
  assert.equal(exact.data.parsed_amounts,3);
  assert.equal(exact.data.verified_amounts,0);
  assert.equal(exact.data.original_document_verified,false);
  assert.ok(exact.data.issues.some(s=>s.includes('un dígito puede ser incorrecto')));
  assert.equal(calls,0);
  const withAi=await post('/api/analyze',{
    document:wrongButBalanced,input_origin:'OCR',visual_review_declared:true
  });
  assert.equal(withAi.status,200);
  assert.equal(withAi.data.input_origin,'OCR');
  assert.equal(withAi.data.original_document_verified,false);
  assert.equal(withAi.data.can_auto_approve,false);
  assert.equal(calls,1);
  assert.ok(withAi.data.issues.some(s=>s.includes('Texto OCR')));
  const injected=await post('/api/verify-money',{
    document:original,input_origin:'OCR',visual_review_declared:true,extra:'unknown'
  });
  assert.equal(injected.status,422);
 }finally{
  app.closeAllConnections();await new Promise(resolve=>app.close(resolve));
 }
});
