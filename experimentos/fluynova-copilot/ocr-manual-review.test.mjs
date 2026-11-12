import test from 'node:test';
import assert from 'node:assert/strict';
import {describeOcrMoneyFields,applyManualOcrCorrections} from './ocr-manual-review.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

const ambiguous=['FACTURA FICTICIA - SIN VALOR FISCAL',
 'Proveedor: Empresa DEMO','Neto: $150.000,00','IVA: $31.500,00',
 'Total: $181.500,00',
 '[LECTURA OCR REGIONAL - SIN VERIFICACION INDEPENDIENTE]',
 'Neto: $150.800,00','Total: $182.300,00'].join('\n');
test('diagnóstico por campo señala ambigüedad y mantiene visibles las cifras no ambiguas',()=>{
 const fields=describeOcrMoneyFields(ambiguous);
 assert.deepEqual(fields.map(f=>[f.key,f.status]),[
  ['net_cents','AMBIGUO_O_INVALIDO'],['tax_cents','LEGIBLE'],['total_cents','AMBIGUO_O_INVALIDO']
 ]);
 assert.equal(fields[0].suggested_text,null);
 assert.equal(fields[1].suggested_text,'$31.500,00');
 assert.equal(fields[1].independent_source_verified,false);
});
test('se corrigen explícitamente solo dos campos duplicados, sin alterar IVA',()=>{
 const r=applyManualOcrCorrections(ambiguous,{
  net_cents:'150.000,00',total_cents:'$181.500,00'
 },{operatorComparedOriginal:true});
 assert.deepEqual(r.corrected_fields,['net_cents','total_cents']);
 assert.equal(r.removed_ocr_lines.net_cents,2);
 assert.equal(r.removed_ocr_lines.total_cents,2);
 assert.equal(r.original_document_verified,false);
 assert.equal(r.can_auto_approve,false);
 assert.match(r.text,/CORRECCION HUMANA DECLARADA/);
 assert.equal(r.text.split('IVA: $31.500,00').length,2);
 const review=verifyMoneyOnly(r.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 assert.equal(review.extracted.net_cents,15000000);
 assert.equal(review.extracted.tax_cents,3150000);
 assert.equal(review.extracted.total_cents,18150000);
 assert.equal(review.parsed_amounts,3);
 assert.equal(review.verified_amounts,0);
 assert.equal(review.original_document_verified,false);
 assert.equal(review.can_auto_approve,false);
});
test('corrección parcial no inventa ni modifica otros campos ambiguos',()=>{
 const r=applyManualOcrCorrections(ambiguous,{net_cents:'$150.000,00'},
  {operatorComparedOriginal:true});
 const review=verifyMoneyOnly(r.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 assert.equal(review.extracted.net_cents,15000000);
 assert.equal(review.extracted.total_cents,null);
 assert.equal(review.extracted.tax_cents,3150000);
 assert.equal(r.corrected_fields.length,1);
});
test('rechaza cambios sin declaración visual, opciones desconocidas y números invalidos',()=>{
 const scenarios=[
  [{net_cents:'150.000,00'},{}],
  [{net_cents:'150,000.00'},{operatorComparedOriginal:true}],
  [{tax_cents:'-31.500,00'},{operatorComparedOriginal:true}],
  [{total_cents:'1.23.456,00'},{operatorComparedOriginal:true}],
  [{supplier:'Empresa fantasma'},{operatorComparedOriginal:true}],
  [{net_cents:''},{operatorComparedOriginal:true}],
  [{net_cents:150000},{operatorComparedOriginal:true}],
  [{},{operatorComparedOriginal:true}]
 ];
 for(const [changes,opts] of scenarios){
  assert.throws(()=>applyManualOcrCorrections(ambiguous,changes,opts),TypeError);
 }
});
test('corrección única mantiene separadores ARS y no destruye campos no seleccionados',()=>{
 const src=['FACTURA FICTICIA - SIN VALOR FISCAL','Neto gravado: $1.200,00',
  'IVA 21%: $252,00','Total a pagar: $1.452,00'].join('\n');
 const r=applyManualOcrCorrections(src,{tax_cents:'252,01'},
  {operatorComparedOriginal:true});
 assert.ok(r.text.includes('Neto gravado: $1.200,00'));
 assert.ok(r.text.includes('Total a pagar: $1.452,00'));
 assert.equal(r.removed_ocr_lines.tax_cents,1);
 assert.equal(r.text.includes('IVA 21%: $252,00'),false);
 const checked=verifyMoneyOnly(r.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 assert.equal(checked.extracted.tax_cents,25201);
 assert.ok(checked.issues.some(x=>/no coincide/i.test(x)));
 assert.equal(checked.can_auto_approve,false);
});
test('límite de caracteres evita truncar documentos silenciosamente',()=>{
 const long='FACTURA FICTICIA \n'+'X'.repeat(5980);
 assert.throws(()=>applyManualOcrCorrections(long,{net_cents:'1,00'},
  {operatorComparedOriginal:true}),/MANUAL_REVIEW_TEXT_TOO_LONG/);
});
