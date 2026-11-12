// OCR de imágenes en memoria; modelo entrenado y WASM sólo locales.
// El resultado no se confunde con datos verificados ni aprobados.
import {CopilotError} from './analysis.mjs';
import {inspectImageBytes,OCR_MAX_TEXT_CHARS} from './image-input.mjs';
import {assertOfflineModel,OCR_DATA_DIR} from './ocr-model.mjs';
import {assessOcrReadability} from './ocr-readability.mjs';
import {planOcrRegionRetry,reconcileOcrRegionTexts} from './ocr-layout.mjs';

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
 if(Number(process.versions.node.split('.')[0])<24)
   throw new CopilotError('OCR_REQUIRES_NODE_24',503);
 const image=inspectImageBytes(input);
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)
   throw new CopilotError('OCR_INVALID_TIMEOUT',500);
 const deadline=Date.now()+timeoutMs;
 const timeLeft=()=>Math.max(1,deadline-Date.now());
 await checkModel(languageDir);
 let worker;
 try{
   const starting=Promise.resolve().then(()=>workerFactory('spa',languageDir));
   // Si la carga demora más del límite, terminar worker si finalmente inicializa.
   try{worker=await withDeadline(starting,timeLeft())}
   catch(e){
     starting.then(w=>w?.terminate?.().catch(()=>{})).catch(()=>{});
     throw e;
   }
   if(typeof worker?.recognize!=='function')throw Error('invalid-worker');
   const result=await withDeadline(Promise.resolve().then(
     ()=>worker.recognize(image.bytes)),timeLeft());
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
   let finalText=text;
   const layout={
     region_retry_attempted:false,recovered_fields:[],conflict_fields:[],
     region_confidence_percent:null,independent_source_verified:false
   };
   // Segunda pasada SOLO si el primer OCR perdió etiquetas y el ancho permite
   // un bloque derecho. Tesseract vuelve a leer el MISMO documento, no una
   // fuente independiente. Nunca reemplazar valores primarios contradictorios.
   const plan=planOcrRegionRetry(text,image.width,image.height);
   if(plan&&timeLeft()>5000){
     layout.region_retry_attempted=true;
     try{
       const extra=await withDeadline(Promise.resolve().then(
         ()=>worker.recognize(image.bytes,{rectangle:plan.rectangle})),timeLeft());
       const candidate=extra?.data?.text;
       const candidateConf=extra?.data?.confidence;
       if(typeof candidate==='string'&&Number.isFinite(candidateConf)&&
         candidateConf>=minimumConfidence&&candidate.length<=OCR_MAX_TEXT_CHARS){
         const normalized=candidate.replace(/\r\n?/g,'\n')
          .replace(/[^\S\n]+/g,' ')
          .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,'').trim();
         const merged=reconcileOcrRegionTexts(text,normalized);
         if(merged.text.length<=OCR_MAX_TEXT_CHARS){
           finalText=merged.text;
           layout.recovered_fields=merged.recovered_fields;
           layout.conflict_fields=merged.conflict_fields;
           layout.region_confidence_percent=Math.round(candidateConf*10)/10;
         }
       }
     }catch{
       // El OCR principal y sus alertas siguen disponibles; no inventar montos.
       layout.region_retry_failed=true;
     }
   }
   const reading_quality=assessOcrReadability(finalText,confidence);
   if(layout.region_retry_attempted){
     reading_quality.reasons.push('SEGUNDA_PASADA_OCR_REGIONAL');
     if(layout.conflict_fields.length)
       reading_quality.reasons.push('CONFLICTO_ENTRE_LECTURAS_OCR');
     reading_quality.layout_recovered_fields=layout.recovered_fields;
     reading_quality.layout_conflict_fields=layout.conflict_fields;
   }
   return {
     document_origin:'IMAGE_OCR_LOCAL',image_format:image.format,
     pixels:{width:image.width,height:image.height},
     text:finalText,characters:finalText.length,
     confidence_percent:Math.round(confidence*10)/10,
     reading_quality,layout_region:layout,
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
