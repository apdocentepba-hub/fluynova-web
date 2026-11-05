/* Guardián v0.1: asistente guiado con memoria de conversación solo en esta pestaña.
 * Nunca persiste mensajes, no solicita claves, no envía información sin permiso.
 * Modo modelo generativo opcional, solo con consentimiento y backend habilitado.
 */
(function(){
'use strict';
if(document.getElementById('fg-launcher'))return;
var isPreview=document.body&&document.body.dataset.guardianPreview==='true';
var ICON='✳', history=[], lastIntent='', aiEnabled=false, inFlight=false;
var engine=window.FluynovaAionGuardian||window.FluynovaGuardianBrain;
var conversation=engine?engine.create():null;
var lastResult=null;
var css=document.createElement('link');css.rel='stylesheet';css.href='/guardian/guardian.css?v=2';document.head.appendChild(css);
var root=document.createElement('div');root.id='fg-root';
root.innerHTML='<button id="fg-launcher" type="button" aria-expanded="false" aria-controls="fg-panel"><span aria-hidden="true">'+ICON+'</span><span>Hablar con Guardián</span></button>'+
'<section id="fg-panel" role="dialog" aria-label="Asistente Guardián de Fluynova" aria-modal="false" hidden>'+
'<header class="fg-head"><div class="fg-avatar" aria-hidden="true">'+ICON+'</div><div><strong>GUARDIÁN × AION · FLUYNOVA</strong><small>Diagnóstico guiado · IA opcional con consentimiento</small></div><button type="button" class="fg-close" aria-label="Cerrar asistente">✕</button></header>'+
'<div id="fg-log" role="log" aria-live="polite" aria-relevant="additions text"></div>'+
'<div id="fg-prompts"><button type="button" data-q="Analizar mi proceso">Analizar mi proceso</button><button type="button" data-q="¿Cuánto cuesta?">Precios</button><button type="button" data-q="Necesito un sistema a medida">Software</button><button type="button" data-q="Quiero hablar con una persona">Contacto</button></div>'+
'<form id="fg-form"><label class="fg-sr" for="fg-question">Tu pregunta</label><input id="fg-question" maxlength="650" placeholder="Contame qué necesitás..." required autocomplete="off"><button type="submit" id="fg-send" aria-label="Enviar pregunta">➤</button></form>'+
'<label class="fg-consent" id="fg-ai-option" hidden><input type="checkbox" id="fg-ai-consent"> Autorizo enviar este chat a un proveedor externo de IA para recibir respuestas generadas.</label>'+
'<div class="fg-footer"><span>Sin cuentas ni claves sensibles.</span><a id="fg-lead" href="/?utm_source=guardian&utm_medium=asistente&utm_campaign=consulta_guiada#contacto">Pedir evaluación ↗</a></div></section>';
document.body.appendChild(root);
if(isPreview)root.querySelector('#fg-lead').href='https://fluynova-web.onrender.com/#contacto';
var launch=root.querySelector('#fg-launcher'),panel=root.querySelector('#fg-panel'),log=root.querySelector('#fg-log'),form=root.querySelector('#fg-form'),input=root.querySelector('#fg-question'),consent=root.querySelector('#fg-ai-consent'),option=root.querySelector('#fg-ai-option'),submit=root.querySelector('#fg-send');
function open(){panel.hidden=false;launch.setAttribute('aria-expanded','true');if(!log.children.length)add('assistant','Hola, soy Guardián × AION. Te ayudo a analizar un proceso y preparar una consulta comercial. El diagnóstico guiado funciona sin enviar tus mensajes a un proveedor externo. Los mensajes permanecen temporalmente en esta pestaña hasta recargarla. ¿Qué necesitás mejorar?');input.focus()}
function close(){panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus()}
launch.addEventListener('click',function(){panel.hidden?open():close()});
root.querySelector('.fg-close').addEventListener('click',close);
function add(role,message){
 var p=document.createElement('div');p.className='fg-message '+(role==='user'?'fg-user':'fg-assistant');p.textContent=String(message||'');log.appendChild(p);log.scrollTop=log.scrollHeight;
}
function updateChoices(choices){
 var box=root.querySelector('#fg-prompts');
 if(!box||!Array.isArray(choices)||!choices.length)return;
 box.replaceChildren();
 choices.slice(0,4).forEach(function(label){
  var button=document.createElement('button');
  button.type='button';button.setAttribute('data-q',label);button.textContent=label;
  box.appendChild(button);
 });
}
function localReply(question){
 if(!engine||!conversation){return 'Este asistente no pudo cargar su guía. Podés enviarnos tu consulta desde el formulario.'}
 lastResult=engine.guided(question,conversation);
 lastIntent=lastResult.tag;
 updateChoices(lastResult.choices);
 return lastResult.reply;
}
function linkToContact(topic){
 var link=document.getElementById('fg-lead');if(!link)return;
 if(isPreview){link.href='https://fluynova-web.onrender.com/#contacto';return;}
 var tag=encodeURIComponent(String(topic||'general').slice(0,32));
 var url=(isPreview?'https://fluynova-web.onrender.com/':'/')+'?utm_source=guardian&utm_medium=asistente&utm_campaign=consulta_guiada&utm_content='+tag;
 if(conversation){
  if(conversation.sector)url+='&guardian_sector='+encodeURIComponent(conversation.sector);
  if(conversation.project)url+='&guardian_proyecto='+encodeURIComponent(conversation.project);
  if(conversation.features.length)url+='&guardian_funciones='+encodeURIComponent(conversation.features.slice(0,5).join(','));
 }
 link.href=url+'#contacto';
}
async function send(question){
 question=String(question||'').trim().slice(0,650);if(!question||inFlight)return;
 add('user',question);input.value='';inFlight=true;submit.disabled=true;
 try{
  var reply='';
  var guidedFlow=!!(conversation&&conversation.aion&&(
    (conversation.aion.stage!=='idle'&&conversation.aion.stage!=='done')||
    /analizar mi proceso/i.test(question)));
  if(guidedFlow)reply=localReply(question);
  else if(aiEnabled&&consent.checked){
   var forAi=history.slice(-6).concat([{role:'user',content:question}]);
   try{
    var res=await fetch('/api/guardian/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,messages:forAi}),signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error('Proveedor no disponible');
    var data=await res.json();reply=String(data.reply||'').slice(0,1700);
   }catch(error){reply='El modo IA no está disponible ahora. Te oriento con la guía local:\n\n'+localReply(question)}
  }else reply=localReply(question);
  add('assistant',reply);
  history.push({role:'user',content:question},{role:'assistant',content:reply});if(history.length>8)history=history.slice(-8);
  linkToContact(lastIntent);
 }catch(error){add('assistant','No pude completar la respuesta. Probá nuevamente o solicitá una evaluación comercial.');}
 finally{submit.disabled=false;inFlight=false;input.focus()}
}
form.addEventListener('submit',function(event){event.preventDefault();send(input.value)});
root.querySelector('#fg-prompts').addEventListener('click',function(event){var button=event.target.closest('[data-q]');if(!button)return;if(panel.hidden)open();send(button.getAttribute('data-q'))});
fetch('/api/guardian/capabilities',{cache:'no-store'}).then(function(response){return response.ok?response.json():null}).then(function(info){if(info&&info.external_ai_enabled===true){aiEnabled=true;option.hidden=false}}).catch(function(){/* La guía local sigue disponible */});
if(document.body.dataset.guardianOpen==='true')open();
})();