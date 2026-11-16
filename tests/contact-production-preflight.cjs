'use strict';
/**
 * Observación puntual de la web pública FLUYNOVA; no envía formularios.
 * Ejecuta únicamente GET /api/health y GET /api/config en el dominio fijo.
 * Se informa como verificación operativa, NO como prueba de entregabilidad.
 */
const {check,BASE}=require('./contact-readiness.js');
const fs=require('node:fs/promises');
const path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 const attempts=[];
 for(let index=0;index<2;index++){
  const result=await check();
  attempts.push({attempt:index+1,...result});
  if(result.code!=='NO_CONFIABLE')break;
  if(index===0)await sleep(2500); // arranque en frío del plan gratuito
 }
 const last=attempts.at(-1);
 const report={
  at_utc:new Date().toISOString(),
  target:BASE,
  scope:'READ_ONLY_GET_HEALTH_AND_CONFIG',
  requests_sent:['GET /api/health','GET /api/config'],
  submissions_sent:0,
  status:last.code,
  health:last.health,
  config:last.config,
  can_claim_formsubmit_delivery:false,
  can_claim_live_customer_leads:false,
  attempts
 };
 const out=path.resolve('qa-contact-readiness');
 await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const description={
  NO_CONFIABLE:'No se pudieron verificar los endpoints públicos.',
  FORMULARIO_DESHABILITADO:'La web responde; el envío automático está DESHABILITADO por su configuración.',
  CONFIG_HABILITADA_SIN_RECEPCION_PROBADA:'La configuración declara el envío habilitado, pero no se probó la recepción del proveedor.'
 }[last.code]||'Resultado no esperado: revisión requerida.';
 console.log('FLUYNOVA_CONTACT_READINESS_OBSERVATION '+JSON.stringify({status:report.status,health:report.health,config:report.config,attempts:attempts.length,submissions_sent:0}));
 if(process.env.GITHUB_STEP_SUMMARY){
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
   '## FLUYNOVA — observación pública (solo GET)\n\n'+
   '- Resultado: **'+report.status+'**\n'+
   '- '+description+'\n'+
   '- /api/health: '+report.health+'; /api/config: '+report.config+'\n'+
   '- Intentos: '+attempts.length+'; POST: **0**; envío de correo: **0**\n'+
   '- Una configuración habilitada **NO confirma recepción** en Gmail.\n');
 }
}
run().catch(async error=>{
 console.error('FLUYNOVA_CONTACT_READINESS_ERROR '+String(error?.message||error));
 process.exitCode=1; // error en la instrumentación, no una respuesta HTTP fallida
});
