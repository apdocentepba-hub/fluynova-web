import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createCanvas} from '@napi-rs/canvas';
import {createApp} from './server.mjs';

test('Chromium: corrección humana separada de OCR, cotejo, discrepancias e invalidación',async()=>{
 const fakeOcr='FACTURA FICTICIA\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00';
 let calls=0,aiCalls=0;
 const server=createApp({
  analyzer:async()=>{aiCalls++;throw Error('LLM_FORBIDDEN')},
  imageRecognizer:async()=>{calls++;return {
   text:fakeOcr,characters:fakeOcr.length,confidence_percent:94,
   model_called:false,ocr_used:true,can_auto_approve:false,needs_manual_review:true
  }}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 const base='http://127.0.0.1:'+port;
 const external=[],errors=[];
 let browser,context;
 try{
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:390,height:850}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1'||u.port!==String(port)){
    external.push(u.toString());await route.abort('blockedbyclient');return;
   }
   await route.continue();
  });
  await page.goto(base+'/',{waitUntil:'load'});
  const canvas=createCanvas(1100,360),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1100,360);
  ctx.fillStyle='#111';ctx.font='bold 52px Arial';
  ctx.fillText('FACTURA FICTICIA',30,90);
  ctx.fillText('NETO: $150.000,00',30,190);
  ctx.fillText('TOTAL: $181.500,00',30,290);
  const attachment={name:'ficticia.png',mimeType:'image/png',buffer:canvas.toBuffer('image/png')};
  await page.locator('#image-file').setInputFiles(attachment);
  await page.locator('#read-image').click();
  await page.locator('#ocr-originals img').waitFor({state:'visible'});
  assert.equal(calls,1);
  assert.match(await page.locator('#document').inputValue(),/150\.800,00/);
  const inputValues={'manual-net':'150.000,00','manual-tax':'31.500,00','manual-total':'181.500,00'};
  for(const [id,v] of Object.entries(inputValues))await page.locator('#'+id).fill(v);
  await page.locator('#manual-control').click();
  assert.match(await page.locator('#manual-status').innerText(),/Se requiere un OCR cargado/);
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#ocr-confirm').check();
  await page.locator('#manual-control').click();
  await page.locator('#result').waitFor({state:'visible'});
  assert.match(await page.locator('#decision').innerText(),/Transcripción humana sin IA/);
  assert.match(await page.locator('#result-provenance').innerText(),/ninguna cifra certificada/i);
  assert.match(await page.locator('#fields').innerText(),/150\.000,00/);
  assert.match(await page.locator('#amount-checks').innerText(),/DIFIERE del texto OCR/);
  assert.match(await page.locator('#manual-status').innerText(),/suma consistente/);
  assert.match(await page.locator('#document').inputValue(),/150\.800,00/);
  assert.equal(aiCalls,0);
  await page.locator('#manual-tax').fill('31,500.00');
  assert.equal(await page.locator('#ocr-confirm').isChecked(),false);
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#ocr-confirm').check();
  await page.locator('#manual-control').click();
  assert.match(await page.locator('#manual-status').innerText(),/MANUAL_AMOUNT_INVALID/);
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#image-file').setInputFiles({
   name:'otro-documento.png',mimeType:'image/png',buffer:canvas.toBuffer('image/png')
  });
  assert.equal(await page.locator('#manual-net').inputValue(),'');
  assert.equal(await page.locator('#manual-tax').inputValue(),'');
  assert.equal(await page.locator('#manual-total').inputValue(),'');
  assert.equal(await page.locator('#document').inputValue(),'');
  assert.equal(await page.locator('#ocr-originals img').count(),0);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  assert.equal(aiCalls,0);
 }finally{
  await context?.close();await browser?.close();
  server.closeAllConnections();await new Promise(r=>server.close(r));
 }
});
