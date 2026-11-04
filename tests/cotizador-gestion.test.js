"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const c=require("../static/cotizador-gestion/cotizador.js");
const h=fs.readFileSync(path.join(__dirname,"../static/cotizador-gestion/index.html"),"utf-8");
test("precios iniciales de los tres paquetes e ingresos recurrentes transparentes",()=>{
 assert.equal(c.estimate({plan:"web"}).setup,290000);
 assert.equal(c.estimate({plan:"web"}).monthly,null);
 assert.equal(c.estimate({plan:"crm"}).setup,290000);
 assert.equal(c.estimate({plan:"crm"}).monthly,39000);
 assert.equal(c.estimate({plan:"gestion"}).monthly,59000);
});
test("primer año es aritmética de implementación + doce mensualidades",()=>{
 assert.equal(c.estimate({plan:"crm"}).firstYear,758000);
 assert.equal(c.estimate({plan:"gestion"}).firstYear,1098000);
});
test("más usuarios, integración o hosting propio piden presupuesto humano",()=>{
 for(const opts of [{team:"6-20"},{team:"21+"},{extraIntegration:true},{infra:"propia"}]){
  const r=c.estimate({plan:"crm",...opts});
  assert.equal(r.requiresCustomQuote,true);assert.equal(r.firstYear,null);
 }
});
test("no inventa plan, opciones inválidas no abren permisos ni pagos",()=>{
 assert.throws(()=>c.estimate({plan:"inexistente"}),TypeError);
 assert.equal(c.estimate({plan:"crm",team:"indefinido"}).monthly,39000);
});
test("formato ARS y datos sensibles fuera del estimador",()=>{
 assert.match(c.ars(290000),/290.000/);
 assert.equal(c.ars(-1),"A cotizar");
 assert.doesNotMatch(h,/type="email"|type="password"|<form|formsubmit|localStorage|sessionStorage|fetch\s*\(/i);
});
test("página marca prototipo y enlaza a evaluación sin pagos",()=>{
 assert.match(h,/NO INDEX|noindex/i);
 assert.match(h,/en desarrollo/i);
 assert.match(h,/\/diagnostico\//);
 assert.match(h,/cotizador\.js/);
});
