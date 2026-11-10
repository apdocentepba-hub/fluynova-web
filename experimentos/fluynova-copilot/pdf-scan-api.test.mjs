import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {buildScannedPdf} from './pdf-scan-fixtures.mjs';

test('OCR de PDF desde Node está expresamente DESHABILITADO: evita crash nativo',async()=>{
 const app=createApp({
  analyzer:async()=>{throw Error('no-model')},
  imageRecognizer:async()=>{throw Error('no-ocr')}
 });
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 try{
  const res=await fetch(base+'/api/pdf/ocr',{method:'POST',
   headers:{'content-type':'application/pdf',origin:base},body:buildScannedPdf()});
  assert.equal(res.status,404);
  assert.equal((await res.json()).error,'NOT_FOUND');
 }finally{app.closeAllConnections();await new Promise(r=>app.close(r))}
});
test('PDF.js se entrega desde activos LOCALES exactos, sin rutas arbitrarias',async()=>{
 const app=createApp();
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 try{
  for(const asset of ['/assets/pdfjs/pdf.mjs','/assets/pdfjs/pdf.worker.mjs']){
   const res=await fetch(base+asset);
   assert.equal(res.status,200);
   assert.match(res.headers.get('content-type'),/text\/javascript/);
   assert.ok((await res.text()).length>50000);
   const csp=res.headers.get('content-security-policy');
   assert.match(csp,/worker-src 'self'/);
   assert.match(csp,/script-src 'unsafe-inline' 'self'/);
  }
  for(const path of ['/assets/pdfjs/other.mjs','/assets/pdfjs/../../server.mjs',
    '/node_modules/pdfjs-dist/build/pdf.mjs']){
   const res=await fetch(base+path);
   assert.equal(res.status,404,path);
  }
 }finally{app.closeAllConnections();await new Promise(r=>app.close(r))}
});
