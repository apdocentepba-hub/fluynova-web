'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');
const py=fs.readFileSync(path.join(base,'app.py'),'utf8');
const html=fs.readFileSync(path.join(base,'static/index.html'),'utf8');
const main=fs.readFileSync(path.join(base,'static/main.js'),'utf8');
const match=py.match(/ALLOWED_CATEGORIES\s*=\s*\{([\s\S]*?)\}/);
if(!match)throw new Error('No se halló la lista segura del backend');
const categories=new Set([...match[1].matchAll(/"([^"\n]+)"/g)].map(m=>m[1]));
const select=html.match(/<select\s+name="category"[^>]*>([\s\S]*?)<\/select>/);
if(!select)throw new Error('No hay categorías de contacto en la web');
const publicCategories=new Set([...select[1].matchAll(/<option(?:\s+[^>]*)?>([^<]+)<\/option>/g)].map(m=>m[1]).filter(x=>x!=='Elegí una opción'));
test('API de respaldo admite todas las categorías públicas actuales',()=>{
 assert.deepEqual([...categories].sort(),[...publicCategories].sort());
});
test('categoría web/catálogo admitida tanto por API como navegador',()=>{
 assert.ok(categories.has('Crear página web / catálogo digital'));
 assert.ok(main.includes("'Crear página web / catálogo digital'"));
});
test('API de respaldo conserva puerta de almacenamiento cerrado y consentimiento',()=>{
 assert.match(py,/CONTACT_STORAGE_READY/);
 assert.match(py,/payload\.get\("consent"\) is True/);
 assert.match(main,/if\(!contactEnabled\)/);
});
