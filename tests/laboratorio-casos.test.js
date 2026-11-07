'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../static/laboratorio/index.html'),'utf8');
test('cuatro demostraciones distintas y CTA diagnóstico existente',()=>{
 assert.equal((html.match(/<article class="card">/g)||[]).length,4);
 for(const s of ['fluynova-ops-lab-preview-20261104.onrender.com/demo.html','fluynova-demo-pasteleria.pages.dev/','fluynova-demo-distribuidora.pages.dev/','fluynova-cotizador-lab-20261104.onrender.com/cotizador-gestion/','href="/diagnostico/"'])assert.ok(html.includes(s),s);
});
test('sin afirmaciones de clientes o ingresos inventados',()=>{
 for(const s of ['no casos de clientes contratados','noindex,nofollow','No ingreses información real','No es un cliente real','No contratable'])assert.ok(html.toLowerCase().includes(s.toLowerCase()),s);
 assert.doesNotMatch(html,/\d+\s*clientes satisfechos|ganancias garantizadas|más de \d+ ventas/i);
});
test('sin scripts, píxeles, formularios ni accesos a claves',()=>{
 assert.doesNotMatch(html,/<script\b|<form\b|\bfetch\s*\(|\bXMLHttpRequest\b|data:text\/javascript/i);
 assert.match(html,/default-src 'none'/);
 assert.match(html,/form-action 'none'/);
});
test('enlaces externos aislados y URLs HTTPS',()=>{
 const links=[...html.matchAll(/<a\b([^>]+)>/g)].map(x=>x[1]);
 for(const link of links.filter(l=>/target="_blank"/.test(l))){assert.match(link,/rel="noopener noreferrer"/);assert.match(link,/href="https:\/\//);}
 assert.equal(links.filter(l=>/target="_blank"/.test(l)).length,4);
});
test('diferencia productos listos de prototipos y marca restricciones',()=>{
 assert.match(html,/El módulo de órdenes de trabajo v0\.2 existe en el laboratorio Windows, pero todavía no está publicado/);
 assert.match(html,/no resultados de clientes reales/);
 assert.match(html,/prefers-reduced-motion/);
});
