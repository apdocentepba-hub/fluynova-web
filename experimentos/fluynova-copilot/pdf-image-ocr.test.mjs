import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizeScannedPdf} from './pdf-image-ocr.mjs';
import {buildScannedPdf} from './pdf-scan-fixtures.mjs';
import {buildSyntheticPdf} from './pdf-fixtures.mjs';
import {inspectImageBytes} from './image-input.mjs';
import {PDF_MAX_BYTES} from './pdf-text.mjs';

const mockText='FACTURA FICTICIA\nNETO: $150.000,00\nIVA: $31.500,00\nTOTAL: $181.500,00';
test('PDF ESCANEADO real sin texto se rasteriza localmente a PNG y entrega OCR a revisión',async()=>{
 const pdf=buildScannedPdf();
 let calls=0;
 const out=await recognizeScannedPdf(pdf,{
  ocrRecognizer:async png=>{
   calls++;
   const m=inspectImageBytes(png);
   assert.equal(m.format,'PNG');
   assert.ok(m.width>=500&&m.height>=280);
   return {ocr_used:true,model_called:false,can_auto_approve:false,
    text:mockText,confidence_percent:87.2};
  }
 });
 assert.equal(calls,1);
 assert.equal(out.pages,1);
 assert.equal(out.document_origin,'PDF_SCAN_OCR_LOCAL');
 assert.equal(out.model_called,false);
 assert.equal(out.needs_manual_review,true);
 assert.equal(out.can_auto_approve,false);
 assert.equal(out.ocr_used,true);
 assert.match(out.text,/FACTURA FICTICIA/);
});
test('PDF con capa de texto no se somete a OCR innecesario',async()=>{
 let calls=0;
 const pdf=buildSyntheticPdf({pages:[[
  'Factura ficticia en PDF con texto','Neto: $100,00',
  'IVA: $21,00','Total: $121,00']]});
 await assert.rejects(recognizeScannedPdf(pdf,{
  ocrRecognizer:async()=>{calls++}
 }),e=>e.code==='OCR_PDF_HAS_TEXT_USE_PDF_EXTRACT');
 assert.equal(calls,0);
});
test('un PDF escaneado corrupto o demasiado grande se rechaza antes del OCR',async()=>{
 for(const raw of [Buffer.alloc(0),Buffer.alloc(PDF_MAX_BYTES+1),
  Buffer.from('texto sin firma PDF '.repeat(3))]){
  await assert.rejects(recognizeScannedPdf(raw,{
   ocrRecognizer:async()=>{throw Error('No ejecutar')}
  }),e=>e.code==='PDF_INVALID_SIZE'||e.code==='PDF_INVALID_HEADER');
 }
});
test('rechaza más de dos páginas incluso si PDF contiene texto',async()=>{
 const pdf=buildSyntheticPdf({pages:Array.from({length:3},
   (_,i)=>['Factura de demostración '+i,'Neto: $100,00','IVA: $21,00','Total: $121,00'])});
 await assert.rejects(recognizeScannedPdf(pdf,{
  ocrRecognizer:async()=>{throw Error('No debería ejecutarse')}
 }),e=>e.code==='OCR_PDF_TOO_MANY_PAGES');
});
test('no se admite OCR que no señale revisión humana o trate el resultado como aprobado',async()=>{
 const pdf=buildScannedPdf();
 await assert.rejects(recognizeScannedPdf(pdf,{
  ocrRecognizer:async()=>({ocr_used:true,model_called:false,can_auto_approve:true,
   text:mockText,confidence_percent:90})
 }),e=>e.code==='OCR_INVALID_RESULT');
});
