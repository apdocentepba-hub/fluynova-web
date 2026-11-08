import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const path=fileURLToPath(new URL('../infra/fluynova-contact-worker/wrangler.jsonc',import.meta.url));
const config=JSON.parse(readFileSync(path,'utf8'));

test('configuración no toca otros Workers ni otra base D1',()=>{
 assert.equal(config.name,'fluynova-contact-staging-only');
 assert.equal(config.main,'./index.mjs');
 assert.equal(config.workers_dev,true);
 assert.equal(config.d1_databases.length,1);
 assert.deepEqual(config.d1_databases[0],{
   binding:'DB',
   database_name:'fluynova-leads-staging',
   database_id:'ce8ac477-dd77-4a1c-a42e-6096dcb78768'
 });
 assert.equal(config.routes,undefined);
 assert.equal(config.route,undefined);
});
test('el staging no recibe consultas incluso después de conectarlo a GitHub',()=>{
 assert.equal(config.vars.ENABLE_CONTACT_SUBMISSIONS,'false');
 assert.equal(config.vars.ALLOWED_ORIGINS,'https://fluynova-staging.invalid');
 assert.equal(config.vars.TURNSTILE_HOSTNAMES,'fluynova-staging.invalid');
 assert.equal(config.observability.enabled,false);
 assert.deepEqual(config.triggers.crons,['0 4 * * *']);
});
test('no se incluyen secretos ni autorización de tráfico en la configuración',()=>{
 const text=JSON.stringify(config);
 for(const item of ['TURNSTILE_SECRET_KEY','RATE_HASH_SECRET','cf_api_token','service_role','apdocentepba-web','alerta-amba'])
  assert.equal(text.includes(item),false,'Dato prohibido '+item);
});
