/**
 * FLUYNOVA — Paso 07C, bóveda LOCAL de laboratorio para backups cifrados.
 * NUNCA se importa desde Workers, NO tiene red, no restaura bases, no borra.
 * La carpeta debe existir previamente, ser propiedad del proceso y 0700;
 * en plataformas distintas de Linux/POSIX la prueba se considera no apta.
 *
 * El formato de 07B sigue siendo BEST-EFFORT_NOT_ATOMIC:
 * persistirlo NO lo convierte en backup consistente de producción.
 */
import {constants} from 'node:fs';
import {lstat,open,link,unlink,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {openPagedEncryptedLabArchive} from './paged-encrypted-archive.mjs';

const ARCHIVE_ID=/^[a-f0-9]{32}$/;
const MAX_FILE_BYTES=180*1024*1024; // límite de laboratorio, solo ciphertext
const O_NOFOLLOW=constants.O_NOFOLLOW??0;
const O_DIRECTORY=constants.O_DIRECTORY??0;
const PRE='fluynova-';
const EXT='.sealed.json';
const fail=code=>{throw Error(code)};
function validId(value){
 if(typeof value!=='string'||!ARCHIVE_ID.test(value))fail('VAULT_ARCHIVE_ID_INVALID');
 return value;
}
function filePath(dir,id){return join(dir,PRE+validId(id)+EXT)}
function isPrivate(mode){return (mode&0o077)===0}
async function privateDirectory(directory){
 if(process.platform==='win32')fail('VAULT_POSIX_ONLY_LAB');
 if(typeof directory!=='string'||!directory.startsWith('/')||directory.includes('\0'))
  fail('VAULT_DIRECTORY_INVALID');
 const path=resolve(directory);
 const stat=await lstat(path);
 if(!stat.isDirectory()||stat.isSymbolicLink()||!isPrivate(stat.mode)||
    (typeof process.getuid==='function'&&stat.uid!==process.getuid()))
  fail('VAULT_DIRECTORY_NOT_PRIVATE');
 if(await realpath(path)!==path)fail('VAULT_DIRECTORY_PATH_UNSAFE');
 return path;
}
function encryptedShape(a){
 if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).length!==9||a.kind!=='FLUYNOVA_PAGED_ENCRYPTED_LAB_V1'||
    a.version!==1||!ARCHIVE_ID.test(a.archiveId||'')||
    a.consistency!=='DOUBLE_PASS_BEST_EFFORT_NOT_ATOMIC'||
    !Array.isArray(a.chunks)||a.chunks.length>1024||
    a.completion?.kind!=='COMPLETE_AFTER_TWO_PASSES'||
    a.completion?.segments!==a.chunks.length)fail('VAULT_NOT_ENCRYPTED_ARCHIVE');
 const keys=['kind','version','createdAt','archiveId','salt','pageSize',
  'consistency','chunks','completion'];
 if(Object.keys(a).some(k=>!keys.includes(k)))fail('VAULT_NOT_ENCRYPTED_ARCHIVE');
 if(a.chunks.some(c=>!c||typeof c!=='object'||Array.isArray(c)||
   Object.keys(c).length!==4||!Number.isSafeInteger(c.sequence)||
   typeof c.iv!=='string'||typeof c.tag!=='string'||
   typeof c.ciphertext!=='string'))
  fail('VAULT_NOT_ENCRYPTED_ARCHIVE');
}
function encodeArchive(archive){
 encryptedShape(archive);
 const bytes=Buffer.from(JSON.stringify(archive)+'\n','utf8');
 if(bytes.length>MAX_FILE_BYTES){bytes.fill(0);fail('VAULT_FILE_TOO_LARGE')}
 return bytes;
}
async function verifyFile(absolute){
 // O_NOFOLLOW protects the last segment; directory must already be private.
 const fh=await open(absolute,constants.O_RDONLY|O_NOFOLLOW);
 try{
  const stat=await fh.stat();
  if(!stat.isFile()||!isPrivate(stat.mode)||stat.nlink!==1||
     stat.size<100||stat.size>MAX_FILE_BYTES)
   fail('VAULT_FILE_UNSAFE');
  return await fh.readFile();
 }finally{await fh.close()}
}
async function syncDirectory(dir){
 const dh=await open(dir,constants.O_RDONLY|O_DIRECTORY);
 try{await dh.sync()}finally{await dh.close()}
}
/**
 * Verify ciphertext (AES-GCM+HMAC) BEFORE saving.
 * Filename is derived exclusively from a random 32-char archiveId.
 * On success returns metadata only, not the archive.
 */
export async function saveEncryptedArchiveLocal({directory,archive,passphrase}={}){
 const dir=await privateDirectory(directory);
 encryptedShape(archive);
 // Wrong key, truncated manifest, non-authentic pages => no file created.
 await openPagedEncryptedLabArchive(archive,passphrase);
 const final=filePath(dir,archive.archiveId);
 const temp=join(dir,'.partial-'+randomBytes(16).toString('hex'));
 const bytes=encodeArchive(archive);
 let made=false,committed=false;
 try{
  const fh=await open(temp,constants.O_CREAT|constants.O_EXCL|
   constants.O_WRONLY|O_NOFOLLOW,0o600);
  made=true;
  try{
   await fh.writeFile(bytes);
   await fh.sync();
  }finally{await fh.close()}
  // Hard-link create is atomic, never replaces an existing final file.
  await link(temp,final);
  committed=true;
  await syncDirectory(dir);
  const digest=createHash('sha256').update(bytes).digest('hex');
  return Object.freeze({
   name:PRE+archive.archiveId+EXT,
   archiveId:archive.archiveId,
   sha256:digest,
   encrypted:true,
   consistency:archive.consistency,
   fileBytes:bytes.length,
   remoteVerified:false,
   productionBackup:false
  });
 }finally{
  bytes.fill(0);
  if(made)await unlink(temp).catch(()=>{});
  // A directory fsync may fail after the file is linked. Do not silently
  // overwrite or unlink a possibly committed snapshot.
  if(committed)await syncDirectory(dir).catch(()=>{});
 }
}
/** Read an existing encrypted file, verify BOTH SHA-256 and cryptographic key. */
export async function readEncryptedArchiveLocal({
 directory,archiveId,passphrase,expectedSha256
}={}){
 const dir=await privateDirectory(directory);
 if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSha256))
  fail('VAULT_CHECKSUM_REQUIRED');
 const path=filePath(dir,archiveId);
 const bytes=await verifyFile(path);
 try{
  if(createHash('sha256').update(bytes).digest('hex')!==expectedSha256)
   fail('VAULT_CHECKSUM_MISMATCH');
  let archive;
  try{archive=JSON.parse(bytes.toString('utf8'))}
  catch{fail('VAULT_FILE_INVALID_JSON')}
  encryptedShape(archive);
  if(archive.archiveId!==archiveId)fail('VAULT_ID_MISMATCH');
  const decoded=await openPagedEncryptedLabArchive(archive,passphrase);
  return Object.freeze({
   archiveId,
   verified:true,
   encrypted:true,
   productionBackup:false,
   snapshot:decoded // sensitive rows IN MEMORY, do not log
  });
 }finally{bytes.fill(0)}
}
