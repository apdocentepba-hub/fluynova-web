import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createApp} from './server.mjs';
import {CopilotError} from './analysis.mjs';
import {buildSyntheticPdf} from './pdf-fixtures.mjs';
let browser;
after(async()=>{await browser?.close()});
async function open(analyzer,width=390){
 browser??=await chromium.launch({headless:true});
 const server=createApp({analyzer});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width,height:850}});
 const page=await context.newPage();
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1'||u.port!==String(server.address().port)){
     external.push(u.toString());await route.abort('blockedbyclient');return;
   }
   await route.continue();
 });
 await page.goto(base+'/',{waitUntil:'load'});
 return {page,errors,external,async close(){await context.close();server.closeAllConnections();await new Promise(r=>server.close(r))}};
}
test('Chromium: IA local se presenta como revisión, citas y texto inerte',async()=>{
 let invocations=0;
 const s=await open(async(text)=>{
   invocations++;assert.match(text,/Proveedor Demo Norte/);
   return {
     model_used:'qwen3:1.7b',decision:'REQUIERE_REVISION_HUMANA',
     can_auto_approve:false,
     extracted:{supplier:'Proveedor Demo Norte',number:'A-0001-00000121',order:'OC-1001',
       net_cents:15000000,tax_cents:3150000,total_cents:18150000,
       explanation:'<img src=x onerror=alert(1)>',uncertainty:'Sin verificación externa.',
       evidence:['Factura A-0001-00000121']},
     issues:['Posible duplicado en datos ficticios'],disclaimer:'Documento no validado por autoridad fiscal.'
   };
 });
 try{
   await s.page.locator('#sample').click();
   assert.match(await s.page.locator('#document').inputValue(),/Factura A-0001/);
   await s.page.locator('#analyze').click();
   await s.page.locator('#result').waitFor({state:'visible'});
   assert.equal(invocations,1);
   assert.match(await s.page.locator('#decision').innerText(),/Revisión humana obligatoria/);
   assert.match(await s.page.locator('#issues').innerText(),/duplicado/i);
   assert.equal(await s.page.locator('#result img').count(),0);
   assert.match(await s.page.locator('#explanation').innerText(),/onerror/);
   assert.equal(await s.page.locator('button').count(),4);
   for(const width of [320,390,768,1024]){
     await s.page.setViewportSize({width,height:850});
     const size=await s.page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(size.scroll<=size.w+2,JSON.stringify(size));
   }
   assert.deepEqual(s.errors,[]);assert.deepEqual(s.external,[]);
 }finally{await s.close()}
});
test('Chromium: modelo indisponible es error visible, no falso éxito',async()=>{
 const s=await open(async()=>{throw new CopilotError('AI_UNAVAILABLE',503)});
 try{
   await s.page.locator('#analyze').click();
   await s.page.getByText(/No se obtuvo el resultado: AI_UNAVAILABLE/).waitFor({state:'visible'});
   assert.equal(await s.page.locator('#result').isVisible(),false);
   assert.match(await s.page.locator('#service-status').innerText(),/No se obtuvo una validación exitosa/);
   assert.deepEqual(s.errors,[]);assert.deepEqual(s.external,[]);
 }finally{await s.close()}
});


test('Chromium: control sin IA funciona con Ollama caído, sin aparentar inferencia',async()=>{
 let modelCalls=0;
 const s=await open(async()=>{modelCalls++;throw new CopilotError('AI_UNAVAILABLE',503)});
 try{
  await s.page.locator('#sample').click();
  await s.page.locator('#verify').click();
  await s.page.locator('#result').waitFor({state:'visible'});
  assert.equal(modelCalls,0);
  assert.match(await s.page.locator('#decision').innerText(),/Reglas sin IA/);
  assert.match(await s.page.locator('#result-provenance').innerText(),/no fueron analizados/);
  assert.match(await s.page.locator('#fields').innerText(),/181\.500,00/);
  assert.match(await s.page.locator('#amount-checks').innerText(),/SIN IA/);
  assert.match(await s.page.locator('#evidence').innerText(),/No se ejecutó un modelo/);
  assert.match(await s.page.locator('#service-status').innerText(),/SIN IA/);
  assert.deepEqual(s.errors,[]);
  assert.deepEqual(s.external,[]);
  await s.page.locator('#analyze').click();
  await s.page.getByText(/No se obtuvo el resultado: AI_UNAVAILABLE/).waitFor({state:'visible'});
  assert.equal(modelCalls,1);
  assert.equal(await s.page.locator('#result').isVisible(),false);
  assert.deepEqual(s.errors,[]);
 }finally{await s.close()}
});


test('Chromium: PDF ficticio real se extrae antes del control local, sin usar Ollama',async()=>{
 let llmCalls=0;
 const s=await open(async()=>{llmCalls++;throw new CopilotError('AI_UNAVAILABLE',503)});
 try{
  const buffer=buildSyntheticPdf({pages:[[
   'Factura de prueba DEMO-PDF-01','Proveedor: Prueba inventada',
   'Neto: $150.000,00','IVA: $31.500,00','Total: $181.500,00'
  ]]});
  await s.page.locator('#pdf-file').setInputFiles({
   name:'comprobante-ficticio.pdf',mimeType:'application/pdf',buffer
  });
  await s.page.locator('#read-pdf').click();
  await s.page.getByText(/PDF textual leído: 1 páginas/).waitFor({state:'visible'});
  assert.match(await s.page.locator('#document').inputValue(),/Neto: \$150\.000,00/);
  assert.equal(llmCalls,0);
  await s.page.locator('#verify').click();
  await s.page.locator('#result').waitFor({state:'visible'});
  assert.match(await s.page.locator('#decision').innerText(),/Reglas sin IA/);
  assert.match(await s.page.locator('#fields').innerText(),/181\.500,00/);
  assert.equal(llmCalls,0);
  assert.deepEqual(s.errors,[]);
  assert.deepEqual(s.external,[]);
 }finally{await s.close()}
});
