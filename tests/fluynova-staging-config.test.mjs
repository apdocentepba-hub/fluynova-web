import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const path=fileURLToPath(new URL(
 '../infra/fluynova-contact-worker/wrangler.staging.example.jsonc',import.meta.url));
const source=readFileSync(path,'utf8');
const cfg=JSON.parse(source);
test('plantilla staging no se despliega públicamente por defecto',()=>{
 assert.equal(cfg.name,'fluynova-contact-staging-only');
 assert.equal(cfg.workers_dev,false);
 assert.equal(cfg.main,'infra/fluynova-contact-worker/index.mjs');
 assert.deepEqual(cfg.triggers.crons,['0 4 * * *']);
 assert.equal(cfg.observability.enabled,false);
 assert.equal(cfg.vars.ENABLE_CONTACT_SUBMISSIONS,'false', 'El staging se publica sin recibir consultas');
 assert.ok(!('routes' in cfg)&&!('route' in cfg));
});
test('la base D1 del staging coincide con la base exclusiva creada en Cloudflare',()=>{
 assert.equal(cfg.d1_databases.length,1);
 assert.equal(cfg.d1_databases[0].binding,'DB');
 assert.equal(cfg.d1_databases[0].database_name,'fluynova-leads-staging');
 assert.equal(cfg.d1_databases[0].database_id,'ce8ac477-dd77-4a1c-a42e-6096dcb78768');
 assert.match(cfg.vars.ALLOWED_ORIGINS,/^https:\/\/REPLACE-WITH-FLUYNOVA-STAGING\.invalid$/);
 assert.equal(cfg.vars.TURNSTILE_HOSTNAMES,'REPLACE-WITH-FLUYNOVA-STAGING.invalid');
 assert.doesNotMatch(source,/apdocentepba|alerta-amba|supabase/i);
});
test('ningún secreto, correo personal o credencial aparece en la plantilla',()=>{
 for(const forbidden of ['TURNSTILE_SECRET_KEY','RATE_HASH_SECRET','service_role',
  'private_key','password','contacto.fluynova@gmail.com']){
   assert.equal(source.includes(forbidden),false,forbidden);
 }
 assert.equal(cfg.env,undefined,'Ningún entorno con tráfico activado');
});
