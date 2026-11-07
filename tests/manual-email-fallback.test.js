'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..','static');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'main.js'),'utf8');
function format(v){
 const start=script.indexOf('function draftTextForEmail(v){');
 const end=script.indexOf('\nfunction clearManualDraft()',start);
 assert.ok(start>=0&&end>start);
 return vm.runInNewContext(script.slice(start,end)+'\ndraftTextForEmail(v)',{v});
}
const lead={name:'Cliente Ficticio',email:'ficticio@example.invalid',category:'Crear página web / catálogo digital',message:'Necesito un sitio ficticio para pruebas de software.',organization:'Negocio simulado',deadline:'Dentro de un mes',stage:'Es una idea',budget:'Necesito una estimación',source:'laboratorio',medium:'portfolio',campaign:'demostraciones_202611',creative:'pasteleria'};
test('un camino manual visible permanece aun si el proveedor falla',()=>{
 for(const id of ['prepare-email','manual-email-panel','manual-email-text','copy-email-text','open-email-client','manual-email-status'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/<button id="prepare-email" type="button"/);
 assert.match(html,/No se envía ni se guarda en ningún servidor/);
});
test('no es posible usar el botón de copia como submit de FormSubmit',()=>{
 assert.match(html,/<button id="copy-email-text" type="button"/);
 assert.match(html,/id="open-email-client"[^>]+href="mailto:/);
 assert.match(script,/prepareEmail\?\.addEventListener\('click'/);
});
test('texto incluye identidad, problema, necesidad y origen comercial',()=>{
 const s=format(lead);
 for(const val of [lead.name,lead.email,lead.category,lead.message,lead.organization,lead.deadline,lead.stage,lead.budget,lead.source,lead.creative])assert.ok(s.includes(val),val);
 assert.match(s,/enviaré voluntariamente/);
});
test('omite datos opcionales ausentes sin crear valores inventados',()=>{
 const s=format({...lead,organization:'',deadline:'',stage:'',budget:'',source:'',medium:'',campaign:'',creative:''});
 assert.doesNotMatch(s,/Empresa o institución:|Plazo orientativo:|Estado del proyecto:|Origen de la consulta:/);
});
test('no usa HTML dinámico ni envía información del visitante al preparar',()=>{
 const start=script.indexOf('// Respaldo manual:');
 const end=script.indexOf('// Respaldo sin AJAX:',start);
 const s=script.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(s,/fetch\s*\(|\.submit\s*\(|sendBeacon|localStorage|sessionStorage|document\.cookie|innerHTML\s*=/);
 assert.match(s,/manualEmailText\.value=content/);
});
test('los mensajes largos no incluyen body en mailto para evitar truncamiento',()=>{
 assert.match(script,/encoded\.length<=1700/);
 assert.match(script,/canPrefill\?'&body='\+encoded:''/);
 assert.match(script,/Copiá todo el texto|copiá todo el texto/i);
});
test('cada cambio del formulario invalida un borrador ya preparado',()=>{
 assert.match(script,/addEventListener\('input',clearManualDraft\)/);
 assert.match(script,/addEventListener\('change',clearManualDraft\)/);
 assert.match(script,/addEventListener\('reset',clearManualDraft\)/);
});
test('conserva validación y consentimiento, sin habilitar envíos cuando config falla',()=>{
 assert.match(script,/const error=leadValidationError\(v\)/);
 assert.match(html,/name="consent" required/);
 assert.match(html,/FormSubmit/);
 assert.match(script,/if\(!contactEnabled\)/);
});
