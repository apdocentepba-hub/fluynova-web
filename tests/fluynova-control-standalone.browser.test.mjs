import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const HTML=await readFile(fileURLToPath(new URL('../static/control/index.html',import.meta.url)),'utf8');
const HOST='control-demo-fluynova.invalid';
let browser;
after(async()=>{await browser?.close()});
async function start(width=390){
 browser??=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request();requests.push({method:req.method(),url:req.url()});
  const u=new URL(req.url());
  if(req.method()!=='GET'||u.hostname!==HOST||u.pathname!=='/control/'){
   await route.abort('blockedbyclient');return;
  }
  await route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:HTML});
 });
 const resp=await page.goto('https://'+HOST+'/control/',{waitUntil:'load'});
 assert.equal(resp.status(),200);
 await page.locator('#records tr').first().waitFor();
 return {context,page,errors,requests};
}
test('pantallas 320-1280, escenario ficticio, 0 solicitudes externas',async()=>{
 const s=await start(390);
 try{
  assert.equal(await s.page.locator('#records tr').count(),6);
  assert.equal(await s.page.locator('#count-alerts').textContent(),'4');
  assert.match(await s.page.locator('body').innerText(),/No hay IA activa/);
  for(const width of [320,390,768,900,1280]){
   await s.page.setViewportSize({width,height:900});
   const dims=await s.page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(dims.scroll<=dims.w+2,JSON.stringify(dims));
  }
  assert.deepEqual(s.errors,[]);
  assert.ok(s.requests.every(x=>x.method==='GET'&&x.url==='https://'+HOST+'/control/'));
 }finally{await s.context.close()}
});
test('control: aprobar, observar, buscar, exportar y reiniciar',async()=>{
 const s=await start(900);
 try{
  assert.equal(await s.page.locator('[data-action="approve"][data-id="F-1004"]').count(),0);
  await s.page.locator('[data-action="approve"][data-id="F-1002"]').click();
  assert.equal(await s.page.locator('#count-approved').textContent(),'1');
  await s.page.locator('[data-action="observe"][data-id="F-1005"]').click();
  await s.page.locator('#review-note').fill('Solicitar orden de compra ficticia');
  await s.page.locator('#save-observation').click();
  assert.equal(await s.page.locator('#count-observed').textContent(),'1');
  assert.equal(await s.page.locator('#audit li').count(),2);
  await s.page.locator('#search').fill('F-1004');
  assert.equal(await s.page.locator('#records tr').count(),1);
  await s.page.locator('#search').fill('');
  await s.page.locator('#status').selectOption('alerts');
  assert.equal(await s.page.locator('#records tr').count(),4);
  const p=s.page.waitForEvent('download');
  await s.page.locator('#export').click();
  assert.equal((await p).suggestedFilename(),'fluynova-demo-comprobantes-ficticios.csv');
  await s.page.locator('#restart').click();
  assert.equal(await s.page.locator('#count-approved').textContent(),'0');
  assert.equal(await s.page.locator('#count-observed').textContent(),'0');
  assert.equal(await s.page.locator('#audit li').count(),1);
  assert.deepEqual(s.errors,[]);
  assert.ok(s.requests.every(x=>x.method==='GET'&&x.url==='https://'+HOST+'/control/'));
 }finally{await s.context.close()}
});


test('circuito completo: observar duplicado, subsanar ejemplo y aprobar',async()=>{
 const s=await start(900);
 try{
  assert.equal(await s.page.locator('#count-alerts').textContent(),'4');
  // El duplicado bloquea la aprobación antes de subsanar.
  assert.equal(await s.page.locator('[data-action="approve"][data-id="F-1003"]').count(),0);
  await s.page.locator('[data-action="observe"][data-id="F-1003"]').click();
  await s.page.locator('#review-note').fill('Factura repetida: solicitar corrección (demo)');
  await s.page.locator('#save-observation').click();
  assert.equal(await s.page.locator('#count-observed').textContent(),'1');
  assert.equal(await s.page.locator('[data-action="approve"][data-id="F-1003"]').count(),0);
  await s.page.locator('[data-action="fix"][data-id="F-1003"]').click();
  assert.equal(await s.page.locator('#count-alerts').textContent(),'2');
  assert.equal(await s.page.locator('#count-observed').textContent(),'0');
  assert.equal(await s.page.locator('[data-action="approve"][data-id="F-1003"]').count(),1);
  assert.match(await s.page.locator('#records').innerText(),/A-0001-00000122/);
  await s.page.locator('[data-action="approve"][data-id="F-1003"]').click();
  assert.equal(await s.page.locator('#count-approved').textContent(),'1');
  const history=await s.page.locator('#audit').innerText();
  assert.match(history,/Aprobación simulada/);
  assert.match(history,/Subsanación ficticia/);
  assert.match(history,/Observación registrada/);
  const p=s.page.waitForEvent('download');
  await s.page.locator('#export').click();
  const csv=await readFile(await (await p).path(),'utf8');
  assert.match(csv,/neto_centavos/);
  assert.match(csv,/FICTICIO/);
  assert.match(csv,/A-0001-00000122/);
  assert.deepEqual(s.errors,[]);
  assert.ok(s.requests.every(x=>x.method==='GET'&&x.url==='https://'+HOST+'/control/'));
 }finally{await s.context.close()}
});
test('documento sin alertas observado necesita volver a pendiente antes de aprobar',async()=>{
 const s=await start(900);
 try{
  await s.page.locator('[data-action="observe"][data-id="F-1002"]').click();
  await s.page.locator('#review-note').fill('Revisar condiciones de ejemplo');
  await s.page.locator('#save-observation').click();
  assert.equal(await s.page.locator('[data-action="approve"][data-id="F-1002"]').count(),0);
  assert.equal(await s.page.locator('[data-action="fix"][data-id="F-1002"]').count(),0);
  await s.page.locator('[data-action="undo"][data-id="F-1002"]').click();
  await s.page.locator('[data-action="approve"][data-id="F-1002"]').click();
  assert.equal(await s.page.locator('#count-approved').textContent(),'1');
  assert.deepEqual(s.errors,[]);
 }finally{await s.context.close()}
});


test('observación con texto malicioso queda inerte en HTML y CSV',async()=>{
 const s=await start(900);
 try{
  const malicious='=HYPERLINK("https://evil.invalid","ver") <img src=x onerror=alert(1)>';
  await s.page.locator('[data-action="observe"][data-id="F-1005"]').click();
  await s.page.locator('#review-note').fill(malicious);
  await s.page.locator('#save-observation').click();
  assert.equal(await s.page.locator('#audit img').count(),0);
  assert.match(await s.page.locator('#audit').innerText(),/=HYPERLINK/);
  const p=s.page.waitForEvent('download');
  await s.page.locator('#export').click();
  const csv=await readFile(await (await p).path(),'utf8');
  assert.match(csv,/"'=HYPERLINK/,'Las fórmulas de planilla deben neutralizarse');
  assert.deepEqual(s.errors,[]);
  assert.ok(s.requests.every(x=>x.method==='GET'&&x.url==='https://'+HOST+'/control/'));
 }finally{await s.context.close()}
});
