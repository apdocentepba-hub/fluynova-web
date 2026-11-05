import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {transformHtml, transformMainJs, transformGuardianJs, build} from '../scripts/build-static-commercial-preview.mjs';

const home = '<!doctype html><html><head><meta name="robots" content="index,follow"></head><body class="flx-ux-2026"><form id="contact-form" method="POST" action="https://formsubmit.co/contacto.fluynova@gmail.com"><button class="btn btn-primary submit-btn" type="submit">Enviar</button></form><a href="/privacidad">Privacidad</a></body></html>';
const main = `let contactEnabled=false;\nasync function loadContactAvailability(){\n const res=await fetch('/api/config');\n}\nloadContactAvailability();\nasync function deliverDirect(v){fetch('https://formsubmit.co/ajax/'+v.email)}\nform?.addEventListener('submit',e=>e.preventDefault());\n// Respaldo sin AJAX:\nalternateSend?.addEventListener('click',()=>HTMLFormElement.prototype.submit.call(form));\n// Compartir de forma voluntaria:\nconst done=true;`;
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
test('homepage is impossible to submit to FormSubmit with unmodified HTML',()=>{
 const x=transformHtml(home,true);
 assert.match(x,/method="POST" action="\/#contacto"/);
 assert.match(x,/type="submit" disabled/);
 assert.doesNotMatch(x,/action="https:\/\//);
});
test('invalid home changes cause a fail-closed build',()=>{
 assert.throws(()=>transformHtml('<html><head></head><body></body></html>',true),/acción externa/);
});
test('removes API readiness and remote POST code from main script',()=>{
 const x=transformMainJs(main);
 assert.doesNotMatch(x,/fetch\('\/api\/config'/);
 assert.doesNotMatch(x,/https:\/\/formsubmit.co/);
 assert.doesNotMatch(x,/HTMLFormElement.prototype.submit/);
 assert.match(x,/contactEnabled=false/);
 assert.match(x,/Envío automático pendiente/);
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
  assert.equal(output.externalSubmissions,false);
  assert.match(await readFile(join(outputDir,'robots.txt'),'utf8'),/Disallow: \//);
  assert.rejects(readFile(join(outputDir,'sitemap.xml'),'utf8'));
  assert.equal(await readFile(join(sourceDir,'index.html'),'utf8'),home);
  assert.equal(await readFile(join(outputDir,'styles.css'),'utf8'),'body{}');
  assert.doesNotMatch(await readFile(join(outputDir,'main.js'),'utf8'),/fetch\('\/api\/config'/);
 }finally{await rm(dir,{force:true,recursive:true});}
});
test('build refuses to overwrite source directory',async()=>{
 await assert.rejects(build({sourceDir:'/tmp/inside',outputDir:'/tmp/inside'}),/fuera/);
 await assert.rejects(build({sourceDir:'/tmp/inside',outputDir:'/tmp/inside/dist'}),/fuera/);
 await assert.rejects(build({sourceDir:'/tmp/inside/static',outputDir:'/tmp/inside'}),/fuera/);
});
