import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {tmpdir} from 'node:os';
import {transformHtml, transformMainJs, transformGuardianJs, build, verifyOutput} from '../scripts/build-static-commercial-preview.mjs';

const home = '<!doctype html><html><head><meta name="robots" content="index,follow"></head><body class="flx-ux-2026"><form id="contact-form" method="POST" action="https://formsubmit.co/contacto.fluynova@gmail.com"><input type="hidden" name="_template" value="table"><input type="checkbox" name="consent" required><button class="btn btn-primary submit-btn" type="submit">Enviar</button></form><a href="/privacidad">Privacidad</a></body></html>';
const main = `const CONTACT_EMAIL='contacto.fluynova@gmail.com';
let contactEnabled=false;
async function loadContactAvailability(){
 const res=await fetch('/api/config');
}
loadContactAvailability();
function leadValidationError(v){if(!v.consent)return 'Aceptá los términos';return '';}
function currentLead(){return {website:'',consent:true,category:'Automatizar tareas',email:'cliente@example.org'};}
async function deliverDirect(v){return fetch('https://formsubmit.co/ajax/'+encodeURIComponent(CONTACT_EMAIL),{method:'POST'});}
form?.addEventListener('submit',e=>{e.preventDefault();const v=currentLead();if(v.website)return;});
// Respaldo manual:
const prepareEmail=document.getElementById('prepare-email');
// Respaldo sin AJAX:
alternateSend?.addEventListener('click',()=>HTMLFormElement.prototype.submit.call(form));
// Compartir de forma voluntaria:
const done=true;`;
const guardian=`var aiEnabled=false;\nasync function send(question){\n var reply='';\n  if(aiEnabled&&consent.checked){\n  var res=await fetch('/api/guardian/chat',{method:'POST'});\n  }else reply=localReply(question);\n  add('assistant',reply);\n }\nfetch('/api/guardian/capabilities',{cache:'no-store'}).then(x=>x.json()).catch(()=>{});\nif(document.body.dataset.guardianOpen==='true')open();`;

test('every page is noindex and uses privacy .html',()=>{
 const x=transformHtml('<html><head></head><body><a href="/privacidad">Privacidad</a></body></html>');
 assert.match(x,/noindex,nofollow,noarchive/);
 assert.match(x,/href="\/privacidad.html"/);
 assert.match(x,/data-fluynova-static="true"/);
});
test('replaces existing robots directive, never leaves index,follow',()=>{
 const x=transformHtml(home,true);
 assert.equal((x.match(/name="robots"/g)||[]).length,1);
 assert.doesNotMatch(x,/content="index,follow"/);
});
test('public preview banner is visibly distinguishable on all pages',()=>{
 const x=transformHtml(home,true),y=transformHtml('<html><head></head><body>Interior</body></html>');
 for(const text of [x,y]) {
  assert.match(text,/role="note" data-fluynova-preview="true"/);
  assert.match(text,/Formulario de prueba: abre FormSubmit en otra pestaña/);
  assert.match(text,/https:\/\/fluynova-web.onrender.com\//);
  assert.equal((text.match(/data-fluynova-preview=/g)||[]).length,1);
 }
});
test('homepage provides native POST in new tab, explicit consent and replyto',()=>{
 const x=transformHtml(home,true);
 assert.match(x,/method="POST" action="https:\/\/formsubmit\.co\/contacto\.fluynova@gmail\.com"/);
 assert.match(x,/data-contact-provider="formsubmit" target="_blank"/);
 assert.match(x,/name="consent" required/);
 assert.match(x,/name="_replyto"/);
 assert.doesNotMatch(x,/id="alternate-send"/);
 assert.doesNotMatch(x,/type="submit" disabled/);
});
test('FormSubmit error regression: sends origin using _url and never suppresses Referrer',()=>{
 const h=transformHtml(home,true);
 assert.match(h,/target="_blank" rel="noopener"/);
 assert.doesNotMatch(h,/rel="[^"]*noreferrer/);
 assert.match(h,/name="_url" value="https:\/\/fluynova-comercial-estatica-preview\.onrender\.com\/"/);
 assert.match(h,/name="_replyto" value=""/);
 const js=transformMainJs(main);
 assert.match(js,/source.value=window.location.origin\+window.location.pathname/);
 assert.match(js,/window.location.protocol!=='https:'/);
 assert.doesNotMatch(js,/window.location.search|window.location.hash/);
});

