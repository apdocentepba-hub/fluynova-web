'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../static');
const js=fs.readFileSync(path.join(root,'main.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=js.indexOf('const fromWebSales=');
const end=js.indexOf(' // Guía a consulta comercial',start);
assert.ok(start>0 && end>start, 'No se encontró el bloque de atribución comercial');
const actualBlock=js.slice(start,end);
const webCategory='Crear página web / catálogo digital';
function selectedCategory(query){
 let actual='';
 const form={elements:{namedItem(k){assert.equal(k,'category');return {set value(x){actual=x}}}}};
 vm.runInNewContext(`const referral=new URLSearchParams(${JSON.stringify(query)}); ${actualBlock}` ,{URLSearchParams,form});
 return actual;
}
const LAB='?utm_source=laboratorio&utm_medium=portfolio&utm_campaign=demostraciones_202611&utm_content=';
test('pastelería de la galería precategoriza solicitud web',()=>assert.equal(selectedCategory(LAB+'pasteleria'),webCategory));
test('distribuidora de la galería precategoriza solicitud web',()=>assert.equal(selectedCategory(LAB+'distribuidora'),webCategory));
test('laboratorio CRM y cotizador NO se presentan falsamente como páginas web',()=>{
 assert.equal(selectedCategory(LAB+'crm'),'');assert.equal(selectedCategory(LAB+'cotizador'),'');
});
test('campaña o medio adulterados NO precategorizan',()=>{
 assert.equal(selectedCategory('?utm_source=laboratorio&utm_medium=spam&utm_campaign=demostraciones_202611&utm_content=pasteleria'),'');
 assert.equal(selectedCategory('?utm_source=laboratorio&utm_medium=portfolio&utm_campaign=maliciosa&utm_content=pasteleria'),'');
});
test('Instagram web mantiene compatibilidad con campaña anterior',()=>{
 assert.equal(selectedCategory('?utm_source=instagram&utm_content=webs&utm_campaign=perfil_ig_202611'),webCategory);
});
test('campaña de venta de webs existente conserva su categoría',()=>{
 assert.equal(selectedCategory('?utm_source=webs&utm_campaign=webs_202611'),webCategory);
});
test('entrada directa y parámetros desconocidos no alteran categoría',()=>{
 assert.equal(selectedCategory(''),'');assert.equal(selectedCategory('?utm_source=google&utm_content=pasteleria'),'');
});
test('Guardián se carga una sola vez y en orden',()=>{
 const scripts=[...index.matchAll(/<script\s+defer\s+src="(\/guardian\/(?:guardian_brain|guardian)\.js\?v=\d+)"\s*><\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.length,2);assert.deepEqual(scripts,['/guardian/guardian_brain.js?v=6','/guardian/guardian.js?v=3']);
});
test('el formulario todavía exige consentimiento y conserva campos UTM',()=>{
 for(const field of ['origen_fuente','origen_canal','origen_campania','origen_mensaje'])assert.ok(index.includes('name="'+field+'"'));
 assert.match(index,/name="consent"\s+required/);
 assert.match(js,/if\(!contactEnabled\)/);
 assert.match(js,/const fromLaboratorioWebs=/);
});
