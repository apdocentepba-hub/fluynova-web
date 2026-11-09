/**
 * FLUYNOVA — paquete portable SOLO PARA REVISIÓN, sin publicación.
 * No incluye configuración de producción, datos de clientes, JWT ni D1.
 * Los archivos aislados deben servirse únicamente detrás del Worker admin
 * autenticado: copiar el ZIP a Pages o a un hosting público SERÍA INSEGURO.
 */
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedModule} from './generate-admin-assets.mjs';
const root=new URL('../',import.meta.url);
const dist=new URL('../review-dist/',import.meta.url);
const files=['dashboard.html','dashboard.css','dashboard.js'];
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex')}
export async function buildReviewPackage(){
 const current=await readFile(new URL('../admin-assets.generated.mjs',import.meta.url),'utf8');
 if(current!==await expectedModule())throw Error('ADMIN_ASSETS_OUT_OF_SYNC');
 const cfg=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 if(cfg?.vars?.ADMIN_READ_ENABLED!=='false' ||
    cfg?.workers_dev!==false || cfg?.preview_urls!==false ||
    cfg?.routes || cfg?.route || cfg?.assets || cfg?.d1_databases)
   throw Error('ADMIN_PUBLICATION_GATES_NOT_CLOSED');
 await rm(dist,{recursive:true,force:true});
 await mkdir(dist,{recursive:true});
 const hashes={};
 for(const name of files){
  const buffer=await readFile(new URL(name,root));
  hashes[name]=sha256(buffer);
  await writeFile(new URL(name,dist),buffer);
 }
 const instructions=[
  'FLUYNOVA — PAQUETE DE REVISIÓN DEL PANEL ADMINISTRATIVO',
  'NO PUBLICAR / NO SUBIR A PAGES / NO SIRVE PARA PRODUCCIÓN.',
  '',
  'Los archivos HTML/CSS/JS son solo una vista candidata.',
  'El panel correcto debe servirse exclusivamente desde el Worker',
  'administrativo que verifica JWT Cloudflare Access RS256 y subject.',
  'Este ZIP no incluye ni crea login, dominio, credenciales o D1 real.',
  'Si se abre dashboard.html localmente, la API no estará disponible.',
  'No agregar estadísticas reales ni compartir archivos con datos privados.',
  '',
  'Revisar manifest.json: SHA-256 de cada uno de los tres archivos.',
  'La compilación y los tests corren en GitHub sin publicar cambios.',
  ''
 ].join('\n');
 await writeFile(new URL('LEER_ANTES_DE_ABRIR.txt',dist),instructions,'utf8');
 const manifest={
  project:'FLUYNOVA',
  artifact:'admin-dashboard-review-only',
  schemaVersion:1,
  releaseStatus:'NEVER_DEPLOY_FROM_THIS_ZIP',
  realData:false,
  authenticatedHostingIncluded:false,
  networkServicesConfigured:false,
  files:hashes
 };
 await writeFile(new URL('manifest.json',dist),JSON.stringify(manifest,null,2)+'\n','utf8');
 return Object.freeze({destination:fileURLToPath(dist),manifest});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const x=await buildReviewPackage();
 console.log('ADMIN_REVIEW_PACKAGE_READY: files=5, sha256=true, only_local=true, deploy=false');
 console.log(x.destination);
}
