import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPortfolio,transformPortfolio} from '../scripts/build-portfolio-static.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(join(ROOT,'static/laboratorio/index.html'),'utf8');
const result=transformPortfolio(source),html=result.html;
const hrefs=[...html.matchAll(/\bhref="([^"]+)"/g)].map(x=>x[1].replaceAll('&amp;','&'));

test('el portable mantiene tres demos ficticias y elimina cotizador no validado',()=>{
 assert.equal((html.match(/<article class="card">/g)||[]).length,3);
 assert.doesNotMatch(html,/fluynova-cotizador-lab/);
 assert.match(html,/no casos de clientes contratados/);
});
test('preserva tres URLs de demos existentes, sin cambiarlas',()=>{
 const demos=hrefs.filter(x=>x.startsWith('https://fluynova-ops-lab-preview')||x.startsWith('https://fluynova-demo-'));
 assert.deepEqual(demos,[
  'https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html',
  'https://fluynova-demo-pasteleria.pages.dev/',
  'https://fluynova-demo-distribuidora.pages.dev/'
 ]);
});
test('sin rutas relativas de otros dominios en la vista portátil',()=>{
 assert.ok(result.localLinks>=4);
 assert.doesNotMatch(html,/\bhref="\/(?!\/)/);
 assert.ok(hrefs.includes('https://fluynova-web.onrender.com/'));
 assert.ok(hrefs.includes('https://fluynova-web.onrender.com/privacidad'));
 assert.ok(hrefs.includes('contacto/index.html'));
 assert.ok(hrefs.filter(x=>x.startsWith('contacto/index.html?')).length===5);
});
test('los cinco CTA con UTM dirigen al formulario estático y evitan el cold start',()=>{
 const tracked=hrefs.filter(x=>x.includes('utm_source=laboratorio'));
 assert.equal(tracked.length,5);
 for(const href of tracked){
  const u=new URL(href,'https://portfolio.test/');
  assert.equal(u.origin,'https://portfolio.test');
  assert.equal(u.pathname,'/contacto/index.html');
  assert.equal(u.searchParams.get('utm_medium'),'portfolio');
  assert.equal(u.searchParams.get('utm_campaign'),'demostraciones_202611');
 }
});
test('tiene correo visible y alternativas voluntarias sin red',()=>{
 assert.match(html,/Contacto manual: contacto\.fluynova@gmail\.com/);
 const links=hrefs.filter(x=>x.startsWith('mailto:'));
 assert.equal(links.length,2);
 for(const href of links){
  const mail=new URL(href);
  assert.equal(mail.pathname,'contacto.fluynova@gmail.com');
  assert.match(mail.searchParams.get('subject')||'',/FLUYNOVA/);
  assert.match(mail.searchParams.get('body')||'',/Qué necesita mi negocio/i);
 }
 assert.match(html,/vos decidís si lo enviás/);
});
test('mantiene noindex, CSP, protección de datos y cero scripts',()=>{
 assert.match(html,/content="noindex,nofollow,noarchive"/);
 assert.match(html,/default-src 'none'/);
 assert.match(html,/data-portfolio-static="true"/);
 assert.doesNotMatch(html,/<script\b|<form\b|<iframe\b|fetch\s*\(|XMLHttpRequest|localStorage/);
});
test('rechaza cambios de estructura de los que depende el generador',()=>{
 assert.throws(()=>transformPortfolio(source.replace('href="mailto:contacto.fluynova@gmail.com?','href="mailto:otro@ejemplo.com?')),/Falta correo de respaldo/);
 assert.throws(()=>transformPortfolio(source.replace('content="noindex,nofollow,noarchive"','content="index,follow"')),/Falta noindex/);
});
test('escribe un HTML en carpeta temporal y no sobrescribe en un segundo intento',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'fluynova-portfolio-'));
 try{
  const created=await buildPortfolio(join(tmp,'salida'));
  const rendered=await readFile(created.file,'utf8');
  assert.equal(rendered,html);
  assert.ok(created.bytes>10000);
  const contact=await readFile(join(tmp,'salida','contacto','index.html'),'utf8');
  const js=await readFile(join(tmp,'salida','contacto','contacto.js'),'utf8');
  assert.match(contact,/form-action 'none'/);
  assert.match(contact,/type="submit" disabled/);
  assert.match(contact,/src="contacto.js"/);
  assert.match(js,/URLSearchParams/);
  assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  await assert.rejects(()=>buildPortfolio(join(tmp,'salida')),{code:'EEXIST'});
 }finally{await rm(tmp,{recursive:true,force:true});}
});


test('no se transfieren consultas a Render ni se depende de scripts externos para captar',()=>{
 const tracked=hrefs.filter(x=>x.includes('utm_source=laboratorio'));
 assert.equal(tracked.length,5);
 assert.ok(tracked.every(x=>x.startsWith('contacto/index.html?')));
 assert.ok(hrefs.includes('contacto/index.html'));
 assert.doesNotMatch(html,/href="https:\/\/fluynova-web\.onrender\.com\/diagnostico\/\?/);
});


test('edición de borrador: correo y link se actualizan, sin envío automático',async()=>{
 const contact=await readFile(join(ROOT,'static/laboratorio/contacto/index.html'),'utf8');
 const js=await readFile(join(ROOT,'static/laboratorio/contacto/contacto.js'),'utf8');
 assert.match(contact,/<textarea id="resumen" maxlength="1500"/);
 assert.doesNotMatch(contact,/<textarea id="resumen"[^>]*readonly/);
 assert.match(js,/text\.addEventListener\("input",syncMailto\)/);
 assert.match(js,/encodeURIComponent\(message\)/);
 assert.match(js,/url\.length<=1800 && message\.trim\(\)/);
 assert.match(js,/link\.hidden=true/);
 assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
});


test('el banner de staging no niega la existencia del formulario local',()=>{
 assert.match(html,/VISTA PREVIA AUTÓNOMA/);
 assert.match(html,/Consulta local sin envío automático ni almacenamiento/);
 assert.doesNotMatch(html,/Sin formularios ni envíos automáticos/);
});
