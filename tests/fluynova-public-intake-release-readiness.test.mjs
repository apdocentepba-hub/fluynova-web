import test from 'node:test';
import assert from 'node:assert/strict';
import {readReleaseInputs} from '../infra/fluynova-public-intake-worker/release-guard.mjs';
import {generateReleaseReadiness,reviewRollback,prerequisites} from '../infra/fluynova-public-intake-worker/release-readiness.mjs';

const clean=readReleaseInputs();
const id='12345678-1234-4234-8234-123456789012';
const safe={
 versionId:id,
 previousFlags:{ENABLE_PUBLIC_INTAKE:'false',ENABLE_CONTACT_SUBMISSIONS:'false'},
 activeBindingId:'fluynova-d1-example',previousBindingId:'fluynova-d1-example',
 accessPolicyVerified:true,approvalRecorded:true
};
test('una configuración cerrada NO es autorización para desplegar',()=>{
 const p=generateReleaseReadiness(clean);
 assert.equal(p.safeClosed,true);
 assert.equal(p.canDeploy,false);
 assert.equal(p.canEnableTraffic,false);
 assert.equal(p.runtimeRemoteVerified,false);
 assert.equal(p.turnstileRealVerified,false);
 assert.equal(p.d1RemoteVerified,false);
 assert.ok(p.externalPrerequisites.length>=8);
});
test('si el guardián detecta cambios, readiness los revela sin habilitar',()=>{
 const modified=structuredClone(clean);
 modified.candidate.vars.ENABLE_PUBLIC_INTAKE='true';
 const p=generateReleaseReadiness(modified);
 assert.equal(p.safeClosed,false);
 assert.ok(p.configurationFailures.includes('PUBLIC_INTAKE_MUST_REMAIN_OFF'));
 assert.equal(p.canDeploy,false);
});
test('recovery: sin ID de versión verificado no proponer rollback',()=>{
 const p=reviewRollback({...safe,versionId:undefined});
 assert.equal(p.candidateForManualReview,false);
 assert.ok(p.blockers.includes('MISSING_VERIFIED_PREVIOUS_VERSION_ID'));
});
test('recovery: una versión antigua que acepta tráfico no puede ser destino recomendado',()=>{
 const p=reviewRollback({...safe,previousFlags:{ENABLE_PUBLIC_INTAKE:'true',ENABLE_CONTACT_SUBMISSIONS:'true'}});
 assert.equal(p.candidateForManualReview,false);
 assert.ok(p.blockers.includes('TARGET_VERSION_COULD_ACCEPT_TRAFFIC'));
});
test('recovery: cambios en binding D1 bloquean aprobación automática',()=>{
 const p=reviewRollback({...safe,previousBindingId:'D1_NOT_SAME'});
 assert.equal(p.candidateForManualReview,false);
 assert.ok(p.blockers.includes('D1_BINDINGS_NOT_CONFIRMED_UNCHANGED'));
});
test('recovery: sin verificación de Access ni aprobación manual, no apto',()=>{
 const p=reviewRollback({...safe,accessPolicyVerified:false,approvalRecorded:false});
 assert.equal(p.candidateForManualReview,false);
 assert.ok(p.blockers.includes('ACCESS_RULES_NOT_VERIFIED'));
 assert.ok(p.blockers.includes('EXPLICIT_APPROVAL_MISSING'));
});
test('recovery: incluso con documentación completa NO ejecuta cambios',()=>{
 const p=reviewRollback(safe);
 assert.equal(p.candidateForManualReview,true);
 assert.equal(p.rollbackPerformed,false);
 assert.equal(p.dataRestorePerformed,false);
 assert.match(p.warning,/NO restaura D1/);
});
test('precondiciones incluyen Turnstile, acceso, D1, privacidad y autorización',()=>{
 const p=prerequisites.join(' ');
 for(const word of ['Turnstile','Cloudflare Access','D1','retención','aprobación'])
   assert.ok(p.toLowerCase().includes(word.toLowerCase()),word);
});
