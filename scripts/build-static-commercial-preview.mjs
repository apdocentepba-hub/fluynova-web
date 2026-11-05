/**
 * Build an isolated, non-indexable static review of the commercial FLUYNOVA site.
 * Source site is never modified. No network, no mail, no API, no dependencies.
 * Usage: node scripts/build-static-commercial-preview.mjs
 */
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve, relative, join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

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
    'VISTA PREVIA DE FLUYNOVA — El envío automático está desactivado. ' +
    '<a style="color:#c8ffdd;text-decoration:underline" href="https://fluynova-web.onrender.com/">Abrir la web oficial</a>' +
    '</div>');
  if (isHome) {
    html = replaceOnce(html,
      'id="contact-form" method="POST" action="https://formsubmit.co/contacto.fluynova@gmail.com"',
      'id="contact-form" method="POST" action="/#contacto"', 'acción externa del formulario');
    html = replaceOnce(html,
      'class="btn btn-primary submit-btn" type="submit"',
      'class="btn btn-primary submit-btn" type="submit" disabled', 'botón de envío');
    html = html.replace('</head>', '\n<!-- Revisión estática: sin envío directo ni API -->\n</head>');
  }
  return html;
}

export function transformMainJs(source) {
  // Replace the API-dependent readiness function entirely; no GET is attempted.
  const readyStart=source.indexOf('async function loadContactAvailability(){');
  const readyEnd=source.indexOf('loadContactAvailability();',readyStart);
  if(readyStart<0||readyEnd<0||readyEnd<=readyStart) throw new Error('No se encontró puerta de disponibilidad');
  source=source.slice(0,readyStart)+
    `function loadContactAvailability(){\n if(!form||!sendButton)return;\n contactEnabled=false;\n sendButton.disabled=true;\n sendButton.textContent='Envío automático pendiente de verificación';\n feedback('Esta vista permite preparar una consulta por correo. No realiza envíos automáticos ni almacena tus datos.','error');\n}\n`+
    source.slice(readyEnd);
  const start = source.indexOf('async function deliverDirect(v){');
  const end = source.indexOf("form?.addEventListener('submit'", start);
  if (start < 0 || end < 0 || end <= start) throw new Error('No se encontró función de envío');
  source = source.slice(0, start) +
    `async function deliverDirect(){throw new Error('Vista estática: envío automático inhabilitado');}\n` +
    source.slice(end);
  // Remove the direct HTML fallback, including prototype.submit(), which bypasses submit listeners.
  const altStart = source.indexOf('// Respaldo sin AJAX:');
  const altEnd = source.indexOf('// Compartir de forma voluntaria:', altStart);
  if (altStart < 0 || altEnd < 0 || altEnd <= altStart) {
    throw new Error('No se encontró respaldo HTML directo');
  }
  source = source.slice(0, altStart) +
    `// El respaldo HTML a FormSubmit está desactivado en este catálogo estático.\n` +
    source.slice(altEnd);
  if (source.includes('https://formsubmit.co/') || source.includes('HTMLFormElement.prototype.submit')) {
    throw new Error('Quedó un envío externo en el JavaScript estático');
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
        /<form\b[^>]*action=["']https?:\/\//i.test(html)) {
      throw new Error('Salvaguardas HTML ausentes en '+relative(dest,path));
    }
  }
  const index=await readFile(join(dest,'index.html'),'utf8');
  const js=await readFile(join(dest,'main.js'),'utf8');
  const guardian=await readFile(join(dest,'guardian','guardian.js'),'utf8');
  const robots=await readFile(join(dest,'robots.txt'),'utf8');
  if (!/id="contact-form"[^>]*action="\/#contacto"/.test(index) ||
      !/type="submit" disabled/.test(index) ||
      /https:\/\/formsubmit\.co\//.test(js) || /HTMLFormElement\.prototype\.submit/.test(js) ||
      /fetch\s*\(/.test(guardian) || !/Disallow: \//.test(robots) ||
      paths.some(path=>path.endsWith('/sitemap.xml'))) {
    throw new Error('Salvaguardas del catálogo estático ausentes');
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
  return {pages,verifiedPages:verification.verifiedPages,destination:dest,externalSubmissions:false,backendRequired:false};
}

const ownFile=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(ownFile){
  const root=fileURLToPath(new URL('../',import.meta.url));
  build({sourceDir:join(root,'static'),outputDir:join(root,'dist-commercial-static-preview')})
    .then(info=>console.log(JSON.stringify(info,null,2)))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
