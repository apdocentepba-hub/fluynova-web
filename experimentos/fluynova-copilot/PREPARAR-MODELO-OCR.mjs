// SOLO se ejecuta cuando el usuario autoriza explícitamente esta descarga.
// NUNCA invocar desde el endpoint OCR ni automáticamente al abrir Copilot.
import {assertOfflineModel,prepareOfflineModel,OCR_PINNED_COMMIT} from './ocr-model.mjs';
if(!process.argv.includes('--autorizar-descarga')){
 console.error('NO_AUTORIZADO: uso: node PREPARAR-MODELO-OCR.mjs --autorizar-descarga');
 process.exitCode=3;
}else{
 try{
   await assertOfflineModel();
   console.log('OCR español ya preparado y verificado. No se descargó nada.');
 }catch{
   try{
     console.log('Descargando modelo ESPAÑOL OFICIAL fijado al commit '+OCR_PINNED_COMMIT);
     console.log('Solo el modelo de Tesseract. NO se envían documentos ni datos de usuario.');
     const result=await prepareOfflineModel();
     console.log('LISTO:',result.status,'|',result.language,'|',result.bytes,'bytes');
   }catch(err){
     console.error('ERROR:',err?.code||'PREPARATION_FAILED');
     process.exitCode=1;
   }
 }
}
