/**
 * FLUYNOVA — Worker ADMINISTRATIVO separado, candidato cerrado.
 *
 * NO importar desde el receptor público. NO hay routes, workers.dev, D1,
 * Access AUD, team domain o administrador habilitados en wrangler.jsonc.
 * La lectura D1 sólo sucede DESPUÉS de verificar criptográficamente un JWT
 * de Cloudflare Access y exigir el subject exacto autorizado.
 *
 * Ref oficial: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {readMailAdminSnapshot} from '../fluynova-public-intake-worker/mail-admin-report.mjs';
import {ADMIN_ASSETS} from './admin-assets.generated.mjs';

const PATH='/api/admin/mail-summary';
const ASSET_PATHS=Object.freeze({
 '/admin/dashboard.html':['dashboard.html','text/html; charset=utf-8'],
 '/admin/dashboard.css':['dashboard.css','text/css; charset=utf-8'],
 '/admin/dashboard.js':['dashboard.js','text/javascript; charset=utf-8']
});
const PAGE_CSP="default-src 'none'; script-src 'self'; style-src 'self'; "+
 "connect-src 'self'; img-src 'none'; font-src 'none'; object-src 'none'; "+
 "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const TEAM_RE=/^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.cloudflareaccess\.com$/;
const AUD_RE=/^[A-Za-z0-9_-]{20,128}$/;
const SUBJECT_RE=/^[A-Za-z0-9-]{16,128}$/;
const cachedJwks=new Map();

function headers(){
 return {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store, max-age=0',
  'Pragma':'no-cache',
  'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Vary':'Cf-Access-Jwt-Assertion',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Cross-Origin-Resource-Policy':'same-origin'
 };
}
function reply(status,error){
 return new Response(JSON.stringify({ok:false,error}),{status,headers:headers()});
}
function allowedConfig(env){
 return env?.ADMIN_READ_ENABLED==='true' &&
  typeof env.ACCESS_TEAM_DOMAIN==='string' &&
  TEAM_RE.test(env.ACCESS_TEAM_DOMAIN) &&
  typeof env.ACCESS_AUD==='string' && AUD_RE.test(env.ACCESS_AUD) &&
  typeof env.ADMIN_ALLOWED_SUBJECT==='string' &&
  SUBJECT_RE.test(env.ADMIN_ALLOWED_SUBJECT) &&
  typeof env.DB?.prepare==='function';
}
function keysForTeam(team){
 let keys=cachedJwks.get(team);
 if(!keys){
  keys=createRemoteJWKSet(new URL(team+'/cdn-cgi/access/certs'),{
   timeoutDuration:3000,cooldownDuration:30000,cacheMaxAge:600000
  });
  cachedJwks.set(team,keys);
 }
 return keys;
}
async function authorized(request,env){
 // Cloudflare recomienda usar el encabezado JWT, no la cookie.
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>8192||token.split('.').length!==3)return false;
 try{
  const {payload}=await jwtVerify(token,keysForTeam(env.ACCESS_TEAM_DOMAIN),{
   issuer:env.ACCESS_TEAM_DOMAIN,
   audience:env.ACCESS_AUD,
   algorithms:['RS256'],
   clockTolerance:5
  });
  // No alcanza con haber iniciado sesión en Access: control de rol propio.
  // No admitir service tokens, apps distintas ni claims sin vencimiento.
  return payload.type==='app' &&
   typeof payload.sub==='string'&&
   payload.sub===env.ADMIN_ALLOWED_SUBJECT &&
   typeof payload.exp==='number'&&
   typeof payload.iat==='number'&&
   typeof payload.nbf==='number'&&
   payload.exp>payload.iat;
 }catch{
  // No registrar JWTs, email, claim ni errores detallados en respuesta.
  return false;
 }
}
export async function fetchAdmin(request,env={}){
 const u=new URL(request.url);
 const asset=Object.hasOwn(ASSET_PATHS,u.pathname)?ASSET_PATHS[u.pathname]:null;
 if((u.pathname!==PATH&&!asset)||u.search)return reply(404,'NOT_FOUND');
 if(request.method!=='GET')return reply(405,'METHOD_NOT_ALLOWED');
 if(!allowedConfig(env))return reply(503,'ADMIN_DISABLED');
 if(!(await authorized(request,env)))return reply(403,'ACCESS_DENIED');
 // La UI y sus recursos JAMÁS se sirven antes de verificar el JWT RS256
 // y el subject autorizado. No existe un hosting estático alternativo.
 if(asset){
  const [filename,contentType]=asset;
  return new Response(ADMIN_ASSETS[filename],{
   status:200,
   headers:{
    ...headers(),
    'Content-Type':contentType,
    'Content-Security-Policy':PAGE_CSP
   }
  });
 }
 try{
  const report=await readMailAdminSnapshot(env.DB);
  // Solo totales por estado, nunca nombres, mensajes ni IDs de personas.
  const {generatedAt,counts,total,needsReview}=report;
  return new Response(JSON.stringify({
   ok:true,generatedAt,counts,total,needsReview,
   note:'accepted no implica delivered; delivered SMTP no implica lectura'
  }),{status:200,headers:headers()});
 }catch{
  return reply(503,'ADMIN_REPORT_UNAVAILABLE');
 }
}
export default {fetch:fetchAdmin};
