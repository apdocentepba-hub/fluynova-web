'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PLANES,PRECIO_SECCION_EXTRA,presupuesto,importe,textoPresupuesto}=require('../scripts/presupuesto-web.cjs');
test('precio de cada paquete coincide con el cotizador público existente',()=>{
 const landing=fs.readFileSync(path.resolve(__dirname,'../static/webs/index.html'),'utf8');
 const options=[...landing.matchAll(/<option value="(\\d+)">([^<]+)<\\/option>/g)]
   .map(match=>({precio:Number(match[1]),etiqueta:match[2]}));
 for(const p of Object.values(PLANES)){
   const matched=options.filter(x=>x.etiqueta.startsWith(p.etiqueta+' — '));
   assert.equal(matched.length,1,`El plan ${p.etiqueta} debe existir exactamente una vez`);
   assert.equal(matched[0].precio,p.precio,`El precio de ${p.etiqueta} no coincide`);
 }
 assert.ok(landing.includes('desde $70.000 c/u'));
 assert.match(landing,/id="extra" type="number" min="0" max="3"/);
 assert.equal(PRECIO_SECCION_EXTRA,70000);
});
test('catálogo con 2 secciones y 50% anticipo',()=>{
 assert.deepEqual(presupuesto('catalogo',2),{plan:'catalogo',etiqueta:'Web Catálogo',extras:2,base:450000,adicionales:140000,total:590000,anticipo:295000,saldo:295000});
});
test('todos los límites y extras son correctos',()=>{
 for(const plan of Object.keys(PLANES)) for(let extras=0;extras<=3;extras++){
   const p=presupuesto(plan,extras);
   assert.equal(p.total,p.base+extras*70000);
   assert.equal(p.anticipo+p.saldo,p.total);
 }
});
test('rechaza parámetros inválidos y entradas que evitarían un cálculo fiable',()=>{
 for(const [p,e] of [['otro',1],['catalogo',-1],['catalogo',4],['catalogo',1.2],['catalogo',NaN],['constructor',1]]) assert.throws(()=>presupuesto(p,e),RangeError);
});
test('imprime una propuesta sin prometer contrato ni enviar mensajes',()=>{
 const s=textoPresupuesto({plan:'catalogo',extras:2});
 assert.match(s,/Total orientativo:/);
 assert.match(s,/590\.000/);
 assert.match(s,/295\.000/);
 assert.match(s,/no envía correos/);
 assert.match(s,/tratamiento impositivo/);
 assert.equal(typeof importe(70000),'string');
});
