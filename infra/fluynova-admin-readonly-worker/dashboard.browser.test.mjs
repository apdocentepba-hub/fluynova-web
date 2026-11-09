/**
 * FLUYNOVA — E2E Chromium, panel HTTP estático + Workerd administrativo real
 * + Access RS256 JWT real + D1 LOCAL. Sin conexiones externas.
 * La cabecera JWT la añade exclusivamente el puente de prueba, como lo haría
 * un proxy Access autorizado; nunca se almacena en JavaScript cliente.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {Miniflare,createFetchMock} from 'miniflare';
import {SignJWT,generateKeyPair,exportJWK} from 'jose';

const DIR=fileURLToPath(new URL('./',import.meta.url));
const TEAM='https://fluynova-browser-ci.cloudflareaccess.com';
const AUD='b'.repeat(64);
const SUB='7335d417-61da-459d-899c-0a01c76a2f94';
const HOST='https://admin-frontend-ci.invalid';
const ENDPOINT=HOST+'/api/admin/mail-summary';
let privateKey,mf,db,browser,temp,adminToken,badToken;
const fakeId='1b0c48d6-ad64-46e8-87e8-f758a6769c18';
async function sqlFile(relative){
 const content=(await readFile(new URL(relative,import.meta.url),'utf8'))
  .replace(/^--.*$/gm,'');
 for(const statement of content.split(';').map(x=>x.trim()).filter(Boolean))
  assert.equal((await db.prepare(statement).run()).success,true);
}
async function addLead(id,state){
 assert.equal((await db.prepare(
  'INSERT INTO leads(id,received_at,name,email,category,message,consent_at) VALUES(?,?,?,?,?,?,?)'
 ).bind(id,'2026-11-09T11:00:00Z','PERSONA_PRIVADA_CI',
  'privado-ci@example.invalid','Crear página web / catálogo digital',
  'MENSAJE_PRIVADO_CI','2026-11-09T11:00:00Z').run()).success,true);
 assert.equal((await db.prepare(
  'INSERT INTO lead_mail_outbox(lead_id,state,attempts,created_at,updated_at) VALUES(?,?,0,?,?)'
 ).bind(id,state,'2026-11-09T11:00:00Z','2026-11-09T11:00:00Z').run()).success,true);
}
before(async()=>{
 const pair=await generateKeyPair('RS256',{extractable:true});
 privateKey=pair.privateKey;
 const jwk=await exportJWK(pair.publicKey);
 Object.assign(jwk,{kid:'dashboard-key-ci',alg:'RS256',use:'sig'});
 const mock=createFetchMock();mock.disableNetConnect();
 mock.get(TEAM).intercept({method:'GET',path:'/cdn-cgi/access/certs'})
  .reply(200,JSON.stringify({keys:[jwk]}),{
   headers:{'content-type':'application/json'}
  }).persist();
 temp=await mkdtemp(join(DIR,'.dashboard-ci-'));
 const bundle=join(temp,'worker.mjs');
 await build({entryPoints:[join(DIR,'index.mjs')],outfile:bundle,
  bundle:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
 mf=new Miniflare({modules:true,scriptPath:bundle,cf:false,fetchMock:mock,
  d1Databases:{DB:'fluynova-admin-dashboard-e2e-local'},
  bindings:{
   ADMIN_READ_ENABLED:'true',ACCESS_TEAM_DOMAIN:TEAM,ACCESS_AUD:AUD,
   ADMIN_ALLOWED_SUBJECT:SUB
  }
 });
 db=await mf.getD1Database('DB');
 await sqlFile('../fluynova-contact-worker/schema.sql');
 await sqlFile('../fluynova-public-intake-worker/mail-outbox.schema.sql');
 await addLead(fakeId,'uncertain');
 const now=Math.floor(Date.now()/1000);
 const sign=(subject)=>new SignJWT({sub:subject,type:'app'})
  .setProtectedHeader({kid:'dashboard-key-ci',alg:'RS256'})
  .setIssuer(TEAM).setAudience(AUD)
  .setIssuedAt(now).setNotBefore(now-10).setExpirationTime(now+3600)
  .sign(privateKey);
 adminToken=await sign(SUB);
 badToken=await sign('b3522852-65d4-472a-ab12-7e0b54549561');
 browser=await chromium.launch({headless:true});
});
after(async()=>{
 await browser?.close();
 await mf?.dispose();
 if(temp)await rm(temp,{recursive:true,force:true});
});

async function scene({token=null,injectBadData=false}={}){
 const context=await browser.newContext({viewport:{width:390,height:850}});
 const page=await context.newPage();
 const requests=[],errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  requests.push({method:req.method(),pathname:url.pathname,origin:url.origin});
  if(url.origin!==HOST){
   await route.abort('blockedbyclient');return;
  }
  if(req.method()!=='GET'){
   await route.fulfill({status:405,body:'Method Not Allowed'});return;
  }
  if(url.pathname==='/api/admin/mail-summary'){
   if(injectBadData){
    await route.fulfill({status:200,contentType:'application/json',body:
     JSON.stringify({ok:true,generatedAt:'2026-11-09T12:00:00.000Z',
      counts:{pending:'<img src=x onerror=alert(1)>'},total:100,needsReview:0})});
    return;
   }
   const response=await mf.dispatchFetch(ENDPOINT,{
    method:'GET',headers:token?{'Cf-Access-Jwt-Assertion':token}:{}
   });
   await route.fulfill({status:response.status,
    contentType:response.headers.get('content-type')||'application/json',
    body:await response.text()});
   return;
  }
  const files={
   '/dashboard.html':'text/html; charset=utf-8',
   '/dashboard.js':'text/javascript; charset=utf-8',
   '/dashboard.css':'text/css; charset=utf-8'
  };
  if(!files[url.pathname]){
   await route.fulfill({status:404,body:'Not Found'});return;
  }
  await route.fulfill({status:200,contentType:files[url.pathname],
   body:await readFile(join(DIR,url.pathname.slice(1)))});
 });
 return {page,context,requests,errors,close:async()=>context.close()};
}
async function waitForStatus(page,text){
 await page.waitForFunction(message=>
  document.getElementById('status')?.textContent?.includes(message),
  text,{timeout:10000});
}
test('Chromium: login autorizado RS256 y Workerd D1 local muestran 6 estados, sin PII',async()=>{
 const s=await scene({token:adminToken});
 try{
  await s.page.goto(HOST+'/dashboard.html');
  await waitForStatus(s.page,'Estadísticas actualizadas');
  assert.equal(await s.page.locator('#results').isVisible(),true);
  assert.equal(await s.page.locator('tbody tr').count(),6);
  assert.equal(await s.page.locator('.tile').count(),3);
  assert.equal(await s.page.locator('#total').innerText(),'1');
  assert.equal(await s.page.locator('#review').innerText(),'1');
  assert.equal(await s.page.locator('#delivered').innerText(),'0');
  const text=await s.page.locator('body').innerText();
  for(const pii of ['PERSONA_PRIVADA_CI','privado-ci@example.invalid',
   'MENSAJE_PRIVADO_CI',fakeId,'Cf-Access-Jwt-Assertion',adminToken])
   assert.ok(!text.includes(pii),'No exponer '+pii.slice(0,30));
  for(const w of [320,390,768,1366]){
   await s.page.setViewportSize({width:w,height:850});
   const m=await s.page.evaluate(()=>({
    viewport:innerWidth,scroll:document.documentElement.scrollWidth,
    columns:getComputedStyle(document.querySelector('.summary'))
     .gridTemplateColumns.split(' ').length
   }));
   assert.equal(m.scroll,w,'No scroll horizontal: '+w);
   assert.equal(m.columns,w<=700?1:3,'Tarjetas responsive: '+w);
  }
  assert.ok(s.requests.every(r=>r.origin===HOST&&r.method==='GET'));
  assert.deepEqual(s.errors,[]);
  console.log('FLUYNOVA_ADMIN_DASHBOARD_AUTH_BROWSER_PASS: JWT_RS256=true, states=6, pii=false, viewports=4, external_net=0');
 }finally{await s.close()}
});
test('Chromium: anónimo y otro usuario no ven estadísticas (403)',async()=>{
 for(const token of [null,badToken]){
  const s=await scene({token});
  try{
   await s.page.goto(HOST+'/dashboard.html');
   await waitForStatus(s.page,'Acceso denegado');
   assert.equal(await s.page.locator('#results').isVisible(),false);
   assert.equal(await s.page.locator('tbody tr').count(),0);
   assert.equal(await s.page.locator('#total').textContent(),'—');
   assert.ok(s.requests.every(r=>r.origin===HOST&&r.method==='GET'));
   assert.deepEqual(s.errors,[]);
  }finally{await s.close()}
 }
 console.log('FLUYNOVA_ADMIN_DASHBOARD_DENIED_BROWSER_PASS: anonymous_and_wrong_user=403');
});
test('Chromium: datos falsificados no generan HTML dinámico o falsa confirmación',async()=>{
 const s=await scene({token:adminToken,injectBadData:true});
 try{
  await s.page.goto(HOST+'/dashboard.html');
  await waitForStatus(s.page,'no superaron la validación');
  assert.equal(await s.page.locator('#results').isVisible(),false);
  assert.equal(await s.page.locator('img').count(),0);
  assert.equal(await s.page.locator('tbody tr').count(),0);
  assert.deepEqual(s.errors,[]);
 }finally{await s.close()}
});
test('Chromium: al perder el esquema D1 tras cargar, refrescar limpia datos anteriores',async()=>{
 const s=await scene({token:adminToken});
 try{
  await s.page.goto(HOST+'/dashboard.html');
  await waitForStatus(s.page,'Estadísticas actualizadas');
  assert.equal(await s.page.locator('#results').isVisible(),true);
  assert.equal((await db.prepare('DROP TABLE lead_mail_outbox').run()).success,true);
  await s.page.locator('#refresh').click();
  await waitForStatus(s.page,'Servicio administrativo no disponible');
  assert.equal(await s.page.locator('#results').isVisible(),false);
  assert.equal(await s.page.locator('#total').textContent(),'—');
  assert.equal(await s.page.locator('tbody tr').count(),0);
  assert.deepEqual(s.errors,[]);
  console.log('FLUYNOVA_ADMIN_DASHBOARD_UNAVAILABLE_BROWSER_PASS: D1_missing=true, stale_counters=0');
 }finally{await s.close()}
});
