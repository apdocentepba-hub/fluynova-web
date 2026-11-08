import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {makeD1Html,makeD1MainJs,buildD1Candidate,verifyD1Candidate} from '../scripts/build-static-d1-contact-candidate.mjs';
import {transformMainJs} from '../scripts/build-static-main-preview.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HTML=readFileSync(join(ROOT,'static/index.html'),'utf8');
const JS=readFileSync(join(ROOT,'static/main.js'),'utf8');
const CLIENT=readFileSync(join(ROOT,'scripts/contact-d1-staging-client.js'),'utf8');

test('candidato D1 conserva correo, privacidad, formulario cerrado y NO FormSubmit',()=>{
 const h=makeD1Html(HTML);
 assert.match(h,/data-d1-contact="staging-disabled"/);
 assert.match(h,/action="\/#contacto"/);
 assert.match(h,/<fieldset disabled data-d1-gate="closed"/);
 assert.match(h,/type="submit" disabled/);
 assert.match(h,/id="alternate-send" type="button" hidden disabled/);
 assert.match(h,/id="d1-turnstile"/);
 assert.match(h,/src="\/contact-d1-staging\.js"/);
 assert.match(h,/También podés contactarnos por correo/);
 assert.match(h,/mailto:contacto\.fluynova@gmail\.com/);
 assert.match(h,/almacenamiento de pruebas en FLUYNOVA/);
 assert.doesNotMatch(h,/action="https:\/\/formsubmit\.co/);
 assert.match(h,/noindex,nofollow,noarchive/);
});
test('un HTML distinto aborta el build, nunca reabre el formulario',()=>{
 assert.throws(()=>makeD1Html(HTML.replace('name="_honey"','name="unknown"')),/ausentes/);
 assert.throws(()=>makeD1Html(HTML.replace('name="consent" required','name="consent"')),/Cambio no único/);
 assert.throws(()=>makeD1Html(HTML.replace('https://formsubmit.co/contacto.fluynova@gmail.com','https://other.invalid')),/Cambio no único/);
});
test('JavaScript principal elimina el listener bloqueante y las APIs anteriores',()=>{
 const result=makeD1MainJs(transformMainJs(JS));
 assert.doesNotMatch(result,/\bfetch\s*\(/);
 assert.doesNotMatch(result,/formsubmit\.co/);
 assert.doesNotMatch(result,/form\?\.addEventListener\('submit'/);
 assert.match(result,/Cliente D1 separado/);
});
test('sin configuración no intenta cargar CAPTCHA ni hacer llamadas externas',()=>{
 let remote=0;let append=0;
 const status={textContent:'',className:''};
 const form={querySelector:()=>({disabled:true})};
 const context={
  document:{getElementById:id=>id==='contact-form'?form:id==='form-status'?status:({}),head:{appendChild:()=>append++}},
  window:{location:{protocol:'https:'}},
  fetch:()=>{remote++;throw Error('No remote network')},URL
 };
 runInNewContext(CLIENT,context,{timeout:1000});
 assert.equal(remote,0);
 assert.equal(append,0);
 assert.match(status.textContent,/no está habilitado/);
});
function simulateConfigured({reply={status:201,body:{ok:true,stored:true,delivery:'database',id:'397ccb04-a0a0-4666-9981-7edcb1b64f04'}},token='token-de-captcha'}={}){
 const injected=CLIENT.replace("endpoint:'',siteKey:''",
   "endpoint:'https://fluynova-local-test.workers.dev/api/contact',siteKey:'0x4AAAAAAATESTKEY123'");
 assert.notEqual(injected,CLIENT);
 const status={textContent:'',className:''},fieldset={disabled:true,style:{}},send={disabled:true};
 const challenge={}, calls=[], resetCalls=[];
 let onSubmit,turnstileOptions,script,formReset=0;
 const form={
  querySelector:q=>q.startsWith('fieldset')?fieldset:q.startsWith('button')?send:null,
  checkValidity:()=>true,reportValidity:()=>{},
  elements:{namedItem:key=>key==='consent'?{checked:true}:null},
  addEventListener:(type,cb)=>{if(type==='submit')onSubmit=cb;},
  reset:()=>{formReset++}
 };
 const document={
  getElementById:id=>({
    'contact-form':form,'form-status':status,'d1-turnstile':challenge
  })[id],
  createElement:()=>script={},
  head:{appendChild:()=>{script.onload()}}
 };
 const context={
  document,window:{location:{protocol:'https:'},
   turnstile:{render:(_target,opts)=>{turnstileOptions=opts;return 'widget-1'},
     reset:wid=>{resetCalls.push(wid)}}},
  URL, FormData:class{get(key){return ({
   name:'Prueba Controlada',email:'ficticio@example.invalid',
   organization:'Caso sintético',category:'Crear página web / catálogo digital',
   message:'Solicito una demo completamente ficticia de página web.',
   deadline:'',stage:'',budget:'',_honey:'',origen_fuente:'webs',
   origen_canal:'landing',origen_campania:'webs_202611',origen_mensaje:'hero'
  })[key]??null}},
  AbortController:class{signal={};abort(){}},
  setTimeout:()=>44,clearTimeout:()=>{},
  fetch:async(url,opts)=>{calls.push({url,opts,body:JSON.parse(opts.body)});return {
   status:reply.status,json:async()=>reply.body}},
 };
 runInNewContext(injected,context,{timeout:1000});
 assert.equal(fieldset.disabled,false);
 assert.equal(send.disabled,true);
 assert.equal(typeof onSubmit,'function');
 if(token)turnstileOptions.callback(token);
 return {async submit(){
  let prevented=false;
  await onSubmit({preventDefault(){prevented=true}});
  return {prevented,status,send,calls,resetCalls,formReset};
 }};
}
test('simulación cliente: solo HTTP 201 con stored=true confirma una consulta',async()=>{
 const s=simulateConfigured();const r=await s.submit();
 assert.equal(r.prevented,true);
 assert.equal(r.calls.length,1);
 assert.equal(r.calls[0].url,'https://fluynova-local-test.workers.dev/api/contact');
 assert.equal(r.calls[0].body.consent,true);
 assert.equal(r.calls[0].body.turnstile_token,'token-de-captcha');
 assert.equal(r.calls[0].body.category,'Crear página web / catálogo digital');
 assert.equal(r.calls[0].opts.credentials,'omit');
 assert.match(r.status.textContent,/Consulta guardada con código/);
 assert.match(r.status.textContent,/no confirma entrega por correo/);
 assert.equal(r.formReset,1);
 assert.equal(r.send.disabled,true);
 assert.equal(r.resetCalls.length,1);
});
test('simulación cliente: sin CAPTCHA no hay red ni envío, aunque haya datos',async()=>{
 const s=simulateConfigured({token:''}),r=await s.submit();
 assert.equal(r.prevented,true);
 assert.equal(r.calls.length,0);
 assert.match(r.status.textContent,/verificá el CAPTCHA/);
});
test('simulación cliente: éxito HTTP engañoso sin stored no confirma recepción',async()=>{
 const s=simulateConfigured({reply:{status:200,body:{success:true,stored:false}}});
 const r=await s.submit();
 assert.equal(r.calls.length,1);
 assert.equal(r.formReset,0);
 assert.doesNotMatch(r.status.textContent,/Consulta guardada/);
 assert.match(r.status.textContent,/No pudimos guardar/);
});
test('artefacto real aislado conserva 12 páginas, enlaces y modo bloqueado',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'fluynova-d1-staging-'));
 try{
  const dest=join(temp,'candidate');
  const result=await buildD1Candidate({sourceDir:join(ROOT,'static'),outputDir:dest});
  assert.equal(result.pages,12);
  assert.ok(result.internalLinks>=120);
  assert.equal(result.errors,0);
  assert.equal(result.published,false);
  assert.match(result.contact,/not configured/);
  const html=await readFile(join(dest,'index.html'),'utf8');
  const cli=await readFile(join(dest,'contact-d1-staging.js'),'utf8');
  assert.match(cli,/endpoint:''/);
  assert.match(cli,/siteKey:''/);
  await verifyD1Candidate(dest);
  await writeFile(join(dest,'index.html'),html.replace('data-d1-contact="staging-disabled"','data-d1-contact="staging-enabled"'));
  await assert.rejects(verifyD1Candidate(dest),/Puerta de integración/);
 }finally{await rm(temp,{recursive:true,force:true})}
});
test('evita escribir la compilación dentro del árbol original',async()=>{
 await assert.rejects(buildD1Candidate({
  sourceDir:join(ROOT,'static'),outputDir:join(ROOT,'static','d1-candidate')
 }),/separado/);
});
