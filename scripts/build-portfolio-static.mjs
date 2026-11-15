/**
 * FLUYNOVA: construye un portfolio de revisión 100% estático desde /laboratorio/.
 * NO despliega, NO genera formularios, NO envía contactos.
 * Uso local: node scripts/build-portfolio-static.mjs
 */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=join(ROOT,'static','laboratorio','index.html');
const DEFAULT_OUT=join(ROOT,'dist-portfolio-static');
const OFFICIAL='https://fluynova-web.onrender.com/';
const EMAIL='contacto.fluynova@gmail.com';
const BANNER='<div role="note" data-portfolio-static="true" style="background:#234639;color:#f2fff1;text-align:center;padding:13px 18px;font:600 13px/1.5 system-ui,sans-serif">VISTA PREVIA AUTÓNOMA · Sin formularios ni envíos automáticos. Si la web principal tarda, podés escribir a <strong>'+EMAIL+'</strong>.</div>';

function assertSource(html){
 if(typeof html!=='string'||!html.startsWith('<!doctype html>'))throw Error('HTML de laboratorio inesperado');
 if((html.match(/<article class="card">/g)||[]).length!==3)throw Error('No hay exactamente 3 demos');
 if((html.match(/href="mailto:contacto\.fluynova@gmail\.com\?/g)||[]).length!==2)throw Error('Falta correo de respaldo');
 if(!html.includes('content="noindex,nofollow,noarchive"'))throw Error('Falta noindex');
 if(!html.includes("default-src 'none'"))throw Error('Falta CSP restrictiva');
 if(/<script\b|<form\b|<iframe\b|\bfetch\s*\(|XMLHttpRequest|localStorage/.test(html))throw Error('Código activo o captura no auditada');
 for(const url of [
  'https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html',
  'https://fluynova-demo-pasteleria.pages.dev/',
  'https://fluynova-demo-distribuidora.pages.dev/'
 ]) if(!html.includes('href="'+url+'"'))throw Error('Demo faltante: '+url);
}
export function transformPortfolio(html){
 assertSource(html);
 let localLinks=0;
 // Absolutizar SOLO enlaces locales del sitio principal. Los anclajes # quedan internos.
 html=html.replace(/\bhref="\/(?!\/)([^"]*)"/g,(_match,path)=>{
  localLinks++;
  return 'href="'+OFFICIAL+path+'"';
 });
 if(localLinks<4)throw Error('La estructura de navegación difiere de la esperada');
 if(/\bhref="\/(?!\/)/.test(html))throw Error('Quedaron enlaces absolutos de raíz sin destino');
 if(!html.includes('<body>'))throw Error('Falta body');
 html=html.replace('<body>','<body>\n'+BANNER);
 const notice='FLUYNOVA · Demostraciones y prototipos propios, no resultados de clientes reales.';
 if(!html.includes(notice))throw Error('Falta aviso de demos ficticias');
 html=html.replace(notice,notice+' Contacto manual: '+EMAIL+'.');
 if((html.match(/href="mailto:contacto\.fluynova@gmail\.com\?/g)||[]).length!==2)throw Error('Cambió correo directo');
 return {html,localLinks};
}
export async function buildPortfolio(outputDir=DEFAULT_OUT){
 const output=resolve(outputDir);
 if(output===ROOT||ROOT.startsWith(output+'/')||output.startsWith(join(ROOT,'static')+'/'))
  throw Error('La salida no puede sobrescribir el repositorio fuente');
 const source=await readFile(SOURCE,'utf8');
 const result=transformPortfolio(source);
 await mkdir(output,{recursive:true});
 // wx: rechaza sobrescrituras accidentales. Borrar artefactos de prueba es tarea manual.
 await writeFile(join(output,'index.html'),result.html,{encoding:'utf8',flag:'wx'});
 return {file:join(output,'index.html'),localLinks:result.localLinks,bytes:Buffer.byteLength(result.html)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==2){
  console.error('Uso: node scripts/build-portfolio-static.mjs');
  process.exitCode=2;
 }else{
  buildPortfolio().then(x=>console.log(JSON.stringify(x)))
   .catch(e=>{console.error('NO SE CREÓ PORTFOLIO: '+e.message);process.exitCode=1});
 }
}
