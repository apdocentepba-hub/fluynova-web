// Sólo descarga el modelo cuando el usuario ejecuta PREPARAR-OCR-WINDOWS.cmd.
// Durante cada OCR, se exige un modelo de español YA instalado y verificado.
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CopilotError} from './analysis.mjs';

const BASE=dirname(fileURLToPath(import.meta.url));
export const OCR_DATA_DIR=join(BASE,'ocr-data');
export const OCR_DATA_FILE=join(OCR_DATA_DIR,'spa.traineddata.gz');
export const OCR_PINNED_COMMIT='87416418657359cb625c412a48b6e1d6d41c29bd';
export const OCR_EXPECTED_GIT_SHA='72e901f13ca52cfe34cf239a368b9ed3c0ddaf26';
export const OCR_MODEL_URL='https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/'+OCR_PINNED_COMMIT+'/spa.traineddata';
export const OCR_UNCOMPRESSED_MAX_BYTES=3*1024*1024;

export function verifyModelBytes(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<100000||bytes.length>OCR_UNCOMPRESSED_MAX_BYTES)
   return false;
 const gitBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 return gitBlob===OCR_EXPECTED_GIT_SHA;
}
export async function assertOfflineModel(dir=OCR_DATA_DIR){
 let compressed,original;
 try{
   compressed=await readFile(join(dir,'spa.traineddata.gz'));
   if(compressed.length>OCR_UNCOMPRESSED_MAX_BYTES)throw Error('oversize');
   original=gunzipSync(compressed,{maxOutputLength:OCR_UNCOMPRESSED_MAX_BYTES});
 }catch{
   throw new CopilotError('OCR_LANGUAGE_NOT_PREPARED',503);
 }
 if(!verifyModelBytes(original))throw new CopilotError('OCR_LANGUAGE_NOT_PREPARED',503);
 return dir;
}
export async function prepareOfflineModel({fetchImpl=fetch,dir=OCR_DATA_DIR}={}){
 // La llamada sólo se ejecuta desde preparador iniciado voluntariamente.
 const response=await fetchImpl(OCR_MODEL_URL,{signal:AbortSignal.timeout(45000),redirect:'error'});
 if(!response?.ok)throw new CopilotError('OCR_MODEL_DOWNLOAD_FAILED',503);
 const data=Buffer.from(await response.arrayBuffer());
 if(!verifyModelBytes(data))throw new CopilotError('OCR_MODEL_INTEGRITY_FAILED',502);
 await mkdir(dir,{recursive:true});
 const dest=join(dir,'spa.traineddata.gz');
 const tmp=dest+'.part-'+process.pid;
 try{
   await writeFile(tmp,gzipSync(data),{flag:'wx',mode:0o600});
   await rename(tmp,dest);
 }catch(err){
   await unlink(tmp).catch(()=>{});
   throw err;
 }
 await assertOfflineModel(dir);
 return {status:'PREPARED_OFFLINE',language:'spa',bytes:data.length};
}
