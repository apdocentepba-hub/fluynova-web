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
  message:"Necesito organizar las consultas de mis clientes y sus seguimientos.",deadline:"",stage:"",budget:"",_honey:"",...changes};
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
