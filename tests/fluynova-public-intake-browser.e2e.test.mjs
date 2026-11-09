/**
 * E2E aislado: Chromium real -> frontend PR #21 -> Worker PUBLICO aislado -> D1 local real.
 * Turnstile interceptado por createFetchMock; toda la red externa del navegador
 * se bloquea mediante Playwright route.fulfill/route.abort.
 * IMPORTANTE: no hay Cloudflare remoto, Gmail ni datos de personas reales.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {Miniflare,createFetchMock} from 'miniflare';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {buildD1Candidate} from '../frontend-candidate/scripts/build-static-d1-contact-candidate.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FRONT=fileURLToPath(new URL('../frontend-candidate/',import.meta.url));
const SCHEMA=join(ROOT,'infra/fluynova-contact-worker/schema.sql');
const DEDUPE_SCHEMA=join(ROOT,'infra/fluynova-public-intake-worker/idempotency.schema.sql');
const PUBLIC_WORKER=join(ROOT,'infra/fluynova-public-intake-worker/index.mjs');
const PUBLIC_DIR=join(ROOT,'infra/fluynova-public-intake-worker');
let workerdDir,workerBundle;
const ORIGIN='https://fluynova-e2e.invalid';
const WORKER_HOST='fluynova-public-e2e.workers.dev';
const WORKER_URL='https://'+WORKER_HOST+'/api/contact';
const EMAIL='fluynova-ci@example.invalid';
const SITE_KEY='0x4AAAAAAATESTKEY123';
let browser,temp,output;

before(async()=>{
  temp=await mkdtemp(join(tmpdir(),'fluynova-d1-browser-full-'));
  output=join(temp,'www');
  const generated=await buildD1Candidate({
    sourceDir:join(FRONT,'static'),outputDir:output
  });
  assert.equal(generated.pages,12);
  assert.equal(generated.errors,0);
  workerdDir=await mkdtemp(join(PUBLIC_DIR,'.fluynova-public-browser-ci-'));
  workerBundle=join(workerdDir,'public-worker.mjs');
  await build({entryPoints:[PUBLIC_WORKER],outfile:workerBundle,bundle:true,
    format:'esm',platform:'browser',logLevel:'silent'});
  browser=await chromium.launch({headless:true});
});
after(async()=>{
  await browser?.close();
  if(temp)await rm(temp,{recursive:true,force:true});
  if(workerdDir)await rm(workerdDir,{recursive:true,force:true});
});

async function makeD1({siteverify=true,createLeads=true,publicOn=true,contactOn=true}={}){
  const mock=createFetchMock();
  mock.disableNetConnect();
  if(siteverify!==null){
    mock.get('https://challenges.cloudflare.com')
      .intercept({method:'POST',path:'/turnstile/v0/siteverify'})
      .reply(200,JSON.stringify({
        success:siteverify===true,action:'contact',hostname:'fluynova-e2e.invalid'
      })).persist();
  }
  const mf=new Miniflare({
    modules:true,scriptPath:workerBundle,cf:false,fetchMock:mock,
    d1Databases:{DB:'fluynova-only-temporary-e2e'},
    bindings:{
      ENABLE_PUBLIC_INTAKE:publicOn?'true':'false',
      ENABLE_CONTACT_SUBMISSIONS:contactOn?'true':'false',
      ALLOWED_ORIGINS:ORIGIN,
      TURNSTILE_HOSTNAMES:'fluynova-e2e.invalid',
      TURNSTILE_SECRET_KEY:'CI_ONLY_NEVER_REAL',
      RATE_HASH_SECRET:'CI_ONLY_HMAC_SECRET_AND_NOT_PRODUCTION'
    }
  });
  const db=await mf.getD1Database('DB');
  const stmts=(await readFile(SCHEMA,'utf8')).replace(/^--.*$/gm,'')
    .split(';').map(s=>s.trim()).filter(Boolean);
  stmts.push(...(await readFile(DEDUPE_SCHEMA,'utf8')).replace(/^--.*$/gm,'')
    .split(';').map(s=>s.trim()).filter(Boolean));
  for(const stmt of stmts){
    if(!createLeads && (/^CREATE TABLE IF NOT EXISTS leads\b/i.test(stmt) ||
      /^CREATE INDEX IF NOT EXISTS leads_/i.test(stmt)))continue;
    await db.prepare(stmt).run();
  }
  return {mf,db};
}
async function scene({configured=true,siteverify=true,createLeads=true,workerDelayMs=0,publicOn=true,contactOn=true}={}){
  const {mf,db}=await makeD1({siteverify,createLeads,publicOn,contactOn});
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  const page=await context.newPage();
  const unexpectedPosts=[],apiResponses=[],pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==='POST' && url.hostname!==WORKER_HOST)unexpectedPosts.push(url.href);
    if(url.hostname===WORKER_HOST){
      // Para el entorno de pruebas, el IP de Cloudflare es siempre ficticio.
      const headers={...req.headers(),origin:ORIGIN,'cf-connecting-ip':'203.0.113.77'};
      const method=req.method();
      const init={method,headers};
      if(method!=='GET'&&method!=='HEAD'&&method!=='OPTIONS')
        init.body=req.postData()||'';
      const r=await mf.dispatchFetch('https://workerd.test/api/contact',init);
      if(workerDelayMs>0 && method==='POST')
        await new Promise(resolve=>setTimeout(resolve,workerDelayMs));
      const body=await r.text();
      apiResponses.push({method,status:r.status,body});
      const exposed={};
      for(const key of ['access-control-allow-origin','access-control-allow-methods',
        'access-control-allow-headers','access-control-max-age','vary','cache-control']){
        const v=r.headers.get(key);if(v)exposed[key]=v;
      }
      await route.fulfill({
        status:r.status,contentType:'application/json; charset=utf-8',
        headers:exposed,body
      });
      return;
    }
    if(url.hostname==='challenges.cloudflare.com'){
      if(configured&&url.pathname==='/turnstile/v0/api.js'){
        await route.fulfill({status:200,contentType:'application/javascript',body:
          'window.turnstile={render:(_el,opts)=>{window.__turnstileOpts=opts;return "ci-widget";},'+
          'reset:()=>{window.__resetCount=(window.__resetCount||0)+1;}};'});
      }else await route.abort('blockedbyclient');
      return;
    }
    if(url.origin!==ORIGIN){await route.abort('blockedbyclient');return;}
    let relative=decodeURIComponent(url.pathname).replace(/^\/+/,'');
    if(!relative||relative.endsWith('/'))relative+='index.html';
    const localPath=resolve(output,relative);
    if(!localPath.startsWith(output+sep)){await route.abort('blockedbyclient');return;}
    let bytes;
    try{bytes=await readFile(localPath)}
    catch{await route.fulfill({status:404,body:'Not found'});return;}
    if(configured&&relative==='contact-d1-staging.js'){
      const original=bytes.toString('utf8');
      const marker="endpoint:'',siteKey:''";
      assert.equal(original.split(marker).length-1,1,'frontend candidate changed');
      bytes=Buffer.from(original.replace(marker,
        "endpoint:'"+WORKER_URL+"',siteKey:'"+SITE_KEY+"'"));
    }
    const type=({
      '.html':'text/html','.js':'application/javascript','.css':'text/css',
      '.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'
    })[extname(localPath)]||'application/octet-stream';
    await route.fulfill({status:200,contentType:type,body:bytes});
  });
  const response=await page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(response.status(),200);
  return {page,db,context,mf,unexpectedPosts,apiResponses,pageErrors,
    async close(){await context.close();await mf.dispose()}};
}
async function fillAndSubmit(page){
  await page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
  await page.locator('#contact-form input[name="name"]').fill('Cliente ficticio E2E');
  await page.locator('#contact-form input[name="email"]').fill(EMAIL);
  await page.locator('#contact-form select[name="category"]')
    .selectOption({label:'Crear página web / catálogo digital'});
  await page.locator('#contact-form textarea[name="message"]')
    .fill('Quiero una página web ficticia y un catálogo de prueba.');
  await page.locator('#contact-form input[name="consent"]').check();
  assert.equal(await page.locator('#contact-form button[type=submit]').isDisabled(),true);
  await page.evaluate(()=>window.__turnstileOpts.callback('ci-fake-turnstile-token'));
  assert.equal(await page.locator('#contact-form button[type=submit]').isEnabled(),true);
  await page.locator('#contact-form button[type=submit]').click();
}
test('Chromium sin endpoint ni CAPTCHA: formulario cerrado, mail visible, D1 vacía',async()=>{
  const s=await scene({configured:false,siteverify:null});
  try{
    await s.page.waitForFunction(()=>document.querySelector('#form-status')
      ?.textContent?.includes('no está habilitado'));
    assert.equal(await s.page.locator('#contact-form fieldset').evaluate(e=>e.disabled),true);
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    assert.ok(await s.page.locator('a[href^="mailto:contacto.fluynova@gmail.com"]').count()>0);
    assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal(s.apiResponses.length,0);
    assert.deepEqual(s.unexpectedPosts,[]);
    assert.deepEqual(s.pageErrors,[]);
  }finally{await s.close()}
});
test('Chromium -> workerd -> D1 LOCAL: muestra éxito solo tras SQL persistido',async()=>{
  const s=await scene();
  try{
    await fillAndSubmit(s.page);
    await s.page.waitForFunction(()=>document.querySelector('#form-status')
      ?.textContent?.includes('Consulta guardada con código'),null,{timeout:10000});
    const saved=await s.db.prepare('SELECT id,name,email,category,message,status,consent_at FROM leads').first();
    assert.ok(saved,'Se requiere registro real en D1 local');
    assert.equal(saved.email,EMAIL);
    assert.equal(saved.category,'Crear página web / catálogo digital');
    assert.equal(saved.status,'Nuevo');
    const msg=await s.page.locator('#form-status').innerText();
    assert.ok(msg.includes(saved.id),'La UI debe mostrar el ID de la fila persistida');
    assert.match(msg,/no confirma entrega por correo/);
    assert.equal(s.apiResponses.filter(r=>r.method==='POST'&&r.status===201).length,1);
    assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    assert.deepEqual(s.unexpectedPosts,[]);
    assert.deepEqual(s.pageErrors,[]);
    console.log('PUBLIC_INTAKE_CHROMIUM_LOCAL_PASS: chromium=true, workerd=true, d1_persisted=true, mail_sent=false');
  }finally{await s.close()}
});
test('CAPTCHA rechazado por Worker: no crea fila ni confirma recepción',async()=>{
  const s=await scene({siteverify:false});
  try{
    await fillAndSubmit(s.page);
    await s.page.waitForFunction(()=>document.querySelector('#form-status')
      ?.textContent?.includes('CAPTCHA no se pudo verificar'),null,{timeout:10000});
    assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal(s.apiResponses.filter(r=>r.method==='POST'&&r.status===403).length,1);
    assert.equal(await s.page.locator('#contact-form input[name=email]').inputValue(),EMAIL);
    assert.deepEqual(s.unexpectedPosts,[]);
    assert.deepEqual(s.pageErrors,[]);
  }finally{await s.close()}
});
test('D1 local sin tabla de consultas: el formulario NO dice recibido',async()=>{
  const s=await scene({createLeads:false});
  try{
    await fillAndSubmit(s.page);
    await s.page.waitForFunction(()=>document.querySelector('#form-status')
      ?.textContent?.includes('No quedó guardada la consulta'),null,{timeout:10000});

    assert.equal(s.apiResponses.filter(r=>r.method==='POST'&&r.status===503).length,1);
    assert.equal(await s.page.locator('#contact-form input[name=email]').inputValue(),EMAIL);
    assert.doesNotMatch(await s.page.locator('#form-status').innerText(),/Consulta guardada/);
    assert.deepEqual(s.unexpectedPosts,[]);
    assert.deepEqual(s.pageErrors,[]);
  }finally{await s.close()}
});

test('CAPTCHA vencido o con timeout antes de enviar: D1 LOCAL no recibe filas',async()=>{
  const s=await scene();
  try{
    await s.page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
    await s.page.evaluate(()=>window.__turnstileOpts.callback('ci-token-before-expiry'));
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isEnabled(),true);
    await s.page.evaluate(()=>window.__turnstileOpts['expired-callback']());
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    assert.match(await s.page.locator('#form-status').innerText(),/verificación venció/);
    await s.page.evaluate(()=>window.__turnstileOpts.callback('ci-token-before-timeout'));
    await s.page.evaluate(()=>window.__turnstileOpts['timeout-callback']());
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    assert.match(await s.page.locator('#form-status').innerText(),/agotó el tiempo/);
    assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
    assert.equal(s.apiResponses.filter(r=>r.method==='POST').length,0);
    assert.deepEqual(s.pageErrors,[]);
  }finally{await s.close()}
});
test('Renovación del token durante envío: solo un POST, una fila D1 LOCAL',async()=>{
  const s=await scene({workerDelayMs:650});
  try{
    await s.page.waitForFunction(()=>window.__turnstileOpts?.action==='contact');
    await s.page.locator('#contact-form input[name="name"]').fill('Cliente ficticio concurrente');
    await s.page.locator('#contact-form input[name="email"]').fill(EMAIL);
    await s.page.locator('#contact-form select[name="category"]')
      .selectOption({label:'Crear página web / catálogo digital'});
    await s.page.locator('#contact-form textarea[name="message"]')
      .fill('Consulta de prueba para verificar que no haya doble registro de clientes.');
    await s.page.locator('#contact-form input[name="consent"]').check();
    await s.page.evaluate(()=>window.__turnstileOpts.callback('ci-token-original'));
    await s.page.locator('#contact-form button[type=submit]').click();
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    await s.page.evaluate(()=>{
      window.__turnstileOpts.callback('ci-token-renovado');
      document.querySelector('#contact-form').dispatchEvent(
        new Event('submit',{bubbles:true,cancelable:true}));
    });
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    await s.page.waitForFunction(()=>document.querySelector('#form-status')
      ?.textContent?.includes('Consulta guardada con código'),null,{timeout:15000});
    assert.equal(s.apiResponses.filter(r=>r.method==='POST').length,1);
    assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,1);
    assert.equal(await s.page.locator('#contact-form button[type=submit]').isDisabled(),true);
    assert.deepEqual(s.unexpectedPosts,[]);
    assert.deepEqual(s.pageErrors,[]);
  }finally{await s.close()}
});

test('Dos compuertas cerradas: no confirma, D1 vacía y sin APIs privadas',async()=>{
 for(const flags of [{publicOn:false,contactOn:true},{publicOn:true,contactOn:false}]){
  const s=await scene(flags);
  try{
   await fillAndSubmit(s.page);
   // Las solicitudes CORS pueden ser frenadas en preflight, o devolver 503 a POST.
   // No exigir un texto concreto del navegador al fallar CORS (varía por motor).
   await s.page.waitForTimeout(1000);
   const responses=s.apiResponses.filter(r=>r.status===503);
   assert.ok(responses.length>=1,'La compuerta pública debe rechazar con 503');
   assert.equal(s.apiResponses.filter(r=>r.status===201).length,0);
   assert.ok(s.apiResponses.filter(r=>r.method==='POST').length<=1);
   console.log('PUBLIC_INTAKE_BROWSER_CLOSED:',JSON.stringify({
     flags,responses:s.apiResponses.map(r=>({method:r.method,status:r.status})),
     status:await s.page.locator('#form-status').innerText()
   }));
   assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM leads').first()).n,0);
   assert.equal((await s.mf.dispatchFetch('https://workerd.test/admin')).status,404);
   assert.equal((await s.mf.dispatchFetch('https://workerd.test/health')).status,404);
   assert.equal((await s.mf.dispatchFetch('https://workerd.test/api/leads')).status,404);
   assert.doesNotMatch(await s.page.locator('#form-status').innerText(),/Consulta guardada/);
   assert.deepEqual(s.unexpectedPosts,[]);
   assert.deepEqual(s.pageErrors,[]);
  }finally{await s.close()}
 }
});

test('Chromium: regresión visual PR21 sincronizado, sin POST ni solapamiento móvil',async()=>{
 const s=await scene({configured:false});
 try{
  const page=s.page;
  assert.equal(await page.locator('#site-menu a[href="/webs/"]').count(),1,
   'La navegación reciente no debe duplicar el enlace /webs/');
  for(const width of [320,390,900,1366]){
   await page.setViewportSize({width,height:844});
   const metrics=await page.evaluate(()=>({
    viewport:innerWidth,
    scroll:document.documentElement.scrollWidth,
    toggleShown:getComputedStyle(document.querySelector('.mobile-menu')).display!=='none'
   }));
   assert.equal(metrics.scroll,width,'Sin scroll horizontal a '+width+' px');
   assert.equal(metrics.toggleShown,width<=1100,'Menú responsive actualizado a '+width+' px');
   if(width<=1100){
    const toggle=page.locator('.mobile-menu');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   }
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#fg-launcher').waitFor({state:'attached'});
  assert.equal(await page.locator('#fg-launcher').isVisible(),false,
   'El botón flotante no debe cubrir el formulario de contacto');
  assert.equal(await page.locator('#contact-form button[type=submit]').isDisabled(),true);
  assert.ok(await page.locator('a[href^="mailto:contacto.fluynova@gmail.com"]').count()>0);
  assert.equal(s.apiResponses.length,0,'El test visual no realiza contactos a Workerd');
  assert.deepEqual(s.unexpectedPosts,[]);
  assert.deepEqual(s.pageErrors,[]);
 }finally{await s.close()}
});
