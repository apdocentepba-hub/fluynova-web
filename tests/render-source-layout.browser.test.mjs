/**
 * FLUYNOVA — Chromium sobre los archivos EXACTOS que sirve FastAPI en Render
 * (static/index.html, styles.css, conversion-ux-2026.css, main.js).
 * No transforma el candidato, NO tiene red externa y nunca envía formularios.
 */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=resolve(fileURLToPath(new URL('../static/',import.meta.url)));
const HOST='fluynova-source-local.invalid';
const SITE='https://'+HOST+'/';
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript',
 '.svg':'image/svg+xml','.txt':'text/plain','.json':'application/json'};
let browser;
after(async()=>{await browser?.close();browser=undefined});
async function session({width=1920,baseline=false}={}){
 browser??=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width,height:900}});
 const page=await context.newPage();
 const unexpected=[],errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new globalThis.URL(req.url());
  if(req.method()!=='GET'){unexpected.push(req.url());return route.abort('blockedbyclient')}
  if(url.hostname!==HOST)return route.abort('blockedbyclient');
  if(url.pathname==='/api/config'){
   return route.fulfill({status:200,contentType:'application/json',
    body:'{"contact_enabled":false,"contact_method":"formsubmit"}'});
  }
  let path;
  try{
   const fragment=decodeURIComponent(url.pathname).replace(/^\/+/,'');
   path=resolve(ROOT,!fragment||fragment.endsWith('/')?fragment+'index.html':fragment);
   if(path!==ROOT&&!path.startsWith(ROOT+sep))return route.abort('blockedbyclient');
  }catch{return route.abort('blockedbyclient')}
  let bytes;
  try{bytes=await readFile(path)}
  catch{return route.fulfill({status:404,body:'Not found'})}
  if(baseline&&path===join(ROOT,'styles.css')){
   const code=bytes.toString('utf8');
   assert.equal(code.split('html{scroll-behavior:smooth;overflow-x:clip}').length,2,
    'Baseline debe revertir exactamente el parche de clipping en memoria');
   const changed='.ambient-one{background:#275c45;opacity:.20;width:min(490px,100vw);height:490px;right:0;top:170px}';
   const original='.ambient-one{background:#275c45;opacity:.20;width:490px;height:490px;right:-250px;top:170px}';
   assert.equal(code.split(changed).length,2,'Comparar exactamente el resplandor inicial de Render');
   bytes=Buffer.from(code.replace('html{scroll-behavior:smooth;overflow-x:clip}',
    'html{scroll-behavior:smooth}').replace(changed,original),'utf8');
  }
  return route.fulfill({status:200,contentType:MIME[extname(path)]||'application/octet-stream',
   body:bytes});
 });
 const response=await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:15000});
 assert.equal(response.status(),200);
 await page.locator('h1').waitFor();
 // Main.js consulta /api/config, respuesta sintética de formulario desactivado.
 await page.waitForFunction(()=>document.querySelector('.submit-btn')?.disabled===true,null,{timeout:8000});
 return {page,context,unexpected,errors};
}
async function layout(page){
 return page.evaluate(()=>{
  const html=document.documentElement;
  const glow=document.querySelector('.ambient-one');
  const rect=glow.getBoundingClientRect();
  const nav=document.querySelector('#site-menu');
  return {
   viewport:innerWidth,
   contentWidth:html.clientWidth,
   scrollWidth:html.scrollWidth,
   bodyScrollWidth:document.body.scrollWidth,
   rootOverflow:getComputedStyle(html).overflowX,
   glowRight:Math.round(rect.right),
   glowWidth:Math.round(rect.width),
   formVisible:!!document.querySelector('#contact-form'),
   duplicateWebLinks:nav.querySelectorAll('a[href="/webs/"]').length
  };
 });
}
test('Render REAL-SOURCE offline: el CSS viejo reproduce el scroll del resplandor a 1920 px',async()=>{
 const x=await session({width:1920,baseline:true});
 try{
  const m=await layout(x.page);
  console.log('FLUYNOVA_RENDER_BASELINE_OVERFLOW='+JSON.stringify(m));
  assert.ok(m.glowRight>m.viewport+100,
   'Comprobar la misma causa ambiental detectada en el navegador de producción');
  assert.equal(m.rootOverflow,'visible');
  // El desborde DOM puede estar suprimido por body{overflow-x:hidden} en
  // Chromium local: se registra, no se asume reproducibilidad de Render.
  assert.deepEqual(x.unexpected,[]);
  assert.deepEqual(x.errors,[]);
 }finally{await x.context.close()}
});
test('Render REAL-SOURCE offline: raíz clip y contenido visible a siete anchuras',async()=>{
 const x=await session();
 try{
  const sizes=[320,390,768,900,1024,1366,1920];
  const outcomes=[];
  for(const width of sizes){
   await x.page.setViewportSize({width,height:900});
   const m=await layout(x.page);
   outcomes.push(m);
   assert.equal(m.rootOverflow,'clip','La raíz recorta el decorado que excede el ancho');
   assert.ok(m.scrollWidth<=m.contentWidth+2,
    'El documento no debe desplazarse lateralmente: '+JSON.stringify(m));
   assert.equal(m.duplicateWebLinks,1,'Solo un enlace /webs en el menú');
   assert.equal(m.formVisible,true,'El formulario visible conserva el correo alternativo');
  }
  assert.match(await x.page.locator('body').innerText(),
   /El formulario automático sigue en verificación/);
  assert.equal(await x.page.locator('.submit-btn').isDisabled(),true,
   'La API falsa y cerrada no habilita envíos');
  assert.deepEqual(x.unexpected,[],'Ningún POST a FormSubmit o D1');
  assert.deepEqual(x.errors,[]);
  console.log('FLUYNOVA_RENDER_SOURCE_VISUAL_PASS='+JSON.stringify(outcomes));
  await mkdir('artifacts/fluynova-render-source',{recursive:true});
  for(const [width,name] of [[1920,'desktop-1920.png'],[390,'mobile-390.png']]){
   await x.page.setViewportSize({width,height:900});
   await x.page.evaluate(()=>scrollTo(0,0));
   await x.page.screenshot({path:'artifacts/fluynova-render-source/'+name,
    animations:'disabled'});
  }
 }finally{await x.context.close();await browser?.close();browser=undefined}
});
