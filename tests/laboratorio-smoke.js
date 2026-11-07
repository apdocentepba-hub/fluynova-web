'use strict';
/**
 * FLUYNOVA — verificador de disponibilidad del recorrido comercial.
 * No monitorea en segundo plano, no despliega, no registra clientes.
 * Ejecución opt-in: node tests/laboratorio-smoke.js --online
 * Node 18+ con fetch nativo. Tráfico estrictamente restringido a cinco URLs.
 */
const TARGETS=Object.freeze([
  {label:'CRM ficticio',url:'https://fluynova-ops-lab-preview-20261104.onrender.com/demo.html',expected:'FLUYNOVA Ops'},
  {label:'Pastelería ficticia',url:'https://fluynova-demo-pasteleria.pages.dev/',expected:'Alba & Miga'},
  {label:'Distribuidora ficticia',url:'https://fluynova-demo-distribuidora.pages.dev/',expected:'Nórdica Pro'},
  {label:'Cotizador orientativo',url:'https://fluynova-cotizador-lab-20261104.onrender.com/cotizador-gestion/',expected:'FLUYNOVA'},
  {label:'Diagnóstico comercial',url:'https://fluynova-web.onrender.com/diagnostico/',expected:'FLUYNOVA'}
].map(Object.freeze));

const RETRYABLE=new Set([408,425,429,500,502,503,504]);
const MAX_BODY_BYTES=512*1024;
const MAX_TIMEOUT_MS=30000;
const normalize=s=>typeof s==='string'?s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase():'';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Exact allowlist (host AND path AND expected marker); no general purpose URL fetch. */
function targetIsSafe(target){
  if(!target||typeof target!=='object'||Array.isArray(target)||
     typeof target.url!=='string'||typeof target.expected!=='string'||typeof target.label!=='string')return false;
  if(!TARGETS.some(t=>t.url===target.url&&t.expected===target.expected&&t.label===target.label))return false;
  try{
    const u=new URL(target.url);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.port==='';
  }catch{return false;}
}

/** Real fetch responses have streams; stop BEFORE buffering oversized pages. */
async function readHtmlLimited(response,limit=MAX_BODY_BYTES){
  const lengthHeader=response.headers?.get?.('content-length');
  if(lengthHeader!==null&&lengthHeader!==undefined&&lengthHeader!==''&&/^\d+$/.test(String(lengthHeader))&&
     Number(lengthHeader)>limit)return {ok:false,reason:'HTML DEMASIADO GRANDE'};
  if(response.body&&typeof response.body.getReader==='function'){
    const reader=response.body.getReader();
    const decoder=new TextDecoder();let bytes=0,text='';let oversized=false;
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        bytes+=value.byteLength;
        if(bytes>limit){oversized=true;break;}
        text+=decoder.decode(value,{stream:true});
      }
      if(!oversized)text+=decoder.decode();
    }finally{
      if(oversized){try{await reader.cancel();}catch{}}
      else reader.releaseLock();
    }
    return oversized?{ok:false,reason:'HTML DEMASIADO GRANDE'}:{ok:true,text};
  }
  // Only for simple test doubles. The network implementation always streams.
  const text=await response.text();
  return Buffer.byteLength(text,'utf8')>limit?
    {ok:false,reason:'HTML DEMASIADO GRANDE'}:{ok:true,text};
}

async function probe(target,{fetcher=fetch,attempts=3,timeoutMs=10000,sleep=pause}={}){
  if(!targetIsSafe(target)||!Number.isInteger(attempts)||attempts<1||attempts>5||
     !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>MAX_TIMEOUT_MS||
     typeof fetcher!=='function'||typeof sleep!=='function')
    throw new TypeError('Configuración insegura del chequeo');
  const observations=[];
  for(let i=0;i<attempts;i++){
    let response;
    try{
      response=await fetcher(target.url,{
        method:'GET',headers:{Accept:'text/html'},cache:'no-store',credentials:'omit',
        redirect:'manual',signal:AbortSignal.timeout(timeoutMs)
      });
      const status=response.status;
      observations.push(status);
      const final=new URL(response.url||target.url);
      if(final.protocol!=='https:'||final.origin!==new URL(target.url).origin||
         final.pathname!==new URL(target.url).pathname||final.search||final.hash||
         (status>=300&&status<400)){
        try{await response.body?.cancel?.();}catch{}
        return {label:target.label,url:target.url,ok:false,reason:'REDIRECCIÓN INESPERADA',observations};
      }
      if(status>=200&&status<300){
        const type=response.headers?.get?.('content-type')||'';
        if(!/^text\/html\b/i.test(type))
          return {label:target.label,url:target.url,ok:false,reason:'CONTENIDO NO HTML',observations};
        const body=await readHtmlLimited(response);
        if(!body.ok)return {label:target.label,url:target.url,ok:false,reason:body.reason,observations};
        const ok=normalize(body.text).includes(normalize(target.expected));
        return {label:target.label,url:target.url,ok,
          reason:ok?'OK':'TÍTULO/CONTENIDO INESPERADO',observations};
      }
      try{await response.body?.cancel?.();}catch{}
      if(!RETRYABLE.has(status)||i===attempts-1)
        return {label:target.label,url:target.url,ok:false,reason:'HTTP '+status,observations};
    }catch(err){
      observations.push('NETWORK');
      if(i===attempts-1)
        return {label:target.label,url:target.url,ok:false,reason:'RED/TIMEOUT',observations};
    }
    await sleep(200*(i+1));
  }
}
async function checkAll({fetcher=fetch,sleep=pause}={}){
  return Promise.all(TARGETS.map(target=>probe(target,{fetcher,sleep})));
}
module.exports=Object.freeze({TARGETS,targetIsSafe,readHtmlLimited,probe,checkAll});
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
