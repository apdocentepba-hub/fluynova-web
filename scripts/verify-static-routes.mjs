/**
 * FLUYNOVA — auditoría offline de referencias del sitio estático.
 * Solo lee archivos locales: sin red, envíos, credenciales ni despliegue.
 * Uso manual: node scripts/verify-static-routes.mjs dist-commercial-static-preview
 */
import {readdir, readFile, stat} from 'node:fs/promises';
import {resolve, relative, sep, extname, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

async function collect(dir) {
  const files=[];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full=join(dir,entry.name);
    if(entry.isDirectory())files.push(...await collect(full));
    else if(entry.isFile())files.push(full);
    else throw new Error('Entrada no regular en el árbol estático: '+entry.name);
  }
  return files;
}

function parseReferences(html) {
  const result=[];
  // Los HTML comerciales usan atributos entrecomillados. No interpreta código JS.
  const attr=/\b(?:href|src|action)\s*=\s*(["'])(.*?)\1/gi;
  for(const match of html.matchAll(attr)) result.push(match[2].trim());
  return result;
}
function inside(root, absolute) {
  return absolute===root || absolute.startsWith(root+sep);
}
async function isRegularFile(path) {
  try{return (await stat(path)).isFile()}catch{return false}
}

export async function scanStaticRoutes(directory) {
  if(typeof directory!=='string'||!directory.trim())throw new TypeError('Directorio requerido');
  const base=resolve(directory);
  const paths=(await collect(base)).filter(x=>x.endsWith('.html')).sort();
  if(!paths.length)throw new Error('No se encontraron páginas HTML');
  const failures=[];
  let inspected=0,internal=0,external=0,skipped=0;
  for(const page of paths){
    const html=await readFile(page,'utf8');
    const rel=relative(base,page).replaceAll('\\','/');
    const publicPath=rel==='index.html'?'/':'/'+rel.replace(/index\.html$/,'');
    const baseUrl='https://static.fluynova.invalid'+publicPath;
    for(const raw of parseReferences(html)){
      inspected++;
      if(!raw || raw.startsWith('#') || /^(mailto:|tel:|sms:|data:|blob:)/i.test(raw)){skipped++;continue;}
      let url;
      try{url=new URL(raw,baseUrl)}catch{failures.push({page:rel,reference:raw,reason:'URL_INVALIDA'});continue;}
      if(url.protocol!=='https:'){
        failures.push({page:rel,reference:raw,reason:'ESQUEMA_NO_PERMITIDO'});
        continue;
      }
      if(url.origin!=='https://static.fluynova.invalid'){external++;continue;}
      internal++;
      let pathname;
      try{pathname=decodeURIComponent(url.pathname)}
      catch{failures.push({page:rel,reference:raw,reason:'RUTA_CODIFICADA_INVALIDA'});continue;}
      const target=pathname==='/'?'index.html':pathname.slice(1)+(pathname.endsWith('/')?'index.html':'');
      let full=resolve(base,target);
      if(!inside(base,full)){
        failures.push({page:rel,reference:raw,reason:'FUERA_DEL_DIRECTORIO'});
        continue;
      }
      let found=await isRegularFile(full);
      if(!found && !extname(full)){
        full=join(full,'index.html');
        found=inside(base,full)&&await isRegularFile(full);
      }
      if(!found)failures.push({page:rel,reference:raw,reason:'DESTINO_INEXISTENTE'});
    }
  }
  return Object.freeze({pages:paths.length,inspected,internal,external,skipped,failures});
}
export async function verifyStaticRoutes(directory){
  const result=await scanStaticRoutes(directory);
  if(result.failures.length) {
    const example=result.failures[0];
    throw new Error('Enlace estático inválido ('+result.failures.length+'): '+example.page+' -> '+example.reference+' ['+example.reason+']');
  }
  return result;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const directory=process.argv[2];
  if(!directory||process.argv.length!==3){
    console.error('Uso: node scripts/verify-static-routes.mjs dist-commercial-static-preview');
    process.exitCode=2;
  }else{
    verifyStaticRoutes(directory).then(result=>{
      console.log(JSON.stringify({ok:true,...result},null,2));
    }).catch(err=>{console.error(String(err.message));process.exitCode=1;});
  }
}
