/**
 * FLUYNOVA — Chromium E2E OFFLINE.
 * Los recursos HTTPS se sirven mediante Playwright route.fulfill, no internet.
 * Turnstile y el Worker son respuestas simuladas: esto NO certifica D1 remoto.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {buildD1Candidate} from '../scripts/build-static-d1-contact-candidate.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HOST='fluynova-browser-test.invalid';
const WORKER='fluynova-lab-example.workers.dev';
const SITE='https://'+HOST+'/';
const ENDPOINT='https://'+WORKER+'/api/contact';
const UUID='3a70b437-cc50-43c0-bd6d-4ed8ed7ae79a';
const KEY='0x4AAAAAAATESTKEY123';
let dir,output,browser;

before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'fluynova-chromium-'));
 output=join(dir,'site');
 await buildD1Candidate({sourceDir:join(ROOT,'static'),outputDir:output});
 browser=await chromium.launch({headless:true});
});
after(async()=>{
 await browser?.close();
 if(dir)await rm(dir,{recursive:true,force:true});
});

async function visit({configured=false,workerStatus=201,workerDelayMs=0,workerBody={ok:true,stored:true,delivery:'database',id:UUID}}={}){
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 const browserErrors=[],workerRequests=[],unexpectedPosts=[];
 const page=await context.newPage();
 page.on('pageerror',error=>browserErrors.push(error.message));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()==='POST' && url.hostname!==WORKER)unexpectedPosts.push(url.href);
  if(url.hostname===WORKER){
   workerRequests.push({method:request.method(),url:url.href,body:request.postDataJSON()});
   if(workerDelayMs>0)await new Promise(done=>setTimeout(done,workerDelayMs));
   await route.fulfill({status:workerStatus,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':SITE.slice(0,-1)},
    body:JSON.stringify(workerBody)});
   return;
  }
  if(url.hostname==='challenges.cloudflare.com'){
   if(configured&&url.pathname==='/turnstile/v0/api.js'){
    await route.fulfill({status:200,contentType:'application/javascript',body:
      'window.turnstile={render:(_element,opts)=>{window.__turnstileOpts=opts;return "local-widget";},'+
      'reset:()=>{window.__turnstileResets=(window.__turnstileResets||0)+1;}};'});
   }else await route.abort('blockedbyclient');
   return;
  }
  if(url.hostname!==HOST){
   await route.abort('blockedbyclient');
   return;
  }
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(!relative||relative.endsWith('/'))relative+='index.html';
  const path=resolve(output,relative);
  if(path!==output&&!path.startsWith(output+sep)){await route.abort('blockedbyclient');return;}
  let content;
  try{content=await readFile(path)}catch{await route.fulfill({status:404,body:'No encontrado'});return;}
  if(relative==='contact-d1-staging.js'&&configured){
   const src=content.toString('utf8');
   const from="endpoint:'',siteKey:''";
   assert.equal(src.split(from).length-1,1,'configuration anchor changed');
   content=Buffer.from(src.replace(from,
     "endpoint:'"+ENDPOINT+"',siteKey:'"+KEY+"'"));
  }
  const mime=({'.html':'text/html','.js':'application/javascript','.css':'text/css',
    '.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'})[extname(path)]||
    'application/octet-stream';
  await route.fulfill({status:200,contentType:mime,body:content});
 });
 const response=await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:20000});
 assert.equal(response.status(),200);
 return {context,page,browserErrors,workerRequests,unexpectedPosts};
}
async function fillForm(page){
 await page.locator('#contact-form input[name="name"]').fill('Consulta ficticia de navegador');
 await page.locator('#contact-form input[name="email"]').fill('prueba@example.invalid');
 await page.locator('#contact-form select[name="category"]')
   .selectOption({label:'Crear página web / catálogo digital'});
 await page.locator('#contact-form textarea[name="message"]')
   .fill('Necesito un catálogo de prueba con datos completamente ficticios para laboratorio.');
 await page.locator('#contact-form input[name="consent"]').check();
}
test('Chromium real: vista desconfigurada permanece bloqueada y muestra correo directo',async()=>{
 const x=await visit();
 try{
  await x.page.waitForFunction(()=>
   document.querySelector('#form-status')?.textContent?.includes('no está habilitado'));
  // La propiedad HTMLFieldSetElement.disabled es la verificación semántica
  // correcta: Playwright isDisabled() se orienta a controles interactivos.
  assert.equal(await x.page.locator('fieldset[data-d1-gate="closed"]')
    .evaluate(element=>element.disabled),true);
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
  assert.ok((await x.page.locator('a[href^="mailto:contacto.fluynova@gmail.com"]').count())>=1);
  assert.equal(x.workerRequests.length,0);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[],'No debe haber errores de JavaScript en navegador');
 }finally{await x.context.close()}
});
test('Chromium real: CAPTCHA simulado activa botón; HTTP 201 confirma solo D1 guardada',async()=>{
 const x=await visit({configured:true});
 try{
  await x.page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
  await fillForm(x.page);
  assert.equal(x.workerRequests.length,0);
  await x.page.evaluate(()=>window.__turnstileOpts.callback('ficticio-captcha-token'));
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isEnabled(),true);
  await x.page.locator('#contact-form button[type="submit"]').click();
  await x.page.waitForFunction(()=>document.querySelector('#form-status')
    ?.textContent?.includes('Consulta guardada con código'),null,{timeout:5000});
  assert.equal(x.workerRequests.length,1);
  const req=x.workerRequests[0];
  assert.equal(req.method,'POST');
  assert.equal(req.url,ENDPOINT);
  assert.equal(req.body.email,'prueba@example.invalid');
  assert.equal(req.body.turnstile_token,'ficticio-captcha-token');
  assert.equal(req.body.category,'Crear página web / catálogo digital');
  assert.match(await x.page.locator('#form-status').innerText(),/no confirma entrega por correo/);
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[]);
 }finally{await x.context.close()}
});
test('Chromium real: HTTP 200 sin stored no simula éxito ni borra el formulario',async()=>{
 const x=await visit({configured:true,workerStatus:200,workerBody:{success:true,stored:false}});
 try{
  await x.page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
  await fillForm(x.page);
  await x.page.evaluate(()=>window.__turnstileOpts.callback('ficticio-captcha-token'));
  await x.page.locator('#contact-form button[type="submit"]').click();
  await x.page.waitForFunction(()=>document.querySelector('#form-status')
    ?.textContent?.includes('No pudimos guardar tu consulta'),null,{timeout:5000});
  assert.equal(x.workerRequests.length,1);
  assert.equal(await x.page.locator('#contact-form input[name="email"]').inputValue(),
    'prueba@example.invalid');
  assert.doesNotMatch(await x.page.locator('#form-status').innerText(),/Consulta guardada/);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[]);
 }finally{await x.context.close()}
});

test('Chromium: caducidad, timeout y navegador no compatible nunca dejan enviar',async()=>{
 const x=await visit({configured:true});
 try{
  await x.page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
  await fillForm(x.page);
  for(const [callback,expected] of [
   ['expired-callback',/verificación venció/],
   ['timeout-callback',/Se agotó el tiempo/],
   ['unsupported-callback',/navegador no admite/]
  ]){
   await x.page.evaluate(()=>window.__turnstileOpts.callback('token-que-vencerá'));
   assert.equal(await x.page.locator('#contact-form button[type="submit"]').isEnabled(),true);
   await x.page.evaluate(name=>window.__turnstileOpts[name](),callback);
   assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
   assert.match(await x.page.locator('#form-status').innerText(),expected);
  }
  assert.equal(x.workerRequests.length,0);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[]);
 }finally{await x.context.close()}
});
test('Chromium: renovación del token durante envío NO habilita un segundo POST',async()=>{
 const x=await visit({configured:true,workerDelayMs:550});
 try{
  await x.page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
  await fillForm(x.page);
  await x.page.evaluate(()=>window.__turnstileOpts.callback('token-inicial'));
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isEnabled(),true);
  await x.page.locator('#contact-form button[type="submit"]').click();
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
  await x.page.evaluate(()=>{
   window.__turnstileOpts.callback('token-renovado');
   document.querySelector('#contact-form').dispatchEvent(
      new Event('submit',{bubbles:true,cancelable:true}));
  });
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
  await x.page.waitForFunction(()=>document.querySelector('#form-status')
   ?.textContent?.includes('Consulta guardada con código'),null,{timeout:6500});
  assert.equal(x.workerRequests.filter(r=>r.method==='POST').length,1);
  assert.equal(await x.page.locator('#contact-form button[type="submit"]').isDisabled(),true);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[]);
 }finally{await x.context.close()}
});

test('Chromium: gráficos del flujo renovados y tarjeta legible en móvil, sin envío',async()=>{
 const x=await visit();
 try{
  const desktop=await x.page.locator('.workflow-card').evaluate(element=>{
   const css=getComputedStyle(element);
   return {transform:css.transform,background:css.backgroundImage,border:css.borderTopColor};
  });
  assert.equal(desktop.transform,'none','El gráfico principal se presenta alineado');
  assert.match(desktop.background,/linear-gradient/,'El gráfico usa la nueva capa visual');
  assert.equal(await x.page.locator('.solution-graphic').count(),3);
  await x.page.setViewportSize({width:390,height:844});
  const mobile=await x.page.locator('.workflow-card').evaluate(element=>{
   const rect=element.getBoundingClientRect();
   return {left:rect.left,right:rect.right,width:rect.width,viewport:innerWidth};
  });
  assert.ok(mobile.width>220&&mobile.width<=mobile.viewport,
   'El gráfico conserva tamaño usable en pantalla angosta');
  assert.ok(mobile.left>=-2&&mobile.right<=mobile.viewport+2,
   'El gráfico no se desborda horizontalmente');
  assert.equal(x.workerRequests.length,0);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[]);
 }finally{await x.context.close()}
});

test('Chromium: visual QA responsive y teclado, con navegación sin duplicados',async()=>{
 const x=await visit();
 try{
  const page=x.page;
  assert.equal(await page.locator('#site-menu a[href="/webs/"]').count(),1,
   'No duplicar accesos a Páginas web en el menú');
  const widths=[320,390,768,900,1024,1366];
  const results=[];
  for(const width of widths){
   await page.setViewportSize({width,height:850});
   const metrics=await page.evaluate(()=>({
    width:innerWidth,scroll:document.documentElement.scrollWidth,
    menuVisible:getComputedStyle(document.querySelector('#site-menu')).display!=='none',
    mobileVisible:getComputedStyle(document.querySelector('.mobile-menu')).display!=='none'
   }));
   results.push(metrics);
   assert.ok(metrics.scroll<=width+2,
    'No debe haber desborde horizontal a '+width+'px: '+JSON.stringify(metrics));
   assert.equal(metrics.mobileVisible,width<=1100,'Breakpoint de navegación '+width);
   assert.equal(metrics.menuVisible,width>1100,'El menú cerrado no se muestra en '+width);
   if(width<=1100){
    const toggle=page.locator('.mobile-menu');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#site-menu').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#site-menu').isVisible(),false);
    assert.equal(await toggle.evaluate(el=>document.activeElement===el),true,
     'Escape devuelve el foco al botón de menú');
   }
  }
  assert.deepEqual(x.browserErrors,[]);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.equal(x.workerRequests.length,0);
  console.log('VISUAL_QA_BREAKPOINTS='+JSON.stringify(results));
 }finally{await x.context.close()}
});

test('Chromium: contraste de texto esencial, movimiento reducido y capturas sin datos reales',async()=>{
 const x=await visit();
 try{
  const page=x.page;
  // Contraste WCAG 2.x de texto simple sobre tarjeta blanca de la sección de problemas.
  const contrast=await page.locator('.flx-problem-card .flx-card-copy>small').first().evaluate(el=>{
    const rgb=s=>[...s.matchAll(/[0-9.]+/g)].slice(0,3).map(x=>Number(x[0]));
    const L=arr=>{
     const [r,g,b]=arr.map(v=>{
      const x=v/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;
     });return .2126*r+.7152*g+.0722*b;
    };
    const fore=L(rgb(getComputedStyle(el).color));
    const back=L(rgb(getComputedStyle(el.closest('.flx-problem-card')).backgroundColor));
    return (Math.max(fore,back)+.05)/(Math.min(fore,back)+.05);
  });
  assert.ok(contrast>=4.5,'Texto pequeño de la tarjeta requiere contraste >=4.5, actual '+contrast);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  const evidence='artifacts/fluynova-ui';
  await mkdir(evidence,{recursive:true});
  for(const [width,height,name] of [[1366,900,'desktop-1366.png'],[900,768,'tablet-900.png'],[390,844,'mobile-390.png']]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:join(evidence,name),animations:'disabled'});
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#contacto').screenshot({path:join(evidence,'contacto-mobile.png'),
    animations:'disabled'});
  await writeFile(join(evidence,'manifest.json'),JSON.stringify({
   project:'FLUYNOVA',environment:'isolated offline candidate',published:false,
   viewports:[1366,900,390],contrastSmallText:Number(contrast.toFixed(2)),
   containsRealLeads:false,formEnabled:false
  },null,2));
  assert.equal(x.workerRequests.length,0);
  assert.deepEqual(x.unexpectedPosts,[]);
  assert.deepEqual(x.browserErrors,[]);
 }finally{await x.context.close()}
});
