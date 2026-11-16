"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../static/index.html"),"utf8");
const script=fs.readFileSync(path.join(__dirname,"../static/contact-mailto.js"),"utf8");

function harness(changes={},withClipboard=true){
 const values={name:"Cliente de prueba",email:"cliente@example.com",organization:"Empresa ficticia",category:"Automatizar tareas",
  message:"Necesito organizar las consultas de mis clientes y sus seguimientos.",deadline:"",stage:"",budget:"",_honey:"",origen_fuente:"web_directo",origen_canal:"",origen_campania:"",origen_mensaje:"",...changes};
 const selectHtml=html.match(/<select name="category" required>([\s\S]*?)<\/select>/);
 assert.ok(selectHtml,"selector de categorías presente");
 const options=[...selectHtml[1].matchAll(/<option(?: value="([^"]*)")?>([^<]+)<\/option>/g)]
   .map(m=>({value:m[1]===undefined?m[2]:m[1]}));
 const focus=[];
 const fields=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{
  value,focus(){focus.push(key)},checkValidity(){return key==="email"?/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(this.value)):true}
 }]));
 fields.category.options=options;
 const make=(id)=>({id,hidden:id==="manual-mailto-panel"||id==="manual-mailto-open",value:"",textContent:"",
  handlers:{},href:"",addEventListener(name,fn){this.handlers[name]=fn},removeAttribute(name){if(name==="href")this.href=""},focus(){focus.push(id)},select(){this.selected=true}});
 const nodes={};
 for(const id of ["manual-mailto-prepare","manual-mailto-panel","manual-mailto-preview","manual-mailto-open","manual-mailto-copy","manual-mailto-status"])nodes[id]=make(id);
 const form={elements:{namedItem(k){return fields[k]||null}},handlers:{},addEventListener(name,fn){this.handlers[name]=fn}};
 nodes["contact-form"]=form;
 const copies=[];
 const clipboard=withClipboard?{async writeText(s){copies.push(s)}}:{};
 vm.runInNewContext(script,{document:{getElementById(id){return nodes[id]||null}},navigator:{clipboard},Error});
 const prepare=()=>nodes["manual-mailto-prepare"].handlers.click();
 const change=(name,value)=>{fields[name].value=value;form.handlers.input();};
 return {nodes,fields,focus,copies,prepare,change,trigger:async(id)=>nodes[id].handlers.click()};
}
test("se inserta un respaldo junto al formulario original, sin cambiar FormSubmit",()=>{
 for(const id of ["manual-mailto-prepare","manual-mailto-panel","manual-mailto-preview","manual-mailto-open","manual-mailto-copy","manual-mailto-status"])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<script src="\/contact-mailto\.js" defer><\/script>/);
 assert.match(html,/action="https:\/\/formsubmit\.co\/contacto\.fluynova@gmail\.com"/);
 assert.match(html,/name="consent" required/);
 assert.doesNotMatch(script,/fetch\s*\(|\.submit\s*\(|sendBeacon|localStorage|sessionStorage|document\.cookie/);
});
test("el visitante construye un mailto sin FormSubmit ni checkbox y revisa su borrador",()=>{
 const t=harness();
 t.prepare();
 assert.equal(t.nodes["manual-mailto-panel"].hidden,false);
 assert.equal(t.nodes["manual-mailto-open"].hidden,false);
 const u=new URL(t.nodes["manual-mailto-open"].href);
 assert.equal(u.protocol,"mailto:");
 assert.equal(u.pathname,"contacto.fluynova@gmail.com");
 assert.match(u.searchParams.get("subject"),/FLUYNOVA.*Automatizar tareas/);
 assert.match(u.searchParams.get("body"),/Empresa ficticia/);
 assert.match(u.searchParams.get("body"),/consultas de mis clientes/);
 assert.match(t.nodes["manual-mailto-preview"].value,/Para: contacto.fluynova@gmail.com/);
 assert.match(t.nodes["manual-mailto-status"].textContent,/no significa enviarlo/);
});
test("solo permite preparar datos mínimos válidos y bloquea honeypot",()=>{
 for(const [key,bad,expected] of [
  ["name","X","nombre"],["email","mal-email","correo"],["category","","servicio"],
  ["message","muy corto","15 caracteres"],["_honey","spam","No se pudo"]
 ]){
  const t=harness({[key]:bad});
  t.prepare();
  assert.equal(t.nodes["manual-mailto-panel"].hidden,true,key);
  assert.equal(t.nodes["manual-mailto-open"].href,"",key);
  assert.match(t.nodes["manual-mailto-status"].textContent,new RegExp(expected),key);
 }
});
test("mensajes largos usan copia, sin enlace mailto truncado",async()=>{
 const t=harness({message:"texto largo ".repeat(240)});
 t.prepare();
 assert.equal(t.nodes["manual-mailto-panel"].hidden,false);
 assert.equal(t.nodes["manual-mailto-open"].hidden,true);
 assert.equal(t.nodes["manual-mailto-open"].href,"");
 await t.trigger("manual-mailto-copy");
 assert.equal(t.copies.length,1);
 assert.match(t.copies[0],/texto largo/);
});
test("editar o reiniciar el formulario borra el borrador previo",()=>{
 const t=harness();
 t.prepare();
 t.change("message","Otro mensaje para evaluación manual.");
 assert.equal(t.nodes["manual-mailto-panel"].hidden,true);
 assert.equal(t.nodes["manual-mailto-preview"].value,"");
 assert.equal(t.nodes["manual-mailto-open"].href,"");
 t.prepare();
 t.nodes["contact-form"].handlers.reset();
 assert.equal(t.nodes["manual-mailto-preview"].value,"");
});
test("cuando el portapapeles está bloqueado conserva texto seleccionable",async()=>{
 const t=harness({},false);
 t.prepare();
 await t.trigger("manual-mailto-copy");
 assert.equal(t.nodes["manual-mailto-preview"].selected,true);
 assert.match(t.nodes["manual-mailto-status"].textContent,/copialo manualmente/);
});

test("las 12 categorías de FLUYNOVA funcionan con el mismo borrador manual",()=>{
 const categories=[
  "Automatizar tareas","Desarrollar software","Crear página web / catálogo digital",
  "Gestionar clientes (CRM)","Presupuestos y cotizaciones","Pedidos, ventas y stock",
  "Turnos, reservas y agenda","Planillas, reportes y tableros",
  "WhatsApp, correo y respuestas automáticas","Conectar herramientas / datos",
  "Inteligencia artificial","Otro / no estoy seguro"
 ];
 const select=html.match(/<select name="category" required>([\s\S]*?)<\/select>/);
 assert.ok(select);
 const actual=[...select[1].matchAll(/<option>([^<]+)<\/option>/g)].map(m=>m[1]);
 assert.deepEqual(actual,categories,"no perder ni duplicar temas de consulta");
 for(const category of categories){
  const t=harness({category});
  t.prepare();
  assert.equal(t.nodes["manual-mailto-panel"].hidden,false,"panel para "+category);
  assert.equal(t.nodes["manual-mailto-open"].hidden,false,"mailto para "+category);
  const url=new URL(t.nodes["manual-mailto-open"].href);
  assert.ok(url.searchParams.get("subject").includes(category),"asunto para "+category);
  assert.ok(url.searchParams.get("body").includes("Servicio: "+category),"cuerpo para "+category);
 }
});
test("categorías no presentes en el selector no se envían por mailto",()=>{
 const t=harness({category:"Servicio malicioso inyectado"});
 t.prepare();
 assert.equal(t.nodes["manual-mailto-panel"].hidden,true);
 assert.equal(t.nodes["manual-mailto-open"].href,"");
 assert.match(t.nodes["manual-mailto-status"].textContent,/servicio/);
});

test("el HTML queda cerrado sin JavaScript y conserva correo directo sin FormSubmit",()=>{
 assert.match(html,/<button class="btn btn-primary submit-btn" type="submit" disabled>Enviar mi consulta/);
 assert.match(html,/<noscript>[^<]*<p class="form-note">El envío automático necesita JavaScript/);
 assert.match(html,/href="mailto:contacto\.fluynova@gmail\.com\?subject=Consulta%20FLUYNOVA"/);
 assert.match(html,/<script src="\/main\.js" defer><\/script>/);
});

test("la alternativa de correo se muestra antes del consentimiento de FormSubmit",()=>{
 const manual=html.indexOf('id="manual-mailto-prepare"');
 const consent=html.indexOf('<label class="consent">');
 assert.ok(manual>=0&&consent>0&&manual<consent);
 assert.match(html,/id="manual-mailto-prepare" type="button" class="btn btn-primary"/);
 assert.match(html,/id="manual-contact-note"[^>]*>[^<]*No necesita FormSubmit/);
});
test("el origen comercial se adjunta solo en el borrador preparado por decisión del visitante",()=>{
 const t=harness({origen_fuente:"instagram",origen_canal:"profile",origen_campania:"perfil_ig_202611",origen_mensaje:"contacto"});
 assert.equal(t.nodes["manual-mailto-panel"].hidden,true);
 t.prepare();
 const email=new URL(t.nodes["manual-mailto-open"].href);
 const body=email.searchParams.get("body");
 assert.match(body,/Origen de la consulta: fuente=instagram \/ canal=profile \/ campaña=perfil_ig_202611 \/ pieza=contacto/);
 assert.match(t.nodes["manual-mailto-preview"].value,/Origen de la consulta/);
 assert.match(body,/Descripción:\nNecesito organizar/);
});
test("correo manual omite fuente directa y rechaza parámetros maliciosos o extensos",()=>{
 for(const source of ["web_directo","https://externo.example/?secret=1","a".repeat(91)]){
  const t=harness({origen_fuente:source,origen_canal:"profile"});
  t.prepare();
  const body=new URL(t.nodes["manual-mailto-open"].href).searchParams.get("body");
  assert.doesNotMatch(body,/Origen de la consulta/);
  assert.doesNotMatch(body,/externo.example/);
 }
});
