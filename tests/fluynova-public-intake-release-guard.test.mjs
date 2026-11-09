import test from 'node:test';
import assert from 'node:assert/strict';
import {auditClosedRelease,readReleaseInputs} from '../infra/fluynova-public-intake-worker/release-guard.mjs';
const baseline=readReleaseInputs();
const modify=(fn)=>{
 const c=structuredClone(baseline);
 fn(c);
 return auditClosedRelease(c);
};
test('candidate safe-closed, jamás declarado listo para tráfico real',()=>{
 const report=auditClosedRelease(baseline);
 assert.deepEqual(report.failures,[]);
 assert.equal(report.safeClosed,true);
 assert.equal(report.readyForPublicTraffic,false);
 assert.ok(report.outstanding.length>=5);
});
test('encender cualquiera de las compuertas detiene la preparación',()=>{
 for(const field of ['ENABLE_PUBLIC_INTAKE','ENABLE_CONTACT_SUBMISSIONS']){
  assert.equal(modify(c=>{c.candidate.vars[field]='true'}).safeClosed,false,field);
 }
});
test('rutas, workers.dev y previews impiden certificar candidato cerrado',()=>{
 for(const field of ['workers_dev','preview_urls','routes','route','assets']){
  const report=modify(c=>{c.candidate[field]=['workers_dev','preview_urls'].includes(field)?true:[]});
  assert.equal(report.safeClosed,false,field);
 }
});
test('binding D1 remoto exige revisión independiente',()=>{
 const r=modify(c=>{c.candidate.d1_databases=[{binding:'DB',database_name:'fluynova-leads-staging'}]});
 assert.ok(r.failures.includes('REMOTE_CONFIG_PRESENT_D1_DATABASES'));
});
test('dominio real o hostname Turnstile distinto no se abre desde este PR',()=>{
 assert.equal(modify(c=>{c.candidate.vars.ALLOWED_ORIGINS='https://fluynova-web.onrender.com'}).safeClosed,false);
 assert.equal(modify(c=>{c.candidate.vars.TURNSTILE_HOSTNAMES='fluynova.com.ar'}).safeClosed,false);
});
test('variables y secretos extra no pasan el gate',()=>{
 assert.equal(modify(c=>{c.candidate.vars.TURNSTILE_SECRET_KEY='DUMMY'}).safeClosed,false);
 assert.equal(modify(c=>{c.candidate.vars.NEW_FLAG='value'}).safeClosed,false);
});
test('cambio de nombre o D1 del Worker privado detiene el gate',()=>{
 assert.equal(modify(c=>{c.privateWorker.name='unknown'}).safeClosed,false);
 assert.equal(modify(c=>{c.privateWorker.d1_databases[0].database_name='other-db'}).safeClosed,false);
 assert.equal(modify(c=>{c.privateWorker.vars.ENABLE_CONTACT_SUBMISSIONS='true'}).safeClosed,false);
});
test('sin dry-run en package o con deploy en CI se rechaza',()=>{
 assert.equal(modify(c=>{c.pkg.scripts.dryrun='wrangler deploy'}).safeClosed,false);
 const r=modify(c=>{c.workflow+='\n      - name: PUBLICAR\n        run: npx wrangler deploy\n'});
 assert.ok(r.failures.includes('LIVE_DEPLOY_COMMAND_IN_CI'));
});
test('sin ejecución del auditor en CI falla cerrado',()=>{
 const r=modify(c=>{c.workflow=c.workflow.replace('node --test tests/fluynova-public-intake-release-guard.test.mjs','')});
 assert.ok(r.failures.includes('CI_RELEASE_GUARD_MISSING'));
});
test('nombres de secretos obligatorios y sin valores: omisiones o extras fallan',()=>{
 const omitted=modify(c=>{delete c.candidate.secrets});
 assert.ok(omitted.failures.includes('REQUIRED_SECRETS_DECLARATION_CHANGED'));
 const altered=modify(c=>{c.candidate.secrets.required=['TURNSTILE_SECRET_KEY']});
 assert.ok(altered.failures.includes('REQUIRED_SECRETS_DECLARATION_CHANGED'));
 const extended=modify(c=>{c.candidate.secrets.required.push('UNREVIEWED_KEY')});
 assert.ok(extended.failures.includes('REQUIRED_SECRETS_DECLARATION_CHANGED'));
 const misplaced=modify(c=>{c.candidate.vars.RATE_HASH_SECRET='DUMMY'}); 
 assert.equal(misplaced.safeClosed,false);
 const value=modify(c=>{c.candidate.secrets.TURNSTILE_SECRET_KEY='DUMMY'}); 
 assert.ok(value.failures.includes('REQUIRED_SECRETS_DECLARATION_CHANGED'));
});


test('campos de Wrangler no revisados (env, rutas, bindings, CI) nunca pasan SAFE_CLOSED',()=>{
 const forbidden={
  env:{production:{vars:{ENABLE_PUBLIC_INTAKE:'true',ENABLE_CONTACT_SUBMISSIONS:'true'},routes:['fluynova.example/*']}},
  services:[{binding:'OTHER',service:'private-worker'}],
  dispatch_namespaces:[{binding:'DISPATCH',namespace:'danger'}],
  unsafe:{bindings:[{name:'BYPASS',type:'secret_text',text:'unsafe'}]},
  tail_consumers:[{service:'other-worker'}],
  kv_namespaces:[{binding:'KV',id:'fake'}],
  r2_buckets:[{binding:'BUCKET',bucket_name:'fake'}],
 };
 for(const [field,value] of Object.entries(forbidden)){
  const r=modify(c=>{c.candidate[field]=value});
  assert.equal(r.safeClosed,false,field);
  assert.ok(r.failures.includes('UNREVIEWED_PUBLIC_CONFIG_'+field.toUpperCase()),field);
 }
});
test('fecha de compatibilidad y observabilidad requieren revisión expresa',()=>{
 const date=modify(c=>{c.candidate.compatibility_date='2026-11-09'});
 assert.ok(date.failures.includes('COMPATIBILITY_DATE_UNREVIEWED'));
 const observable=modify(c=>{c.candidate.observability.enabled=true});
 assert.ok(observable.failures.includes('OBSERVABILITY_UNREVIEWED'));
 const extra=modify(c=>{c.candidate.observability.logs={enabled:true}});
 assert.ok(extra.failures.includes('OBSERVABILITY_UNREVIEWED'));
});

