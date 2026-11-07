import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {transformHtml,transformMainJs,transformGuardianJs,build,verifyOutput} from '../scripts/build-static-main-preview.mjs';

const html='<html><head><meta name="robots" content="index,follow"></head><body>'+
  '<form id="contact-form" method="POST" action="https://formsubmit.co/contacto.fluynova@gmail.com">'+
  '<input type="hidden" name="_subject" value="Test">'+
  '<label><input name="email" type="email"></label>'+
  '<button class="btn btn-primary submit-btn" type="submit">Enviar</button>'+
  '<a href="/privacidad">Privacidad</a>'+
  '</form></body></html>';
const mainJs="let contactEnabled=false;async function loadContactAvailability(){fetch('/api/config')}\n"+
  "loadContactAvailability();\nfunction feedback(){};async function deliverDirect(v){fetch('https://formsubmit.co/ajax/test')}\n"+
  "form?.addEventListener('submit',async event=>{event.preventDefault()});\n"+
  "// Compartir de forma voluntaria:\nconst x=1;";
const guardianJs="async function send(question){var reply='';\n  if(aiEnabled&&consent.checked){"+
  "fetch('/api/guardian/chat')}else reply=localReply(question);\n"+
  "  add('assistant',reply);}\n"+
  "fetch('/api/guardian/capabilities',{cache:'no-store'}).catch(()=>{});\n"+
  "if(document.body.dataset.guardianOpen==='true')open();";

test('el formulario no puede emitir un POST real aunque el visitante pulse Enter',()=>{
  const out=transformHtml(html,{home:true});
  assert.match(out,/data-preview-contact="disabled"/);
  assert.match(out,/<fieldset disabled/);
  assert.match(out,/type="submit" disabled aria-disabled="true"/);
  assert.doesNotMatch(out,/action="https:\/\/formsubmit\.co/);
  assert.match(out,/action="\/#contacto"/);
  assert.match(out,/data-preview-manual-contact="true"/);
  assert.match(out,/mailto:contacto\.fluynova@gmail\.com/);
  assert.match(out,/href="\/privacidad.html"/);
});
test('todas las páginas quedan noindex y con aviso de vista previa',()=>{
 const out=transformHtml('<html><head></head><body><p>Info</p></body></html>');
 assert.match(out,/noindex,nofollow,noarchive/);
 assert.match(out,/data-static-preview="true"/);
 assert.equal((out.match(/name="robots"/g)||[]).length,1);
});
test('un HTML upstream inesperado aborta el build antes de habilitar captación',()=>{
 assert.throws(()=>transformHtml('<html><head></head><body></body></html>',{home:true}),/Cambio no único/);
 assert.throws(()=>transformHtml('<html><body></body></html>'),/HTML inválido/);
});
test('main.js elimina el chequeo remoto y ambos caminos automáticos de envío',()=>{
 const out=transformMainJs(mainJs);
 assert.doesNotMatch(out,/\bfetch\s*\(/);
 assert.doesNotMatch(out,/formsubmit\.co/);
 assert.match(out,/contactEnabled=false/);
 assert.match(out,/event.preventDefault\(\)/);
});
test('Guardián funciona guiado y no llama a la API ni a IA generativa',()=>{
 const out=transformGuardianJs(guardianJs);
 assert.doesNotMatch(out,/\bfetch\s*\(/);
 assert.match(out,/reply=localReply\(question\)/);
 assert.doesNotMatch(out,/aiEnabled&&consent.checked/);
});
test('build real en fixture aislado, sin tocar origen y detectando 9 páginas',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fluynova-clean-'));
 const src=join(root,'source'),dest=join(root,'output');
 try{
  await mkdir(join(src,'guardian'),{recursive:true});
  await writeFile(join(src,'index.html'),html);
  await writeFile(join(src,'main.js'),mainJs);
  await writeFile(join(src,'guardian','guardian.js'),guardianJs);
  await writeFile(join(src,'privacidad.html'),'<html><head></head><body>Privacidad</body></html>');
  for(let i=0;i<7;i++){
   await mkdir(join(src,'pagina'+i));
   await writeFile(join(src,'pagina'+i,'index.html'),'<html><head></head><body><a href="/">Inicio</a></body></html>');
  }
  await writeFile(join(src,'sitemap.xml'),'<urlset></urlset>');
  const original=await readFile(join(src,'index.html'),'utf8');
  const report=await build({sourceDir:src,outputDir:dest});
  assert.equal(report.pages,9);assert.equal(report.failures,0);
  assert.equal(report.contact,'manual-only; automatic disabled');
  assert.equal(await readFile(join(src,'index.html'),'utf8'),original);
  await assert.rejects(readFile(join(dest,'sitemap.xml'),'utf8'));
  assert.match(await readFile(join(dest,'robots.txt'),'utf8'),/Disallow: \//);
  await verifyOutput(dest);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('el build no puede borrar el código fuente ni construir en un subdirectorio',async()=>{
 await assert.rejects(build({sourceDir:'/tmp/origen',outputDir:'/tmp/origen'}),/separado/);
 await assert.rejects(build({sourceDir:'/tmp/origen',outputDir:'/tmp/origen/salida'}),/separado/);
 await assert.rejects(build({sourceDir:'/tmp/origen/salida',outputDir:'/tmp/origen'}),/separado/);
});
