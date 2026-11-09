/**
 * FLUYNOVA — pruebas de respaldos cifrados con Workerd + D1 LOCAL.
 * Los únicos nombres/emails son artefactos falsos .invalid.
 * El archivo cifrado nunca contiene clientes reales ni secretos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {createEncryptedSnapshot,decryptSnapshotForLocalRecovery,TABLES}
 from './encrypted-snapshot.mjs';

const PASSWORD='Solo-Pruebas-CI! Clave-ficticia-2026';
const AT='2026-11-09T14:00:00.000Z';
const FIRST='5e854940-2f39-4a10-8c9f-48dcbb14c421';
const SECOND='6053b7e8-e73a-4866-8b8a-40e0e47fe8da';
const R1='ab59c1c5-07eb-42a9-a32e-314b66578827';
const R2='e2b16b83-c077-47ab-acb6-edfa156cd18c';
const schemas=[
 '../../fluynova-contact-worker/schema.sql',
 '../../fluynova-public-intake-worker/idempotency.schema.sql',
 '../../fluynova-public-intake-worker/mail-outbox.schema.sql'
];
async function prepareDatabase(t,name){
 const mf=new Miniflare({
  modules:true,script:"export default {fetch(){return new Response('local only')}}",
  d1Databases:{DB:name},cf:false
 });
 t.after(async()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const file of schemas) {
  const raw=await readFile(new URL(file,import.meta.url),'utf8');
  for(const sql of raw.replace(/^--.*$/gm,'').split(';').map(x=>x.trim()).filter(Boolean)){
   const result=await db.prepare(sql).run();
   assert.equal(result.success,true,'Schema LOCAL');
  }
 }
 return db;
}
async function populate(db){
 for(const [id,name,email,msg] of [
  [FIRST,'Persona CI ficticia 1','cliente1@example.invalid','HTML <script>alert(1)</script>, € y ñ'],
  [SECOND,'Persona CI ficticia 2','cliente2@example.invalid','Mensaje sintético, sin datos reales']
 ]){
  const result=await db.prepare(
   'INSERT INTO leads (id,received_at,name,email,category,message,consent_at) '+
   'VALUES(?,?,?,?,?,?,?)'
  ).bind(id,AT,name,email,'Crear página web / catálogo digital',msg,AT).run();
  assert.equal(result.success,true);
 }
 assert.equal((await db.prepare(
  'INSERT INTO lead_rate_limit(fingerprint,hour_bucket,hits) VALUES(?,?,?)'
 ).bind('hmac-ci-not-an-ip',5012,3).run()).success,true);
 for(const [req,lead,mac] of [[R1,FIRST,'mac-ci-a'],[R2,SECOND,'mac-ci-b']]){
  assert.equal((await db.prepare(
   'INSERT INTO lead_idempotency (request_id,payload_mac,fingerprint,lead_id,created_at) '+
   'VALUES(?,?,?,?,?)'
  ).bind(req,mac,'hmac-ip-ficticia',lead,AT).run()).success,true);
 }
 for(const [lead,state] of [[FIRST,'pending'],[SECOND,'bounced']]){
  assert.equal((await db.prepare(
   'INSERT INTO lead_mail_outbox(lead_id,state,attempts,created_at,updated_at) '+
   'VALUES(?,?,?,?,?)'
  ).bind(lead,state,1,AT,AT).run()).success,true);
 }
}
async function insertIntoEmptyLocalDatabase(db,snapshot) {
 // Sólo usada por este test. NO existe función restore de producción.
 const statements=[];
 for(const t of TABLES){
  const placeholders=t.columns.map(()=>'?').join(',');
  const sql='INSERT INTO '+t.name+' ('+t.columns.join(',')+') VALUES ('+placeholders+')';
  for(const row of snapshot.tables[t.name])
   statements.push(db.prepare(sql).bind(...t.columns.map(x=>row[x])));
 }
 if(statements.length) {
  const results=await db.batch(statements);
  assert.equal(results.length,statements.length);
  assert.ok(results.every(x=>x?.success===true));
 }
}
test('D1 LOCAL: cuatro tablas, contenido cifrado, recuperación en D1 NUEVA vacía',async t=>{
 const db=await prepareDatabase(t,'fluynova-backup-source-ci');
 await populate(db);
 const snapshot=await createEncryptedSnapshot(db,PASSWORD,{now:()=>AT});
 assert.equal(snapshot.kind,'FLUYNOVA_D1_ENCRYPTED_V1');
 assert.equal(snapshot.version,1);
 assert.equal(snapshot.kdf,'scrypt');
 assert.equal(snapshot.N,32768);
 assert.equal(snapshot.r,8);
 assert.equal(snapshot.p,1);
 assert.deepEqual(Object.keys(snapshot).sort(),[
  'N','ciphertext','iv','kdf','kind','p','r','salt','tag','version'
 ].sort());
 const serialized=JSON.stringify(snapshot);
 for(const forbidden of [
  'Persona CI ficticia','cliente1@example.invalid',
  '<script>alert','mac-ci-a','hmac-ci-not-an-ip',FIRST,SECOND
 ])assert.equal(serialized.includes(forbidden),false,'No exponer información cifrada');
 const decoded=await decryptSnapshotForLocalRecovery(snapshot,PASSWORD);
 assert.equal(decoded.schema,'FLUYNOVA_KNOWN_TABLES_V1');
 assert.equal(decoded.createdAt,AT);
 assert.deepEqual(Object.keys(decoded.tables),TABLES.map(t=>t.name));
 assert.deepEqual(TABLES.map(t=>decoded.tables[t.name].length),[2,1,2,2]);
 assert.equal(decoded.tables.leads[0].message,'HTML <script>alert(1)</script>, € y ñ');
 const target=await prepareDatabase(t,'fluynova-backup-recovery-ci');
 await insertIntoEmptyLocalDatabase(target,decoded);
 const restored=await createEncryptedSnapshot(target,PASSWORD,{now:()=>AT});
 const checked=await decryptSnapshotForLocalRecovery(restored,PASSWORD);
 assert.deepEqual(checked,decoded,'Las cuatro tablas coinciden tras recuperación LOCAL');
 assert.notEqual(restored.salt,snapshot.salt,'Sal nueva por cada respaldo');
 assert.notEqual(restored.iv,snapshot.iv,'IV nuevo por cada respaldo');
 assert.notEqual(restored.ciphertext,snapshot.ciphertext,'AES-GCM no determinista');
 console.log('FLUYNOVA_BACKUP_ENCRYPTED_D1_LOCAL_PASS: tables=4, restored=4, client_records=synthetic, remote=false, encrypted=true');
});
test('AES-GCM detecta clave incorrecta, cambio de tag/ciphertext o sobre adulterado',async t=>{
 const db=await prepareDatabase(t,'fluynova-backup-integrity-ci');
 const snapshot=await createEncryptedSnapshot(db,PASSWORD,{now:()=>AT});
 await assert.rejects(
  decryptSnapshotForLocalRecovery(snapshot,'Clave-distinta-muy-larga-y-segura-CI'),
  /BACKUP_UNLOCK_FAILED/);
 for(const mutation of [
  o=>{o.tag=(o.tag[0]==='A'?'B':'A')+o.tag.slice(1)},
  o=>{o.ciphertext=(o.ciphertext[0]==='A'?'B':'A')+o.ciphertext.slice(1)},
  o=>{o.N=1024},
  o=>{o.iv='AA=='},
  o=>{o.extra='no autorizado'},
  o=>{delete o.kind}
 ]){
  const fake=structuredClone(snapshot);mutation(fake);
  await assert.rejects(decryptSnapshotForLocalRecovery(fake,PASSWORD),
   /BACKUP_(?:UNLOCK_FAILED|ENVELOPE_INVALID)/);
 }
 await assert.rejects(createEncryptedSnapshot(db,'corta'),/BACKUP_PASSPHRASE_TOO_WEAK/);
 assert.equal((await decryptSnapshotForLocalRecovery(snapshot,PASSWORD)).tables.leads.length,0);
 console.log('FLUYNOVA_BACKUP_INTEGRITY_LOCAL_PASS: wrong_pass=true, tamper_rejected=true, encrypted=true');
});
test('Preflight D1: columna nueva o índice ausente impiden un backup incompleto',async t=>{
 const db=await prepareDatabase(t,'fluynova-backup-drift-ci');
 assert.equal((await db.prepare(
  'ALTER TABLE leads ADD COLUMN unexpected_private_field TEXT'
 ).run()).success,true);
 await assert.rejects(
  createEncryptedSnapshot(db,PASSWORD,{now:()=>AT}),
  /BACKUP_COLUMNS_UNEXPECTED_leads/);
 const second=await prepareDatabase(t,'fluynova-backup-index-ci');
 assert.equal((await second.prepare('DROP INDEX lead_mail_outbox_state_created').run()).success,true);
 await assert.rejects(
  createEncryptedSnapshot(second,PASSWORD,{now:()=>AT}),
  /BACKUP_OUTBOX_INDEX_MISSING/);
});
test('Conteo D1 truncado o incoherente bloquea respaldo (sin silencio)',async t=>{
 const db=await prepareDatabase(t,'fluynova-backup-overflow-ci');
 const mock={
  prepare:sql=>db.prepare(sql),
  batch:async statements=>{
   const res=await db.batch(statements);
   res[0].results[0].n=2001;
   return res;
  }
 };
 await assert.rejects(
  createEncryptedSnapshot(mock,PASSWORD,{now:()=>AT}),
  /BACKUP_UNSAFE_ROW_COUNT_leads/);
});
test('El respaldo no crea endpoint público ni exporta clientes por la API',async()=>{
 const source=await readFile(new URL('../index.mjs',import.meta.url),'utf8');
 const publicSource=await readFile(new URL('../../fluynova-public-intake-worker/index.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/encrypted-snapshot|decryptSnapshotForLocalRecovery|backup\/encrypted/);
 assert.doesNotMatch(publicSource,/encrypted-snapshot|decryptSnapshotForLocalRecovery|backup\/encrypted/);
 assert.ok(source.includes("if((u.pathname!==PATH&&!asset)||u.search)"));
});
