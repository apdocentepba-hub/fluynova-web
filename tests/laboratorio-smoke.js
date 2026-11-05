'use strict';
/**
 * FLUYNOVA - chequeo explícito de destinos de la galería, NO programado ni desplegado.
 * Node 18+. No transmite datos de visitantes ni usa cookies/credenciales.
 * Ejecución en red autorizada: node tests/laboratorio-smoke.js --online
 */
const TARGETS=Object.freeze([
  {label:'CRM ficticio',url:'https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html',expected:'FLUYNOVA Ops'},
  {label:'Pastelería ficticia',url:'https://fluynova-demo-pasteleria.pages.dev/',expected:'Alba & Miga'},
  {label:'Distribuidora ficticia',url:'https://fluynova-demo-distribuidora.pages.dev/',expected:'Nórdica Pro'},
  {label:'Cotizador orientativo',url:'https://fluynova-cotizador-lab-20261104.onrender.com/cotizador-gestion/',expected:'FLUYNOVA'},
  {label:'Diagnóstico comercial',url:'https://fluynova-web.onrender.com/diagnostico/',expected:'FLUYNOVA'}
]);
const RETRYABLE=new Set([408,425,429,500,502,503,504]);
const normalize=s=>typeof s==='string'?s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase():'';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function targetIsSafe(target){
  if(!target||typeof target.url!=='string'||typeof target.expected!=='string'||!target.expected)return false;
  const u=new URL(target.url);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
    (u.hostname.endsWith('.onrender.com')||u.hostname.endsWith('.pages.dev'));
}
async function probe(target,{fetcher=fetch,attempts=3,timeoutMs=10000,sleep=pause}={}){
  if(!targetIsSafe(target)||!Number.isInteger(attempts)||attempts<1||attempts>5||timeoutMs<1)
    throw new TypeError('Configuración insegura del chequeo');
  const observations=[];
  for(let i=0;i<attempts;i++){
    let response;
    try{
      response=await fetcher(target.url,{method:'GET',headers:{Accept:'text/html'},
        cache:'no-store',credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
      const status=response.status;
      observations.push(status);
      const final=new URL(response.url||target.url);
      if(final.protocol!=='https:'||final.host!==new URL(target.url).host){
        return {label:target.label,url:target.url,ok:false,reason:'REDIRECCIÓN INESPERADA',observations};
      }
      if(status>=200&&status<300){
        const type=response.headers?.get?.('content-type')||'';
        if(!type.toLowerCase().includes('text/html'))return {label:target.label,url:target.url,ok:false,reason:'CONTENIDO NO HTML',observations};
        const body=(await response.text()).slice(0,500000);
        return {label:target.label,url:target.url,ok:normalize(body).includes(normalize(target.expected)),
          reason:normalize(body).includes(normalize(target.expected))?'OK':'TÍTULO/CONTENIDO INESPERADO',observations};
      }
      if(!RETRYABLE.has(status)||i===attempts-1)
        return {label:target.label,url:target.url,ok:false,reason:'HTTP '+status,observations};
    }catch(err){
      observations.push('NETWORK');
      if(i===attempts-1)return {label:target.label,url:target.url,ok:false,reason:'RED/TIMEOUT',observations};
    }
    await sleep(200*(i+1));
  }
}
async function checkAll({fetcher=fetch,sleep=pause}={}){
  return Promise.all(TARGETS.map(target=>probe(target,{fetcher,sleep})));
}
module.exports=Object.freeze({TARGETS,targetIsSafe,probe,checkAll});
if(require.main===module){
  if(process.argv.length!==3||process.argv[2]!=='--online'){
    console.error('Chequeo de red solo a pedido: node tests/laboratorio-smoke.js --online');
    process.exitCode=2;
  }else{
    checkAll().then(results=>{
      for(const r of results)console.log(`${r.ok?'PASS':'FAIL'} | ${r.label} | ${r.observations.join(' -> ')} | ${r.reason}`);
      process.exitCode=results.every(r=>r.ok)?0:1;
    }).catch(()=>{console.error('No fue posible completar la verificación');process.exitCode=1;});
  }
}