function simulateNativeSubmit({protocol='https:',honeypot='',valid=true,action='https://formsubmit.co/contacto.fluynova@gmail.com',sourcePresent=true}={}){
 const code=transformMainJs(main);
 const begin=code.indexOf("form?.addEventListener('submit',event=>{");
 const finish=code.indexOf('// Respaldo manual:',begin);
 assert.ok(begin>=0&&finish>begin);
 const subject={value:'original'}, reply={value:''}, source={value:'default'};
 const input=key=>({_subject:subject,_replyto:reply,_url:sourcePresent?source:null})[key];
 let callback;
 const form={
  addEventListener:(_name,cb)=>{callback=cb},
  getAttribute:key=>key==='method'?'POST':key==='action'?action:null,
  querySelector:selector=>selector.includes('_subject')?input('_subject'):
   selector.includes('_replyto')?input('_replyto'):selector.includes('_url')?input('_url'):null,
  reportValidity:()=>{}
 };
 const alerts=[];let cancelled=false;
 runInNewContext(code.slice(begin,finish),{
  form,
  window:{location:{protocol,origin:'https://fluynova-comercial-estatica-preview.onrender.com',
   pathname:'/webs/',search:'?utm_source=test',hash:'#contacto'}},
  currentLead:()=>({website:honeypot,category:'Automatizar tareas',email:'ficticio@example.invalid'}),
  leadValidationError:()=>valid?'':'Datos inválidos',
  feedback:msg=>alerts.push(msg)
 },{timeout:500});
 assert.equal(typeof callback,'function');
 callback({preventDefault:()=>{cancelled=true}});
 return {cancelled,subject,reply,source,alerts};
}
test('POST nativo validado incluye URL sin UTM, Reply-To y asunto antes de navegar',()=>{
 const result=simulateNativeSubmit();
 assert.equal(result.cancelled,false);
 assert.equal(result.source.value,'https://fluynova-comercial-estatica-preview.onrender.com/webs/');
 assert.equal(result.reply.value,'ficticio@example.invalid');
 assert.equal(result.subject.value,'FLUYNOVA | Nueva consulta: Automatizar tareas');
});
test('el formulario aborta si no tiene _url, usa HTTP, cambia destino o contiene honeypot',()=>{
 for(const scenario of [{sourcePresent:false},{protocol:'http:'},{action:'https://evil.invalid'},
   {honeypot:'spam'},{valid:false}]){
  const r=simulateNativeSubmit(scenario);
  assert.equal(r.cancelled,true,JSON.stringify(scenario));
  assert.equal(r.subject.value,'original');
 }
});

