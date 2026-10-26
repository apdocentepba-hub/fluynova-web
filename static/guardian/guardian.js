/* Guardián v0.1: asistente guiado con memoria de conversación solo en esta pestaña.
 * Nunca persiste mensajes, no solicita claves, no envía información sin permiso.
 * Modo modelo generativo opcional, solo con consentimiento y backend habilitado.
 */
(function(){
'use strict';
if(document.getElementById('fg-launcher'))return;
var ICON='✳', history=[], lastIntent='', waitingFor='', aiEnabled=false, inFlight=false;
var TOPICS=[
 {id:'planillas',score:['excel','sheets','planilla','hoja','formula','duplicado','datos','copiar','reportes','informe'],label:'Planillas',
   answer:'Si tenés planillas repetidas o desordenadas, podemos evaluar validaciones, fórmulas, reportes y automatización de tareas. Nuestro paquete inicial de planillas tiene una referencia desde $120.000 ARS, sujeto a revisar los archivos y el alcance. ¿Qué tarea repetís hoy con esas planillas?'},
 {id:'consultas',score:['cliente','consulta','pedido','mensaje','presupuesto enviado','ventas','seguimiento','responder','contactos','whatsapp'],label:'Consultas',
   answer:'Podemos diseñar un formulario y un seguimiento simple de consultas, pendientes y estados para que no pierdas pedidos. Nuestro punto de partida orientativo es desde $240.000 ARS; integrar WhatsApp automáticamente requiere una integración oficial que se cotiza y verifica aparte. ¿Hoy recibís consultas por correo, formularios o WhatsApp?'},
 {id:'sistema',score:['software','sistema','programa','aplicacion','app','desarrollo','panel','a medida','control de stock','inventario','crm'],label:'Software',
   answer:'Podemos evaluar un sistema para un proceso específico: registrar datos, buscar, controlar estados y obtener reportes. Un mini sistema interno comienza orientativamente desde $420.000 ARS, pero primero necesitamos definir qué debe hacer. ¿Qué información querés registrar y quién usaría el sistema?'},
 {id:'guardian',score:['guardian','alerta','vigilar','avisar','monitorear','monitor','problema','revision automatica','notificar','detectar','auditoria'],label:'Guardián',
   answer:'Guardián está en piloto. Este asistente te guía y prepara el contacto con Fluynova. La supervisión técnica sobre correos, sitio y servicios conectados se configura por separado; no puede vigilar cualquier cuenta ni enviar mensajes por su cuenta. ¿Qué proceso o problema te gustaría que detectara?'},
 {id:'integracion',score:['integrar','conectar','integracion','mercado pago','tiendanube','api','sincronizar','facturacion','erp'],label:'Integración',
   answer:'Antes de integrar dos plataformas revisamos si ofrecen acceso autorizado y una API adecuada. No prometemos conexiones a bancos, cobros o mensajería sin verificar permisos y costos. ¿Qué dos herramientas querés conectar?'},
 {id:'precios',score:['precio','cuanto sale','cuanto cuesta','cobran','costos','pagar','tarifa','presupuesto','valor','planes'],label:'Precios',
   answer:'Tenemos referencias iniciales en pesos argentinos: planillas desde $120.000, seguimiento de consultas desde $240.000 y mini sistema desde $420.000. Son importes orientativos: el presupuesto final depende de la complejidad y se confirma por escrito. ¿Cuál de estas tres soluciones te interesa?'},
 {id:'gratis',score:['gratis','gratuita','sin cargo','consulta gratis','primera charla'],label:'Evaluación',
   answer:'La primera evaluación orientativa es sin cargo. Nos contás qué tarea te quita tiempo y verificamos si podemos ayudarte. Un diagnóstico técnico detallado o una implementación se cotizan por separado. ¿Querés describir tu problema para preparar la consulta?'},
 {id:'tiempo',score:['cuanto tarda','cuanto tiempo','demora','plazo','entrega','urgente','cuando'],label:'Plazos',
   answer:'El plazo depende de lo que hay que construir, los datos disponibles y las pruebas necesarias. Preferimos acordarlo por escrito después de revisar el alcance, en vez de prometer una fecha sin evaluar el trabajo. ¿Qué necesitás resolver primero?'},
 {id:'privacidad',score:['privacidad','datos personales','contraseña','seguridad','informacion sensible','comparte datos','seguro'],label:'Privacidad',
   answer:'No compartas contraseñas, tarjetas, DNI ni datos sensibles por el chat. Este modo guiado opera en tu navegador y no almacena conversaciones en nuestros servidores. Un proveedor de IA externo solo se usaría si se habilita y lo autorizás expresamente. Podés leer la política de privacidad de Fluynova.'},
 {id:'contacto',score:['humano','asesor','persona','hablar con alguien','contactar','contacto','mail','email','cotizar','quiero contratar','contratar'],label:'Contacto',
   answer:'Podés enviar tu consulta en el formulario de Fluynova. Una persona revisará el pedido y responderá por correo; no prometemos un plazo específico. ¿Querés contar primero qué necesitás, o preferís abrir directamente el formulario?'},
 {id:'apd',score:['apdocente','alertasapd','docente','apd','pid','actos publicos','listado oficial'],label:'APDocente',
   answer:'AlertasAPD es un proyecto independiente para ayudar a docentes de la Provincia de Buenos Aires a organizar sus búsquedas. Su sitio es alertasapd.com.ar. Las postulaciones y la información oficial deben verificarse en ABC/DGCyE.'}
];
function normalize(text){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[!?.,;:()]/g,' ')}
function decide(text){
 var q=normalize(text),best=null,score=0;
 TOPICS.forEach(function(topic){var s=0;topic.score.forEach(function(term){
 var needle=normalize(term);if(q.includes(needle))s+=needle.indexOf(' ')>=0?5:needle.length>=7?3:2
 });if(s>score){score=s;best=topic}});
 if(best&&score>=2)return best;
 if(/^(hola|buenas|buen dia|que tal|hello)\b/.test(q))return {id:'hola',answer:'¡Hola! Soy Guardián, el asistente de Fluynova. Contame qué tarea repetitiva te complica el trabajo o elegí una opción: planillas, seguimiento de clientes, sistema interno o evaluación de precios.'};
 if(/gracias|perfecto|joya/.test(q))return {id:'gracias',answer:'¡De nada! Si querés avanzar con una solución concreta, podés contarme qué querés resolver o abrir una consulta con el equipo.'};
 if(lastIntent&&(/^(y|pero|eso|tambien|cuanto|como|cuando|cual|si|dale|ok)\b/.test(q)||q.length<22)){
  var prev=TOPICS.find(function(x){return x.id===lastIntent});
  if(prev)return prev;
 }
 return {id:'general',answer:'Puedo orientarte sobre automatizaciones, planillas, consultas, software e integraciones. Para no darte una respuesta inventada: ¿qué tarea hacés manualmente y qué te gustaría que ocurriera automáticamente?'};
}
var css=document.createElement('link');css.rel='stylesheet';css.href='/guardian/guardian.css?v=1';document.head.appendChild(css);
var root=document.createElement('div');root.id='fg-root';
root.innerHTML='<button id="fg-launcher" type="button" aria-expanded="false" aria-controls="fg-panel"><span aria-hidden="true">'+ICON+'</span><span>Hablar con Guardián</span></button>'+
'<section id="fg-panel" role="dialog" aria-label="Asistente Guardián de Fluynova" aria-modal="false" hidden>'+
'<header class="fg-head"><div class="fg-avatar" aria-hidden="true">'+ICON+'</div><div><strong>Guardián · FLUYNOVA</strong><small>Asistente guiado · Versión piloto</small></div><button type="button" class="fg-close" aria-label="Cerrar asistente">✕</button></header>'+
'<div id="fg-log" role="log" aria-live="polite" aria-relevant="additions text"></div>'+
'<div id="fg-prompts"><button type="button" data-q="¿Qué puedo automatizar?">Qué automatizar</button><button type="button" data-q="¿Cuánto cuesta?">Precios</button><button type="button" data-q="Necesito un sistema a medida">Software</button><button type="button" data-q="Quiero hablar con una persona">Contacto</button></div>'+
'<form id="fg-form"><label class="fg-sr" for="fg-question">Tu pregunta</label><input id="fg-question" maxlength="650" placeholder="Contame qué necesitás..." required autocomplete="off"><button type="submit" id="fg-send" aria-label="Enviar pregunta">➤</button></form>'+
'<label class="fg-consent" id="fg-ai-option" hidden><input type="checkbox" id="fg-ai-consent"> Autorizo enviar este chat a un proveedor externo de IA para recibir respuestas generadas.</label>'+
'<div class="fg-footer"><span>Sin cuentas ni claves sensibles.</span><a id="fg-lead" href="/?utm_source=guardian&utm_medium=asistente&utm_campaign=consulta_guiada#contacto">Pedir evaluación ↗</a></div></section>';
document.body.appendChild(root);
var launch=root.querySelector('#fg-launcher'),panel=root.querySelector('#fg-panel'),log=root.querySelector('#fg-log'),form=root.querySelector('#fg-form'),input=root.querySelector('#fg-question'),consent=root.querySelector('#fg-ai-consent'),option=root.querySelector('#fg-ai-option'),submit=root.querySelector('#fg-send');
function open(){panel.hidden=false;launch.setAttribute('aria-expanded','true');if(!log.children.length)add('assistant','Hola, soy Guardián. Te ayudo a encontrar una solución para tu negocio y a preparar una consulta. ¿Qué necesitás mejorar?');input.focus()}
function close(){panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus()}
launch.addEventListener('click',function(){panel.hidden?open():close()});
root.querySelector('.fg-close').addEventListener('click',close);
function add(role,message){
 var p=document.createElement('div');p.className='fg-message '+(role==='user'?'fg-user':'fg-assistant');p.textContent=String(message||'');log.appendChild(p);log.scrollTop=log.scrollHeight;
}
function localReply(question){
 var topic=decide(question),answer=topic.answer;
 if(topic.id!=='general'&&topic.id!=='hola'&&topic.id!=='gracias')lastIntent=topic.id;
 if(topic.id==='precios'&&lastIntent&&lastIntent!=='precios'){var p=TOPICS.find(function(x){return x.id===lastIntent});if(p&&['planillas','consultas','sistema'].includes(p.id))answer=p.answer}
 return answer;
}
function linkToContact(topic){
 var link=document.getElementById('fg-lead');
 if(!link)return;
 var tag=encodeURIComponent(String(topic||'general').slice(0,32));
 link.href='/?utm_source=guardian&utm_medium=asistente&utm_campaign=consulta_guiada&utm_content='+tag+'#contacto';
}
async function send(question){
 question=String(question||'').trim().slice(0,650);if(!question||inFlight)return;
 add('user',question);input.value='';inFlight=true;submit.disabled=true;
 try{
  var reply='';
  if(aiEnabled&&consent.checked){
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
 }finally{submit.disabled=false;inFlight=false;input.focus()}
}
form.addEventListener('submit',function(event){event.preventDefault();send(input.value)});
root.querySelectorAll('[data-q]').forEach(function(button){button.addEventListener('click',function(){if(panel.hidden)open();send(button.getAttribute('data-q'))})});
fetch('/api/guardian/capabilities',{cache:'no-store'}).then(function(response){return response.ok?response.json():null}).then(function(info){if(info&&info.external_ai_enabled===true){aiEnabled=true;option.hidden=false}}).catch(function(){/* La guía local sigue disponible */});
if(document.body.dataset.guardianOpen==='true')open();
})();