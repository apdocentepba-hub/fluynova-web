"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"../static");
const src=fs.readFileSync(path.join(root,"instagram/referral.js"),"utf8");
const {rewriteReferralLink}=require("../static/instagram/referral.js");
const source="?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611&utm_content=soluciones";
const origin="https://fluynova-web.onrender.com";

test("CTA de soluciones mantiene Instagram en lugar de atribuirse a la página",()=>{
 const before="/?utm_source=soluciones_express&utm_medium=web&utm_campaign=venta_noviembre&utm_content=planillas#contacto";
 const after=rewriteReferralLink(before,source,origin);
 const url=new URL(after,origin);
 assert.equal(url.searchParams.get("utm_source"),"instagram");
 assert.equal(url.searchParams.get("utm_medium"),"profile");
 assert.equal(url.searchParams.get("utm_campaign"),"perfil_ig_202611");
 assert.equal(url.searchParams.get("utm_content"),"soluciones");
 assert.equal(url.hash,"#contacto");
});
test("CTA de planillas /#contacto recibe campaña heredada",()=>{
 const to=rewriteReferralLink("/#contacto",source.replace("soluciones","planillas"),origin);
 const url=new URL(to,origin);
 assert.equal(url.searchParams.get("utm_content"),"planillas");
 assert.equal(url.searchParams.get("utm_source"),"instagram");
});
test("navegación desde servicios a diagnóstico también conserva campaña",()=>{
 const to=rewriteReferralLink("/diagnostico/",source,origin);
 assert.equal(to,"/diagnostico/?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611&utm_content=soluciones");
});
test("visitas normales mantienen atribución original del servicio",()=>{
 const before="/?utm_source=soluciones_express&utm_medium=web&utm_campaign=venta_noviembre#contacto";
 assert.equal(rewriteReferralLink(before,"",origin),before);
 assert.equal(rewriteReferralLink(before,"?utm_source=google&utm_campaign=organic",origin),before);
});
test("sin campaña o con caracteres inválidos no altera enlaces",()=>{
 const before="/#contacto";
 assert.equal(rewriteReferralLink(before,"?utm_source=instagram",origin),before);
 assert.equal(rewriteReferralLink(before,"?utm_source=instagram&utm_campaign=%3Cscript%3E",origin),before);
});
test("no reescribe enlaces externos, mailto ni rutas irrelevantes",()=>{
 for(const before of ["https://evil.example/#contacto","mailto:contacto.fluynova@gmail.com","/productos/","/privacidad","/#servicios"]){
   assert.equal(rewriteReferralLink(before,source,origin),before);
 }
});
test("las dos landings de servicios cargan el script sin cambiar su HTML de formulario",()=>{
 for(const name of ["soluciones-express","automatizacion-de-planillas"]){
   const html=fs.readFileSync(path.join(root,name,"index.html"),"utf8");
   assert.ok(html.includes('<script defer src="/instagram/referral.js"></script>'));
   assert.match(html,/href="\/\?utm_source=soluciones_express|href="\/#contacto/);
 }
});
test("en DOM simulado solo modifica el CTA correcto",()=>{
 const attrs=[];
 const anchors=[
  {href:"/#contacto",getAttribute(name){assert.equal(name,"href");return this.href;},setAttribute(name,value){attrs.push({name,value});}},
  {href:"mailto:contacto.fluynova@gmail.com",getAttribute(name){return this.href;},setAttribute(name,value){attrs.push({name,value});}}
 ];
 const win={location:{origin,search:source},document:{querySelectorAll(selector){assert.equal(selector,"a[href]");return anchors;}}};
 vm.runInNewContext(src,{window:win,URL,URLSearchParams});
 assert.equal(attrs.length,1);
 assert.equal(attrs[0].name,"href");
 assert.ok(attrs[0].value.includes("utm_source=instagram"));
});
test("sin almacenamiento, cookies ni solicitudes de red",()=>{
 assert.ok(!/fetch\(|sendBeacon|document\.cookie|localStorage|sessionStorage/.test(src));
 assert.ok(!/location\.assign|location\.replace|location\.href\s*=/.test(src));
});