test('invalid home changes cause a fail-closed build',()=>{
 assert.throws(()=>transformHtml('<html><head></head><body></body></html>',true),/Acción de formulario no autorizada/);
});
test('static main JS uses only validated HTML native POST, no AJAX or API readiness',()=>{
 const x=transformMainJs(main);
 assert.doesNotMatch(x,/fetch\('\/api\/config'/);
 assert.doesNotMatch(x,/https:\/\/formsubmit.co\/ajax\//);
 assert.doesNotMatch(x,/HTMLFormElement.prototype.submit.call/);
 assert.match(x,/contactEnabled=true/);
 assert.match(x,/event.preventDefault\(\)/);
 assert.match(x,/const error=leadValidationError\(v\);/);
 assert.match(x,/No preventDefault: navegación POST nativa/);
});
test('missing essential frontend code fails closed',()=>{
 assert.throws(()=>transformMainJs('let contactEnabled=false;'),/puerta de disponibilidad/);
});
test('Guardián cannot contact APIs but still offers local replies',()=>{
 const x=transformGuardianJs(guardian);
 assert.doesNotMatch(x,/\bfetch\s*\(/);
 assert.match(x,/reply=localReply\(question\)/);
});
test('Guardián unexpected upstream changes abort build',()=>{
 assert.throws(()=>transformGuardianJs('var aiEnabled=false;'),/verificación de IA/);
});
test('a standalone static build copies assets and does not change source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fluynova-static-'));
 try{
  const sourceDir=join(dir,'static'),outputDir=join(dir,'dist');
  await mkdir(join(sourceDir,'guardian'),{recursive:true});
  await writeFile(join(sourceDir,'index.html'),home);
  await writeFile(join(sourceDir,'privacidad.html'),'<html><head></head><body>Privacidad</body></html>');
  await writeFile(join(sourceDir,'main.js'),main);
  await writeFile(join(sourceDir,'guardian','guardian.js'),guardian);
  await writeFile(join(sourceDir,'styles.css'),'body{}');
  await writeFile(join(sourceDir,'sitemap.xml'),'<xml></xml>');
  const output=await build({sourceDir,outputDir});
  assert.equal(output.pages,2);
  assert.equal(output.verifiedPages,2);
  assert.equal(output.externalSubmissions,true);
  assert.equal(output.nativePost,true);
  assert.equal(output.deliveryVerified,false);
  assert.match(await readFile(join(outputDir,'robots.txt'),'utf8'),/Disallow: \//);
  await assert.rejects(readFile(join(outputDir,'sitemap.xml'),'utf8'));
  assert.equal(await readFile(join(sourceDir,'index.html'),'utf8'),home);
  assert.equal(await readFile(join(outputDir,'styles.css'),'utf8'),'body{}');
  assert.doesNotMatch(await readFile(join(outputDir,'main.js'),'utf8'),/fetch\('\/api\/config'/);
 }finally{await rm(dir,{force:true,recursive:true});}
});
test('build verification rejects tampered preview before publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fluynova-tamper-'));
 try {
  const sourceDir=join(dir,'static'), outputDir=join(dir,'dist');
  await mkdir(join(sourceDir,'guardian'),{recursive:true});
  await writeFile(join(sourceDir,'index.html'),home);
  await writeFile(join(sourceDir,'privacidad.html'),'<html><head></head><body>Privacidad</body></html>');
  await writeFile(join(sourceDir,'main.js'),main);
  await writeFile(join(sourceDir,'guardian','guardian.js'),guardian);
  await build({sourceDir,outputDir});
  const index=join(outputDir,'index.html');
  const good=await readFile(index,'utf8');
  await writeFile(index,good.replace('data-fluynova-preview="true"','data-fluynova-preview="false"'));
  await assert.rejects(verifyOutput(outputDir),/Salvaguardas HTML/);
  await writeFile(index,good.replace('name="consent" required','name="consent"'));
  await assert.rejects(verifyOutput(outputDir),/Salvaguardas de POST HTML/);
  await writeFile(index,good);
  await writeFile(join(outputDir,'guardian','guardian.js'),"fetch('/api/guardian/chat');");
  await assert.rejects(verifyOutput(outputDir),/Salvaguardas de POST HTML/);
 } finally {await rm(dir,{force:true,recursive:true});}
});
test('build refuses to overwrite source directory',async()=>{
 await assert.rejects(build({sourceDir:'/tmp/inside',outputDir:'/tmp/inside'}),/fuera/);
 await assert.rejects(build({sourceDir:'/tmp/inside',outputDir:'/tmp/inside/dist'}),/fuera/);
 await assert.rejects(build({sourceDir:'/tmp/inside/static',outputDir:'/tmp/inside'}),/fuera/);
});
