"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const home=fs.readFileSync(path.join(__dirname,"../static/index.html"),"utf8");
const source=fs.readFileSync(path.join(__dirname,"../static/main.js"),"utf8");
const webs=fs.readFileSync(path.join(__dirname,"../static/webs/index.html"),"utf8");
const label="Crear página web / catálogo digital";

function bootstrap(search){
  const fields=new Map([
    ["category",{value:""}],
    ["message",{value:""}],
    ...["origen_fuente","origen_canal","origen_campania","origen_mensaje"].map(k=>[k,{value:""}])
  ]);
  const form={elements:{namedItem(k){return fields.get(k);}}};
  const referral=new URLSearchParams(search);
  const cleanCampaignParam=(key,fallback="")=>{
    const value=String(referral.get(key)||fallback).slice(0,90);
    return /^[a-zA-Z0-9_.-]{1,90}$/.test(value)?value:fallback;
  };
  const start=source.indexOf("if(form){");
  const end=source.indexOf("\nlet contactEnabled",start);
  assert.ok(start>=0&&end>start,"bootstrap block exists");
  vm.runInNewContext(source.slice(start,end),{form,referral,cleanCampaignParam});
  return Object.fromEntries([...fields].map(([k,x])=>[k,x.value]));
}
test("formulario público incluye opción específica web/catálogo sin quitar otras",()=>{
 assert.ok(home.includes("<option>"+label+"</option>"));
 for(const x of ["Automatizar tareas","Desarrollar software","Conectar herramientas / datos","Inteligencia artificial","Otro / no estoy seguro"]){
   assert.ok(home.includes("<option>"+x+"</option>"));
 }
});
test("categoría web admitida en las dos listas de validación y selección",()=>{
 assert.equal((source.match(/'Crear página web \/ catálogo digital'/g)||[]).length,3);
 assert.match(source,/if\(!categories.includes\(v.category\)\)/);
});
test("visita desde demo /webs deja web preseleccionada y atribución correcta",()=>{
 const x=bootstrap("?utm_source=webs&utm_medium=landing&utm_campaign=webs_202611&utm_content=hero");
 assert.equal(x.category,label);
 assert.equal(x.origen_fuente,"webs");
 assert.equal(x.origen_campania,"webs_202611");
 assert.equal(x.origen_mensaje,"hero");
});
test("visita desde Reel Instagram -> /webs/ preselecciona web sin perder Instagram",()=>{
 const x=bootstrap("?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611&utm_content=webs");
 assert.equal(x.category,label);
 assert.equal(x.origen_fuente,"instagram");
 assert.equal(x.origen_canal,"profile");
 assert.equal(x.origen_mensaje,"webs");
});
test("enlace directo de contacto Instagram mantiene selección normal",()=>{
 const x=bootstrap("?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611&utm_content=contacto");
 assert.equal(x.category,"");
 assert.equal(x.origen_fuente,"instagram");
});
test("visitantes sin campaña seleccionan la categoría voluntariamente",()=>{
 const x=bootstrap("");
 assert.equal(x.category,"");
 assert.equal(x.origen_fuente,"web_directo");
 assert.equal(x.message,"");
});
test("campañas inventadas no fuerzan tipo de servicio",()=>{
 const x=bootstrap("?utm_source=webs&utm_campaign=cualquier_cosa");
 assert.equal(x.category,"");
});
test("la transferencia desde GUARDIÁN continúa funcionando",()=>{
 const x=bootstrap("?utm_source=guardian&guardian_sector=comercio");
 assert.equal(x.category,"Automatizar tareas");
 assert.match(x.message,/Guard[iá]án|Guardián/);
});
test("las dos CTA comerciales conservan paso por formulario y consentimiento",()=>{
 assert.ok(webs.includes("utm_source=webs"));
 assert.ok(webs.includes("#contacto"));
 assert.ok(home.includes('name="consent" required'));
 assert.ok(home.includes('action="https://formsubmit.co/contacto.fluynova@gmail.com"'));
 assert.ok(source.includes("await deliverDirect(v)"));
});
test("preselección no envía formularios, hace tracking ni persiste actividad",()=>{
 const start=source.indexOf("// Quien visita la demo de webs");
 const end=source.indexOf("// Guía a consulta comercial",start);
 const segment=source.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(segment,/fetch\s*\(|\.submit\s*\(|localStorage|sessionStorage|document\.cookie|sendBeacon/);
});
