import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditAdminReleaseInputs,currentPreflight,releaseReport}
 from './release-preflight.mjs';
const root=new URL('../',import.meta.url);
const workflow=new URL('../../../.github/workflows/fluynova-admin-readonly-candidate.yml',import.meta.url);

async function baseline(){
 const [a,b,c,d,e]=await Promise.all([
  readFile(new URL('wrangler.jsonc',root),'utf8'),
  readFile(new URL('index.mjs',root),'utf8'),
  readFile(workflow,'utf8'),
  readFile(new URL('admin-assets.generated.mjs',root),'utf8'),
  readFile(new URL('package.json',root),'utf8')
 ]);
 return {
  config:JSON.parse(a),entry:b,workflowText:c,assets:d,packageConfig:JSON.parse(e)
 };
}
function altered(value,modify){
 const clone=structuredClone(value);
 modify(clone);
 return auditAdminReleaseInputs(clone);
}
test('release preflight offline confirma código seguro pero jamás certifica Cloudflare real',async()=>{
 const result=await currentPreflight();
 assert.equal(result.localSafe,true,JSON.stringify(result.errors));
 assert.equal(result.status,'OFFLINE_GATES_PASS_REMOTE_BLOCKED');
 assert.equal(result.deployReady,false);
 assert.equal(result.deployAuthorized,false);
 assert.equal(result.remoteVerified,false);
 assert.deepEqual(result.errors,[]);
 const packet=await releaseReport();
 assert.equal(packet.offlineAudit.localSafe,true);
 assert.equal(packet.safeToDeploy,false);
 assert.equal(packet.liveAccessConfigured,false);
 assert.equal(packet.realD1Verified,false);
 assert.equal(packet.deploymentApprovalRecorded,false);
 assert.ok(packet.remoteRequirements.length>=10);
 assert.ok(packet.riskNotes.some(s=>s.includes('NO revierte cambios D1')));
 assert.ok(packet.riskNotes.some(s=>s.includes('destructivo')));
 console.log('FLUYNOVA_ADMIN_RELEASE_GATE_PASS: local=true, remote=false, deploy=false');
});
test('configuraciones de publicación no autorizadas se rechazan individualmente',async()=>{
 const p=await baseline();
 const risks=[
  x=>x.config.vars.ADMIN_READ_ENABLED='true',
  x=>x.config.workers_dev=true,
  x=>x.config.preview_urls=true,
  x=>x.config.routes=[{pattern:'admin.example.invalid/*',zone_name:'example.invalid'}],
  x=>x.config.route='admin.example.invalid/*',
  x=>x.config.d1_databases=[{binding:'DB',database_name:'fluynova-leads-staging'}],
  x=>x.config.assets={directory:'./dist'},
  x=>x.config.send_email=[{name:'EMAIL'}],
  x=>x.config.triggers={crons:['* * * * *']},
  x=>x.config.vars.ACCESS_TEAM_DOMAIN='https://fake.cloudflareaccess.com',
  x=>x.config.vars.ADMIN_ALLOWED_SUBJECT='ci-admin',
  x=>x.config.observability.enabled=true,
  x=>x.config.name='fluynova-contact-staging-only',
  x=>x.config.env={production:{vars:{ADMIN_READ_ENABLED:'true'}}}
 ];
 for(const risk of risks){
  const result=altered(p,risk);
  assert.equal(result.localSafe,false,JSON.stringify(result));
  assert.equal(result.deployReady,false);
  assert.ok(result.errors.length,'Any remote enablement must be rejected');
 }
});
test('Workflows con comandos Cloudflare mutantes, credenciales o permisos heredados fallan',async()=>{
 const p=await baseline();
 const unsafe=[
  'wrangler deploy',
  'wrangler versions upload',
  'wrangler versions deploy',
  'wrangler rollback',
  'wrangler secret put FOO',
  'wrangler d1 execute DB --remote',
  'wrangler d1 time-travel restore DB',
  'wrangler pages deploy public',
  'curl -X POST https://api.cloudflare.com/client/v4/workers/scripts',
  'CF_API_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'pull_request_target:'
 ];
 for(const command of unsafe){
  const result=altered(p,x=>{x.workflowText+='\n      - run: '+command+'\n'});
  assert.ok(result.errors.includes('WORKFLOW_REMOTE_MUTATION_DETECTED'),command);
  assert.equal(result.deployReady,false);
 }
 const allowed=altered(p,x=>{x.workflowText+='\n      - run: wrangler deploy --dry-run\n'});
 assert.equal(allowed.errors.includes('WORKFLOW_REMOTE_MUTATION_DETECTED'),false);
});
test('Ausencia o alteración de auth, integración D1 y assets produce bloqueo',async()=>{
 const p=await baseline();
 for(const mutation of [
  x=>x.entry=x.entry.replace("import {ADMIN_ASSETS} from './admin-assets.generated.mjs'",""),
  x=>x.entry=x.entry.replace('createRemoteJWKSet,jwtVerify','jwtVerify'),
  x=>x.entry=x.entry.replace('readMailAdminSnapshot','readOtherData'),
  x=>x.entry=x.entry.replace('if(!(await authorized(request,env)))','if(true)'),
  x=>x.entry=x.entry.replace("request.method!=='GET'","request.method==='POST'"),
  x=>x.entry+="\nimport {createHandler} from '../fluynova-contact-worker/index.mjs';",
  x=>x.assets='garbled',
  x=>x.packageConfig.scripts.dryrun='wrangler deploy',
  x=>x.packageConfig.scripts.publish='wrangler deploy'
 ]){
  const result=altered(p,mutation);
  assert.equal(result.localSafe,false,JSON.stringify(result));
 }
});
test('preflight con configuración corrupta jamás habilita despliegue',()=>{
 const state=auditAdminReleaseInputs({config:null});
 assert.equal(state.localSafe,false);
 assert.equal(state.deployReady,false);
 assert.equal(state.remoteVerified,false);
 assert.equal(state.deployAuthorized,false);
});
