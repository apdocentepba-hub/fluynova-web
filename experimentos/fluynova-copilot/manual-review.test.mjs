import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewManualAmounts} from './manual-review.mjs';

const OCR='FACTURA FICTICIA\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00';
const entered={net_cents:'150.000,00',tax_cents:'31.500,00',total_cents:'181.500,00'};
const review=(source=OCR,amounts=entered)=>reviewManualAmounts(source,amounts,{inputOrigin:'OCR',visualReviewDeclared:true});

test('corrige cifras OCR equivocadas con entrada humana explícita sin certificar original',()=>{
 const r=review();
 assert.equal(r.extracted.net_cents,15000000);
 assert.equal(r.extracted.tax_cents,3150000);
 assert.equal(r.extracted.total_cents,18150000);
 assert.equal(r.amount_verification.net_cents.ocr_text_cents,15080000);
 assert.equal(r.amount_verification.net_cents.disagreement_with_ocr,true);
 assert.equal(r.amount_verification.total_cents.disagreement_with_ocr,true);
 assert.equal(r.amount_verification.tax_cents.disagreement_with_ocr,false);
 assert.equal(r.arithmetic_consistent,true);
 assert.equal(r.verified_amounts,0);
 assert.equal(r.original_document_verified,false);
 assert.equal(r.can_auto_approve,false);
 assert.equal(r.model_called,false);
 assert.equal(r.extracted.evidence.length,0);
});
test('importe OCR ambiguo sigue marcado como no corroborado aunque una persona lo escriba',()=>{
 const source='FACTURA FICTICIA\nNeto: $150.000,00\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $181.500,00';
 const r=review(source);
 assert.equal(r.amount_verification.net_cents.ocr_text_cents,null);
 assert.equal(r.amount_verification.net_cents.disagreement_with_ocr,null);
 assert.match(r.issues.join(' '),/no aportó un importe único/);
 assert.equal(r.can_auto_approve,false);
});
test('suma manual inconsistente se advierte sin autocorregir',()=>{
 const r=review(OCR,{...entered,total_cents:'182.500,00'});
 assert.equal(r.arithmetic_consistent,false);
 assert.equal(r.extracted.total_cents,18250000);
 assert.match(r.issues.join(' '),/NO cumplen Neto/);
 assert.equal(r.verified_amounts,0);
});
test('requiere tres campos y prohíbe extras',()=>{
 for(const obj of [null,{}, {net_cents:'150.000,00'}, {...entered,otra:'100,00'},
  {...entered,tax_cents:undefined},['150.000,00','31.500,00','181.500,00']]){
  assert.throws(()=>review(OCR,obj),e=>['MANUAL_AMOUNT_FIELDS_REQUIRED','MANUAL_AMOUNT_INVALID'].includes(e.code));
 }
});
test('rechaza formatos monetarios ambiguos, números JS y negativos',()=>{
 for(const bad of ['31,500.00','-31.500,00','31.500,0','31.50','31 500,00',31500,
   '31.500,000','31.500.00','999.999.999.999.999.999,00']){
  assert.throws(()=>review(OCR,{...entered,tax_cents:bad}),e=>e.code==='MANUAL_AMOUNT_INVALID');
 }
});
test('exige declaración de cotejo y procedencia OCR',()=>{
 assert.throws(()=>reviewManualAmounts(OCR,entered),e=>e.code==='MANUAL_OCR_REVIEW_REQUIRED');
 assert.throws(()=>reviewManualAmounts(OCR,entered,{inputOrigin:'TEXT',visualReviewDeclared:true}),e=>e.code==='MANUAL_OCR_REVIEW_REQUIRED');
 assert.throws(()=>reviewManualAmounts(OCR,entered,{inputOrigin:'OCR',visualReviewDeclared:false}),e=>e.code==='MANUAL_OCR_REVIEW_REQUIRED');
});
test('no admite texto vacío, excesivo ni ajeno al control previo de OCR',()=>{
 assert.throws(()=>review('',entered),e=>e.code==='INVALID_DOCUMENT_LENGTH');
 assert.throws(()=>review('x'.repeat(6100),entered),e=>e.code==='INVALID_DOCUMENT_LENGTH'); 
});
