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
});
test('conserva atribución UTM al dirigir hacia la web principal',()=>{
 const tracked=hrefs.filter(x=>x.includes('utm_source=laboratorio'));
 assert.equal(tracked.length,5);
 for(const href of tracked){
  const u=new URL(href);
  assert.equal(u.origin,'https://fluynova-web.onrender.com');
  assert.ok(['/diagnostico/','/webs/'].includes(u.pathname));
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
  await assert.rejects(()=>buildPortfolio(join(tmp,'salida')),{code:'EEXIST'});
 }finally{await rm(tmp,{recursive:true,force:true});}
});
