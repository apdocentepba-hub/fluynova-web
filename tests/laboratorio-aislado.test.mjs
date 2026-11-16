import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const staticDir=resolve(here,'../static');
const html=readFileSync(resolve(staticDir,'laboratorio/index.html'),'utf8');
const hrefs=[...html.matchAll(/\bhref="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
const external=hrefs.filter(h=>h.startsWith('https://'));
const demos=[
 'https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html',
 'https://fluynova-demo-pasteleria.pages.dev/',
 'https://fluynova-demo-distribuidora.pages.dev/'
];

test('presenta exactamente tres demostraciones, no el cotizador experimental',()=>{
 assert.equal((html.match(/<article class="card">/g)||[]).length,3);
 assert.match(html,/Tres ejemplos, problemas concretos/);
 assert.doesNotMatch(html,/fluynova-cotizador-lab|Cotizador orientativo · No contratable/i);
});

test('las tres demos apuntan solo a URLs previamente utilizadas en los proyectos',()=>{
 assert.deepEqual(external,demos);
 for(const href of demos){
  assert.equal(hrefs.filter(x=>x===href).length,1);
  const tag=html.match(new RegExp('<a[^>]+href="'+href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"[^>]*>'));
  assert.ok(tag && tag[0].includes('target="_blank"') && tag[0].includes('rel="noopener noreferrer"'),href);
 }
});

test('cinco CTA comerciales conservan UTM de origen y destino existente',()=>{
 const links=hrefs.filter(h=>h.includes('utm_source=laboratorio'));
 assert.equal(links.length,5);
 assert.deepEqual(links.map(h=>new URL(h,'https://fluynova-web.onrender.com').searchParams.get('utm_content')).sort(),
  ['cierre','crm','distribuidora','hero','pasteleria']);
 for(const link of links){
  const url=new URL(link,'https://fluynova-web.onrender.com');
  assert.equal(url.searchParams.get('utm_medium'),'portfolio');
  assert.equal(url.searchParams.get('utm_campaign'),'demostraciones_202611');
  assert.ok(['/diagnostico/','/webs/'].includes(url.pathname));
  assert.ok(existsSync(resolve(staticDir,'.'+url.pathname,'index.html')),url.pathname);
 }
});

test('las demostraciones se distinguen de trabajos contratados',()=>{
 assert.match(html,/datos ficticios/);
 assert.match(html,/no casos de clientes contratados/);
 assert.match(html,/No ingreses información real/);
 assert.match(html,/No permite gestionar datos de clientes reales/);
});

test('vista no indexable, sin rastreo, formularios o llamadas de red',()=>{
 assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 assert.match(html,/default-src 'none'/);
 assert.doesNotMatch(html,/<script\b|<form\b|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
});

test('responsive y teclado sin dependencia de fuentes de terceros',()=>{
 assert.match(html,/@media\(max-width:820px\)/);
 assert.match(html,/@media\(max-width:580px\)/);
 assert.match(html,/:focus-visible/);
 assert.match(html,/href="#contenido"/);
 assert.doesNotMatch(html,/<link[^>]+href="https?:\/\//);
});

test('enlaces locales importantes tienen destinos en el proyecto actual',()=>{
 for(const path of ['/','/webs/','/soluciones-express/','/diagnostico/','/privacidad']){
  assert.ok(hrefs.includes(path),path);
 }
 assert.ok(existsSync(resolve(staticDir,'index.html')));
 assert.ok(existsSync(resolve(staticDir,'webs/index.html')));
 assert.ok(existsSync(resolve(staticDir,'soluciones-express/index.html')));
 assert.ok(existsSync(resolve(staticDir,'diagnostico/index.html')));
});


test('el contacto directo funciona como alternativa sin envíos automáticos',()=>{
 const links=hrefs.filter(h=>h.startsWith('mailto:'));
 assert.equal(links.length,2);
 for (const href of links){
  const url=new URL(href);
  assert.equal(url.protocol,'mailto:');
  assert.equal(url.pathname,'contacto.fluynova@gmail.com');
  assert.match(url.searchParams.get('subject')||'',/FLUYNOVA.*Consulta desde galería/i);
  assert.match(url.searchParams.get('body')||'',/me interesa consultar/i);
  assert.match(url.searchParams.get('body')||'',/Qué necesita mi negocio/i);
  assert.ok(href.length<1200);
 }
 assert.match(html,/vos decidís si lo enviás/);
 assert.doesNotMatch(html,/<form\b|fetch\s*\(|XMLHttpRequest/);
});
