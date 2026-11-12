import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createCanvas} from '@napi-rs/canvas';
import {createApp} from './server.mjs';

const ambiguous=[
 'FACTURA FICTICIA DEMOSTRACION',
 'Neto: $150.000,00','IVA: $31.500,00','Total: $181.500,00',
 '[LECTURA OCR REGIONAL - SIN VERIFICACION INDEPENDIENTE]',
 'Neto: $150.800,00','Total: $182.300,00'].join('\n');
function image(){
 const c=createCanvas(1100,440),ctx=c.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,1100,440);
 ctx.fillStyle='#111';ctx.font='bold 48px Arial';
 ['FACTURA FICTICIA','NETO: $150.000,00','IVA: $31.500,00','TOTAL: $181.500,00']
 .forEach((s,i)=>ctx.fillText(s,25,90+i*99));
 return c.toBuffer('image/png');
}
async function setup(){
 let aiCalls=0;
 const server=createApp({
  analyzer:async()=>{aiCalls++;throw Error('Ollama no permitido en este test')},
  imageRecognizer:async()=>({
   text:ambiguous,characters:ambiguous.length,confidence_percent:93,
   ocr_used:true,model_called:false,can_auto_approve:false,
   needs_manual_review:true
  })
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port,base='http://127.0.0.1:'+port;
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:850}});
 const page=await context.newPage(),errors=[],external=[],verifyResults=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname!=='127.0.0.1'||u.port!==String(port)){
   external.push(u.toString());await route.abort('blockedbyclient');return;
  }
  await route.continue();
 });
 page.on('response',async response=>{
  if(response.url().endsWith('/api/verify-money')&&response.ok()){
   verifyResults.push(await response.json().catch(()=>null));
  }
 });
 await page.goto(base+'/',{waitUntil:'load'});
 await page.locator('#image-file').setInputFiles({
  name:'original-ficticio.png',mimeType:'image/png',buffer:image()
 });
 await page.locator('#read-image').click();
 await page.locator('#manual-review').waitFor({state:'visible'});
 return {server,browser,context,page,errors,external,verifyResults,
  aiCalls:()=>aiCalls,async close(){
   await context.close();await browser.close();
   server.closeAllConnections();await new Promise(r=>server.close(r));
  }};
}
test('Chromium: neto y total duplicados pueden corregirse sin certificar importes',async()=>{
 const s=await setup();
 try{
  assert.match(await s.page.locator('#manual-net-status').innerText(),/ambiguo/i);
  assert.match(await s.page.locator('#manual-total-status').innerText(),/ambiguo/i);
  assert.match(await s.page.locator('#manual-tax-status').innerText(),/31.500,00/);
  assert.equal(await s.page.locator('#ocr-originals img').count(),1);
  assert.equal(await s.page.locator('#manual-net').inputValue(),'');
  await s.page.locator('#manual-net').fill('150.000,00');
  await s.page.locator('#manual-total').fill('$181.500,00');
  await s.page.locator('#manual-apply').click();
  assert.match(await s.page.locator('#manual-status').innerText(),/COTEJO_REQUERIDO/);
  assert.match(await s.page.locator('#document').inputValue(),/150.800,00/);
  await s.page.locator('#ocr-confirm').check();
  await s.page.locator('#manual-apply').click();
  await s.page.getByText(/Correcciones aplicadas a 2 campo/).waitFor({state:'visible'});
  const revised=await s.page.locator('#document').inputValue();
  assert.doesNotMatch(revised,/150.800,00|182.300,00/);
  assert.equal(revised.split('\n').filter(line=>/^Neto:/.test(line)).length,1);
  assert.equal(revised.split('\n').filter(line=>/^Total:/.test(line)).length,1);
  assert.match(revised,/CORRECCION HUMANA DECLARADA/);
  assert.equal(await s.page.locator('#ocr-confirm').isChecked(),false);
  await s.page.locator('#verify').click();
  assert.match(await s.page.locator('#service-status').innerText(),/Control detenido/);
  await s.page.locator('#ocr-confirm').check();
  await s.page.locator('#verify').click();
  await s.page.locator('#result').waitFor({state:'visible'});
  assert.match(await s.page.locator('#fields').innerText(),/181.500,00/);
  assert.match(await s.page.locator('#disclaimer').innerText(),/NO certificado/i);
  assert.match(await s.page.locator('#result-provenance').innerText(),/no verificación independiente/i);
  assert.equal(s.verifyResults.length,1);
  assert.equal(s.verifyResults[0].verified_amounts,0);
  assert.equal(s.verifyResults[0].parsed_amounts,3);
  assert.equal(s.verifyResults[0].original_document_verified,false);
  assert.equal(s.verifyResults[0].can_auto_approve,false);
  assert.equal(s.aiCalls(),0);
  assert.deepEqual(s.errors,[]);
  assert.deepEqual(s.external,[]);
  for(const width of [320,390,1024]){
   await s.page.setViewportSize({width,height:850});
   const size=await s.page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(size.scroll<=size.width+2,JSON.stringify(size));
  }
 }finally{await s.close()}
});
test('Chromium: formatos extranjeros o valores vacíos NO alteran OCR original',async()=>{
 const s=await setup();
 try{
  const original=await s.page.locator('#document').inputValue();
  await s.page.locator('#ocr-confirm').check();
  await s.page.locator('#manual-apply').click();
  assert.match(await s.page.locator('#manual-status').innerText(),/No ingresaste/);
  assert.equal(await s.page.locator('#document').inputValue(),original);
  await s.page.locator('#manual-net').fill('150,000.00');
  await s.page.locator('#manual-apply').click();
  assert.match(await s.page.locator('#manual-status').innerText(),/MANUAL_REVIEW_INVALID_AMOUNT_net_cents/);
  assert.equal(await s.page.locator('#document').inputValue(),original);
  assert.equal(await s.page.locator('#result').isVisible(),false);
  assert.equal(s.verifyResults.length,0);
  assert.deepEqual(s.errors,[]);assert.deepEqual(s.external,[]);
 }finally{await s.close()}
});
test('Chromium: seleccionar un archivo distinto borra el estado de revisión anterior',async()=>{
 const s=await setup();
 try{
  await s.page.locator('#ocr-confirm').check();
  await s.page.locator('#image-file').setInputFiles({
   name:'otro-documento-ficticio.png',mimeType:'image/png',buffer:image()
  });
  assert.equal(await s.page.locator('#ocr-confirm').isChecked(),false);
  assert.equal(await s.page.locator('#manual-review').isVisible(),false);
  assert.equal(await s.page.locator('#document').inputValue(),'');
  assert.equal(await s.page.locator('#ocr-originals img').count(),0);
  assert.deepEqual(s.errors,[]);assert.deepEqual(s.external,[]);
 }finally{await s.close()}
});
