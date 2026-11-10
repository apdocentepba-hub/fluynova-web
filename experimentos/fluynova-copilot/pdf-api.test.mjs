import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {buildSyntheticPdf} from './pdf-fixtures.mjs';
import {PDF_MAX_BYTES} from './pdf-text.mjs';

const LINES=['Factura ficticia local P-001','Proveedor: Prueba','Neto: $150.000,00',
 'IVA: $31.500,00','Total: $181.500,00'];
async function start(){
 let llmCalls=0;
 const app=createApp({analyzer:async()=>{llmCalls++;throw Error('No debe usarse')}});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 return {app,url:'http://127.0.0.1:'+app.address().port,modelCalls:()=>llmCalls,
  async close(){app.closeAllConnections();await new Promise(r=>app.close(r))}};
}
test('PDF verdadero se extrae por localhost, sin Ollama ni guardar factura',async()=>{
 const s=await start();
 try{
  const bytes=buildSyntheticPdf({pages:[LINES]});
  const res=await fetch(s.url+'/api/pdf/extract',{
   method:'POST',headers:{origin:s.url,'content-type':'application/pdf'},body:bytes
  });
  assert.equal(res.status,200);
  const result=await res.json();
  assert.equal(result.ocr_used,false);
  assert.equal(result.model_called,false);
  assert.equal(result.pages,1);
  assert.match(result.text,/Neto: \$150\.000,00/);
  assert.equal(s.modelCalls(),0);
  const check=await fetch(s.url+'/api/verify-money',{
    method:'POST',headers:{origin:s.url,'content-type':'application/json'},
    body:JSON.stringify({document:result.text})
  });
  assert.equal(check.status,200);
  const checked=await check.json();
  assert.equal(checked.extracted.total_cents,18150000);
  assert.equal(checked.can_auto_approve,false);
  assert.equal(s.modelCalls(),0);
 }finally{await s.close()}
});
test('PDF no acepta origen malicioso, MIME incorrecto ni bytes que exceden límite',async()=>{
 const s=await start();
 try{
  const bytes=buildSyntheticPdf({pages:[LINES]});
  const badOrigin=await fetch(s.url+'/api/pdf/extract',{
   method:'POST',headers:{origin:'https://externo.invalid','content-type':'application/pdf'},body:bytes
  });
  assert.equal(badOrigin.status,403);
  const badMime=await fetch(s.url+'/api/pdf/extract',{
   method:'POST',headers:{origin:s.url,'content-type':'application/octet-stream'},body:bytes
  });
  assert.equal(badMime.status,415);
  const oversized=await fetch(s.url+'/api/pdf/extract',{
   method:'POST',headers:{origin:s.url,'content-type':'application/pdf'},body:Buffer.alloc(PDF_MAX_BYTES+1)
  });
  assert.equal(oversized.status,413);
  const invalid=await fetch(s.url+'/api/pdf/extract',{
   method:'POST',headers:{origin:s.url,'content-type':'application/pdf'},body:Buffer.alloc(40)
  });
  assert.equal(invalid.status,415);
  assert.equal(s.modelCalls(),0);
 }finally{await s.close()}
});
