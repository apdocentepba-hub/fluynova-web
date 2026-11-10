import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createApp} from './server.mjs';
import {CopilotError} from './analysis.mjs';

function image(){
 const canvas=createCanvas(1000,280);
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,1000,280);
 ctx.fillStyle='black';ctx.font='bold 50px Arial';
 ctx.fillText('FACTURA FICTICIA',30,85);
 ctx.fillText('TOTAL: $181.500,00',30,165);
 return canvas.toBuffer('image/png');
}
async function serverStart(imageRecognizer){
 const app=createApp({
  analyzer:async()=>{throw new Error('LLM should not be called')},
  imageRecognizer
 });
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 return {app,base,async close(){app.closeAllConnections();await new Promise(r=>app.close(r))}};
}
test('OCR endpoint usa bytes PNG y no llama IA ni devuelve aprobación',async()=>{
 let calls=0;
 const srv=await serverStart(async bytes=>{
  calls++;
  assert.ok(Buffer.isBuffer(bytes));
  assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  return {text:'FACTURA FICTICIA\nNeto: $150.000,00',model_called:false,
    ocr_used:true,can_auto_approve:false,needs_manual_review:true};
 });
 try{
  const res=await fetch(srv.base+'/api/ocr/image',{method:'POST',
    headers:{origin:srv.base,'content-type':'image/png'},body:image()});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.model_called,false);
  assert.equal(data.can_auto_approve,false);
  assert.equal(calls,1);
 }finally{await srv.close()}
});
test('OCR endpoint bloquea orígenes externos, formatos falsos y tamaños',async()=>{
 let calls=0;
 const srv=await serverStart(async()=>{calls++;return {}});
 const png=image();
 try{
  const cases=[
    {contentType:'image/svg+xml',origin:srv.base,bytes:png,status:415},
    {contentType:'image/png',origin:'https://atacante.invalid',bytes:png,status:403},
    {contentType:'image/jpeg',origin:srv.base,bytes:png,status:415},
    {contentType:'image/png',origin:srv.base,bytes:Buffer.alloc(50),status:415},
    {contentType:'image/png',origin:srv.base,bytes:Buffer.alloc(3*1024*1024+1),status:413}
  ];
  for(const c of cases){
   const res=await fetch(srv.base+'/api/ocr/image',{method:'POST',
     headers:{origin:c.origin,'content-type':c.contentType},body:c.bytes});
   assert.equal(res.status,c.status,JSON.stringify(c));
  }
  assert.equal(calls,0);
 }finally{await srv.close()}
});
test('OCR no permite trabajo concurrente ilimitado: la segunda solicitud se rechaza',async()=>{
 let signal,release;
 const entered=new Promise(r=>{signal=r});
 const gate=new Promise(r=>{release=r});
 let calls=0;
 const srv=await serverStart(async()=>{calls++;signal();await gate;return {
  text:'OCR simulado: FACTURA',model_called:false,can_auto_approve:false
 }});
 try{
  const opts={method:'POST',headers:{origin:srv.base,'content-type':'image/png'},body:image()};
  const first=fetch(srv.base+'/api/ocr/image',opts);
  await entered;
  const second=await fetch(srv.base+'/api/ocr/image',opts);
  assert.equal(second.status,429);
  assert.equal((await second.json()).error,'OCR_BUSY');
  assert.equal(calls,1);
  release();
  const r=await first;assert.equal(r.status,200);
 }finally{release?.();await srv.close()}
});
test('si no hay modelo OCR preparado, error explícito sin respuesta simulada',async()=>{
 const srv=await serverStart(async()=>{throw new CopilotError('OCR_LANGUAGE_NOT_PREPARED',503)});
 try{
  const res=await fetch(srv.base+'/api/ocr/image',{method:'POST',
   headers:{origin:srv.base,'content-type':'image/png'},body:image()});
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,'OCR_LANGUAGE_NOT_PREPARED');
 }finally{await srv.close()}
});
