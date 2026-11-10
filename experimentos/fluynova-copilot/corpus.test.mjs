import test from 'node:test';
import assert from 'node:assert/strict';
import {SYNTHETIC_CORPUS} from './corpus-sintetico.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

test('corpus sintético: IDs únicos, rango seguro y casos adversos',()=>{
 const ids=SYNTHETIC_CORPUS.map(c=>c.id);
 assert.equal(SYNTHETIC_CORPUS.length,53);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(ids.filter(x=>x.startsWith('I')).length>=20);
 assert.ok(ids.filter(x=>x.startsWith('V')).length>=25);
 assert.ok(ids.filter(x=>x.startsWith('E')).length>=3);
 for(const fixture of SYNTHETIC_CORPUS){
   assert.ok(fixture.source.length>=25&&fixture.source.length<=6000,fixture.id);
   assert.ok(Object.isFrozen(fixture.expected),fixture.id);
   assert.deepEqual(Object.keys(fixture.expected),
     ['net_cents','tax_cents','total_cents'],fixture.id);
   for(const value of Object.values(fixture.expected)){
     assert.ok(value===null||Number.isSafeInteger(value),fixture.id);
   }
 }
});
for(const fixture of SYNTHETIC_CORPUS){
 test(fixture.id+' '+fixture.description,()=>{
   const result=verifyMoneyOnly(fixture.source);
   assert.equal(result.mode,'REGLAS_SIN_IA');
   assert.equal(result.model_called,false);
   assert.equal(result.model_used,null);
   assert.equal(result.decision,'REQUIERE_REVISION_HUMANA');
   assert.equal(result.can_auto_approve,false);
   assert.equal(result.verified_amounts,Object.values(fixture.expected).filter(x=>x!==null).length);
   for(const [key,expected] of Object.entries(fixture.expected)){
     assert.equal(result.extracted[key],expected,
       fixture.id+' campo '+key+' no corresponde al resultado esperado');
     assert.equal(result.amount_verification[key].model_proposal_cents,null);
     assert.equal(result.amount_verification[key].disagreement,null);
     if(expected===null)assert.ok(
       result.issues.some(issue=>/no se pudo corroborar/.test(issue)),
       fixture.id+' requiere alerta por monto ambiguo o ausente'
     );
   }
   const mismatchIssue=result.issues.some(x=>/Neto \+ impuestos no coincide con total/.test(x));
   assert.equal(mismatchIssue,fixture.mismatch,fixture.id+' suma aritmética mal clasificada');
 });
}
