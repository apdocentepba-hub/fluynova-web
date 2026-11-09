/**
 * FLUYNOVA — Paso 07B: archivo cifrado paginado, SOLO laboratorio.
 *
 * La extracción paginada NO es una transacción global D1. Dos lecturas
 * completas y hash comparado detectan drift observable, pero no garantizan
 * un snapshot atómico ante escrituras concurrentes; requiere fuente QUIETA
 * o exportación nativa consistente antes de cualquier producción.
 *
 * No escribe archivos, restaura D1, configura credenciales ni abre HTTP.
 * Solo guarda segmentos YA CIFRADOS en memoria del ejecutor de pruebas.
 */
import {randomBytes,createHash,createHmac,createCipheriv,createDecipheriv,
 scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {TABLES} from './encrypted-snapshot.mjs';

const scrypt=promisify(scryptCallback);
const KIND='FLUYNOVA_PAGED_ENCRYPTED_LAB_V1';
const N=32768,R=8,P=1,MAX_SEGMENTS=1024;
const MAX_PAGE_BYTES=512*1024,MAX_CIPHERTEXT=1024*1024;
const MAX_TOTAL_ROWS=100000;
function fail(code){throw Error(code)}
function keyValid(v){
 return typeof v==='string'&&v.length>=20&&v.length<=1024&&
  Buffer.byteLength(v,'utf8')<=2048;
}
function iso(v){
 return typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&
  Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
}
function asBase64(s,expected,max=MAX_CIPHERTEXT){
 if(typeof s!=='string'||s.length>Math.ceil(max*4/3)+8||
  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))
  fail('PAGED_INVALID_BASE64');
 const b=Buffer.from(s,'base64');
 if(b.toString('base64')!==s||b.length>max||(expected!==null&&b.length!==expected))
  fail('PAGED_INVALID_BASE64');
 return b;
}
function toJson(obj){return Buffer.from(JSON.stringify(obj),'utf8')}
function pageSql(table,cursor,size) {
 const select=table.columns.join(',')+' FROM '+table.name;
 const order=' ORDER BY '+table.key+' LIMIT ?';
 if(cursor===null)
  return {sql:'SELECT '+select+order,args:[size]};
 const keys=table.key.split(',');
 if(keys.length===1)
  return {sql:'SELECT '+select+' WHERE '+keys[0]+' > ?'+order,
   args:[cursor[0],size]};
 if(keys.length===2)
  return {sql:'SELECT '+select+' WHERE ('+keys.join(',')+') > (?,?)'+order,
   args:[cursor[0],cursor[1],size]};
 fail('PAGED_KEY_UNSUPPORTED');
}
function cursorFrom(row,table){
 const keys=table.key.split(',');
 return keys.map(key=>{
  const v=row?.[key];
  if(typeof v!=='string'&&!(typeof v==='number'&&Number.isSafeInteger(v)))
   fail('PAGED_CURSOR_INVALID');
  return v;
 });
}
function isSafeRow(row,columns) {
 return !!row&&typeof row==='object'&&!Array.isArray(row)&&
  Object.keys(row).length===columns.length&&
  columns.every(k=>Object.hasOwn(row,k)&&
   (row[k]===null||typeof row[k]==='string'||
    (typeof row[k]==='number'&&Number.isSafeInteger(row[k]))));
}
async function* readPages(db,pageSize){
 for(const t of TABLES){
  let cursor=null;
  while(true){
   const {sql,args}=pageSql(t,cursor,pageSize);
   const result=await db.prepare(sql).bind(...args).all();
   if(result?.success!==true||!Array.isArray(result.results))
    fail('PAGED_D1_READ_FAILED');
   const rows=result.results;
   if(rows.length>pageSize||rows.some(row=>!isSafeRow(row,t.columns)))
    fail('PAGED_UNEXPECTED_ROWS');
   if(!rows.length)break;
   const previous=cursor;
   cursor=cursorFrom(rows[rows.length-1],t);
   if(previous&&JSON.stringify(cursor)===JSON.stringify(previous))
    fail('PAGED_CURSOR_STUCK');
   const bytes=toJson({table:t.name,rows});
   if(bytes.length>MAX_PAGE_BYTES)fail('PAGED_CHUNK_TOO_LARGE');
   yield {table:t.name,rows,cursor,digest:createHash('sha256').update(bytes).digest('hex')};
   if(rows.length<pageSize)break;
  }
 }
}
async function readCounts(db){
 const out=await db.batch(TABLES.map(t=>db.prepare('SELECT COUNT(*) AS n FROM '+t.name)));
 if(!Array.isArray(out)||out.length!==TABLES.length||
  out.some(r=>r?.success!==true||r?.results?.length!==1||
   !Number.isSafeInteger(r.results[0]?.n)||r.results[0].n<0))
  fail('PAGED_COUNTS_NOT_CONFIRMED');
 const counts=out.map(r=>r.results[0].n);
 if(counts.reduce((a,b)=>a+b,0)>MAX_TOTAL_ROWS)
  fail('PAGED_LIMIT_EXCEEDED');
 return counts;
}
function headerBytes(h){
 return toJson([h.kind,h.version,h.createdAt,h.archiveId,h.salt,h.pageSize,h.consistency]);
}
function macEntry(hmac,chunk){
 hmac.update(toJson([chunk.sequence,chunk.iv,chunk.tag,chunk.ciphertext]));
}
function aad(header,seq){return toJson([KIND,header.archiveId,seq])}
/** Explicitly local-only archive: pages are NOT a guaranteed D1 point-in-time view. */
export async function createPagedEncryptedLabArchive(db,passphrase,{
 pageSize=128,now=()=>new Date().toISOString()
}={}){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')
  fail('PAGED_D1_MISSING');
 if(!keyValid(passphrase))fail('PAGED_PASSPHRASE_INVALID');
 if(!Number.isSafeInteger(pageSize)||pageSize<16||pageSize>256)
  fail('PAGED_PAGE_SIZE_INVALID');
 const at=now();if(!iso(at))fail('PAGED_TIME_INVALID');
 // LAS CUENTAS y las dos lecturas comprueban drift observable. No reemplazan
 // un punto de vista transaccional consistente ante escrituras concurrentes.
 const before=await readCounts(db);
 const salt=randomBytes(16);
 const header=Object.freeze({
  kind:KIND,version:1,createdAt:at,archiveId:randomBytes(16).toString('hex'),
  salt:salt.toString('base64'),pageSize,
  consistency:'DOUBLE_PASS_BEST_EFFORT_NOT_ATOMIC'
 });
 const key=await scrypt(passphrase,salt,32,{N,r:R,p:P,maxmem:64*1024*1024});
 const chunks=[],digests=[],firstCounts=Object.fromEntries(TABLES.map(t=>[t.name,0]));
 const seal=createHmac('sha256',key);
 seal.update(headerBytes(header));
 try{
  for await(const page of readPages(db,pageSize)){
   if(chunks.length>=MAX_SEGMENTS)fail('PAGED_SEGMENT_LIMIT_EXCEEDED');
   const sequence=chunks.length;
   firstCounts[page.table]+=page.rows.length;
   const iv=randomBytes(12);
   const plain=toJson({table:page.table,rows:page.rows});
   try{
    const cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(aad(header,sequence));
    const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
    const chunk=Object.freeze({
     sequence,iv:iv.toString('base64'),
     tag:cipher.getAuthTag().toString('base64'),
     ciphertext:encrypted.toString('base64')
    });
    chunks.push(chunk);macEntry(seal,chunk);digests.push([page.table,page.digest]);
   }finally{plain.fill(0)}
  }
  const after=await readCounts(db);
  if(before.some((n,i)=>n!==after[i])||
    TABLES.some((t,i)=>firstCounts[t.name]!==before[i]))
   fail('PAGED_CONCURRENT_CHANGE_DETECTED');
  const nextDigests=[];
  for await(const page of readPages(db,pageSize))
   nextDigests.push([page.table,page.digest]);
  if(JSON.stringify(digests)!==JSON.stringify(nextDigests))
   fail('PAGED_CONCURRENT_CHANGE_DETECTED');
  return Object.freeze({
   ...header,
   chunks:Object.freeze(chunks),
   completion:Object.freeze({
    kind:'COMPLETE_AFTER_TWO_PASSES',segments:chunks.length,
    mac:seal.digest('base64')
   })
  });
 }finally{key.fill(0)}
}
export async function openPagedEncryptedLabArchive(archive,passphrase){
 if(!keyValid(passphrase))fail('PAGED_PASSPHRASE_INVALID');
 if(!archive||typeof archive!=='object'||Array.isArray(archive)||
  Object.keys(archive).length!==9||archive.kind!==KIND||
  archive.version!==1||!iso(archive.createdAt)||
  !/^[a-f0-9]{32}$/.test(archive.archiveId||'')||
  !Number.isSafeInteger(archive.pageSize)||archive.pageSize<16||
  archive.pageSize>256||
  archive.consistency!=='DOUBLE_PASS_BEST_EFFORT_NOT_ATOMIC'||
  !Array.isArray(archive.chunks)||archive.chunks.length>MAX_SEGMENTS||
  archive.completion?.kind!=='COMPLETE_AFTER_TWO_PASSES'||
  archive.completion.segments!==archive.chunks.length)
  fail('PAGED_ARCHIVE_INCOMPLETE');
 const key=await scrypt(passphrase,asBase64(archive.salt,16,64),32,
  {N,r:R,p:P,maxmem:64*1024*1024});
 try{
  const seal=createHmac('sha256',key);seal.update(headerBytes(archive));
  const tables=Object.fromEntries(TABLES.map(t=>[t.name,[]]));
  let previousTable=-1,total=0;
  for(let i=0;i<archive.chunks.length;i++){
   const chunk=archive.chunks[i];
   if(!chunk||Object.keys(chunk).length!==4||chunk.sequence!==i)
    fail('PAGED_ARCHIVE_INVALID_SEQUENCE');
   macEntry(seal,chunk);
   const iv=asBase64(chunk.iv,12,64),tag=asBase64(chunk.tag,16,64);
   const encrypted=asBase64(chunk.ciphertext,null,MAX_CIPHERTEXT);
   const decipher=createDecipheriv('aes-256-gcm',key,iv);
   decipher.setAAD(aad(archive,i));decipher.setAuthTag(tag);
   let raw;
   try{raw=Buffer.concat([decipher.update(encrypted),decipher.final()])}
   catch{fail('PAGED_AUTHENTICATION_FAILED')}
   try{
    if(raw.length>MAX_PAGE_BYTES)fail('PAGED_CHUNK_TOO_LARGE');
    let decoded;try{decoded=JSON.parse(raw.toString('utf8'))}
    catch{fail('PAGED_CHUNK_INVALID')}
    const index=TABLES.findIndex(t=>t.name===decoded?.table);
    if(index<0||index<previousTable||!Array.isArray(decoded.rows)||
     !decoded.rows.length||decoded.rows.length>archive.pageSize||
     !decoded.rows.every(x=>isSafeRow(x,TABLES[index].columns)))
     fail('PAGED_CHUNK_INVALID');
    previousTable=index;
    tables[decoded.table].push(...decoded.rows);
    total+=decoded.rows.length;
    if(total>MAX_TOTAL_ROWS)fail('PAGED_LIMIT_EXCEEDED');
   }finally{raw.fill(0)}
  }
  const expected=asBase64(archive.completion.mac,32,64);
  const actual=seal.digest();
  if(!actual.equals(expected))fail('PAGED_MANIFEST_INVALID');
  return Object.freeze({schema:'FLUYNOVA_KNOWN_TABLES_V1',
   createdAt:archive.createdAt,tables,
   consistency:archive.consistency});
 }finally{key.fill(0)}
}
