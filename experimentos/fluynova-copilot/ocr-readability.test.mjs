import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOcrReadability} from './ocr-readability.mjs';
const GOOD='Factura ficticia control\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
test('texto legible y suma correcta sigue EXIGIENDO cotejo visual',()=>{
  const x=assessOcrReadability(GOOD,91);
  assert.equal(x.classification,'COTEJAR_VISUALMENTE');
  assert.equal(x.readable_amounts,3);
  assert.equal(x.arithmetic_consistent,true);
  assert.equal(x.original_document_verified,false);
  assert.equal(x.can_auto_approve,false);
});
test('desenfoque severo con 0/3 importes propone recapturar',()=>{
  const x=assessOcrReadability('Factura FICTICIA\nNUETO $I$OOO\nIV4 $31300\nTOTaL ~$',63);
  assert.equal(x.classification,'RECAPTURAR_SUGERIDO');
  assert.equal(x.readable_amounts,0);
  assert.deepEqual(x.reasons,['CONFIANZA_GLOBAL_BAJA','SIN_IMPORTES_LEGIBLES']);
});
test('confianza global baja recomienda recaptura incluso cuando cifras parecen legibles',()=>{
  const x=assessOcrReadability(GOOD,74.9);
  assert.equal(x.classification,'RECAPTURAR_SUGERIDO');
  assert.equal(x.readable_amounts,3);
  assert.equal(x.can_auto_approve,false);
});
test('un importe faltante o inválido implica corregir o recapturar',()=>{
  const x=assessOcrReadability(GOOD.replace('IVA: $31.500,00','IVA: no legible'),88);
  assert.equal(x.classification,'CORREGIR_O_RECAPTURAR');
  assert.equal(x.readable_amounts,2);
  assert.equal(x.arithmetic_consistent,null);
});
test('inconsistencia aritmética implica revisión aunque tres campos sean legibles',()=>{
  const x=assessOcrReadability(GOOD.replace('181.500','181.400'),91);
  assert.equal(x.classification,'CORREGIR_O_RECAPTURAR');
  assert.equal(x.readable_amounts,3);
  assert.equal(x.arithmetic_consistent,false);
});
test('dígitos compensados con suma coherente NO se detectan automáticamente',()=>{
  const x=assessOcrReadability(GOOD.replace('150.000','150.800').replace('181.500','182.300'),96);
  assert.equal(x.classification,'COTEJAR_VISUALMENTE');
  assert.equal(x.arithmetic_consistent,true);
  assert.equal(x.original_document_verified,false);
  assert.match(x.disclaimer,/NO prueban/);
});
test('parámetros de confianza fuera de rango fallan de forma explícita',()=>{
  for(const c of [-1,101,Number.NaN,'90',undefined]){
    assert.throws(()=>assessOcrReadability(GOOD,c),TypeError);
  }
});
