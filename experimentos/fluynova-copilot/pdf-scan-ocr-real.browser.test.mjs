// End-to-end REAL: browser PDF.js -> Canvas -> PNG -> Tesseract español local -> texto.
// Ningún documento externo, ningún OCR simulado, ningún uso de Qwen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createApp} from './server.mjs';
import {buildScannedPdf} from './pdf-scan-fixtures.mjs';
import {assertOfflineModel} from './ocr-model.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

test('Chromium + PDF raster + Tesseract REAL; métricas por campo, sin APIs externas', {timeout:170000}, async()=>{
 await assertOfflineModel();
 let llmCalls=0;
 const app=createApp({analyzer:async()=>{
   llmCalls++;
   throw new Error('Ollama no debe ser invocado');
 }});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const port=app.address().port;
 const base='http://127.0.0.1:'+port;
 let browser,context;
 const external=[],consoleErrors=[],seen=[];
 try{
   browser=await chromium.launch({headless:true});
   context=await browser.newContext({viewport:{width:1280,height:900}});
   const page=await context.newPage();
   page.on('pageerror',e=>consoleErrors.push(e.message));
   await page.route('**/*',async route=>{
     const url=new URL(route.request().url());
     if(url.hostname!=='127.0.0.1'||url.port!==String(port)){
       external.push(url.toString());
       await route.abort('blockedbyclient');
       return;
     }
     if(url.pathname==='/api/analyze')seen.push('AI_REQUEST');
     if(url.pathname==='/api/ocr/image')seen.push('OCR_REQUEST');
     await route.continue();
   });
   await page.goto(base+'/',{waitUntil:'load'});
   const buffer=buildScannedPdf();
   assert.ok(buffer.length>1000);
   await page.locator('#pdf-file').setInputFiles({
     name:'ejemplo-escaneado-ficticio.pdf',
     mimeType:'application/pdf',buffer
   });
   await page.locator('#scan-pdf').click();
   await page.waitForFunction(()=>{
     const status=document.querySelector('#pdf-status')?.textContent||'';
     return status.includes('OCR PDF local de')||status.includes('OCR PDF no realizado');
   },null,{timeout:130000});
   const status=await page.locator('#pdf-status').innerText();
   assert.match(status,/OCR PDF local de 1 página\(s\)/,status);
   const text=await page.locator('#document').inputValue();
   assert.match(text,/FACTURA/i);
   assert.match(text,/TOTAL/i);
   assert.ok(text.length>=30);
   const result=verifyMoneyOnly(text);
   const expected={net_cents:15000000,tax_cents:3150000,total_cents:18150000};
   let hit=0;
   for(const [field,truth] of Object.entries(expected)){
     const actual=result.extracted[field];
     const correct=actual===truth;
     hit+=Number(correct);
     console.log('OCR campo '+field+': '+(correct?'OK':'REVISAR')+
        (actual===null?' (no corroborado)':' (cifra etiquetada leída)'));
   }
   console.log('OCR PDF REAL campos monetarios:',hit+'/3');
   console.log('OCR PDF REAL texto caracteres:',text.length);
   console.log('OCR PDF REAL estado UI:',status);
   assert.equal(llmCalls,0);
   assert.deepEqual(seen.filter(x=>x==='AI_REQUEST'),[]);
   assert.equal(seen.filter(x=>x==='OCR_REQUEST').length,1);
   assert.deepEqual(external,[]);
   assert.deepEqual(consoleErrors,[]);
   assert.equal(result.can_auto_approve,false);
   // La lectura sin formato manual perfecto es experimental. No declarar 3/3
   // si el OCR no interpreta las cifras correctamente en este ensayo.
   await page.locator('#verify').click();
   await page.locator('#result').waitFor({state:'visible'});
   assert.match(await page.locator('#decision').innerText(),/Reglas sin IA/);
   assert.equal(llmCalls,0);
 }finally{
   await context?.close();
   await browser?.close();
   app.closeAllConnections();
   await new Promise(r=>app.close(r));
 }
});
