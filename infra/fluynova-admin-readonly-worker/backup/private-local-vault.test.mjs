import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,chmod,lstat,readFile,writeFile,symlink,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {readFile as readText} from 'node:fs/promises';
import {createPagedEncryptedLabArchive} from './paged-encrypted-archive.mjs';
import {saveEncryptedArchiveLocal,readEncryptedArchiveLocal} from './private-local-vault.mjs';

const PASS='FLUYNOVA-CLAVE-FICTICIA-SOLO-TESTS-2026';
const NOW='2026-11-09T16:00:00.000Z';
async function source(t,name){
 const mf=new Miniflare({modules:true,
  script:"export default {fetch(){return new Response('local')}}",
  d1Databases:{DB:name},cf:false});
 t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const file of [
  '../../fluynova-contact-worker/schema.sql',
  '../../fluynova-public-intake-worker/idempotency.schema.sql',
  '../../fluynova-public-intake-worker/mail-outbox.schema.sql'
 ]){
  const raw=(await readText(new URL(file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const sql of raw.split(';').map(x=>x.trim()).filter(Boolean))
   assert.equal((await db.prepare(sql).run()).success,true);
 }
 assert.equal((await db.prepare(
  'INSERT INTO leads(id,received_at,name,email,category,message,consent_at) '+
  'VALUES(?,?,?,?,?,?,?)'
 ).bind('ci-unique-test-id',NOW,'NOMBRE-SECRETO-LAB',
   'confidencial@example.invalid','Web','MENSAJE-SECRETO-LAB',NOW).run()).success,true);
 return db;
}
async function privateFolder(t){
 const dir=await mkdtemp(join(tmpdir(),'fluynova-vault-ci-'));
 await chmod(dir,0o700);
 t.after(()=>rm(dir,{recursive:true,force:true}));
 return dir;
}
test('07C: respaldo cifrado se guarda 0600, se lee y valida AES-GCM y HMAC',async t=>{
 const db=await source(t,'fluynova-07c-safe-vault');
 const archive=await createPagedEncryptedLabArchive(db,PASS,{now:()=>NOW,pageSize:16});
 const dir=await privateFolder(t);
 const result=await saveEncryptedArchiveLocal({directory:dir,archive,passphrase:PASS});
 assert.equal(result.encrypted,true);
 assert.equal(result.productionBackup,false);
 assert.equal(result.remoteVerified,false);
 assert.equal(result.consistency,'DOUBLE_PASS_BEST_EFFORT_NOT_ATOMIC');
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
 const p=join(dir,result.name);
 const stat=await lstat(p);
 assert.equal(stat.mode&0o077,0,'Only owner has file permissions');
 assert.equal(stat.nlink,1,'No hardlinked final file');
 const contents=await readFile(p,'utf8');
 for(const str of ['NOMBRE-SECRETO-LAB','confidencial@example.invalid',
  'MENSAJE-SECRETO-LAB','FLUYNOVA-CLAVE-FICTICIA'])
  assert.equal(contents.includes(str),false,'No PII/password leaked: '+str);
 const decoded=await readEncryptedArchiveLocal({
  directory:dir,archiveId:result.archiveId,passphrase:PASS,expectedSha256:result.sha256
 });
 assert.equal(decoded.verified,true);
 assert.equal(decoded.snapshot.tables.leads.length,1);
 assert.equal(decoded.snapshot.tables.leads[0].name,'NOMBRE-SECRETO-LAB');
 assert.equal(decoded.snapshot.tables.leads[0].message,'MENSAJE-SECRETO-LAB');
 assert.equal(decoded.snapshot.consistency,'DOUBLE_PASS_BEST_EFFORT_NOT_ATOMIC');
 console.log('FLUYNOVA_07C_VAULT_LOCAL_PASS: encrypted=true, mode=0600, readback=true, remote=false');
});
test('07C: nunca sobreescribe un backup; clave incorrecta no crea archivo',async t=>{
 const db=await source(t,'fluynova-07c-no-overwrite');
 const archive=await createPagedEncryptedLabArchive(db,PASS,{now:()=>NOW,pageSize:16});
 const dir=await privateFolder(t);
 await assert.rejects(saveEncryptedArchiveLocal({
  directory:dir,archive,passphrase:'OTRA-CONTRASEÑA-SUFICIENTE-PARA-LAB'
 }),/PAGED_AUTHENTICATION_FAILED|PAGED_MANIFEST_INVALID/);
 const file=join(dir,'fluynova-'+archive.archiveId+'.sealed.json');
 await assert.rejects(lstat(file),{code:'ENOENT'});
 const result=await saveEncryptedArchiveLocal({directory:dir,archive,passphrase:PASS});
 const first=await readFile(file,'utf8');
 await assert.rejects(saveEncryptedArchiveLocal({
  directory:dir,archive,passphrase:PASS
 }),{code:'EEXIST'});
 assert.equal(await readFile(file,'utf8'),first,'No overwrites');
 const verified=await readEncryptedArchiveLocal({
  directory:dir,archiveId:archive.archiveId,passphrase:PASS,expectedSha256:result.sha256
 });
 assert.equal(verified.snapshot.tables.leads.length,1);
});
test('07C: detecta ciphertext editado, hash incorrecto y permiso público',async t=>{
 const db=await source(t,'fluynova-07c-corruption');
 const archive=await createPagedEncryptedLabArchive(db,PASS,{now:()=>NOW,pageSize:16});
 const dir=await privateFolder(t);
 const result=await saveEncryptedArchiveLocal({directory:dir,archive,passphrase:PASS});
 const p=join(dir,result.name);
 await assert.rejects(readEncryptedArchiveLocal({
  directory:dir,archiveId:result.archiveId,passphrase:PASS,
  expectedSha256:'0'.repeat(64)
 }),/VAULT_CHECKSUM_MISMATCH/);
 const original=await readFile(p,'utf8');
 const corrupted=original.replace('"ciphertext":"','"ciphertext":"B');
 assert.notEqual(corrupted,original);
 await writeFile(p,corrupted,'utf8');
 await assert.rejects(readEncryptedArchiveLocal({
  directory:dir,archiveId:result.archiveId,passphrase:PASS,expectedSha256:result.sha256
 }),/VAULT_CHECKSUM_MISMATCH/);
 await writeFile(p,original,'utf8');
 await chmod(p,0o644);
 await assert.rejects(readEncryptedArchiveLocal({
  directory:dir,archiveId:result.archiveId,passphrase:PASS,expectedSha256:result.sha256
 }),/VAULT_FILE_UNSAFE/);
 await chmod(p,0o600);
 await chmod(dir,0o755);
 await assert.rejects(readEncryptedArchiveLocal({
  directory:dir,archiveId:result.archiveId,passphrase:PASS,expectedSha256:result.sha256
 }),/VAULT_DIRECTORY_NOT_PRIVATE/);
});
test('07C: ni rutas o nombres arbitrarios ni carpetas simbólicas',async t=>{
 const db=await source(t,'fluynova-07c-traversal');
 const archive=await createPagedEncryptedLabArchive(db,PASS,{now:()=>NOW,pageSize:16});
 const dir=await privateFolder(t);
 for(const id of ['../another','./',archive.archiveId+'/../../other','ABCDEF','x'.repeat(32)]){
  await assert.rejects(readEncryptedArchiveLocal({
   directory:dir,archiveId:id,passphrase:PASS,expectedSha256:'0'.repeat(64)
  }),/VAULT_ARCHIVE_ID_INVALID/);
 }
 const link=join(dir,'other-dir');
 await symlink(dir,link,'dir');
 await assert.rejects(saveEncryptedArchiveLocal({
  directory:link,archive,passphrase:PASS
 }),/VAULT_DIRECTORY_NOT_PRIVATE/);
 assert.equal((await lstat(link)).isSymbolicLink(),true);
});
test('07C: sin endpoints de backup ni conexión a servicios externos',async()=>{
 const [pub,admin]=await Promise.all([
  readFile(new URL('../../fluynova-public-intake-worker/index.mjs',import.meta.url),'utf8'),
  readFile(new URL('../index.mjs',import.meta.url),'utf8')
 ]);
 for(const code of [pub,admin])
  assert.doesNotMatch(code,/private-local-vault|saveEncryptedArchiveLocal|readEncryptedArchiveLocal/);
});
