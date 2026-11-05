'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {BASE,ENDPOINTS,readEndpoint,check}=require('./contact-readiness.js');
const json=(url,obj,status=200,extra={})=>({url,status,
 headers:{get(k){return k==='content-type'?'application/json':k==='content-length'?null:''}},
 text:async()=>JSON.stringify(obj),...extra});
const fetcher=(health,config)=>async(url,opts)=>{
 assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');assert.equal(opts.credentials,'omit');
 assert.ok(ENDPOINTS.some(p=>url===BASE+p));
 return url.endsWith('/health')?health(url):config(url);
};
test('GET salud y configuración habilitada NO prueban recepción de FormSubmit',async()=>{
 const f=fetcher(u=>json(u,{ok:true}),u=>json(u,{contact_enabled:true,contact_method:'formsubmit'}));
 const x=await check({fetcher:f});assert.equal(x.code,'CONFIG_HABILITADA_SIN_RECEPCION_PROBADA');assert.equal(x.canClaimReception,false);
});
test('configuración deshabilitada no se presenta como formulario listo',async()=>{
 const f=fetcher(u=>json(u,{ok:true}),u=>json(u,{contact_enabled:false,contact_method:'formsubmit'}));
 const x=await check({fetcher:f});assert.equal(x.code,'FORMULARIO_DESHABILITADO');
});
test('HTTP 503 hace fallar revisión de disponibilidad',async()=>{
 const f=fetcher(u=>json(u,{error:'unavailable'},503),u=>json(u,{contact_enabled:true,contact_method:'formsubmit'}));
 const x=await check({fetcher:f});assert.equal(x.code,'NO_CONFIABLE');assert.equal(x.health,'HTTP_503');
});
test('no sigue redirecciones aunque sean mismo dominio',async()=>{
 const r=await readEndpoint('/api/config',{fetcher:async u=>json(u,{ok:true},302)});assert.equal(r.reason,'REDIRECT');
});
test('no acepta endpoint arbitrario',async()=>{
 await assert.rejects(readEndpoint('/api/anything',{fetcher:async()=>{throw Error('should not run')}}),TypeError);
});
test('rechaza JSON con forma incorrecta',async()=>{
 const f=fetcher(u=>json(u,{ok:true}),u=>json(u,{contact_enabled:'true',contact_method:'formsubmit'}));
 assert.equal((await check({fetcher:f})).code,'NO_CONFIABLE');
});
test('rechaza contenido no JSON',async()=>{
 const u=BASE+'/api/config';const r=await readEndpoint('/api/config',{fetcher:async()=>({url:u,status:200,
 headers:{get:()=> 'text/html'},text:async()=>'<html>no</html>'})});assert.equal(r.reason,'NOT_JSON');
});
test('rechaza un cuerpo mayor a 4KiB',async()=>{
 const u=BASE+'/api/config';const r=await readEndpoint('/api/config',{fetcher:async()=>({url:u,status:200,
 headers:{get:k=>k==='content-type'?'application/json':k==='content-length'?'999999':''},text:async()=>{throw Error('should not read')}})});
 assert.equal(r.reason,'TOO_LARGE');
});
test('rechaza respuestas de red y errores de tiempo',async()=>{
 const r=await readEndpoint('/api/config',{fetcher:async()=>{throw Error('offline')}});
 assert.equal(r.reason,'NETWORK_OR_TIMEOUT');
});
test('no confunde otras rutas HTTPS con endpoints configurados',async()=>{
 await assert.rejects(readEndpoint('https://attacker.example/'),TypeError);
});
