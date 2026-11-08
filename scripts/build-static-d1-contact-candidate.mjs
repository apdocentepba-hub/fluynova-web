/**
 * FLUYNOVA — candidato de enlace con receptor D1. Generación offline solamente.
 * El HTML del artefacto queda cerrado con fieldset disabled y la configuración
 * del cliente está vacía; no puede enviar consultas sin configuración explícita.
 * Nunca ejecuta solicitudes de red ni publica nada al construir.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildBlocked,transformHtml} from './build-static-main-preview.mjs';
import {verifyStaticRoutes} from './verify-static-routes.mjs';

const MAIL='contacto.fluynova@gmail.com';
const FORM='id="contact-form" method="POST" action="https://formsubmit.co/'+MAIL+'"';
const BLOCK="// Vista previa sin red: ni FormSubmit ni solicitudes al backend.\n"+
 "form?.addEventListener('submit',event=>{event.preventDefault();feedback('El formulario está deshabilitado. Usá el correo manual.','error');});";
const BANNER='VISTA PREVIA TÉCNICA · El formulario no envía datos. Para comunicarte, usá el correo manual.';
const NOTE='LABORATORIO FLUYNOVA · Formulario bloqueado hasta configurar y verificar D1 y Turnstile reales. El correo directo sigue disponible.';

function exact(s,from,to,tag){
 const i=s.indexOf(from);
 if(i<0||s.indexOf(from,i+from.length)>=0)throw Error('Cambio no único: '+tag);
 return s.slice(0,i)+to+s.slice(i+from.length);
}
export function makeD1Html(original) {
 let html=transformHtml(original,{home:false});
 html=exact(html,BANNER,NOTE,'banner de laboratorio');
 html=exact(html,FORM,
  'id="contact-form" method="POST" action="/#contacto" data-d1-contact="staging-disabled"',
  'form action');
 html=exact(html,'><input type="hidden" name="_subject"',
  '><fieldset disabled data-d1-gate="closed" style="border:0;padding:0;margin:0;min-width:0;opacity:.8"><input type="hidden" name="_subject"',
  'inicio fieldset');
 html=exact(html,'</form>','</fieldset></form>','cierre fieldset');
 html=exact(html,'class="btn btn-primary submit-btn" type="submit"',
  'class="btn btn-primary submit-btn" type="submit" disabled',
  'submit bloqueado');
 html=exact(html,'name="consent" required><span>Acepto el uso de mis datos para responder a esta consulta y su transmisión mediante FormSubmit como proveedor del formulario.',
  'name="consent" required><span>Acepto el uso de mis datos para responder a esta consulta, su almacenamiento de pruebas en FLUYNOVA y el control antispam de Cloudflare Turnstile.',
  'consentimiento D1');
 html=exact(html,'El formulario utiliza FormSubmit como intermediario del envío. No compartas contraseñas ni datos personales sensibles.',
  'La recepción D1 permanece deshabilitada en este laboratorio. No ingreses datos reales; para consultas usá el correo directo.',
  'nota proveedor');
 html=exact(html,'id="alternate-send" type="button" hidden',
  'id="alternate-send" type="button" hidden disabled',
  'respaldo anterior deshabilitado');
 html=exact(html,'<button class="btn btn-primary submit-btn"',
  '<div id="d1-turnstile" data-contact-captcha="not-configured" style="margin:12px 0"></div><button class="btn btn-primary submit-btn"',
  'contenedor de captcha');
 html=exact(html,'</head>',
  '  <script src="/contact-d1-staging.js" defer></script>\n</head>',
  'carga cliente');
 if(!html.includes('También podés contactarnos por correo')||
    !html.includes('mailto:'+MAIL)||!html.includes('data-d1-gate="closed"')||
    !html.includes('name="consent" required')||!html.includes('name="_honey"')||
    /action="https:\/\/formsubmit\.co/.test(html))
  throw Error('Formulario o correo directo ausentes');
 return html;
}
export function makeD1MainJs(blocked){
 const output=exact(blocked,BLOCK,
  '// Cliente D1 separado: la página queda cerrada hasta configurar entorno de staging.',
  'listener bloqueante');
 if(/\bfetch\s*\(/.test(output)||/formsubmit\.co/.test(output))
  throw Error('Código de proveedor externo heredado');
 return output;
}
export async function verifyD1Candidate(dest){
 const [html,main,client,robots]=await Promise.all([
  readFile(join(dest,'index.html'),'utf8'),
  readFile(join(dest,'main.js'),'utf8'),
  readFile(join(dest,'contact-d1-staging.js'),'utf8'),
  readFile(join(dest,'robots.txt'),'utf8')
 ]);
 const form=html.match(/<form\b[^>]*id="contact-form"[^>]*>/)?.[0]||'';
 if(!form.includes('action="/#contacto"')||
    !form.includes('data-d1-contact="staging-disabled"')||
    !html.includes('data-d1-gate="closed"')||
    !html.includes('type="submit" disabled')||
    !html.includes('También podés contactarnos por correo')||
    !html.includes('mailto:'+MAIL)||
    !html.includes('name="consent" required')||
    !html.includes('data-static-preview="true"')||
    !html.includes('name="robots" content="noindex,nofollow,noarchive"')||
    !client.includes("endpoint:''")||!client.includes("siteKey:''")||
    !client.includes('result?.stored!==true')||
    !client.includes('event.preventDefault()')||
    /\bfetch\s*\(/.test(main)||/formsubmit\.co/.test(main)||
    !/Disallow: \//.test(robots))
  throw Error('Puerta de integración D1 cerrada incorrectamente');
 const refs=await verifyStaticRoutes(dest);
 if(refs.failures.length)throw Error('Enlaces rotos en candidato D1');
 return {pages:refs.pages,internalLinks:refs.internal,errors:refs.failures.length,
  contact:'D1 staging not configured; direct email visible',published:false};
}
export async function buildD1Candidate({sourceDir,outputDir}={}){
 if(typeof sourceDir!=='string'||typeof outputDir!=='string')
  throw TypeError('Origen y destino explícitos requeridos');
 await buildBlocked({sourceDir,outputDir});
 const src=resolve(sourceDir),dest=resolve(outputDir);
 const [original,blocked,client]=await Promise.all([
  readFile(join(src,'index.html'),'utf8'),
  readFile(join(dest,'main.js'),'utf8'),
  readFile(fileURLToPath(new URL('./contact-d1-staging-client.js',import.meta.url)),'utf8')
 ]);
 await writeFile(join(dest,'index.html'),makeD1Html(original),'utf8');
 await writeFile(join(dest,'main.js'),makeD1MainJs(blocked),'utf8');
 await writeFile(join(dest,'contact-d1-staging.js'),client,'utf8');
 return verifyD1Candidate(dest);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--offline-candidate'){
  console.error('Uso: node scripts/build-static-d1-contact-candidate.mjs --offline-candidate');
  process.exitCode=2;
 }else{
  const root=fileURLToPath(new URL('../',import.meta.url));
  buildD1Candidate({sourceDir:join(root,'static'),outputDir:join(root,'dist-static-d1-staging')})
   .then(r=>console.log(JSON.stringify(r,null,2)))
   .catch(error=>{console.error(error.stack||error.message);process.exitCode=1});
 }
}
