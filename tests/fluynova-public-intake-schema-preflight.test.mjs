/**
 * FLUYNOVA — ensayo preflight/migración/reversión en D1 LOCAL (Workerd).
 * No usa Cloudflare remoto, credenciales ni datos personales reales.
 * NO simula Time Travel; verifica sólo compatibilidad y conservación local.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {inspectD1Schema} from '../infra/fluynova-public-intake-worker/schema-preflight.mjs';

const WORKER_DIR=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/',import.meta.url));
const ENTRY=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/index.mjs',import.meta.url));
const BASE=fileURLToPath(new URL('../infra/fluynova-contact-worker/schema.sql',import.meta.url));
const MIGRATION=fileURLToPath(new URL('../infra/fluynova-public-intake-worker/idempotency.schema.sql',import.meta.url));
async function sqlStatements(path) {
 const content=(await readFile(path,'utf8')).replace(/^--.*$/gm,'');
 return content.split(';').map(x=>x.trim()).filter(Boolean);
}
async function apply(db,path) {
 for(const sql of await sqlStatements(path)) {
  const outcome=await db.prepare(sql).run();
  assert.equal(outcome.success,true,'Error en sentencia SQL de entorno local');
 }
}
async function makeD1(t) {
 const dir=await mkdtemp(join(WORKER_DIR,'.fluynova-migration-local-'));
 const bundle=join(dir,'worker.mjs');
 await build({entryPoints:[ENTRY],outfile:bundle,bundle:true,format:'esm',
   platform:'browser',logLevel:'silent'});
 const mf=new Miniflare({modules:true,scriptPath:bundle,cf:false,
   d1Databases:{DB:'fluynova-migration-rehearsal-local'}});
 t.after(async()=>{await mf.dispose();await rm(dir,{recursive:true,force:true})});
 return mf.getD1Database('DB');
}
const SYNTHETIC_ID='22b041ca-11d5-4a46-8ba2-e596e82566e9';
const REQUEST_ID='f4ab4ff2-46ab-4eab-855c-42bd234dce0a';

test('D1 LOCAL: preflight sin PII, migración dos veces, reversión de nueva tabla conserva base',async t=>{
 const db=await makeD1(t);
 await apply(db,BASE);
 await db.prepare(
  'INSERT INTO leads(id,received_at,name,email,category,message,consent_at) '+
  'VALUES(?,?,?,?,?,?,?)'
 ).bind(SYNTHETIC_ID,'2026-11-08T12:00:00Z','Caso ficticio',
  'migration-test@example.invalid','Crear página web / catálogo digital',
  'Mensaje inexistente para prueba en base D1 local','2026-11-08T12:00:00Z').run();
 await db.prepare(
  'INSERT INTO lead_rate_limit(fingerprint,hour_bucket,hits) VALUES(?,?,?)'
 ).bind('ci-hmac-only',123456,3).run();
 const initialLead=await db.prepare('SELECT id,received_at,name,email,message FROM leads').first();
 const initialRate=await db.prepare(
  'SELECT fingerprint,hour_bucket,hits FROM lead_rate_limit').first();

 const auditedQueries=[];
 const auditedDb={prepare(sql){auditedQueries.push(sql);return db.prepare(sql)}};
 const before=await inspectD1Schema(auditedDb);
 assert.equal(before.mode,'SQLITE_MASTER_READ_ONLY');
 assert.equal(before.baseReady,true,JSON.stringify(before.missing));
 assert.equal(before.ledgerReady,false);
 assert.equal(before.migrationNeeded,true);
 assert.equal(before.canApplyInIsolatedLab,true);
 assert.equal(before.remoteVerified,false);
 assert.equal(before.approvedToMigrate,false);
 assert.ok(auditedQueries.length>=5);
 assert.ok(auditedQueries.every(sql=>/^(?:SELECT type,name,tbl_name FROM sqlite_master|PRAGMA (?:table_info|index_info|index_list))/i.test(sql)),
   'El auditor sólo puede leer esquema y metadatos');
 assert.ok(auditedQueries.every(sql=>!/(SELECT \* FROM leads|SELECT .* FROM leads\b|INSERT|DELETE|UPDATE|DROP)/i.test(sql)),
   'El preflight no consulta ni modifica registros personales');

 await apply(db,MIGRATION);
 let checked=await inspectD1Schema(db);
 assert.equal(checked.baseReady,true);
 assert.equal(checked.ledgerReady,true,JSON.stringify(checked.missing));
 assert.equal(checked.migrationNeeded,false);
 assert.deepEqual(checked.missing,[]);
 await apply(db,MIGRATION);
 checked=await inspectD1Schema(db);
 assert.equal(checked.ledgerReady,true,'La migración IF NOT EXISTS admite repetición');
 assert.deepEqual(await db.prepare(
  'SELECT id,received_at,name,email,message FROM leads').first(),initialLead);
 assert.deepEqual(await db.prepare(
  'SELECT fingerprint,hour_bucket,hits FROM lead_rate_limit').first(),initialRate);

 // Verificar restricciones reales del esquema nuevo, sin producción.
 await db.prepare('INSERT INTO lead_idempotency '+
  '(request_id,payload_mac,fingerprint,lead_id,created_at) VALUES(?,?,?,?,?)')
  .bind(REQUEST_ID,'ci-payload-hmac','ci-ip-hmac',SYNTHETIC_ID,'2026-11-08T12:00:00Z').run();
 await assert.rejects(db.prepare('INSERT INTO lead_idempotency '+
  '(request_id,payload_mac,fingerprint,lead_id,created_at) VALUES(?,?,?,?,?)')
  .bind(REQUEST_ID,'different','other','another-lead','2026-11-08T12:01:00Z').run());
 await assert.rejects(db.prepare('INSERT INTO lead_idempotency '+
  '(request_id,payload_mac,fingerprint,lead_id,created_at) VALUES(?,?,?,?,?)')
  .bind('e27ee346-aeb0-43ad-95c6-81e179c2b4de','different','other',
   SYNTHETIC_ID,'2026-11-08T12:01:00Z').run());

 // Reversión LOCAL de tabla nueva, sólo después de vaciar datos ficticios.
 await db.prepare('DELETE FROM lead_idempotency WHERE request_id=?').bind(REQUEST_ID).run();
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM lead_idempotency').first()).n,0);
 await db.prepare('DROP INDEX lead_idempotency_created_at').run();
 await db.prepare('DROP TABLE lead_idempotency').run();
 const reverted=await inspectD1Schema(db);
 assert.equal(reverted.baseReady,true,JSON.stringify(reverted.missing));
 assert.equal(reverted.ledgerReady,false);
 assert.equal(reverted.migrationNeeded,true);
 assert.deepEqual(await db.prepare(
  'SELECT id,received_at,name,email,message FROM leads').first(),initialLead);
 assert.deepEqual(await db.prepare(
  'SELECT fingerprint,hour_bucket,hits FROM lead_rate_limit').first(),initialRate);
 console.log('FLUYNOVA_D1_MIGRATION_LOCAL_PASS: base_preserved=true, migrated=true, reapplied=true, rollback_schema_only=true, remote=false');
});

test('D1 LOCAL: una tabla de idempotencia incompleta o con constraints falsos bloquea preflight',async t=>{
 const db=await makeD1(t);
 await apply(db,BASE);
 await db.prepare('CREATE TABLE lead_idempotency '+
  '(request_id TEXT,payload_mac TEXT,fingerprint TEXT,lead_id TEXT,created_at TEXT)').run();
 await db.prepare('CREATE INDEX lead_idempotency_created_at ON lead_idempotency(created_at)').run();
 let result=await inspectD1Schema(db);
 assert.equal(result.baseReady,true);
 assert.equal(result.ledgerReady,false);
 assert.equal(result.migrationNeeded,false,'Una migración parcial no se vuelve a aplicar automáticamente');
 assert.equal(result.canApplyInIsolatedLab,false);
 assert.ok(result.missing.includes('LEDGER_REQUEST_ID_NOT_PRIMARY_KEY'));
 assert.ok(result.missing.includes('LEDGER_LEAD_ID_NOT_UNIQUE'));
 assert.ok(result.missing.some(x=>x.startsWith('LEDGER_COLUMN_NULLABLE_')));
 assert.equal(result.approvedToMigrate,false);
 await db.prepare('DROP INDEX lead_idempotency_created_at').run();
 result=await inspectD1Schema(db);
 assert.ok(result.missing.includes('PARTIAL_LEDGER_SCHEMA'));
 assert.equal(result.canApplyInIsolatedLab,false);
 console.log('FLUYNOVA_D1_PARTIAL_SCHEMA_FAIL_CLOSED_PASS: remote=false');
});
