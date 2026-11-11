import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreOcrAmounts} from './ocr-score.mjs';
const truth={net_cents:10000,tax_cents:2100,total_cents:12100};
test('dos cifras falsificadas mantienen suma correcta: clasificar como error peligroso',()=>{
 const result=scoreOcrAmounts(truth,{
  net_cents:10020,tax_cents:2100,total_cents:12120
 });
 assert.equal(result.correct,1);
 assert.equal(result.abstentions,0);
 assert.equal(result.wrongPlausible,2);
 assert.equal(result.arithmeticallyConsistent,true);
 assert.equal(result.silentArithmeticRisk,true);
 assert.equal(result.neverIndependentlyVerified,true);
});
test('el OCR que no puede leer un campo cuenta como abstención, no como acierto',()=>{
 const r=scoreOcrAmounts(truth,{net_cents:10000,tax_cents:null,total_cents:12100});
 assert.equal(r.correct,2);
 assert.equal(r.abstentions,1);
 assert.equal(r.wrongPlausible,0);
 assert.equal(r.silentArithmeticRisk,false);
});
test('valor falso con suma incorrecta sigue siendo error, pero no error silencioso',()=>{
 const r=scoreOcrAmounts(truth,{net_cents:10000,tax_cents:2100,total_cents:12000});
 assert.equal(r.correct,2);assert.equal(r.wrongPlausible,1);
 assert.equal(r.arithmeticallyConsistent,false);
 assert.equal(r.silentArithmeticRisk,false);
});
test('el resultado exacto no equivale a certificación de autenticidad',()=>{
 const r=scoreOcrAmounts(truth,{...truth});
 assert.equal(r.correct,3);assert.equal(r.wrongPlausible,0);
 assert.equal(r.neverIndependentlyVerified,true);
});
test('sin verdades numéricas válidas se rechaza el benchmark',()=>{
 assert.throws(()=>scoreOcrAmounts({...truth,total_cents:'12100'},truth),TypeError);
});
