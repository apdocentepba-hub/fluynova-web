import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';

const document='FACTURA FICTICIA\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00';
const valid={document,input_origin:'OCR',visual_review_declared:true,
 manual_amounts:{net_cents:'150.000,00',tax_cents:'31.500,00',total_cents:'181.500,00'}};
async function session(){
 let aiCalls=0;
 const app=createApp({analyzer:async()=>{aiCalls++;throw new Error('LLM_CALL_FORBIDDEN')}});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port;
 return {base,app,getCalls:()=>aiCalls,close:async()=>{
  app.closeAllConnections();await new Promise(resolve=>app.close(resolve));
 }};
}
async function post(base,payload,origin=base){
 const res=await fetch(base+'/api/manual-review',{method:'POST',
  headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)});
 return {status:res.status,result:await res.json()};
}
test('API transcribe tres importes como humanos no certificados, sin ejecutar Qwen',async()=>{
 const s=await session();
 try{
  const {status,result}=await post(s.base,valid);
  assert.equal(status,200);
  assert.equal(result.input_origin,'OCR');
  assert.equal(result.manual_entry_declared,true);
  assert.equal(result.model_called,false);
  assert.equal(result.can_auto_approve,false);
  assert.equal(result.verified_amounts,0);
  assert.equal(result.original_document_verified,false);
  assert.equal(result.manual_entered_amounts,3);
  assert.equal(result.arithmetic_consistent,true);
  assert.equal(result.extracted.net_cents,15000000);
  assert.equal(result.extracted.total_cents,18150000);
  assert.equal(result.amount_verification.net_cents.ocr_text_cents,15080000);
  assert.equal(result.amount_verification.net_cents.disagreement_with_ocr,true);
  assert.equal(s.getCalls(),0);
 }finally{await s.close()}
});
test('API rechaza transcripciones parciales, formato extranjero y parámetros extra',async()=>{
 const s=await session();
 try{
  const variants=[
   [{...valid,manual_amounts:{net_cents:'150.000,00'}},'MANUAL_AMOUNT_FIELDS_REQUIRED'],
   [{...valid,manual_amounts:{...valid.manual_amounts,tax_cents:'31,500.00'}},'MANUAL_AMOUNT_INVALID'],
   [{...valid,visual_review_declared:false},'MANUAL_OCR_REVIEW_REQUIRED'],
   [{...valid,input_origin:'TEXT'},'MANUAL_OCR_REVIEW_REQUIRED'],
   [{...valid,extra:'inyección'},'MANUAL_REVIEW_INVALID_REQUEST'],
   [{...valid,document:''},'INVALID_DOCUMENT_LENGTH']
  ];
  for(const [payload,expected] of variants){
   const res=await post(s.base,payload);
   assert.equal(res.status,422,expected);
   assert.equal(res.result.error,expected);
   assert.equal(res.result.decision,'REQUIERE_REVISION_HUMANA');
  }
  assert.equal(s.getCalls(),0);
 }finally{await s.close()}
});
test('API bloquea orígenes ajenos y respuestas automáticas',async()=>{
 const s=await session();
 try{
  const out=await post(s.base,valid,'https://atacante.invalid');
  assert.equal(out.status,403);
  assert.equal(out.result.error,'ORIGIN_REJECTED');
  const incorrect={...valid,manual_amounts:{...valid.manual_amounts,total_cents:'182.500,00'}};
  const res=await post(s.base,incorrect);
  assert.equal(res.status,200);
  assert.equal(res.result.arithmetic_consistent,false);
  assert.equal(res.result.can_auto_approve,false);
  assert.equal(s.getCalls(),0);
 }finally{await s.close()}
});
