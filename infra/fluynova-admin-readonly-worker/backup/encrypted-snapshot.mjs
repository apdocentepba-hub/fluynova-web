/**
 * FLUYNOVA — Paso 07A: respaldo D1 cifrado EN MEMORIA, SIN servicio remoto.
 *
 * No genera archivos, no usa red ni implementa restore. Acepta un binding
 * D1 proporcionado EXPLÍCITAMENTE por el invocador. NO conectarlo a HTTP.
 * Las filas de clientes existen en memoria durante cifrado/descifrado:
 * este prototipo NO sustituye la revisión de privacidad de producción.
 *
 * El respaldo representa exactamente las cuatro tablas operativas CONOCIDAS
 * (no es una copia integral de infraestructura, Access, secretos o bookmarks).
 */
import {randomBytes,createCipheriv,createDecipheriv,scrypt as scryptCallback}
 from 'node:crypto';
import {promisify} from 'node:util';
import {inspectD1Schema}
 from '../../fluynova-public-intake-worker/schema-preflight.mjs';

const scrypt=promisify(scryptCallback);
const KIND='FLUYNOVA_D1_ENCRYPTED_V1';
const AAD=Buffer.from(KIND,'utf8');
const N=32768,R=8,P=1;
const MAX_ROWS=2000; // falla explícitamente: sin resultados truncados
const MAX_BYTES=8*1024*1024;
export const TABLES=Object.freeze([
 Object.freeze({name:'leads',key:'id',columns:Object.freeze([
  'id','received_at','name','email','organization','category','message',
  'deadline','stage','budget','source','medium','campaign','creative',
  'consent_at','status'
 ])}),
 Object.freeze({name:'lead_rate_limit',key:'fingerprint,hour_bucket',columns:Object.freeze([
  'fingerprint','hour_bucket','hits'
 ])}),
 Object.freeze({name:'lead_idempotency',key:'request_id',columns:Object.freeze([
  'request_id','payload_mac','fingerprint','lead_id','created_at'
 ])}),
 Object.freeze({name:'lead_mail_outbox',key:'lead_id',columns:Object.freeze([
  'lead_id','state','attempts','created_at','updated_at','provider_message_id'
 ])})
]);
const fail=(code)=>{throw Error(code)};
function passphraseValid(passphrase){
 return typeof passphrase==='string'&&passphrase.length>=20&&
  passphrase.length<=1024&&Buffer.byteLength(passphrase,'utf8')<=2048;
}
function canonicalTime(value){
 return typeof value==='string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString()===value;
}
function fieldsExactly(row,columns){
 return row&&typeof row==='object'&&!Array.isArray(row)&&
  Object.keys(row).length===columns.length&&
  columns.every(name=>Object.hasOwn(row,name))&&
  Object.keys(row).every(name=>columns.includes(name))&&
  columns.every(name=>row[name]!==undefined&&
   (row[name]===null||typeof row[name]==='string'||
    (typeof row[name]==='number'&&Number.isSafeInteger(row[name]))));
}
function safeSnapshot(snapshot) {
 if(!snapshot||snapshot.schema!=='FLUYNOVA_KNOWN_TABLES_V1'||
    !canonicalTime(snapshot.createdAt)||
    !snapshot.tables||typeof snapshot.tables!=='object'||
    Array.isArray(snapshot.tables)||Object.keys(snapshot.tables).length!==TABLES.length)
   return false;
 let total=0;
 for(const table of TABLES){
  const records=snapshot.tables[table.name];
  if(!Array.isArray(records)||records.length>MAX_ROWS||
     !records.every(row=>fieldsExactly(row,table.columns)))return false;
  total+=records.length;
 }
 if(total>MAX_ROWS*TABLES.length)return false;
 return true;
}
function identical(a,b){return JSON.stringify(a)===JSON.stringify(b)}
async function checkedSchema(db){
 const status=await inspectD1Schema(db);
 if(!status.baseReady||!status.ledgerReady||status.missing.length)
  fail('BACKUP_BASE_SCHEMA_UNSUPPORTED');
 for(const t of TABLES){
  const result=await db.prepare("PRAGMA table_info('"+t.name+"')").all();
  if(result?.success!==true||!Array.isArray(result.results))
   fail('BACKUP_SCHEMA_READ_FAILED');
  const columns=result.results.map(x=>String(x.name));
  if(!identical(columns,t.columns))fail('BACKUP_COLUMNS_UNEXPECTED_'+t.name);
 }
 // Validación adicional del nuevo outbox (sin datos personales).
 const fks=await db.prepare("PRAGMA foreign_key_list('lead_mail_outbox')").all();
 if(fks?.success!==true||!Array.isArray(fks.results)||
    !fks.results.some(fk=>fk.table==='leads'&&fk.from==='lead_id'&&fk.to==='id'))
   fail('BACKUP_OUTBOX_FOREIGN_KEY_MISSING');
 const idx=await db.prepare("PRAGMA index_info('lead_mail_outbox_state_created')").all();
 if(idx?.success!==true||!Array.isArray(idx.results)||
    !identical(idx.results.map(x=>x.name),['state','created_at']))
   fail('BACKUP_OUTBOX_INDEX_MISSING');
}
export async function createEncryptedSnapshot(db,passphrase,{
 now=()=>new Date().toISOString()
}={}){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')
  fail('BACKUP_D1_BINDING_MISSING');
 if(!passphraseValid(passphrase))fail('BACKUP_PASSPHRASE_TOO_WEAK');
 await checkedSchema(db);
 const at=now();
 if(!canonicalTime(at))fail('BACKUP_TIME_INVALID');
 // UNA transacción de lectura: cuatro SELECT + cuatro COUNT coherentes.
 const statements=[];
 for(const t of TABLES){
  statements.push(db.prepare('SELECT COUNT(*) AS n FROM '+t.name));
  statements.push(db.prepare('SELECT '+t.columns.join(',')+' FROM '+t.name+
   ' ORDER BY '+t.key+' LIMIT '+(MAX_ROWS+1)));
 }
 const out=await db.batch(statements);
 if(!Array.isArray(out)||out.length!==statements.length||
    out.some(x=>x?.success!==true||!Array.isArray(x.results)))
  fail('BACKUP_READ_TRANSACTION_FAILED');
 const tables={};
 for(let i=0;i<TABLES.length;i++){
  const t=TABLES[i],count=out[2*i].results[0]?.n;
  const rows=out[2*i+1].results;
  if(!Number.isSafeInteger(count)||count<0||count>MAX_ROWS||
     rows.length!==count||rows.length>MAX_ROWS)
   fail('BACKUP_UNSAFE_ROW_COUNT_'+t.name);
  if(!rows.every(x=>fieldsExactly(x,t.columns)))
   fail('BACKUP_UNEXPECTED_DATA_'+t.name);
  tables[t.name]=rows;
 }
 const snapshot={schema:'FLUYNOVA_KNOWN_TABLES_V1',createdAt:at,tables};
 if(!safeSnapshot(snapshot))fail('BACKUP_SNAPSHOT_INVALID');
 const plaintext=Buffer.from(JSON.stringify(snapshot),'utf8');
 if(plaintext.length>MAX_BYTES){plaintext.fill(0);fail('BACKUP_TOO_LARGE')}
 const salt=randomBytes(16),iv=randomBytes(12);
 try{
  const key=await scrypt(passphrase,salt,32,{N,r:R,p:P,maxmem:64*1024*1024});
  try{
   const cipher=createCipheriv('aes-256-gcm',key,iv);
   cipher.setAAD(AAD);
   const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
   const envelope=Object.freeze({
    kind:KIND,
    version:1,
    kdf:'scrypt',
    N,r:R,p:P,
    salt:salt.toString('base64'),
    iv:iv.toString('base64'),
    tag:cipher.getAuthTag().toString('base64'),
    ciphertext:ciphertext.toString('base64')
   });
   return envelope; // ninguna fila ni estadística fuera del cifrado
  }finally{key.fill(0)}
 }finally{plaintext.fill(0)}
}
function decodeField(value,length,limit=MAX_BYTES){
 if(typeof value!=='string'||value.length>Math.ceil(limit*4/3)+8||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
  fail('BACKUP_ENVELOPE_INVALID');
 const b=Buffer.from(value,'base64');
 if((length!==null&&b.length!==length)||b.length>limit||
    b.toString('base64')!==value)
  fail('BACKUP_ENVELOPE_INVALID');
 return b;
}
export async function decryptSnapshotForLocalRecovery(envelope,passphrase){
 // No ejecutar sobre D1: devuelve únicamente un objeto EN MEMORIA.
 if(!passphraseValid(passphrase))fail('BACKUP_PASSPHRASE_TOO_WEAK');
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
    Object.keys(envelope).length!==9||
    envelope.kind!==KIND||envelope.version!==1||
    envelope.kdf!=='scrypt'||envelope.N!==N||
    envelope.r!==R||envelope.p!==P)
  fail('BACKUP_ENVELOPE_INVALID');
 const salt=decodeField(envelope.salt,16,64),
  iv=decodeField(envelope.iv,12,64),
  tag=decodeField(envelope.tag,16,64),
  bytes=decodeField(envelope.ciphertext,null,MAX_BYTES+1024);
 let plaintext;
 const key=await scrypt(passphrase,salt,32,{N,r:R,p:P,maxmem:64*1024*1024});
 try{
  const cipher=createDecipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(AAD);
  cipher.setAuthTag(tag);
  try{plaintext=Buffer.concat([cipher.update(bytes),cipher.final()])}
  catch{fail('BACKUP_UNLOCK_FAILED')}
 }finally{key.fill(0)}
 try{
  if(plaintext.length>MAX_BYTES)fail('BACKUP_TOO_LARGE');
  let snapshot;
  try{snapshot=JSON.parse(plaintext.toString('utf8'))}
  catch{fail('BACKUP_PAYLOAD_INVALID')}
  if(!safeSnapshot(snapshot))fail('BACKUP_PAYLOAD_INVALID');
  return snapshot;
 }finally{plaintext.fill(0)}
}
