/**
 * FLUYNOVA - candidato estático limpio desde main.
 * CONSTRUCCIÓN LOCAL / CI SOLAMENTE. NO DESPLIEGA, NO ENVÍA FORMULARIOS.
 * Emite una vista noindex con formulario inutilizable y enlace mailto manual.
 */
import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {resolve, join, relative, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyStaticRoutes} from './verify-static-routes.mjs';

const MAIL='contacto.fluynova@gmail.com';
const FORM_ACTION='id="contact-form" method="POST" action="https://formsubmit.co/'+MAIL+'"';
const BUILD_NOTE='VISTA PREVIA TÉCNICA · El formulario no envía datos. Para comunicarte, usá el correo manual.';
const BANNER='<div role="note" data-static-preview="true" style="padding:12px;background:#204133;color:white;text-align:center;font:600 13px/1.5 system-ui,sans-serif">'+
  BUILD_NOTE+' <a style="color:#e5ffd4;text-decoration:underline" href="mailto:'+MAIL+'">Escribir correo</a></div>';

function one(src,oldValue,newValue,where){
  const at=src.indexOf(oldValue);
  if(at<0||src.indexOf(oldValue,at+oldValue.length)>=0)throw Error('Cambio no único: '+where);
  return src.slice(0,at)+newValue+src.slice(at+oldValue.length);
}
function within(a,b){return a===b||b.startsWith(a+sep);}
async function walk(root){
  const output=[];
  for(const ent of await readdir(root,{withFileTypes:true})){
    const file=join(root,ent.name);
    if(ent.isDirectory())output.push(...await walk(file));
    else if(ent.isFile())output.push(file);
    else throw Error('Elemento no regular en static: '+relative(root,file));
  }
  return output;
}
export function transformHtml(html,{home=false}={}){
  if(!/<html\b/i.test(html)||!/<head\b/i.test(html)||!/<body\b/i.test(html))throw Error('HTML inválido');
  const re=/<meta\s+name=["']robots["'][^>]*>/gi;
  const candidates=[...html.matchAll(re)];
  if(candidates.length>1)throw Error('robots duplicados en HTML');
  const tag='<meta name="robots" content="noindex,nofollow,noarchive">';
  html=candidates.length?html.replace(re,tag):html.replace(/<head\b[^>]*>/i,'$&\n'+tag);
  html=html.replace(/href=(["'])\/privacidad\1/g,'href="/privacidad.html"');
  html=html.replace(/<body\b([^>]*)>/i,(_m,a)=>'<body'+a+'>\n'+BANNER);
  if(!home)return html;

  const disabledAction='id="contact-form" method="POST" action="/#contacto"';
  html=one(html,FORM_ACTION,disabledAction+' data-preview-contact="disabled"','form action');
  // Con el fieldset deshabilitado tampoco se envían campos mediante Enter sin JavaScript.
  html=one(html,'>'+ '<input type="hidden" name="_subject"',
    '><fieldset disabled style="border:0;padding:0;margin:0;min-width:0;opacity:.75">'+
    '<input type="hidden" name="_subject"','form start');
  const formEnd='</form>';
  html=one(html,formEnd,'</fieldset></form>\n'+
    '<p data-preview-manual-contact="true" style="text-align:center;padding:12px">'+
    'La recepción automática está deshabilitada en esta vista técnica. '+
    '<a href="mailto:'+MAIL+'?subject=FLUYNOVA%20%7C%20Consulta">Escribir a FLUYNOVA por correo</a></p>','form end');
  html=one(html,'class="btn btn-primary submit-btn" type="submit"',
    'class="btn btn-primary submit-btn" type="submit" disabled aria-disabled="true"','submit button');
  if(!html.includes('data-preview-contact="disabled"')||!html.includes('data-preview-manual-contact="true"'))throw Error('Vista de contacto no cerrada');
  return html;
}
export function transformMainJs(script){
  const begin=script.indexOf('async function loadContactAvailability(){');
  const end=script.indexOf('loadContactAvailability();',begin);
  if(begin<0||end<0)throw Error('Puerta de configuración distinta de main');
  script=script.slice(0,begin)+
    "function loadContactAvailability(){\n"+
    " if(!form||!sendButton)return;\n"+
    " contactEnabled=false;\n"+
    " sendButton.disabled=true;\n"+
    " sendButton.textContent='Formulario deshabilitado en vista previa';\n"+
    " feedback('Para consultas usá el enlace de correo manual. No se envían datos desde este ensayo.','error');\n"+
    "}\n"+script.slice(end);
  const sendStart=script.indexOf('async function deliverDirect(v){');
  const sendEnd=script.indexOf('// Compartir de forma voluntaria:',sendStart);
  if(sendStart<0||sendEnd<0||sendStart>=sendEnd)throw Error('Ruta de envío distinta de main');
  script=script.slice(0,sendStart)+
    "// Vista previa sin red: ni FormSubmit ni solicitudes al backend.\n"+
    "form?.addEventListener('submit',event=>{event.preventDefault();feedback('El formulario está deshabilitado. Usá el correo manual.','error');});\n"+
    script.slice(sendEnd);
  if(/\bfetch\s*\(/.test(script)||/HTMLFormElement\.prototype\.submit/.test(script)||
     /formsubmit\.co/.test(script))throw Error('Solicitud remota conservada en main.js');
  return script;
}
export function transformGuardianJs(script){
  const aiStart=script.indexOf('  if(aiEnabled&&consent.checked){');
  const aiEnd=script.indexOf("  add('assistant',reply);",aiStart);
  if(aiStart<0||aiEnd<0)throw Error('Cambio inesperado en IA de Guardián');
  script=script.slice(0,aiStart)+"  reply=localReply(question);\n"+script.slice(aiEnd);
  const fetchStart=script.indexOf("fetch('/api/guardian/capabilities'");
  const fetchEnd=script.indexOf("if(document.body.dataset.guardianOpen",fetchStart);
  if(fetchStart<0||fetchEnd<0)throw Error('Cambio inesperado en capacidades de Guardián');
  script=script.slice(0,fetchStart)+'// Vista estática: solo guía local; no se consulta API.\n'+script.slice(fetchEnd);
  if(/\bfetch\s*\(/.test(script))throw Error('Guardián todavía hace solicitudes remotas');
  return script;
}
export async function verifyOutput(dest){
  const paths=await walk(dest);
  const htmlPaths=paths.filter(p=>extname(p)==='.html');
  const root=await readFile(join(dest,'index.html'),'utf8');
  const js=await readFile(join(dest,'main.js'),'utf8');
  const guardian=await readFile(join(dest,'guardian','guardian.js'),'utf8');
  const robots=await readFile(join(dest,'robots.txt'),'utf8');
  if(htmlPaths.length<9||!root.includes('data-preview-contact="disabled"')||
     !root.includes('<fieldset disabled')||!root.includes('data-preview-manual-contact="true"')||
     !root.includes('type="submit" disabled aria-disabled="true"')||
     /action=["']https:\/\/formsubmit\.co/i.test(root)||
     !root.includes('action="/#contacto"')||!root.includes('mailto:'+MAIL)||
     !js.includes('contactEnabled=false;')||
     /\bfetch\s*\(/.test(js)||/\bfetch\s*\(/.test(guardian)||
     !/Disallow: \//.test(robots)||paths.some(p=>p.endsWith('/sitemap.xml'))){
    throw Error('Falló validación de aislamiento estático');
  }
  for(const p of htmlPaths){
    const h=await readFile(p,'utf8');
    if(!h.includes('<meta name="robots" content="noindex,nofollow,noarchive">')||
       !h.includes('data-static-preview="true"')||
       /href=["']\/privacidad["']/.test(h)){
      throw Error('Página sin protecciones: '+relative(dest,p));
    }
  }
  const refs=await verifyStaticRoutes(dest);
  return Object.freeze({pages:htmlPaths.length,internalLinks:refs.internal,externalReferences:refs.external,failures:refs.failures.length,contact:'manual-only; automatic disabled',guardian:'offline guided'});
}
export async function build({sourceDir,outputDir}={}){
  if(typeof sourceDir!=='string'||typeof outputDir!=='string')throw TypeError('Origen y destino requeridos');
  const src=resolve(sourceDir),dest=resolve(outputDir);
  if(within(src,dest)||within(dest,src))throw Error('El directorio de salida debe estar separado del origen');
  await rm(dest,{recursive:true,force:true});
  await mkdir(dest,{recursive:true});
  await cp(src,dest,{recursive:true});
  for(const p of await walk(dest)){
    if(extname(p)==='.html'){
      const text=await readFile(p,'utf8');
      await writeFile(p,transformHtml(text,{home:p===join(dest,'index.html')}),'utf8');
    }
  }
  for(const [path,fn] of [['main.js',transformMainJs],['guardian/guardian.js',transformGuardianJs]]){
    const full=join(dest,path);await writeFile(full,fn(await readFile(full,'utf8')),'utf8');
  }
  await rm(join(dest,'sitemap.xml'),{force:true});
  await writeFile(join(dest,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  return verifyOutput(dest);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){console.error('Uso: node scripts/build-static-main-preview.mjs');process.exitCode=2}
  else{
    const root=fileURLToPath(new URL('../',import.meta.url));
    build({sourceDir:join(root,'static'),outputDir:join(root,'dist-static-main-preview')})
    .then(r=>console.log(JSON.stringify({status:'PASS',...r},null,2)))
    .catch(e=>{console.error('BUILD FAILED: '+e.message);process.exitCode=1});
  }
}
