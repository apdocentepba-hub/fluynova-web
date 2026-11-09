/**
 * FLUYNOVA — propuesta municipal SIN PUBLICAR: pruebas Chromium.
 * Solo archivos reales del sitio, datos inventados y rutas de lectura.
 * No se contacta ninguna infraestructura ni se envían formularios.
 */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=resolve(fileURLToPath(new URL('../static/',import.meta.url)));
const HOST='fluynova-municipios-ci.invalid';
const SITE='https://'+HOST+'/municipios/';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
let browser;
after(async()=>{await browser?.close();browser=undefined});
async function session(width=390){
 browser??=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width,height:850}});
 const page=await context.newPage();
 const requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  requests.push({url:req.url(),method:req.method()});
  if(req.method()!=='GET'||url.hostname!==HOST){
   await route.abort('blockedbyclient');return;
  }
  let file;
  try{
   const part=decodeURIComponent(url.pathname).replace(/^\/+/,'');
   if(part.includes('\0'))throw Error('bad');
   file=resolve(ROOT,part.endsWith('/')?part+'index.html':part);
   if(!file.startsWith(ROOT+sep))throw Error('outside');
  }catch{await route.abort('blockedbyclient');return}
  let buffer;
  try{buffer=await readFile(file)}
  catch{await route.fulfill({status:404,body:'Not found'});return}
  await route.fulfill({status:200,contentType:types[extname(file)]||'application/octet-stream',
   body:buffer});
 });
 const response=await page.goto(SITE,{waitUntil:'load',timeout:15000});
 assert.equal(response.status(),200);
 await page.locator('#case-list [data-case]').first().waitFor();
 return {context,page,requests,errors};
}
test('Página municipal: contenido honesto y responsive a 7 anchuras',async()=>{
 const s=await session(320);
 try{
  assert.match(await s.page.title(),/FLUYNOVA.+municipal/i);
  assert.equal(await s.page.locator('h1').count(),1);
  assert.equal(await s.page.locator('#propuestas article').count(),3);
  assert.equal(await s.page.locator('#demo [data-case]').count(),3);
  assert.equal(await s.page.locator('form').count(),0);
  const text=await s.page.locator('body').innerText();
  assert.match(text,/Prototipo visual offline/);
  assert.match(text,/Sin reemplazar plataformas existentes/);
  assert.match(text,/sin modelo de IA, sin API, sin base de datos/i);
  assert.match(text,/no sistema municipal contratado/i);
  const responsive=[];
  for(const width of [320,390,768,900,1024,1366,1920]){
   await s.page.setViewportSize({width,height:850});
   const m=await s.page.evaluate(()=>({
    viewport:innerWidth,
    root:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
    max:document.documentElement.clientWidth
   }));
   assert.ok(m.root<=m.viewport+2,JSON.stringify(m));
   assert.ok(m.body<=m.viewport+2,JSON.stringify(m));
   responsive.push(width);
  }
  console.log('FLUYNOVA_MUNICIPIOS_LAYOUT_PASS: widths='+responsive.join(',')+', remote=false');
  assert.deepEqual(s.errors,[]);
  assert.ok(s.requests.every(r=>r.url.startsWith('https://'+HOST+'/')&&r.method==='GET'));
 }finally{await s.context.close()}
});
test('Demostración municipal: derivar, resolver, reiniciar sin HTTP ni datos',async()=>{
 const s=await session(390);
 try{
  const total=async()=>[
   await s.page.locator('#count-new').textContent(),
   await s.page.locator('#count-assigned').textContent(),
   await s.page.locator('#count-resolved').textContent()
  ];
  assert.deepEqual(await total(),['3','0','0']);
  const button=s.page.locator('[data-advance="DEMO-001"]');
  await button.click();
  assert.deepEqual(await total(),['2','1','0']);
  assert.equal(await s.page.locator('#demo-history li').count(),1);
  assert.match(await s.page.locator('#demo-history').innerText(),/Derivada a Servicios públicos/);
  assert.match(await s.page.locator('[data-case="DEMO-001"] .case-owner').innerText(),/Servicios públicos/);
  assert.equal(await button.textContent(),'Marcar resuelta');
  await button.click();
  assert.deepEqual(await total(),['2','0','1']);
  assert.equal(await s.page.locator('#demo-history li').count(),2);
  assert.match(await s.page.locator('#demo-history').innerText(),/Marcada resuelta/);
  assert.equal(await button.isDisabled(),true);
  assert.equal(await s.page.locator('[data-case="DEMO-001"] .case-status').textContent(),'Resuelta');
  for(const id of ['DEMO-002','DEMO-003']){
   const b=s.page.locator('[data-advance="'+id+'"]');
   await b.click();await b.click();
  }
  assert.deepEqual(await total(),['0','0','3']);
  assert.equal(await s.page.locator('#demo-history li').count(),6);
  await s.page.locator('#reset-demo').click();
  assert.deepEqual(await total(),['3','0','0']);
  assert.equal(await s.page.locator('#demo-history li').count(),1);
  assert.match(await s.page.locator('#demo-history').innerText(),/Sin movimientos todavía/);
  assert.equal(await s.page.locator('[data-case="DEMO-001"] .case-owner').isHidden(),true);
  assert.equal(await button.isDisabled(),false);
  assert.match(await s.page.locator('#demo-notice').textContent(),/Ejemplo reiniciado/);
  assert.deepEqual(s.errors,[]);
  assert.ok(s.requests.every(r=>r.method==='GET'&&r.url.startsWith('https://'+HOST+'/')),
   'Botones no deben comunicarse con servidor o terceros');
  console.log('FLUYNOVA_MUNICIPIOS_DEMO_PASS: derive_resolve_reset=true, post=0, external=0');
 }finally{await s.context.close()}
});
test('Privacidad: no hay datos reales, almacenamiento ni envío automático',async()=>{
 const s=await session(390);
 try{
  const href=await s.page.locator('.contact-box a[href^="mailto:"]').getAttribute('href');
  assert.match(href,/^mailto:contacto\.fluynova@gmail\.com\?subject=/);
  assert.equal(await s.page.locator('a[href*="formsubmit"]').count(),0);
  assert.equal(await s.page.locator('input').count(),0);
  const state=await s.page.evaluate(()=>({
   localStorage:localStorage.length,
   sessionStorage:sessionStorage.length,
   buttons:[...document.querySelectorAll('.cases button')].length
  }));
  assert.equal(state.localStorage,0);
  assert.equal(state.sessionStorage,0);
  assert.equal(state.buttons,3);
  const script=await readFile(new URL('../static/municipios/municipios.js',import.meta.url),'utf8');
  // No confundir comentarios descriptivos con llamadas ejecutables (e.g. "NO fetch()").
  const executableSource=script.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  assert.doesNotMatch(executableSource,/\bfetch\s*\(|XMLHttpRequest|localStorage\s*\.|sessionStorage\s*\.|navigator\.sendBeacon/i);
  assert.deepEqual(s.errors,[]);
 }finally{await s.context.close()}
});
