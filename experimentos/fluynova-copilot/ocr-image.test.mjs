import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {inspectImageBytes,IMAGE_MAX_BYTES} from './image-input.mjs';
import {recognizeImage} from './ocr-image.mjs';
import {verifyModelBytes} from './ocr-model.mjs';

function image(type='image/png'){
 const canvas=createCanvas(1000,260);
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,1000,260);
 ctx.fillStyle='black';ctx.font='bold 43px Arial';
 ctx.fillText('FACTURA FICTICIA',45,70);
 ctx.font='36px Arial';
 ctx.fillText('Neto: $150.000,00',45,130);
 ctx.fillText('IVA: $31.500,00',45,184);
 ctx.fillText('Total: $181.500,00',45,238);
 return canvas.toBuffer(type);
}
const mockText='FACTURA FICTICIA\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
test('PNG y JPEG binarios: tamaño, píxeles y formato',()=>{
 const png=inspectImageBytes(image());
 assert.equal(png.format,'PNG');assert.equal(png.width,1000);assert.equal(png.height,260);
 const jpeg=inspectImageBytes(image('image/jpeg'));
 assert.equal(jpeg.format,'JPEG');assert.equal(jpeg.width,1000);assert.equal(jpeg.height,260);
});
test('cabeceras no permitidas y dimensiones excesivas se rechazan',()=>{
 for(const b of [Buffer.alloc(0),Buffer.alloc(40),Buffer.alloc(IMAGE_MAX_BYTES+1)]){
  assert.throws(()=>inspectImageBytes(b),e=>e.code==='IMAGE_INVALID_SIZE'||e.code==='IMAGE_UNSUPPORTED_FORMAT');
 }
 const png=image();
 png.writeUInt32BE(20000,16);
 assert.throws(()=>inspectImageBytes(png),e=>e.code==='IMAGE_DIMENSIONS_REJECTED');
 assert.throws(()=>inspectImageBytes(Buffer.from('%PDF-1.4 ejemplo falso no es una imagen')),
  e=>e.code==='IMAGE_UNSUPPORTED_FORMAT'||e.code==='IMAGE_INVALID_SIZE');
});
test('OCR retorna sólo texto a revisar y nunca aprueba importes',async()=>{
 let terminated=false,called=false,providedLanguage;
 const png=image();
 const out=await recognizeImage(png,{
  checkModel:async(dir)=>{assert.equal(typeof dir,'string')},
  workerFactory:async(lang,dir)=>{
   called=true;providedLanguage=lang;
   assert.equal(typeof dir,'string');
   return {
    recognize:async(b)=>{assert.deepEqual(b,png);return {data:{text:mockText,confidence:85.5}}},
    terminate:async()=>{terminated=true}
   };
  }
 });
 assert.equal(providedLanguage,'spa');
 assert.equal(out.document_origin,'IMAGE_OCR_LOCAL');
 assert.equal(out.model_called,false);
 assert.equal(out.ocr_used,true);
 assert.equal(out.needs_manual_review,true);
 assert.equal(out.can_auto_approve,false);
 assert.equal(out.confidence_percent,85.5);
 assert.equal(out.text,mockText);
 assert.equal(called,true);assert.equal(terminated,true);
});
test('nunca ejecuta OCR ni accede a red si falta el modelo local',async()=>{
 let called=false;
 await assert.rejects(recognizeImage(image(),{
  checkModel:async()=>{throw Object.assign(new Error('missing'),{code:'OCR_LANGUAGE_NOT_PREPARED'})},
  workerFactory:async()=>{called=true}
 }),e=>e.code==='OCR_LANGUAGE_NOT_PREPARED'||e.code==='OCR_PROCESSING_FAILED');
 assert.equal(called,false);
});
test('baja confianza e imagen sin texto producen rechazo seguro',async()=>{
 for(const result of [
  {text:mockText,confidence:12.5,code:'OCR_LOW_CONFIDENCE'},
  {text:'',confidence:80,code:'OCR_INSUFFICIENT_TEXT'},
  {text:'x'.repeat(6200),confidence:85,code:'OCR_TEXT_TOO_LONG'}
 ]){
  let terminated=false;
  await assert.rejects(recognizeImage(image(),{
   checkModel:async()=>{},
   workerFactory:async()=>({
    recognize:async()=>({data:{text:result.text,confidence:result.confidence}}),
    terminate:async()=>{terminated=true}
   })
  }),e=>e.code===result.code);
  assert.equal(terminated,true);
 }
});
test('timeout de OCR se identifica y se intenta liberar el worker',async()=>{
 let stopped=false;
 const hung=new Promise(()=>{});
 await assert.rejects(recognizeImage(image(),{
  timeoutMs:20,checkModel:async()=>{},
  workerFactory:async()=>({recognize:()=>hung,terminate:async()=>{stopped=true}})
 }),e=>e.code==='OCR_TIMEOUT');
 assert.equal(stopped,true);
});
test('no se aceptan datos de idioma falsos o inusualmente grandes',()=>{
 assert.equal(verifyModelBytes(Buffer.from('sin datos')),false);
 assert.equal(verifyModelBytes(Buffer.alloc(3*1024*1024+1)),false);
});
