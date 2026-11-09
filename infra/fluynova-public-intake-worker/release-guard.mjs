/**
 * Auditoría de preparación del receptor público FLUYNOVA.
 * Solo lee archivos locales; nunca llama a Cloudflare, nunca despliega.
 * PASS significa SAFE_CLOSED, no que esté autorizado para publicación.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readMigrationSql,auditMigrationSql} from './migration-guard.mjs';

const local=(relative)=>fileURLToPath(new URL(relative,import.meta.url));
export const readReleaseInputs=()=>({
  candidate:JSON.parse(readFileSync(local('./wrangler.jsonc'),'utf8')),
  privateWorker:JSON.parse(readFileSync(local('../fluynova-contact-worker/wrangler.jsonc'),'utf8')),
  privateSource:readFileSync(local('../fluynova-contact-worker/index.mjs'),'utf8'),
  publicEntry:readFileSync(local('./index.mjs'),'utf8'),
  publicHandler:readFileSync(local('./contact-handler.mjs'),'utf8'),
  pkg:JSON.parse(readFileSync(local('./package.json'),'utf8')),
  workflow:readFileSync(local('../../.github/workflows/fluynova-public-intake-candidate.yml'),'utf8'),
  migrationSql:readMigrationSql(),
});

export function auditClosedRelease({candidate,privateWorker,privateSource,publicEntry,publicHandler,pkg,workflow,migrationSql}) {
  const failures=[];
  const requireSafe=(ok,code)=>{if(!ok)failures.push(code)};
  requireSafe(candidate?.name==='fluynova-public-intake-candidate','WRONG_PUBLIC_WORKER');
  requireSafe(auditMigrationSql(migrationSql).safe,'MIGRATION_SQL_NOT_ALLOWLISTED');
  requireSafe(candidate?.main==='./index.mjs','UNEXPECTED_ENTRYPOINT');
  // Allowlist cerrada: Wrangler admite env.<nombre>, bindings y rutas que podrían
  // sobrescribir el modo apagado si en el futuro se invoca --env.
  // Cualquier campo nuevo exige una revisión explícita antes de incorporarlo.
  const approvedConfigFields=new Set([
    'name','main','compatibility_date','workers_dev','preview_urls',
    'observability','vars','secrets'
  ]);
  for(const field of Object.keys(candidate||{})){
    requireSafe(approvedConfigFields.has(field),'UNREVIEWED_PUBLIC_CONFIG_'+field.toUpperCase());
  }
  requireSafe(candidate?.compatibility_date==='2026-11-08','COMPATIBILITY_DATE_UNREVIEWED');
  requireSafe(candidate?.observability?.enabled===false&&
    Object.keys(candidate.observability).length===1,'OBSERVABILITY_UNREVIEWED');
  requireSafe(candidate?.workers_dev===false,'WORKERS_DEV_EXPOSED');
  requireSafe(candidate?.preview_urls===false,'PREVIEW_URLS_MUST_BE_OFF');
  for(const field of ['route','routes','d1_databases','triggers','account_id','assets','zone_id','site']){
    requireSafe(candidate?.[field]===undefined,'REMOTE_CONFIG_PRESENT_'+field.toUpperCase());
  }
  const vars=candidate?.vars||{};
  requireSafe(vars.ENABLE_PUBLIC_INTAKE==='false','PUBLIC_INTAKE_MUST_REMAIN_OFF');
  requireSafe(vars.ENABLE_CONTACT_SUBMISSIONS==='false','SUBMISSIONS_MUST_REMAIN_OFF');
  requireSafe(vars.ALLOWED_ORIGINS==='https://fluynova-staging.invalid','UNEXPECTED_ORIGIN');
  requireSafe(vars.TURNSTILE_HOSTNAMES==='fluynova-staging.invalid','UNEXPECTED_TURNSTILE_HOST');
  requireSafe(Object.keys(vars).sort().join('|')===
    ['ENABLE_PUBLIC_INTAKE','ENABLE_CONTACT_SUBMISSIONS','ALLOWED_ORIGINS','TURNSTILE_HOSTNAMES'].sort().join('|'),
    'UNREVIEWED_PUBLIC_VARIABLE');
  // Wrangler valida los NOMBRES requeridos sin exponer sus valores en Git.
  // No se admiten otras claves en el bloque ni claves secretas entre vars.
  const required=['RATE_HASH_SECRET','TURNSTILE_SECRET_KEY'];
  requireSafe(candidate?.secrets&&Object.keys(candidate.secrets).join('|')==='required'&&
    Array.isArray(candidate.secrets.required)&&
    [...candidate.secrets.required].sort().join('|')===required.join('|'),
    'REQUIRED_SECRETS_DECLARATION_CHANGED');
  const publicText=JSON.stringify({...candidate,secrets:undefined});
  requireSafe(!/secret|api.token|password|credential|service_role|private.key/i.test(publicText),
    'SECRET_IN_PUBLIC_CONFIG');

  // Congelar el código del Worker privado, no solamente su wrangler.jsonc.
  // Usar el hash Git blob del archivo base staging (dato público, NO secreto).
  // Un cambio en el código del Worker privado no debe entrar desde este PR.
  const privateSourceHash=typeof privateSource==='string'
    ?createHash('sha1').update('blob '+Buffer.byteLength(privateSource)+'\0')
      .update(privateSource).digest('hex')
    :'';
  requireSafe(privateSourceHash==='d1811e9bf4a35bec0baecbe05ab3833d8360e536',
    'PRIVATE_WORKER_SOURCE_CHANGED');
  // Este Worker debe depender de su copia propia: nunca importar
  // el módulo que Cloudflare Builds despliega para staging privado.
  requireSafe(typeof publicEntry==='string'&&
    publicEntry.includes("from './contact-handler.mjs'")&&
    !publicEntry.includes('../fluynova-contact-worker/'),
    'PUBLIC_WORKER_IMPORTS_PRIVATE_BACKEND');
  requireSafe(typeof publicHandler==='string'&&
    publicHandler.includes('export function createHandler(')&&
    publicHandler.includes('async function persistIdempotentLead(')&&
    !/\bimport\s*(?:\(|\{|\*|['"])/.test(publicHandler)&&
    !publicHandler.includes('../fluynova-contact-worker/'),
    'PUBLIC_HANDLER_NOT_SELF_CONTAINED');
  requireSafe(privateWorker?.name==='fluynova-contact-staging-only','PRIVATE_WORKER_CHANGED');
  requireSafe(privateWorker?.vars?.ENABLE_CONTACT_SUBMISSIONS==='false','PRIVATE_WORKER_OPEN');
  // El backend privado no debe aceptar orígenes/hostnames verdaderos desde
  // un cambio en esta feature. Access remoto sigue requiriendo auditoría propia.
  requireSafe(privateWorker?.vars?.ALLOWED_ORIGINS==='https://fluynova-staging.invalid'&&
    privateWorker?.vars?.TURNSTILE_HOSTNAMES==='fluynova-staging.invalid',
    'PRIVATE_WORKER_ORIGINS_CHANGED');
  requireSafe(privateWorker?.routes===undefined&&privateWorker?.route===undefined,
    'PRIVATE_WORKER_ROUTES_CHANGED');
  requireSafe(privateWorker?.d1_databases?.length===1&&
    privateWorker.d1_databases[0]?.binding==='DB'&&
    privateWorker.d1_databases[0]?.database_name==='fluynova-leads-staging'&&
    privateWorker.d1_databases[0]?.database_id==='ce8ac477-dd77-4a1c-a42e-6096dcb78768',
    'PRIVATE_D1_CHANGED');
  // La rama candidata NO puede invocar operaciones remotas de Cloudflare.
  // Una actualización de versión, secretos, cron o D1 puede mutar recursos
  // sin ejecutar el comando clásico "wrangler deploy".
  // Solo admitimos scripts de package.json conocidos y CI de pruebas offline.
  requireSafe(pkg?.scripts?.dryrun==='wrangler deploy --dry-run','DRYRUN_COMMAND_CHANGED');
  requireSafe(pkg?.scripts?.check==='node --check index.mjs'&&
    Object.keys(pkg.scripts).sort().join('|')==='check|dryrun',
    'UNREVIEWED_PACKAGE_SCRIPT');
  const ciText=String(workflow||'');
  const mutatingCli=/\b(?:wrangler|cf)\s+(?:deploy\b|publish\b|rollback\b|delete\b|versions\s+(?:upload|deploy|secret\b|rollback\b)|secret\b|triggers\b|pages\s+(?:deploy|publish)\b|d1\s+(?:execute|migrations\s+apply)\b)/i;
  const indirectPublish=/\b(?:npm|pnpm|yarn)\s+run\s+(?:deploy|publish|release|promote|apply|upload|migrate|migrations)\b/i;
  const cloudflareCredential=/CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CF_API_KEY|api\.cloudflare\.com|cloudflare\/(?:wrangler-action|pages-action)@|secrets\.(?:CLOUDFLARE|CF_)/i;
  requireSafe(!mutatingCli.test(ciText)&&!indirectPublish.test(ciText)&&
    !cloudflareCredential.test(ciText),'LIVE_DEPLOY_COMMAND_IN_CI');
  requireSafe(typeof workflow==='string'&&
    workflow.includes("feature/fluynova-public-intake-isolated-20261108")&&
    workflow.includes('npm run dryrun')&&
    workflow.includes('node --test tests/fluynova-public-intake-release-guard.test.mjs')&&
    workflow.includes('node infra/fluynova-public-intake-worker/release-guard.mjs')&&
    workflow.includes('node --test tests/fluynova-public-intake-release-readiness.test.mjs'),
    'CI_RELEASE_GUARD_MISSING');
  return {
    safeClosed:failures.length===0,
    readyForPublicTraffic:false, // SIEMPRE requiere verificación externa + autorización.
    failures,
    outstanding:[
      'Dominio público exclusivo verificado y controles Cloudflare Access/WAF por Worker',
      'Widget Turnstile real para dominio autorizado; secret solo en Cloudflare',
      'Binding D1 exclusivamente de FLUYNOVA y secreto HMAC privado',
      'Política de retención, lectura y eliminación de leads',
      'Prueba remota con datos ficticios y consentimiento; revisión y aprobación explícita'
    ]
  };
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const report=auditClosedRelease(readReleaseInputs());
  console.log(JSON.stringify({status:report.safeClosed?'SAFE_CLOSED':'UNSAFE',...report},null,2));
  if(!report.safeClosed)process.exitCode=1;
}
