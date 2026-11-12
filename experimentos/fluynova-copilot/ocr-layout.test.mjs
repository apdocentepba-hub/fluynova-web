import test from 'node:test';
import assert from 'node:assert/strict';
import {planOcrRegionRetry,planOcrRegionRetries,assessOcrRegionEvidence,reconcileOcrRegionTexts} from './ocr-layout.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

const complete='FACTURA FICTICIA\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
function parsed(source){
 return verifyMoneyOnly(source,{inputOrigin:'OCR',visualReviewDeclared:true});
}
test('solo proponer segunda pasada si faltan campos; región acotada dentro de imagen',()=>{
 assert.equal(planOcrRegionRetry(complete,1440,850),null);
 const p=planOcrRegionRetry('FACTURA FICTICIA\nNeto: $150.000,00',1440,850);
 assert.deepEqual(p.missing_fields,['tax_cents','total_cents']);
 assert.equal(p.rectangle.left,605);
 assert.equal(p.rectangle.top,145);
 assert.ok(p.rectangle.width>0&&p.rectangle.left+p.rectangle.width<=1440);
 assert.ok(p.rectangle.height>0&&p.rectangle.top+p.rectangle.height<=850);
 assert.equal(planOcrRegionRetry('Neto: $150.000,00',600,400),null);
});
test('recupera SOLO campos ausentes desde segunda lectura OCR, manteniendo cotejo obligatorio',()=>{
 const a='FACTURA FICTICIA\nNeto: $150.000,00';
 const r=reconcileOcrRegionTexts(a,complete);
 assert.deepEqual(r.recovered_fields,['tax_cents','total_cents']);
 assert.deepEqual(r.conflict_fields,[]);
 const reviewed=parsed(r.text);
 assert.equal(reviewed.extracted.net_cents,15000000);
 assert.equal(reviewed.extracted.tax_cents,3150000);
 assert.equal(reviewed.extracted.total_cents,18150000);
 assert.equal(reviewed.verified_amounts,0);
 assert.equal(reviewed.original_document_verified,false);
 assert.equal(reviewed.can_auto_approve,false);
 assert.match(r.text,/LECTURA OCR REGIONAL/);
});
test('nunca elige entre cifras contradictorias aunque ambas mantengan sumas',()=>{
 const changed='FACTURA FICTICIA\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00';
 const r=reconcileOcrRegionTexts(complete,changed);
 assert.deepEqual(r.recovered_fields,[]);
 assert.deepEqual(r.conflict_fields,['net_cents','total_cents']);
 const checked=parsed(r.text);
 assert.equal(checked.extracted.net_cents,null);
 assert.equal(checked.extracted.tax_cents,3150000);
 assert.equal(checked.extracted.total_cents,null);
 assert.equal(checked.verified_amounts,0);
 assert.equal(checked.can_auto_approve,false);
});
test('una lectura primaria ambigua nunca se sobrescribe con secundaria',()=>{
 const ambiguous='FACTURA FICTICIA\nNeto: $100,00\nNeto: $200,00\nIVA: $21,00\nTotal: $121,00';
 const r=reconcileOcrRegionTexts(ambiguous,complete);
 assert.equal(r.recovered_fields.length,0);
 assert.ok(r.conflict_fields.includes('net_cents'));
 const checked=parsed(r.text);
 assert.equal(checked.extracted.net_cents,null);
 assert.equal(checked.can_auto_approve,false);
});
test('segunda región con etiquetas duplicadas tampoco permite reconstruir monto',()=>{
 const initial='FACTURA FICTICIA\nNeto: $150.000,00';
 const second='IVA: $31.500,00\nIVA: $32.000,00\nTotal: $181.500,00';
 const r=reconcileOcrRegionTexts(initial,second);
 assert.deepEqual(r.recovered_fields,['total_cents']);
 assert.deepEqual(r.conflict_fields,['tax_cents']);
 assert.equal(parsed(r.text).extracted.tax_cents,null);
 assert.equal(parsed(r.text).extracted.total_cents,18150000);
});
test('no altera importe original cuando ambas lecturas coinciden',()=>{
 const r=reconcileOcrRegionTexts(complete,complete);
 assert.equal(r.text,complete);
 assert.deepEqual(r.recovered_fields,[]);
 assert.deepEqual(r.conflict_fields,[]);
});
test('no acepta una región con importe inválido o montos con formato extranjero',()=>{
 const first='FACTURA FICTICIA\nNeto: $150.000,00';
 const second='IVA: $31,500.00\nTotal: -181.500,00';
 const r=reconcileOcrRegionTexts(first,second);
 assert.deepEqual(r.recovered_fields,[]);
 assert.deepEqual(r.conflict_fields,['tax_cents','total_cents']);
 assert.equal(parsed(r.text).extracted.tax_cents,null);
});


test('tres zonas de búsqueda seguras, sin suponer que montos siempre están a la derecha',()=>{
 const zones=planOcrRegionRetries('FACTURA DEMO\nNeto: $150.000,00',1440,850);
 assert.deepEqual(zones.map(z=>z.name),['right','center','left']);
 assert.deepEqual(zones[0].missing_fields,['tax_cents','total_cents']);
 for(const z of zones){
  assert.ok(z.rectangle.left>=0&&z.rectangle.top>=0);
  assert.ok(z.rectangle.left+z.rectangle.width<=1440);
  assert.ok(z.rectangle.top+z.rectangle.height<=850);
 }
 assert.deepEqual(planOcrRegionRetries(complete,1440,850),[]);
 assert.deepEqual(planOcrRegionRetries('Neto: $100,00',500,850),[]);
});
test('recorte de un único importe no se considera evidencia suficiente aunque luzca válido',()=>{
 const bad=assessOcrRegionEvidence('NETO: $150.800,00',2);
 assert.equal(bad.valid_count,1);
 assert.equal(bad.sufficient,false);
 assert.equal(bad.reason,'INSUFFICIENT_LABELED_FIELDS');
 const pair=assessOcrRegionEvidence('Neto: $150.000,00\nIVA: $31.500,00',2);
 assert.equal(pair.sufficient,true);
 assert.equal(pair.valid_count,2);
 const duplicate=assessOcrRegionEvidence('Neto: $150.000,00\nIVA: $31.500,00\nIVA: $32.500,00',2);
 assert.equal(duplicate.sufficient,false);
 assert.equal(duplicate.reason,'DUPLICATED_OR_INVALID_AMOUNT');
});
