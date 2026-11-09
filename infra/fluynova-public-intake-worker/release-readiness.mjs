/**
 * FLUYNOVA — informe de liberación/rollback de solo lectura.
 * No recibe credenciales ni ejecuta comandos. No habilita tráfico.
 */
import {readReleaseInputs,auditClosedRelease} from './release-guard.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const prerequisites=Object.freeze([
 'Confirmar dominio exclusivo y reglas de Cloudflare Access/WAF para el nuevo Worker',
 'Crear widget Turnstile del dominio real; guardar secret únicamente en Cloudflare',
 'Revisar D1 remoto exclusivo de FLUYNOVA, esquema, permisos y bookmark previo',
 'Configurar secreto HMAC independiente, sin registrarlo en Git ni chats',
 'Definir retención, acceso administrativo y eliminación de datos personales',
 'Auditar Cron Triggers EFECTIVOS en Cloudflare; código scheduled sin trigger no demuestra limpieza',
 'Validar con consulta ficticia en remoto cerrado y confirmar observabilidad',
 'Registrar ID de versión segura, bindings y plan de reversión',
 'Obtener aprobación explícita antes de publicar o habilitar tráfico'
]);

export function generateReleaseReadiness(inputs){
 const audit=auditClosedRelease(inputs);
 return {
  project:'FLUYNOVA/public-intake-candidate',
  mode:'READ_ONLY_NOT_DEPLOYED',
  safeClosed:audit.safeClosed,
  configurationFailures:[...audit.failures],
  canDeploy:false,
  canEnableTraffic:false,
  runtimeRemoteVerified:false,
  accessVerified:false,
  turnstileRealVerified:false,
  d1RemoteVerified:false,
  externalPrerequisites:[...prerequisites],
  rollbackPrinciple:'No ejecutar rollback sin verificar la versión destino, flags, bindings y aprobación. D1 no se revierte junto con el Worker.'
 };
}

/** Evalúa SOLO si una versión conocida merece revisión manual; nunca ejecuta rollback. */
export function reviewRollback({
  versionId, previousFlags, activeBindingId, previousBindingId,
  accessPolicyVerified=false, approvalRecorded=false
}={}){
 const blockers=[];
 const add=(ok,msg)=>{if(!ok)blockers.push(msg)};
 add(typeof versionId==='string'&&/^[a-f0-9-]{36}$/i.test(versionId),
   'MISSING_VERIFIED_PREVIOUS_VERSION_ID');
 add(previousFlags?.ENABLE_PUBLIC_INTAKE==='false'&&
     previousFlags?.ENABLE_CONTACT_SUBMISSIONS==='false',
     'TARGET_VERSION_COULD_ACCEPT_TRAFFIC');
 add(typeof activeBindingId==='string'&&activeBindingId.length>0&&
     activeBindingId===previousBindingId,
     'D1_BINDINGS_NOT_CONFIRMED_UNCHANGED');
 add(accessPolicyVerified===true,'ACCESS_RULES_NOT_VERIFIED');
 add(approvalRecorded===true,'EXPLICIT_APPROVAL_MISSING');
 return {
   candidateForManualReview:blockers.length===0,
   rollbackPerformed:false,
   dataRestorePerformed:false,
   blockers,
   warning:'Wrangler rollback cambia inmediatamente el despliegue activo. NO restaura D1; un restore D1 es destructivo y requiere autorización aparte.'
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 console.log(JSON.stringify(generateReleaseReadiness(readReleaseInputs()),null,2));
}
