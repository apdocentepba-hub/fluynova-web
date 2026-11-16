'use strict';
/**
 * FLUYNOVA — preflight read-only de formulario comercial, NUNCA envía consultas.
 * Ejecutar explícitamente con: node tests/contact-readiness.js --online
 * Las comprobaciones GET no demuestran activación/recepción de FormSubmit.
 */
const BASE='https://fluynova-web.onrender.com';
const ENDPOINTS=Object.freeze(['/api/health','/api/config']);
const MAX_BYTES=4096;

async function readSmallJson(response){
 const typ=response.headers?.get?.('content-type')||'';
 if(!/^application\/json\b/i.test(typ))throw new Error('NOT_JSON');
 const declared=response.headers?.get?.('content-length');
 if(declared && /^\d+$/.test(declared)&&Number(declared)>MAX_BYTES)throw new Error('TOO_LARGE');
 let data=''; let size=0;
 if(response.body&&typeof response.body.getReader==='function'){
  const reader=response.body.getReader();let exceeded=false;
  try{
   const decoder=new TextDecoder();
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>MAX_BYTES){exceeded=true;throw new Error('TOO_LARGE')}
    data+=decoder.decode(value,{stream:true});}
   data+=decoder.decode();
  }finally{if(exceeded)try{await reader.cancel()}catch{}else reader.releaseLock();}
 }else{
  data=await response.text();
  if(Buffer.byteLength(data,'utf8')>MAX_BYTES)throw new Error('TOO_LARGE');
 }
 try{return JSON.parse(data)}catch{throw new Error('INVALID_JSON')}
}

async function readEndpoint(endpoint,{fetcher=fetch,timeoutMs=8000}={}){
 if(!ENDPOINTS.includes(endpoint)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw new TypeError('Endpoint no autorizado');
 const url=BASE+endpoint;
 try{
  const res=await fetcher(url,{method:'GET',redirect:'manual',cache:'no-store',credentials:'omit',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
  if(res.url && res.url!==url || res.status>=300&&res.status<400)return {ok:false,reason:'REDIRECT'};
  if(res.status!==200)return {ok:false,reason:'HTTP_'+res.status};
  const json=await readSmallJson(res);
  if(!json||typeof json!=='object'||Array.isArray(json))return {ok:false,reason:'INVALID_SCHEMA'};
  return {ok:true,json};
 }catch(error){return {ok:false,reason:['NOT_JSON','TOO_LARGE','INVALID_JSON'].includes(error.message)?error.message:'NETWORK_OR_TIMEOUT'};}
}
async function check({fetcher=fetch}={}){
 const health=await readEndpoint('/api/health',{fetcher});
 const config=await readEndpoint('/api/config',{fetcher});
 const healthOk=health.ok&&health.json.ok===true;
 const configOk=config.ok && typeof config.json.contact_enabled==='boolean'&&config.json.contact_method==='formsubmit';
 let code;
 if(!healthOk||!configOk)code='NO_CONFIABLE';
 else if(!config.json.contact_enabled)code='FORMULARIO_DESHABILITADO';
 else code='CONFIG_HABILITADA_SIN_RECEPCION_PROBADA';
 // NUNCA return ready:true: aún debe probarse activación del proveedor y recepción del buzón.
 return Object.freeze({code,health:healthOk?'OK':health.reason||'INVALID_SCHEMA',config:configOk?'OK':config.reason||'INVALID_SCHEMA',canClaimReception:false});
}
module.exports=Object.freeze({BASE,ENDPOINTS,readSmallJson,readEndpoint,check});
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--online'){
  console.error('Solo GET públicos a pedido: node tests/contact-readiness.js --online');process.exitCode=2;
 }else check().then(r=>{console.log(JSON.stringify(r,null,2));process.exitCode=r.code==='NO_CONFIABLE'?1:0}).catch(()=>{console.error('No se completó la revisión');process.exitCode=1});
}
