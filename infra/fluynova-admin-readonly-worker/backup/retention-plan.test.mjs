import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeEncryptedBackupRetention} from './retention-plan.mjs';
const NOW='2026-11-09T15:00:00.000Z';
const daysAgo=n=>new Date(Date.parse(NOW)-n*86400000).toISOString();
const backup=(id,age,overrides={})=>({
 id:'fluy-'+id,createdAt:daysAgo(age),scope:'FLUYNOVA',
 format:'FLUYNOVA_PAGED_ENCRYPTED_LAB_V1',
 encrypted:true,checksumVerified:true,storage:'APPROVED_PRIVATE',
 legalHold:false,...overrides
});
test('política de retención conserva las copias recientes y nunca ejecuta borrados',()=>{
 const data=[backup('a',0),backup('b',1),backup('c',2),backup('d',4)];
 const result=proposeEncryptedBackupRetention(data,{asOf:NOW});
 assert.equal(result.candidates,0);
 assert.equal(result.deletionAuthorized,false);
 assert.equal(result.filesDeleted,0);
 assert.equal(result.mode,'ADVISORY_ONLY_NO_DELETION');
 assert.equal(result.kept,4);
});
test('copias viejas redundantes solo producen candidatos para revisión manual',()=>{
 const data=[
  backup('latest1',0),backup('latest2',1),backup('latest3',2),
  backup('old1',190),backup('old2',191),backup('old3',192)
 ];
 const result=proposeEncryptedBackupRetention(data,{asOf:NOW});
 assert.ok(result.candidates>=2);
 assert.equal(result.filesDeleted,0);
 assert.equal(result.deletionAuthorized,false);
 assert.ok(result.decisions.every(d=>['hold','retain','candidateForManualDeletion'].includes(d.status)));
 assert.ok(result.decisions.filter(d=>d.status==='candidateForManualDeletion')
  .every(d=>d.reason==='OLDER_THAN_MINIMUM_AGE_AND_REDUNDANT'));
});
test('sin al menos cuatro copias válidas no propone destruir la única recuperación',()=>{
 const data=[backup('only1',500),backup('only2',600),backup('only3',700)];
 const result=proposeEncryptedBackupRetention(data,{asOf:NOW});
 assert.equal(result.candidates,0);
 assert.equal(result.kept,3);
});
test('legal hold, otro proyecto y metadata sin verificación nunca son elegibles',()=>{
 const data=[
  backup('new1',0),backup('new2',1),backup('new3',2),
  backup('held',800,{legalHold:true}),
  backup('foreign',850,{scope:'APDOCENTE'}),
  backup('unknown',900,{checksumVerified:false}),
  backup('public',1000,{storage:'PUBLIC'}),
  backup('future',-2),
 ];
 const plan=proposeEncryptedBackupRetention(data,{asOf:NOW});
 assert.equal(plan.candidates,0);
 assert.equal(plan.decisions.find(d=>d.id==='fluy-held').status,'hold');
 assert.equal(plan.decisions.find(d=>d.id==='fluy-foreign').status,'hold');
 assert.equal(plan.decisions.find(d=>d.id==='fluy-future').status,'hold');
 assert.equal(plan.held,5);
});
test('rechaza duplicados, fechas inválidas, 90 días menos y objetos malformados',()=>{
 const b=backup('dup',10);
 assert.throws(()=>proposeEncryptedBackupRetention([b,b],{asOf:NOW}),
  /RETENTION_INVALID_OR_DUPLICATE_ID/);
 assert.throws(()=>proposeEncryptedBackupRetention([null],{asOf:NOW}),
  /RETENTION_INVALID_OR_DUPLICATE_ID/);
 assert.throws(()=>proposeEncryptedBackupRetention([],{asOf:'2026/11/09'}),
  /RETENTION_INPUT_INVALID/);
 assert.throws(()=>proposeEncryptedBackupRetention([],{asOf:NOW,minAgeDays:89}),
  /RETENTION_INPUT_INVALID/);
});
test('no inserta PII en el reporte de decisiones',()=>{
 const b=backup('privacy',400,{name:'PERSONA-PRIVADA',
  email:'falso@example.invalid',message:'MENSAJE-SECRETO'});
 const plan=proposeEncryptedBackupRetention([
  backup('new1',0),backup('new2',1),backup('new3',2),b
 ],{asOf:NOW});
 const output=JSON.stringify(plan);
 for(const privateValue of ['PERSONA-PRIVADA','falso@example.invalid','MENSAJE-SECRETO'])
  assert.equal(output.includes(privateValue),false);
 assert.equal(output.includes('fluy-privacy'),true);
 console.log('FLUYNOVA_07B_RETENTION_PASS: advisory_only=true, deletions=0, privacy=true');
});
