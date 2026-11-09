import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {createPagedEncryptedLabArchive,openPagedEncryptedLabArchive}
 from './paged-encrypted-archive.mjs';
import {createEncryptedSnapshot} from './encrypted-snapshot.mjs';

const PASS='Frase-laboratorio-SOLO-CI-2026; no usar nunca';
const CLOCK='2026-11-09T15:00:00.000Z';
const SQL=[
 '../../fluynova-contact-worker/schema.sql',
 '../../fluynova-public-intake-worker/idempotency.schema.sql',
 '../../fluynova-public-intake-worker/mail-outbox.schema.sql'
];
async function local(t,name) {
 const mf=new Miniflare({
  modules:true,script:"export default {fetch(){return new Response('not public')}}",
  d1Databases:{DB:name},cf:false
 });
 t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const file of SQL){
  const source=(await readFile(new URL(file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const sql of source.split(';').map(x=>x.trim()).filter(Boolean)){
   assert.equal((await db.prepare(sql).run()).success,true);
  }
 }
 return db;
}
async function fill(db,n) {
 const sql='INSERT INTO leads(id,received_at,name,email,category,message,consent_at) VALUES(?,?,?,?,?,?,?)';
 let statements=[];
 for(let i=0;i<n;i++){
  const id='lead-'+String(i).padStart(8,'0');
  statements.push(db.prepare(sql).bind(id,CLOCK,'Solo laboratorio',
   'ficticio'+i+'@example.invalid','Web','Mensaje artificial '+i,CLOCK));
  if(statements.length===200||i===n-1){
   const result=await db.batch(statements);
   assert.ok(result.every(x=>x.success===true));
   statements=[];
  }
 }
}
test('07B: 2305 consultas D1 local paginadas y cifradas; 07A se niega por su límite',async t=>{
 const db=await local(t,'fluynova-07b-big-local');
 await fill(db,2305);
 await assert.rejects(createEncryptedSnapshot(db,PASS,{now:()=>CLOCK}),
  /BACKUP_UNSAFE_ROW_COUNT_leads/);
 const archive=await createPagedEncryptedLabArchive(db,PASS,{
  now:()=>CLOCK,pageSize:128
 });
 assert.equal(archive.kind,'FLUYNOVA_PAGED_ENCRYPTED_LAB_V1');
 assert.equal(archive.consistency,'DOUBLE_PASS_BEST_EFFORT_NOT_ATOMIC');
 assert.equal(archive.completion.kind,'COMPLETE_AFTER_TWO_PASSES');
 assert.ok(archive.chunks.length>=19,'Más de 2000 filas divididas en páginas');
 assert.equal(archive.completion.segments,archive.chunks.length);
 const publicData=JSON.stringify(archive);
 for(const secret of ['Solo laboratorio','ficticio0@example.invalid',
  'Mensaje artificial 1','lead-00000001'])
  assert.equal(publicData.includes(secret),false,'No incluir PII en claro');
 const restored=await openPagedEncryptedLabArchive(archive,PASS);
 assert.equal(restored.tables.leads.length,2305);
 assert.equal(restored.tables.leads[0].id,'lead-00000000');
 assert.equal(restored.tables.leads.at(-1).id,'lead-00002304');
 assert.equal(restored.tables.lead_rate_limit.length,0);
 assert.equal(restored.tables.lead_mail_outbox.length,0);
 console.log('FLUYNOVA_07B_BIG_LOCAL_PASS: leads=2305, encrypted_pages='+archive.chunks.length+', remote=false');
});
test('07B: el archivo cifrado no admite bloques perdidos, alterados, repetidos ni clave errónea',async t=>{
 const db=await local(t,'fluynova-07b-integrity-local');
 await fill(db,19);
 const original=await createPagedEncryptedLabArchive(db,PASS,{
  now:()=>CLOCK,pageSize:16
 });
 assert.equal(original.chunks.length,2);
 for(const modify of [
  a=>{a.chunks.pop()},
  a=>{a.chunks.reverse()},
  a=>{a.chunks[0].tag=(a.chunks[0].tag[0]==='A'?'B':'A')+a.chunks[0].tag.slice(1)},
  a=>{a.completion.mac='AAAA'},
  a=>{delete a.completion},
  a=>{a.archiveId='0'.repeat(32)},
  a=>{a.pageSize=500}
 ]){
  const fake=structuredClone(original);modify(fake);
  await assert.rejects(openPagedEncryptedLabArchive(fake,PASS),
   /PAGED_/);
 }
 await assert.rejects(openPagedEncryptedLabArchive(original,'Otra-clave-muy-distinta-de-laboratorio'),
  /PAGED_AUTHENTICATION_FAILED|PAGED_MANIFEST_INVALID/);
 assert.equal((await openPagedEncryptedLabArchive(original,PASS)).tables.leads.length,19);
});
test('07B: cambia una fila durante doble lectura y no genera respaldo aparentemente válido',async t=>{
 const db=await local(t,'fluynova-07b-drift-local');
 await fill(db,52);
 let firstPage=0;
 const proxy={
  batch:statements=>db.batch(statements),
  prepare(sql){
   if(sql.includes('SELECT id,received_at')&&sql.includes('FROM leads')&&
      !sql.includes('WHERE')){
    firstPage++;
    if(firstPage===2){
     return {
      bind(...args){
       const stmt=db.prepare(sql).bind(...args);
       return {all:async()=>{
        assert.equal((await db.prepare("UPDATE leads SET message=? WHERE id=?")
          .bind('CAMBIO A MITAD DEL BACKUP','lead-00000000').run()).success,true);
        return stmt.all();
       }};
      }
     };
    }
   }
   return db.prepare(sql);
  }
 };
 await assert.rejects(createPagedEncryptedLabArchive(proxy,PASS,{
  now:()=>CLOCK,pageSize:32
 }),/PAGED_CONCURRENT_CHANGE_DETECTED/);
 assert.equal((await db.prepare('SELECT message FROM leads WHERE id=?')
  .bind('lead-00000000').first()).message,'CAMBIO A MITAD DEL BACKUP');
});
test('07B: esquema modificado, contraseña débil y tamaño de página inválido cierran la exportación',async t=>{
 const db=await local(t,'fluynova-07b-schema-local');
 assert.equal((await db.prepare('ALTER TABLE leads ADD COLUMN private_unexpected TEXT')
  .run()).success,true);
 await assert.rejects(createPagedEncryptedLabArchive(db,PASS,{now:()=>CLOCK}),
  /BACKUP_COLUMNS_UNEXPECTED_leads/);
 await assert.rejects(createPagedEncryptedLabArchive(db,'demasiado corta',{now:()=>CLOCK}),
  /PAGED_PASSPHRASE_INVALID/);
 await assert.rejects(createPagedEncryptedLabArchive(db,PASS,{now:()=>CLOCK,pageSize:2}),
  /PAGED_PAGE_SIZE_INVALID/);
});
test('07B: paginación y descifrado NO son rutas del Worker público o administrativo',async()=>{
 const pub=await readFile(new URL('../../fluynova-public-intake-worker/index.mjs',import.meta.url),'utf8');
 const admin=await readFile(new URL('../index.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(pub,/paged-encrypted-archive|createPagedEncryptedLabArchive/);
 assert.doesNotMatch(admin,/paged-encrypted-archive|createPagedEncryptedLabArchive/);
});
