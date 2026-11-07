/**
 * FLUYNOVA — formulario nativo FormSubmit para evaluación OFFLINE.
 * Genera artefacto NOINDEX en carpeta local: NUNCA publica ni envía consultas.
 * A diferencia del build por defecto (bloqueado), este artefacto PUEDE enviar
 * si alguien lo aloja y pulsa Enviar. NO DEPLOY hasta prueba de Gmail y aprobación.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildBlocked,transformHtml} from './build-static-main-preview.mjs';
import {verifyStaticRoutes} from './verify-static-routes.mjs';

const DESTINATION='https://formsubmit.co/contacto.fluynova@gmail.com';
const MAIL='contacto.fluynova@gmail.com';
const BANNER_OLD='VISTA PREVIA TÉCNICA · El formulario no envía datos. Para comunicarte, usá el correo manual.';
const BANNER_NEW='VISTA DE PRUEBA INTERNA · El botón Enviar transmite datos reales a FormSubmit. No uses datos de clientes ni información sensible.';
const ORIGINAL_ACTION='id="contact-form" method="POST" action="'+DESTINATION+'"';
const CANDIDATE_ACTION=ORIGINAL_ACTION+' data-native-candidate="true" target="_blank" rel="noopener noreferrer"';
const SCRIPTS_BLOCKED="// Vista previa sin red: ni FormSubmit ni solicitudes al backend.\n"+
  "form?.addEventListener('submit',event=>{event.preventDefault();feedback('El formulario está deshabilitado. Usá el correo manual.','error');});";
const SCRIPTS_NATIVE=[
"// Candidato estático: un único POST nativo solo por interacción humana.",
"form?.addEventListener('submit',event=>{",
" if(!contactEnabled){",
"  event.preventDefault();",
"  feedback('El formulario aún no está disponible. Usá el correo manual.','error');",
"  return;",
" }",
" const v=currentLead();",
" const invalid=leadValidationError(v);",
" const subject=form.elements.namedItem('_subject');",
" const reply=form.elements.namedItem('_replyto');",
" const source=form.elements.namedItem('_url');",
" if(v.website||invalid||!form.checkValidity()||",
"    form.getAttribute('action')!=='https://formsubmit.co/contacto.fluynova@gmail.com'||",
"    form.getAttribute('method')?.toUpperCase()!=='POST'||",
"    !subject||!reply||!source||!form.elements.namedItem('consent')?.checked||",
"    window.location.protocol!=='https:'){",
"  event.preventDefault();",
"  feedback(invalid||'No se pudo validar el formulario. Revisá los datos.','error');",
"  form.reportValidity?.();",
"  return;",
" }",
" subject.value='FLUYNOVA | Nueva consulta: '+v.category;",
" reply.value=v.email;",
" source.value=window.location.origin+window.location.pathname;",
" // Se abre una pestaña del proveedor. Solo su confirmación y Gmail prueban entrega.",
" feedback('Se abrirá FormSubmit. Revisá su confirmación; esto todavía no acredita la llegada a Gmail.','');",
"});",
].join('\n');

function replaceExactly(text,needle,replacement,tag){
 const start=text.indexOf(needle);
 if(start<0||text.indexOf(needle,start+needle.length)>=0)
  throw new Error('Cambio ausente o duplicado: '+tag);
 return text.slice(0,start)+replacement+text.slice(start+needle.length);
}
export function makeNativeHtml(originalHtml){
 let out=transformHtml(originalHtml,{home:false});
 out=replaceExactly(out,BANNER_OLD,BANNER_NEW,'banner de entorno interno');
 out=replaceExactly(out,ORIGINAL_ACTION,CANDIDATE_ACTION,'acción única POST');
 out=replaceExactly(out,'<input type="hidden" name="_template" value="table">',
   '<input type="hidden" name="_template" value="table"><input type="hidden" name="_replyto" value=""><input type="hidden" name="_url" value="">','Reply-To y URL de origen');
 const oldNote='El formulario utiliza FormSubmit como intermediario del envío. No compartas contraseñas ni datos personales sensibles.';
 if(out.includes(oldNote))
  out=replaceExactly(out,oldNote,
   'El envío se realiza desde el navegador con FormSubmit. Comprobá la respuesta del proveedor; no compartas claves ni datos sensibles.','mensaje de proveedor');
 if(!out.includes('name="_honey"')||!out.includes('name="consent" required')||
    !out.includes('class="btn btn-primary submit-btn" type="submit"')||
    out.includes('<fieldset disabled')||out.includes('data-preview-contact="disabled"'))
  throw new Error('Faltan condiciones de formulario o se heredó bloqueo');
 return out;
}
export function makeNativeJs(blockedJs){
 let out=replaceExactly(blockedJs,
  " contactEnabled=false;\n sendButton.disabled=true;\n sendButton.textContent='Formulario deshabilitado en vista previa';\n feedback('Para consultas usá el enlace de correo manual. No se envían datos desde este ensayo.','error');",
  " contactEnabled=true;\n sendButton.disabled=false;\n sendButton.textContent='Enviar mediante FormSubmit ↗';\n feedback('Este es un candidato de pruebas: enviar abre FormSubmit. No hay entrega verificada.','');",
  'disponibilidad');
 out=replaceExactly(out,SCRIPTS_BLOCKED,SCRIPTS_NATIVE,'submit nativo único');
 if(/\bfetch\s*\(/.test(out)||/HTMLFormElement\.prototype\.submit/.test(out)||
    /formsubmit\.co\/ajax\//.test(out))throw new Error('Quedó una vía AJAX o remota no prevista');
 return out;
}
export async function verifyNativeCandidate(dest){
 const [html,script,guardian,robots]=await Promise.all([
  readFile(join(dest,'index.html'),'utf8'),
  readFile(join(dest,'main.js'),'utf8'),
  readFile(join(dest,'guardian','guardian.js'),'utf8'),
  readFile(join(dest,'robots.txt'),'utf8'),
 ]);
 const count=(regex,text)=>[...text.matchAll(regex)].length;
 if(count(/data-native-candidate="true"/g,html)!==1||
    count(/action="https:\/\/formsubmit\.co\/contacto\.fluynova@gmail\.com"/g,html)!==1||
    !html.includes('method="POST"')||!html.includes('name="_replyto"')||
    !html.includes('name="_url" value=""')||
    !html.includes('name="_honey"')||!html.includes('name="consent" required')||
    !html.includes('name="_template" value="table"')||
    !html.includes('data-static-preview="true"')||!html.includes(BANNER_NEW)||
    !html.includes('name="robots" content="noindex,nofollow,noarchive"')||
    html.includes('<fieldset disabled')||html.includes('type="submit" disabled')||
    !html.includes('target="_blank" rel="noopener noreferrer"')||
    !html.includes('mailto:'+MAIL)||
    !script.includes("form?.addEventListener('submit',event=>")||
    !script.includes("const invalid=leadValidationError(v)")||
    !script.includes("reply.value=v.email;")||
    !script.includes("source.value=window.location.origin+window.location.pathname;")||
    !script.includes("contactEnabled=true;")||
    /\bfetch\s*\(/.test(script)||/\bfetch\s*\(/.test(guardian)||
    !/Disallow: \//.test(robots))
  throw new Error('El artefacto no cumple la puerta de entrega estática de laboratorio');
 const links=await verifyStaticRoutes(dest);
 return Object.freeze({pages:links.pages,internalReferences:links.internal,
  externalReferences:links.external,missing:links.failures.length,
  contact:'native POST opt-in; delivery NOT verified',
  published:false});
}
export async function buildNativeCandidate({sourceDir,outputDir}={}){
 if(typeof sourceDir!=='string'||typeof outputDir!=='string')
  throw new TypeError('Origen y destino requeridos');
 // buildBlocked comprueba que no se sobrescriba el origen y conserva otras páginas.
 await buildBlocked({sourceDir,outputDir});
 const root=resolve(sourceDir),dest=resolve(outputDir);
 const html=await readFile(join(root,'index.html'),'utf8');
 const blockedJs=await readFile(join(dest,'main.js'),'utf8');
 await writeFile(join(dest,'index.html'),makeNativeHtml(html),'utf8');
 await writeFile(join(dest,'main.js'),makeNativeJs(blockedJs),'utf8');
 return verifyNativeCandidate(dest);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=='--offline-candidate'){
  console.error('Uso exclusivo de desarrollo: node scripts/build-static-native-contact.mjs --offline-candidate');
  process.exitCode=2;
 }else{
  const root=fileURLToPath(new URL('../',import.meta.url));
  buildNativeCandidate({sourceDir:join(root,'static'),outputDir:join(root,'dist-static-native-contact-candidate')})
   .then(r=>console.log(JSON.stringify(r,null,2)))
   .catch(e=>{console.error(e.message);process.exitCode=1});
 }
}
