/**
 * Auditoría de preparación del receptor público FLUYNOVA.
 * Solo lee archivos locales; nunca llama a Cloudflare, nunca despliega.
 * PASS significa SAFE_CLOSED, no que esté autorizado para publicación.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const local=(relative)=>fileURLToPath(new URL(relative,import.meta.url));
export const readReleaseInputs=()=>({
  candidate:JSON.parse(readFileSync(local('./wrangler.jsonc'),'utf8')),
  privateWorker:JSON.parse(readFileSync(local('../fluynova-contact-worker/wrangler.jsonc'),'utf8')),
  pkg:JSON.parse(readFileSync(local('./package.json'),'utf8')),
  workflow:readFileSync(local('../../.github/workflows/fluynova-public-intake-candidate.yml'),'utf8'),
});

export function auditClosedRelease({candidate,privateWorker,pkg,workflow}) {
  const failures=[];
  const requireSafe=(ok,code)=>{if(!ok)failures.push(code)};
  requireSafe(candidate?.name==='fluynova-public-intake-candidate','WRONG_PUBLIC_WORKER');
  requireSafe(candidate?.main==='./index.mjs','UNEXPECTED_ENTRYPOINT');
  requireSafe(candidate?.workers_dev===false,'WORKERS_DEV_EXPOSED');
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
  const publicText=JSON.stringify(candidate||{});
  requireSafe(!/secret|api.token|password|credential|service_role|private.key/i.test(publicText),
    'SECRET_IN_PUBLIC_CONFIG');
  requireSafe(privateWorker?.name==='fluynova-contact-staging-only','PRIVATE_WORKER_CHANGED');
  requireSafe(privateWorker?.vars?.ENABLE_CONTACT_SUBMISSIONS==='false','PRIVATE_WORKER_OPEN');
  requireSafe(privateWorker?.d1_databases?.length===1&&
    privateWorker.d1_databases[0]?.binding==='DB'&&
    privateWorker.d1_databases[0]?.database_name==='fluynova-leads-staging'&&
    privateWorker.d1_databases[0]?.database_id==='ce8ac477-dd77-4a1c-a42e-6096dcb78768',
    'PRIVATE_D1_CHANGED');
  requireSafe(pkg?.scripts?.dryrun==='wrangler deploy --dry-run','DRYRUN_COMMAND_CHANGED');
  requireSafe(!/(?:^|\n)\s*(?:-\s*)?(?:run:\s*)?(?:npx\s+)?wrangler\s+deploy\b|(?:^|\n)\s*(?:run:\s*)?npm\s+run\s+deploy\b|CLOUDFLARE_API_TOKEN|api\.cloudflare\.com/i.test(String(workflow)),
    'LIVE_DEPLOY_COMMAND_IN_CI');
  requireSafe(typeof workflow==='string'&&
    workflow.includes("feature/fluynova-public-intake-isolated-20261108")&&
    workflow.includes('npm run dryrun')&&
    workflow.includes('node --test tests/fluynova-public-intake-release-guard.test.mjs'),
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
