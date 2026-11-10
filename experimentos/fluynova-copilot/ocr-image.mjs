// OCR de imágenes en memoria; modelo entrenado y WASM sólo locales.
// El resultado no se confunde con datos verificados ni aprobados.
import {CopilotError} from './analysis.mjs';
import {inspectImageBytes,OCR_MAX_TEXT_CHARS} from './image-input.mjs';
import {assertOfflineModel,OCR_DATA_DIR} from './ocr-model.mjs';

async function realWorkerFactory(lang,dir){
 const {createWorker}=await import('tesseract.js');
 return createWorker(lang,1,{langPath:dir,gzip:true,cacheMethod:'none'});
}
function withDeadline(work,ms){
 let timer;
 const timeout=new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new CopilotError('OCR_TIMEOUT',504)),ms);
 });
 return Promise.race([work,timeout]).finally(()=>clearTimeout(timer));
}
export async function recognizeImage(input,{
 workerFactory=realWorkerFactory,languageDir=OCR_DATA_DIR,timeoutMs=90000,
 minimumConfidence=35,checkModel=assertOfflineModel
}={}){
 const image=inspectImageBytes(input);
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)
   throw new CopilotError('OCR_INVALID_TIMEOUT',500);
 await checkModel(languageDir);
 let worker;
 try{
   const starting=Promise.resolve().then(()=>workerFactory('spa',languageDir));
   // Si la carga demora más del límite, terminar worker si finalmente inicializa.
   try{worker=await withDeadline(starting,timeoutMs)}
   catch(e){
     starting.then(w=>w?.terminate?.().catch(()=>{})).catch(()=>{});
     throw e;
   }
   if(typeof worker?.recognize!=='function')throw Error('invalid-worker');
   const result=await withDeadline(Promise.resolve().then(
     ()=>worker.recognize(image.bytes)),timeoutMs);
   const raw=result?.data?.text;
   const confidence=result?.data?.confidence;
   if(typeof raw!=='string'||typeof confidence!=='number'||
      !Number.isFinite(confidence))throw new CopilotError('OCR_INVALID_RESULT',502);
   const text=raw.replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ')
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,'').trim();
   if(text.length>OCR_MAX_TEXT_CHARS)
     throw new CopilotError('OCR_TEXT_TOO_LONG',422);
   if(text.length<25)throw new CopilotError('OCR_INSUFFICIENT_TEXT',422);
   if(confidence<minimumConfidence)throw new CopilotError('OCR_LOW_CONFIDENCE',422);
   return {
     document_origin:'IMAGE_OCR_LOCAL',image_format:image.format,
     pixels:{width:image.width,height:image.height},
     text,characters:text.length,confidence_percent:Math.round(confidence*10)/10,
     ocr_used:true,ocr_engine:'TESSERACT_LOCAL_SPA',
     model_called:false,needs_manual_review:true,can_auto_approve:false,
     disclaimer:'Texto aproximado por OCR. Los importes y datos deben comprobarse con el documento visual original. Sin validación fiscal ni decisión automática.'
   };
 }catch(e){
   if(e instanceof CopilotError)throw e;
   if(/Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND/i.test(String(e?.message||'')))
     throw new CopilotError('OCR_ENGINE_NOT_INSTALLED',503);
   throw new CopilotError('OCR_PROCESSING_FAILED',422);
 }finally{
   if(worker?.terminate)await Promise.race([
     Promise.resolve().then(()=>worker.terminate()).catch(()=>{}),
     new Promise(r=>setTimeout(r,4000))
   ]);
 }
}
