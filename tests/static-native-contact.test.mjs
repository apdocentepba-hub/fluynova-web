import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {makeNativeHtml,makeNativeJs,buildNativeCandidate,verifyNativeCandidate} from '../scripts/build-static-native-contact.mjs';
import {transformMainJs} from '../scripts/build-static-main-preview.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HTML=readFileSync(join(ROOT,'static/index.html'),'utf8');
const MAIN=readFileSync(join(ROOT,'static/main.js'),'utf8');
const JS=makeNativeJs(transformMainJs(MAIN));

test('HTML de main conserva consentimiento y honeypot con un POST nativo exacto',()=>{
 const h=makeNativeHtml(HTML);
 assert.match(h,/data-native-candidate="true"/);
 assert.match(h,/method="POST" action="https:\/\/formsubmit\.co\/contacto\.fluynova@gmail\.com"/);
 assert.match(h,/target="_blank" rel="noopener"/);
 const formOpen=h.match(/<form[^>]+id="contact-form"[^>]*>/)?.[0];
 assert.ok(formOpen);
 assert.doesNotMatch(formOpen,/rel="[^"]*noreferrer/);
 assert.match(h,/name="_honey"/);
 assert.match(h,/name="consent" required/);
 assert.match(h,/name="_replyto" value=""/);
 assert.match(h,/name="_url" value=""/);
 assert.match(h,/name="_subject" value="/);
 assert.match(h,/noindex,nofollow,noarchive/);
 assert.match(h,/data-static-preview="true"/);
 assert.match(h,/VISTA DE PRUEBA INTERNA/);
 assert.match(h,/mailto:contacto\.fluynova@gmail\.com/);
 assert.doesNotMatch(h,/<fieldset disabled/);
 assert.doesNotMatch(h,/type="submit" disabled/);
 assert.doesNotMatch(h,/_captcha" value="false"/);
});
test('modificaciones inesperadas del origen bloquean la preparación',()=>{
 assert.throws(()=>makeNativeHtml(HTML.replace('name="_honey"','name="hidden_unknown"')),/Faltan condiciones/);
 assert.throws(()=>makeNativeHtml(HTML.replace('name="consent" required','name="consent"')),/Faltan condiciones/);
 assert.throws(()=>makeNativeHtml(HTML.replace('https://formsubmit.co/contacto.fluynova@gmail.com','https://evil.test/')),/Cambio ausente/);
});
test('código convertido conserva validación local, pero jamás usa AJAX ni API',()=>{
 assert.match(JS,/const invalid=leadValidationError\(v\)/);
 assert.match(JS,/if\(v.website\|\|invalid\|\|!form.checkValidity\(\)/);
 assert.match(JS,/reply.value=v.email;/);
 assert.match(JS,/source.value=window.location.origin\+window.location.pathname;/);
 assert.match(JS,/subject.value='FLUYNOVA \| Nueva consulta: '\+v.category;/);
 assert.doesNotMatch(JS,/\bfetch\s*\(/);
 assert.doesNotMatch(JS,/https:\/\/formsubmit.co\/ajax\//);
 assert.doesNotMatch(JS,/HTMLFormElement\.prototype\.submit/);
});
function listener({valid=true,honey='',consent=true,protocol='https:',destination='https://formsubmit.co/contacto.fluynova@gmail.com'}={}){
 const start=JS.indexOf('// Candidato estático: un único POST nativo');
 const end=JS.indexOf('// Compartir de forma voluntaria:',start);
 assert.ok(start>=0&&end>start);
 const subject={value:'Original'};
 const reply={value:''};
 const source={value:''};
 const checkbox={checked:consent};
 const form={
  elements:{namedItem:key=>({_subject:subject,_replyto:reply,_url:source,consent:checkbox})[key]},
  getAttribute:key=>key==='action'?destination:key==='method'?'POST':null,
  checkValidity:()=>valid,
  reportValidity:()=>{},
  addEventListener:(_type,handler)=>{form.handler=handler;}
 };
 let prevented=false;const feedbackMessages=[];
 const lead={name:'Prueba Ficticia',email:'ficticio@example.invalid',
  category:'Crear página web / catálogo digital',message:'Contenido totalmente ficticio para una prueba.',
  website:honey,consent:consent};
 runInNewContext(JS.slice(start,end),{
   form,window:{location:{protocol,origin:'https://fluynova.example',pathname:'/webs/'}},contactEnabled:true,currentLead:()=>lead,
   leadValidationError:()=>valid?'':'Datos incorrectos',
   feedback:(msg)=>feedbackMessages.push(msg)
 },{timeout:500});
 form.handler({preventDefault:()=>{prevented=true;}});
 return {prevented,subject,reply,source,feedbackMessages};
}
test('usuario válido genera únicamente intención de POST nativo, sin enviar nada',()=>{
 const r=listener();
 assert.equal(r.prevented,false);
 assert.equal(r.subject.value,'FLUYNOVA | Nueva consulta: Crear página web / catálogo digital');
 assert.equal(r.reply.value,'ficticio@example.invalid');
 assert.equal(r.source.value,'https://fluynova.example/webs/');
 assert.match(r.feedbackMessages[0],/todavía no acredita/);
});
test('sin consentimiento, datos inválidos y trampa de bot no se permite POST',()=>{
 for(const opts of [{consent:false},{valid:false},{honey:'bot-value'},{protocol:'http:'}]){
  const r=listener(opts);assert.equal(r.prevented,true,JSON.stringify(opts));
  assert.equal(r.subject.value,'Original');
 }
});
test('la acción alterada no puede producir un POST automático',()=>{
 const r=listener({destination:'https://otra-pagina.invalid/form'});
 assert.equal(r.prevented,true);
});
test('genera el árbol comercial desde main de forma aislada y comprueba cada ruta',async()=>{
 const working=await mkdtemp(join(tmpdir(),'fluynova-native-'));
 try{
  const out=join(working,'candidate');
  const result=await buildNativeCandidate({sourceDir:join(ROOT,'static'),outputDir:out});
  assert.ok(result.pages>=12);
  assert.ok(result.internalReferences>=100);
  assert.equal(result.missing,0);
  assert.equal(result.published,false);
  assert.match(result.contact,/delivery NOT verified/);
  const html=await readFile(join(out,'index.html'),'utf8');
  const js=await readFile(join(out,'main.js'),'utf8');
  assert.match(html,/data-native-candidate="true"/);
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  await verifyNativeCandidate(out);
  await writeFile(join(out,'index.html'),html.replace('data-native-candidate="true"','data-native-candidate="false"'));
  await assert.rejects(verifyNativeCandidate(out),/puerta de entrega/);
 }finally{await rm(working,{recursive:true,force:true});}
});
test('no acepta directorios de salida capaces de sobrescribir la fuente',async()=>{
 await assert.rejects(buildNativeCandidate({
  sourceDir:join(ROOT,'static'),outputDir:join(ROOT,'static','test')
 }),/separado/);
});
