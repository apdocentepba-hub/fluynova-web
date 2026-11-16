"use strict";
/**
 * Contrato de la entrega AJAX, aislado de Internet.
 * Ejecuta el bloque REAL de static/main.js con fetch y HTMLFormElement simulados.
 * Ninguna petición sale del proceso ni se envía ningún correo.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../static/main.js'),'utf8');
const start=source.indexOf("const alternateSend=document.getElementById('alternate-send');");
const end=source.indexOf('// Compartir de forma voluntaria:',start);
assert.ok(start>=0&&end>start,'Extraer implementación real del formulario, no reimplementarla');
const implementation=source.slice(start,end);
function harness({enabled=true,provider={ok:true,result:{success:'true'}},changes={}}={}){
 const values={
  name:'Visitante de prueba',email:'visitante@example.com',organization:'Comercio ficticio',
  category:'Presupuestos y cotizaciones',
  message:'Necesito ordenar los presupuestos y las aprobaciones comerciales.',
  deadline:'Dentro de un mes',stage:'Lo hago manualmente',budget:'Necesito una estimación',
  _honey:'',origen_fuente:'instagram',origen_canal:'profile',
  origen_campania:'perfil_ig_202611',origen_mensaje:'contacto',
  ...changes
 };
 const consent={checked:true},calls=[],native=[],feedbacks=[],handlers={};
 let resetCount=0;
 const form={
  elements:{namedItem(k){
   if(k==='consent')return consent;
   if(k==='email')return {checkValidity:()=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(values.email))};
   return {value:values[k]||''};
  }},
  addEventListener(name,fn){handlers[name]=fn},
  reset(){resetCount++}
 };
 const status={textContent:'',className:''};
 const sendButton={disabled:!enabled,textContent:'',innerHTML:''};
 const alternate={hidden:true,handlers:{},addEventListener(name,fn){this.handlers[name]=fn}};
 const replies={
  successString:{ok:true,result:{success:'true'}},
  successBoolean:{ok:true,result:{success:true}},
  rejected:{ok:false,result:{success:false,message:'Rechazado por proveedor'}},
  noConfirmation:{ok:true,result:{success:false,message:'No hubo confirmación'}},
  malformed:{ok:true,throwJson:true},
  transportError:{throwFetch:true}
 };
 const request=typeof provider==='string'?replies[provider]:provider;
 const fetcher=async(url,options)=>{
  assert.equal(url,'https://formsubmit.co/ajax/contacto.fluynova%40gmail.com');
  assert.equal(options.method,'POST');
  assert.equal(options.headers.Accept,'application/json');
  const payload=JSON.parse(options.body);
  calls.push({url,options,payload});
  if(request?.throwFetch)throw Error('Red sin respuesta');
  return {ok:request.ok,async json(){if(request.throwJson)throw Error('JSON incorrecto');return request.result;}};
 };
 const sandbox={
  document:{getElementById(id){return id==='alternate-send'?alternate:null}},
  form,status,sendButton,CONTACT_EMAIL:'contacto.fluynova@gmail.com',
  contactEnabled:enabled,
  fetch:fetcher,
  FormData:class{constructor(element){assert.equal(element,form)}get(k){return values[k]??null}},
  HTMLFormElement:{prototype:{submit(){native.push({form:this,values:{...values}})}}},
  feedback(message,kind){status.textContent=message;status.className='form-status '+kind;feedbacks.push({message,kind})}
 };
 // El bloque bajo prueba usa una variable léxica contactEnabled definida en main.js.
 vm.runInNewContext('const contactEnabled=globalEnabled;\n'+implementation,{...sandbox,globalEnabled:enabled});
 return {
  form,values,consent,status,sendButton,alternate,calls,native,feedbacks,
  get resetCount(){return resetCount},
  submit(){assert.equal(typeof handlers.submit,'function');return handlers.submit({preventDefault(){}})},
  fallback(){assert.equal(typeof alternate.handlers.click,'function');alternate.handlers.click()}
 };
}
test('sin configuración habilitada no hay POST y aparece respaldo manual',async()=>{
 const h=harness({enabled:false});
 await h.submit();
 assert.equal(h.calls.length,0);
 assert.equal(h.resetCount,0);
 assert.match(h.status.textContent,/Preparar correo con mis datos/);
});
test('FormSubmit acepta success string y valida payload, consentimiento y UTM',async()=>{
 const h=harness({provider:'successString'});
 await h.submit();
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].payload.name,h.values.name);
 assert.equal(h.calls[0].payload._replyto,h.values.email);
 assert.equal(h.calls[0].payload.category,'Presupuestos y cotizaciones');
 assert.equal(h.calls[0].payload.origen_fuente,'instagram');
 assert.equal(h.calls[0].payload.origen_campania,'perfil_ig_202611');
 assert.equal(h.calls[0].payload._honey,'');
 assert.equal(h.resetCount,1);
 assert.equal(h.alternate.hidden,true);
 assert.equal(h.sendButton.disabled,false);
 assert.match(h.status.textContent,/proveedor confirmó/);
});
test('FormSubmit acepta success boolean sin inventar recepción Gmail',async()=>{
 const h=harness({provider:'successBoolean'});
 await h.submit();
 assert.equal(h.resetCount,1);
 assert.match(h.status.textContent,/proveedor confirmó/);
 assert.doesNotMatch(h.status.textContent,/Gmail confirmó|correo entregado/i);
});
for(const [label,provider] of [
 ['HTTP 403','rejected'],
 ['respuesta sin success','noConfirmation'],
 ['JSON inválido','malformed'],
 ['red caída','transportError']
]){
 test(label+' no declara éxito, conserva formulario y habilita alternativa tradicional',async()=>{
  const h=harness({provider});
  await h.submit();
  assert.equal(h.resetCount,0);
  assert.equal(h.calls.length,1);
  assert.equal(h.sendButton.disabled,false);
  assert.equal(h.alternate.hidden,false);
  assert.match(h.status.textContent,/No pudimos confirmar el envío/);
  h.fallback();
  assert.equal(h.native.length,1,'Alternativa requiere clic explícito');
  assert.equal(h.native[0].form,h.form);
 });
}
test('sin consentimiento no hay POST ni respaldo de proveedor',async()=>{
 const h=harness();h.consent.checked=false;
 await h.submit();
 assert.equal(h.calls.length,0);
 assert.equal(h.resetCount,0);
 assert.match(h.status.textContent,/aceptar/);
});
test('honeypot bloquea todo POST incluso con consentimiento',async()=>{
 const h=harness({changes:{_honey:'spam'}});await h.submit();
 assert.equal(h.calls.length,0);assert.equal(h.resetCount,0);
});
test('email inválido no transmite datos personales',async()=>{
 const h=harness({changes:{email:'mail-invalido'}});await h.submit();
 assert.equal(h.calls.length,0);
 assert.match(h.status.textContent,/correo electrónico válido/);
});
test('alternativa tradicional requiere fallo previo y no se activa sola',()=>{
 const h=harness();h.fallback();assert.equal(h.native.length,0);
});
test('si el visitante revoca consentimiento tras error, bloqueo también aplica al fallback',async()=>{
 const h=harness({provider:'rejected'});
 await h.submit();h.consent.checked=false;h.fallback();
 assert.equal(h.native.length,0);
 assert.match(h.status.textContent,/aceptar/);
});
test('respuesta sospechosa del proveedor no se inserta como HTML',async()=>{
 const h=harness({provider:{ok:false,result:{success:false,message:'<script>alert(1)</script>'}}});
 await h.submit();
 assert.equal(h.resetCount,0);
 assert.match(h.status.textContent,/<script>alert\(1\)<\/script>/);
 assert.equal(h.status.innerHTML,undefined,'El código usa exclusivamente textContent');
});
