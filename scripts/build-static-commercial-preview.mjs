/**
 * Build an isolated, non-indexable static review of the commercial FLUYNOVA site.
 * Source site is never modified. No backend API or cross-origin JavaScript requests. Native POST upon explicit submit.
 * Usage: node scripts/build-static-commercial-preview.mjs
 */
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve, relative, join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyStaticRoutes} from './verify-static-routes.mjs';

function replaceOnce(source, match, replacement, label) {
  const first = source.indexOf(match);
  if (first === -1 || source.indexOf(match, first + match.length) !== -1) {
    throw new Error(`No se encontró exactamente una referencia: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + match.length);
}

export function transformHtml(html, isHome = false) {
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html) || !/<body\b/i.test(html)) {
    throw new Error('HTML inválido para vista previa');
  }
  // Every preview page must be excluded from indexing, regardless of its original policy.
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i,
      '<meta name="robots" content="noindex,nofollow,noarchive">');
  } else {
    html = html.replace(/<head\b[^>]*>/i,
      '$&\n<meta name="robots" content="noindex,nofollow,noarchive">');
  }
  // Privacy was served by a FastAPI route: static sites need its existing .html file.
  html = html.replace(/href=(['"])\/privacidad\1/g, 'href="/privacidad.html"');
  // Every public preview page clearly states its limitations. No visitor should
  // confuse this non-indexed review with a commercial contact channel.
  html = html.replace(/<body(\s[^>]*)?>/i, (_match, attrs = '') =>
    `<body${attrs || ''} data-fluynova-static="true">\n` +
    '<div role="note" data-fluynova-preview="true" style="padding:10px 14px;background:#174435;color:#fff;text-align:center;font:600 13px/1.5 system-ui,Arial,sans-serif">' +
    'VISTA PREVIA DE FLUYNOVA — Formulario de prueba: abre FormSubmit en otra pestaña. Evitá datos escolares o sensibles. ' +
    '<a style="color:#c8ffdd;text-decoration:underline" href="https://fluynova-web.onrender.com/">Abrir la web oficial</a>' +
    '</div>');
  if (isHome) {
    // FormSubmit action is explicit, exact and only sends when the visitor submits.
    const action='id="contact-form" method="POST" action="https://formsubmit.co/contacto.fluynova@gmail.com"';
    if (!html.includes(action)) throw new Error('Acción de formulario no autorizada');
    html = replaceOnce(html,
      action,
      action + ' data-contact-provider="formsubmit" target="_blank" rel="noopener noreferrer"', 'acción del formulario');
    if (!html.includes('class="btn btn-primary submit-btn" type="submit"') ||
        !html.includes('name="consent"')) throw new Error('Falta envío o consentimiento');
    html = replaceOnce(html,
      '<input type="hidden" name="_template" value="table">',
      '<input type="hidden" name="_template" value="table"><input type="hidden" name="_replyto" value="">',
      'Reply-To de contacto');
    // El botón AJAX alternativo no debe existir: es una única acción HTML nativa.
    html = html.replace(/<button id="alternate-send"[^>]*>[^<]*<\/button>/, '');
    if (html.includes('id="alternate-send"')) throw new Error('Falló retiro del botón duplicado');
    html = html.replace('</head>', '\n<!-- Vista previa: FormSubmit mediante POST HTML, sin AJAX -->\n</head>');
  }
  return html;
}

export function transformMainJs(source) {
  // Static hosting has no /api/config; use browser's native form POST, not AJAX.
  const readyStart=source.indexOf('async function loadContactAvailability(){');
  const readyEnd=source.indexOf('loadContactAvailability();',readyStart);
  if(readyStart<0||readyEnd<0)throw new Error('No se encontró puerta de disponibilidad');
  source=source.slice(0,readyStart)+
    `function loadContactAvailability(){
 if(!form||!sendButton)return;
 contactEnabled=true;
 sendButton.disabled=false;
 sendButton.textContent='Enviar mediante FormSubmit ↗';
 feedback('El formulario abre el proveedor de correo en otra pestaña. Solo su confirmación indica si se procesó el envío.','');
}
`+
    source.slice(readyEnd);

  const from=source.indexOf('async function deliverDirect(v){');
  const to=source.indexOf('// Respaldo manual:',from);
  if(from<0||to<0||to<=from)throw new Error('No se encontró el controlador AJAX');
  source=source.slice(0,from)+`// Envío nativo: el usuario decide enviar. El navegador muestra la respuesta de FormSubmit.
form?.addEventListener('submit',event=>{
 const v=currentLead();
 if(v.website){event.preventDefault();feedback('Revisá los campos del formulario.','error');return;}
 const error=leadValidationError(v);
 if(error){event.preventDefault();feedback(error,'error');form.reportValidity?.();return;}
 if(form.getAttribute('method')?.toUpperCase()!=='POST' ||
    form.getAttribute('action')!=='https://formsubmit.co/contacto.fluynova@gmail.com') {
    event.preventDefault();feedback('Destino de contacto inválido. Usá la opción por correo.','error');return;
 }
 const subject=form.querySelector('input[name="_subject"]');
 const reply=form.querySelector('input[name="_replyto"]');
 if(!subject||!reply){event.preventDefault();feedback('Faltan campos de entrega.','error');return;}
 subject.value='FLUYNOVA | Nueva consulta: '+v.category;
 reply.value=v.email;
 feedback('FormSubmit se abre en otra pestaña. Verificá su confirmación; el envío todavía no está comprobado.','');
 // No preventDefault: navegación POST nativa, sin CORS, en otra pestaña.
});
`+source.slice(to);
  const altStart=source.indexOf('// Respaldo sin AJAX:');
  const altEnd=source.indexOf('// Compartir de forma voluntaria:',altStart);
  if(altStart<0||altEnd<0)throw new Error('No se encontró el respaldo duplicado');
  source=source.slice(0,altStart)+'// No hay botón AJAX alternativo: el POST nativo es el único envío automático.\\n'+source.slice(altEnd);
  if(source.includes('https://formsubmit.co/ajax/') ||
     source.includes('HTMLFormElement.prototype.submit.call(form)') ||
     source.includes("fetch('/api/config'") ||
     !source.includes("const error=leadValidationError(v);") ||
     !source.includes("No preventDefault: navegación POST nativa")) {
    throw new Error('Quedó un envío AJAX o falta validación en navegador');
  }
  return source;
}

export function transformGuardianJs(source) {
  const start = source.indexOf("fetch('/api/guardian/capabilities'");
  const end = source.indexOf("if(document.body.dataset.guardianOpen", start);
  if (start < 0 || end < 0 || end <= start) throw new Error('No se encontró verificación de IA');
  source = source.slice(0, start) +
    `// Vista previa estática: asistente guiado local, sin conexión API ni proveedor de IA.\n` +
    source.slice(end);
  // The optional AI POST remains unreachable because aiEnabled stays false;
  // eliminate it as defense in depth rather than rely on that state alone.
  const aiStart = source.indexOf('  if(aiEnabled&&consent.checked){');
  const aiEnd = source.indexOf("  add('assistant',reply);", aiStart);
  if (aiStart < 0 || aiEnd < 0) throw new Error('No se encontró rama IA');
  source = source.slice(0, aiStart) +
    `  reply=localReply(question);\n` + source.slice(aiEnd);
  if (/\bfetch\s*\(/.test(source)) throw new Error('Quedó una solicitud remota en Guardián estático');
  return source;
}

async function walk(dir) {
  const paths=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const item=join(dir,entry.name);
    if(entry.isDirectory()) paths.push(...await walk(item));
    else if(entry.isFile()) paths.push(item);
    else throw new Error(`Entrada inesperada: ${item}`);
  }
  return paths;
}
export async function verifyOutput(dest) {
  const paths = await walk(dest);
  const pages = paths.filter(path => extname(path).toLowerCase() === '.html');
  if (!pages.length) throw new Error('Vista previa sin páginas HTML');
  for (const path of pages) {
    const html=await readFile(path,'utf8');
    if (!/<meta name="robots" content="noindex,nofollow,noarchive">/.test(html) ||
        !/data-fluynova-preview="true"/.test(html) ||
        /href=["']\/privacidad["']/.test(html) ||
        (path!==join(dest,'index.html') && /<form\b[^>]*action=["']https?:\/\//i.test(html))) {
      throw new Error('Salvaguardas HTML ausentes en '+relative(dest,path));
    }
  }
  const index=await readFile(join(dest,'index.html'),'utf8');
  const js=await readFile(join(dest,'main.js'),'utf8');
  const guardian=await readFile(join(dest,'guardian','guardian.js'),'utf8');
  const robots=await readFile(join(dest,'robots.txt'),'utf8');
  if (!/id="contact-form"[^>]*method="POST"[^>]*action="https:\/\/formsubmit\.co\/contacto\.fluynova@gmail\.com"/.test(index) ||
      !/data-contact-provider="formsubmit"[^>]*target="_blank"/.test(index) ||
      !/name="consent"[^>]*required/.test(index) ||
      !/name="_replyto"/.test(index) ||
      !js.includes("form?.addEventListener('submit',event=>") ||
      !js.includes("const error=leadValidationError(v);") ||
      !js.includes("No preventDefault: navegación POST nativa") ||
      !js.includes("contactEnabled=true;") ||
      /https:\/\/formsubmit\.co\/ajax\//.test(js) ||
      /HTMLFormElement\.prototype\.submit/.test(js) ||
      js.includes("fetch('/api/config'") ||
      /id="alternate-send"/.test(index) ||
      /fetch\s*\(/.test(guardian) || !/Disallow: \//.test(robots) ||
      paths.some(path=>path.endsWith('/sitemap.xml'))) {
    throw new Error('Salvaguardas de POST HTML faltantes');
  }
  return {verifiedPages:pages.length};
}

export async function build({sourceDir, outputDir}={}) {
  if (!sourceDir||!outputDir) throw new TypeError('Definí origen y destino');
  const src=resolve(sourceDir), dest=resolve(outputDir);
  if (src===dest || !relative(src,dest).startsWith('..') || !relative(dest,src).startsWith('..')) {
    throw new Error('El destino debe estar fuera de static/');
  }
  await rm(dest,{recursive:true,force:true});
  await mkdir(dest,{recursive:true});
  await cp(src,dest,{recursive:true,errorOnExist:false});
  let pages=0;
  for(const filename of await walk(dest)) {
    if(extname(filename).toLowerCase()==='.html') {
      const html=await readFile(filename,'utf8');
      await writeFile(filename,transformHtml(html,filename===join(dest,'index.html')),'utf8');
      pages++;
    }
  }
  const main=join(dest,'main.js');
  await writeFile(main,transformMainJs(await readFile(main,'utf8')),'utf8');
  const guardian=join(dest,'guardian','guardian.js');
  await writeFile(guardian,transformGuardianJs(await readFile(guardian,'utf8')),'utf8');
  await writeFile(join(dest,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await rm(join(dest,'sitemap.xml'),{force:true});
  const verification=await verifyOutput(dest);
  const routes=await verifyStaticRoutes(dest);
  return {pages,verifiedPages:verification.verifiedPages,verifiedInternalReferences:routes.internal,destination:dest,externalSubmissions:true,nativePost:true,deliveryVerified:false,backendRequired:false};
}

const ownFile=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(ownFile){
  const root=fileURLToPath(new URL('../',import.meta.url));
  // La vista previa NO se publica si fallan las pruebas reales de Node.
  const checks=spawnSync(process.execPath,['--test','tests/static-commercial-preview.test.mjs'],{
    cwd:root,encoding:'utf8',timeout:30000
  });
  if(checks.stdout)process.stdout.write(checks.stdout);
  if(checks.stderr)process.stderr.write(checks.stderr);
  if(checks.error || checks.status!==0){
    console.error('Pruebas del formulario no aprobadas; compilación cancelada');
    process.exitCode=1;
  }else{
    build({sourceDir:join(root,'static'),outputDir:join(root,'dist-commercial-static-preview')})
      .then(info=>console.log(JSON.stringify(info,null,2)))
      .catch(error=>{console.error(error.message);process.exitCode=1;});
  }
}
