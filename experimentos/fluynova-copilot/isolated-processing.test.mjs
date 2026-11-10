import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {runIsolated,isolatedPdf,isolatedOcr} from './isolated-processing.mjs';
import {buildSyntheticPdf} from './pdf-fixtures.mjs';
import {createApp} from './server.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

function pdf(){
 return buildSyntheticPdf({pages:[[
  'Factura ficticia de laboratorio aislado','Neto: $150.000,00',
  'IVA: $31.500,00','Total: $181.500,00'
 ]]});
}
function image(){
 const canvas=createCanvas(1200,500),ctx=canvas.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,1200,500);
 ctx.fillStyle='black';ctx.font='bold 62px Arial';
 ctx.fillText('FACTURA FICTICIA',50,110);
 ctx.fillText('NETO: $150.000,00',50,220);
 ctx.fillText('IVA: $31.500,00',50,330);
 ctx.fillText('TOTAL: $181.500,00',50,440);
 return canvas.toBuffer('image/png');
}
const fault=new URL('./processor-fault-fixture.mjs',import.meta.url);
test('PDF REAL se procesa en subproceso y retorna texto a controles locales',async()=>{
 const out=await isolatedPdf(pdf());
 assert.equal(out.document_origin,'PDF_TEXTO_LOCAL');
 assert.equal(out.model_called,false);
 assert.match(out.text,/Neto: \$150.000,00/);
 const money=verifyMoneyOnly(out.text);
 assert.equal(money.extracted.total_cents,18150000);
 assert.equal(money.can_auto_approve,false);
});
test('OCR Tesseract REAL funciona en proceso separado, sin IA de lenguaje',async()=>{
 const out=await isolatedOcr(image());
 assert.equal(out.document_origin,'IMAGE_OCR_LOCAL');
 assert.equal(out.ocr_used,true);
 assert.equal(out.model_called,false);
 assert.equal(out.needs_manual_review,true);
 assert.equal(out.can_auto_approve,false);
 assert.match(out.text,/FACTURA/);
 assert.match(out.text,/TOTAL/);
});
test('un crash del procesador no tumba ni bloquea al servidor principal',async()=>{
 const app=createApp({pdfExtractor:bytes=>runIsolated('pdf',bytes,{workerUrl:fault})});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 try{
  const result=await fetch(base+'/api/pdf/extract',{
   method:'POST',headers:{origin:base,'content-type':'application/pdf'},body:pdf()
  });
  assert.equal(result.status,502);
  assert.equal((await result.json()).error,'PROCESSOR_CRASHED');
  const status=await fetch(base+'/api/status');
  assert.equal(status.status,200);
  assert.equal((await status.json()).human_review_required,true);
 }finally{app.closeAllConnections();await new Promise(r=>app.close(r))}
});
test('procesador colgado se termina por timeout sin bloquear otros controles',async()=>{
 const began=Date.now();
 await assert.rejects(
  runIsolated('ocr',image(),{workerUrl:fault,timeoutMs:150}),
  e=>e.code==='PROCESSOR_TIMEOUT'&&e.status===504
 );
 assert.ok(Date.now()-began<5000);
});
test('entrada inválida o excesiva se rechaza ANTES de crear un proceso',async()=>{
 for(const item of [Buffer.from('NO-PDF'.repeat(20)),Buffer.alloc(4*1024*1024+1)]){
  await assert.rejects(runIsolated('pdf',item),e=>
   ['PDF_INVALID_HEADER','PROCESSOR_INVALID_SIZE'].includes(e.code));
 }
 await assert.rejects(runIsolated('ocr',Buffer.from('no-image'.repeat(20))),
  e=>e.code==='IMAGE_UNSUPPORTED_FORMAT');
});
