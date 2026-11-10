import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {buildScannedPdf} from './pdf-scan-fixtures.mjs';
import {PDF_MAX_BYTES} from './pdf-text.mjs';

async function start(scannedPdfRecognizer,imageRecognizer=async()=>({})){
 const app=createApp({scannedPdfRecognizer,imageRecognizer,
  analyzer:async()=>{throw new Error('Ollama no debe recibir este documento')}
 });
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 return {app,base:'http://127.0.0.1:'+app.address().port,
  async close(){app.closeAllConnections();await new Promise(r=>app.close(r))}
 };
}
test('endpoint PDF OCR recibe PDF escaneado sólo en localhost, sin invocar IA',async()=>{
 let calls=0;
 const s=await start(async bytes=>{
  calls++;assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
  return {document_origin:'PDF_SCAN_OCR_LOCAL',pages:1,confidence_percent:90,
   model_called:false,can_auto_approve:false,needs_manual_review:true,text:'FACTURA FICTICIA'};
 });
 try{
  const res=await fetch(s.base+'/api/pdf/ocr',{method:'POST',
    headers:{origin:s.base,'content-type':'application/pdf'},body:buildScannedPdf()});
  assert.equal(res.status,200);
  const out=await res.json();
  assert.equal(out.model_called,false);
  assert.equal(out.can_auto_approve,false);
  assert.equal(calls,1);
 }finally{await s.close()}
});
test('endpoint PDF OCR restringe origen, MIME y tamaño',async()=>{
 let calls=0;
 const s=await start(async()=>{calls++});
 try{
  const pdf=buildScannedPdf();
  const tests=[
   {ct:'application/pdf',origin:'https://ajeno.invalid',body:pdf,status:403},
   {ct:'image/png',origin:s.base,body:pdf,status:415},
   {ct:'application/pdf',origin:s.base,body:Buffer.alloc(PDF_MAX_BYTES+1),status:413}
  ];
  for(const x of tests){
   const res=await fetch(s.base+'/api/pdf/ocr',{method:'POST',
    headers:{origin:x.origin,'content-type':x.ct},body:x.body});
   assert.equal(res.status,x.status);
  }
  assert.equal(calls,0);
 }finally{await s.close()}
});
test('una imagen OCR concurrente queda bloqueada mientras procesa PDF OCR',async()=>{
 let entered,release;
 const started=new Promise(r=>{entered=r}),gate=new Promise(r=>{release=r});
 const s=await start(async()=>{entered();await gate;return {model_called:false}});
 try{
  const first=fetch(s.base+'/api/pdf/ocr',{method:'POST',
    headers:{origin:s.base,'content-type':'application/pdf'},body:buildScannedPdf()});
  await started;
  const second=await fetch(s.base+'/api/pdf/ocr',{method:'POST',
    headers:{origin:s.base,'content-type':'application/pdf'},body:buildScannedPdf()});
  assert.equal(second.status,429);
  assert.equal((await second.json()).error,'OCR_BUSY');
  release();
  assert.equal((await first).status,200);
 }finally{release?.();await s.close()}
});