test('CI bloquea mutaciones remotas distintas de wrangler deploy',()=>{
 const commands=[
   'npx wrangler versions upload',
   'npx wrangler versions deploy',
   'npx wrangler versions secret put TURNSTILE_SECRET_KEY',
   'npx wrangler secret put RATE_HASH_SECRET',
   'npx wrangler triggers deploy',
   'npx wrangler d1 execute fluynova-leads-staging --remote',
   'npx wrangler pages deploy ./dist',
   'npx wrangler rollback previous-version',
   'npx wrangler deploy --temporary',
   'npm run publish',
   'pnpm run deploy',
   'yarn run promote',
   'curl -X POST https://api.cloudflare.com/client/v4/accounts/example/workers',
 ];
 for(const command of commands){
   const report=modify(c=>{c.workflow+='\n      - name: Intento de modificación\n        run: '+command+'\n'});
   assert.ok(report.failures.includes('LIVE_DEPLOY_COMMAND_IN_CI'),
     'No bloquearía comando remoto: '+command);
 }
});
test('CI rechaza acciones Cloudflare y referencias a credenciales',()=>{
 for(const fragment of [
  '\n      - uses: cloudflare/wrangler-action@v3',
  '\n      - uses: cloudflare/pages-action@v1',
  '\n      - name: Credencial\n        env:\n          CLOUDFLARE_API_TOKEN: hidden',
  '\n      - name: Credencial\n        env:\n          CF_API_KEY: hidden',
  '\n      - name: Credencial\n        run: echo ' + '$' + '{{ secrets.CLOUDFLARE_TOKEN }}',
 ]){
  const report=modify(c=>{c.workflow+=fragment+'\n'});
  assert.ok(report.failures.includes('LIVE_DEPLOY_COMMAND_IN_CI'),fragment);
 }
});
test('package scripts están en allowlist; tareas nuevas no pasan la auditoría',()=>{
 for(const action of [
  c=>{c.pkg.scripts.publish='wrangler versions deploy';},
  c=>{c.pkg.scripts.check='wrangler deploy --dry-run';},
  c=>{c.pkg.scripts.deploy='echo HELLO';}
 ]){
  const report=modify(action);
  assert.ok(report.failures.includes('UNREVIEWED_PACKAGE_SCRIPT'));
 }
});
test('Worker privado: un origen real o rutas nuevas exigen revisión independiente',()=>{
 const changedOrigin=modify(c=>{c.privateWorker.vars.ALLOWED_ORIGINS='https://fluynova-web.onrender.com'});
 assert.ok(changedOrigin.failures.includes('PRIVATE_WORKER_ORIGINS_CHANGED'));
 const changedHostname=modify(c=>{c.privateWorker.vars.TURNSTILE_HOSTNAMES='fluynova.com.ar'});
 assert.ok(changedHostname.failures.includes('PRIVATE_WORKER_ORIGINS_CHANGED'));
 const changedRoute=modify(c=>{c.privateWorker.routes=[{pattern:'fluynova.example/*'}]});
 assert.ok(changedRoute.failures.includes('PRIVATE_WORKER_ROUTES_CHANGED'));
});

test('el SQL de idempotencia actual es aditivo, no modifica datos y no autoriza remoto',()=>{
 const r=modify(()=>{});
 assert.equal(r.safeClosed,true,JSON.stringify(r.failures));
 const annotated=modify(c=>{c.migrationSql='-- Auditoría solamente\\n'+c.migrationSql;});
 assert.equal(annotated.safeClosed,true,'Los comentarios de línea no cambian las sentencias');
});
test('CI bloquea migraciones alteradas o destructivas antes de cualquier D1',()=>{
 const changes=[
  s=>s+'\\nDROP TABLE leads;',
  s=>s+'\\nDELETE FROM lead_rate_limit;',
  s=>s+'\\nUPDATE leads SET status = \'Descartado\';',
  s=>s.replace('lead_id TEXT NOT NULL UNIQUE','lead_id TEXT NOT NULL'),
  s=>s.replace('payload_mac TEXT NOT NULL','payload_mac TEXT'),
  s=>s.replace('ON lead_idempotency(created_at)','ON leads(received_at)'),
  s=>s.replace('CREATE TABLE IF NOT EXISTS lead_idempotency',
    'CREATE TABLE IF NOT EXISTS leads'),
  s=>s.replace('created_at TEXT NOT NULL','created_at TEXT NOT NULL, leaked TEXT'),
  s=>s+'\\nCREATE TRIGGER leaked AFTER INSERT ON leads BEGIN SELECT 1; END;',
 ];
 for(const change of changes){
  const bad=modify(c=>{c.migrationSql=change(c.migrationSql)});
  assert.ok(bad.failures.includes('MIGRATION_SQL_NOT_ALLOWLISTED'),
   'Se rechazó el SQL modificado antes de permitir la preparación');
 }
 const absent=modify(c=>{delete c.migrationSql});
 assert.ok(absent.failures.includes('MIGRATION_SQL_NOT_ALLOWLISTED'));
});
