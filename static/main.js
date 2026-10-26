const menuButton=document.querySelector('.mobile-menu');
const menu=document.querySelector('.menu');
menuButton?.addEventListener('click',()=>{
 const open=menu.classList.toggle('open');
 menuButton.setAttribute('aria-expanded',String(open));
 menuButton.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
 menu.classList.remove('open');menuButton?.setAttribute('aria-expanded','false');
}));
document.getElementById('year').textContent=new Date().getFullYear();

const CONTACT_EMAIL='martin.nicolas.podubinio@gmail.com';
const form=document.getElementById('contact-form'),status=document.getElementById('form-status');
const sendButton=form?.querySelector('button[type=submit]');
// Atribución voluntaria: solo se adjuntan parámetros UTM al mensaje si la persona envía
// el formulario con consentimiento. No se crean cookies ni se guardan datos de navegación.
const referral=new URLSearchParams(window.location.search);
function cleanCampaignParam(key,fallback=''){
 const value=String(referral.get(key)||fallback).slice(0,90);
 return /^[a-zA-Z0-9_.-]{1,90}$/.test(value)?value:fallback;
}
if(form){
 form.elements.namedItem('origen_fuente').value=cleanCampaignParam('utm_source','web_directo');
 form.elements.namedItem('origen_canal').value=cleanCampaignParam('utm_medium');
 form.elements.namedItem('origen_campania').value=cleanCampaignParam('utm_campaign');
 form.elements.namedItem('origen_mensaje').value=cleanCampaignParam('utm_content');

 // Guía a consulta comercial: solo se transfieren categorías predefinidas, no el chat.
 if(referral.get('utm_source')==='guardian'){
  const sectores={taller:'taller mecánico',peluqueria:'peluquería o centro de estética',comercio:'comercio',gastronomia:'local gastronómico',inmobiliaria:'inmobiliaria',salud:'consultorio',educacion:'institución educativa',servicios:'servicio técnico u oficio'};
  const funciones={turnos:'turnos',presupuestos:'presupuestos',stock:'stock',avisos:'avisos',cobros:'cobros',ordenes:'seguimiento de trabajos',clientes:'consultas de clientes'};
  const rubro=sectores[referral.get('guardian_sector')]||'negocio';
  const claves=String(referral.get('guardian_funciones')||'').split(',').slice(0,5);
  const interes=[...new Set(claves.map(k=>funciones[k]).filter(Boolean))];
  const proyectos={analiticos:'la gestión de solicitudes de analíticos',pases:'las solicitudes de pases escolares',equivalencias:'los dictámenes de equivalencias',solicitudes:'las solicitudes web'};
  const proyecto=proyectos[referral.get('guardian_proyecto')]||'';
  const objetivo=proyecto?'Quiero automatizar '+proyecto+'.':interes.length?'Me interesa automatizar '+interes.join(', ')+'.':'Quiero evaluar automatizaciones.';
  const texto='Hola, estuve hablando con Guardián. Mi rubro o actividad es: '+rubro+'. '+objetivo+' Me gustaría conocer una propuesta y qué información necesitan para presupuestar.';
  const input=form.elements.namedItem('message'),category=form.elements.namedItem('category');
  if(input&&!input.value)input.value=texto;
  if(category)category.value=proyecto||interes.length>1?'Desarrollar software':'Automatizar tareas';
 }
}
let contactEnabled=false;

function feedback(msg,kind){
 status.textContent=msg;
 status.className='form-status '+kind;
}

async function loadContactAvailability(){
 if(!form||!sendButton)return;
 sendButton.disabled=true;
 try {
  const res=await fetch('/api/config',{cache:'no-store'});
  if(!res.ok)throw new Error('No se pudo verificar la configuración');
  const info=await res.json();
  contactEnabled=info.contact_enabled===true&&info.contact_method==='formsubmit';
  if(!contactEnabled){
   sendButton.textContent='Formulario en preparación';
   feedback('El envío automático está pendiente de verificación. Por ahora podés escribirnos directamente al correo indicado abajo.','error');
  } else {
   sendButton.disabled=false;
   sendButton.innerHTML='Enviar mi consulta <span aria-hidden="true">↗</span>';
   status.className='form-status';
  }
 }catch(error){
  sendButton.textContent='Formulario temporalmente no disponible';
  feedback('La recepción automática no está disponible. Usá el correo de contacto que aparece debajo del formulario.','error');
 }
}
loadContactAvailability();

// Calculadora informativa: estima el esfuerzo actual, sin prometer ahorros.
const calcMinutes=document.getElementById('calc-minutes');
const calcRepeats=document.getElementById('calc-repeats');
const calcDays=document.getElementById('calc-days');
const calcHours=document.getElementById('calc-hours');
const calcContact=document.getElementById('calc-to-contact');
const formatHours=new Intl.NumberFormat('es-AR',{maximumFractionDigits:1});
function getEffortEstimate(){
 const bounds=[[calcMinutes,1,240],[calcRepeats,1,100],[calcDays,1,31]];
 if(bounds.some(([el,min,max])=>!el||!Number.isFinite(el.valueAsNumber)||el.valueAsNumber<min||el.valueAsNumber>max))return null;
 const minutes=calcMinutes.valueAsNumber;
 const repeats=calcRepeats.valueAsNumber;
 const days=calcDays.valueAsNumber;
 return {minutes,repeats,days,hours:(minutes*repeats*days)/60};
}
function renderEffortEstimate(){
 if(!calcHours)return;
 const e=getEffortEstimate();
 calcHours.textContent=e?formatHours.format(e.hours)+' horas / mes':'Ingresá valores válidos';
 if(calcContact)calcContact.disabled=!e;
}
[calcMinutes,calcRepeats,calcDays].forEach(el=>el?.addEventListener('input',renderEffortEstimate));
calcContact?.addEventListener('click',()=>{
 const e=getEffortEstimate();
 if(!e||!form)return;
 const msg=form.elements.namedItem('message');
 if(!msg)return;
 const summary='Quiero evaluar una tarea repetitiva que me lleva aproximadamente '+e.minutes+' minutos, '+e.repeats+' veces por día, '+e.days+' días al mes ('+formatHours.format(e.hours)+' horas mensuales de trabajo actual). ';
 if(!msg.value.includes('Quiero evaluar una tarea repetitiva'))msg.value=summary+msg.value;
 const category=form.elements.namedItem('category');
 if(category)category.value='Automatizar tareas';
 document.getElementById('contacto')?.scrollIntoView({behavior:'smooth',block:'start'});
 msg.focus({preventScroll:true});
});
renderEffortEstimate();

document.querySelectorAll('[data-topic]').forEach(link=>link.addEventListener('click',()=>{
 if(!form)return;
 const categories=['Automatizar tareas','Desarrollar software','Conectar herramientas / datos','Inteligencia artificial','Otro / no estoy seguro'];
 const selected=link.dataset.category;
 form.elements.namedItem('category').value=categories.includes(selected)?selected:'Otro / no estoy seguro';
 const msg=form.elements.namedItem('message');
 if(msg&&!msg.value)msg.value='Me interesa: '+link.dataset.topic+'. Quisiera saber cómo se podría implementar. ';
}));

const alternateSend=document.getElementById('alternate-send');
let pendingLead=null;
function currentLead(){
 const fd=new FormData(form);
 const str=k=>String(fd.get(k)||'').trim();
 return {
  name:str('name'),email:str('email'),organization:str('organization'),
  category:str('category'),message:str('message'),deadline:str('deadline'),
  stage:str('stage'),budget:str('budget'),website:str('_honey'),
  source:str('origen_fuente'),medium:str('origen_canal'),campaign:str('origen_campania'),creative:str('origen_mensaje'),
  consent:form.elements.namedItem('consent').checked
 };
}
// Usamos la validación nativa del navegador para type="email" en vez de
// una expresión regular duplicada, que rechazaba correos válidos.
function leadValidationError(v){
 if(v.name.length<2||v.name.length>100) return 'Ingresá un nombre de 2 a 100 caracteres.';
 const emailInput=form?.elements.namedItem('email');
 if(!v.email||v.email.length>180||!emailInput?.checkValidity()) return 'Ingresá un correo electrónico válido.';
 const categories=['Automatizar tareas','Desarrollar software','Conectar herramientas / datos','Inteligencia artificial','Otro / no estoy seguro'];
 if(!categories.includes(v.category)) return 'Elegí qué tipo de servicio necesitás.';
 if(v.message.length<15||v.message.length>5000) return 'Contanos tu idea con al menos 15 caracteres (máximo 5.000).';
 if(!v.consent) return 'Tenés que aceptar el tratamiento de los datos para enviar tu consulta.';
 return '';
}
async function deliverDirect(v){
 const body={
  name:v.name,email:v.email,organization:v.organization,category:v.category,
  message:v.message,plazo:v.deadline,etapa:v.stage,presupuesto:v.budget,
  origen_fuente:v.source,origen_canal:v.medium,origen_campania:v.campaign,origen_mensaje:v.creative,
  _subject:'FLUYNOVA | Nueva consulta: '+v.category,
  _replyto:v.email,_template:'table',_honey:v.website
 };
 const response=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(CONTACT_EMAIL),{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify(body)
 });
 let result;
 try{result=await response.json();}catch{throw new Error('El proveedor no devolvió una confirmación válida.');}
 if(!response.ok||!(result.success===true||result.success==='true')){
  throw new Error(String(result.message||'El proveedor rechazó la consulta.').slice(0,200));
 }
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!contactEnabled){
  feedback('El envío automático todavía no está activo. Usá el correo de contacto indicado debajo.','error');
  return;
 }
 const v=currentLead();
 if(v.website)return;
 const error=leadValidationError(v);
 if(error){
  feedback(error,'error');
  return;
 }
 pendingLead=null;
 if(alternateSend)alternateSend.hidden=true;
 sendButton.disabled=true;
 sendButton.textContent='Enviando consulta…';
 status.className='form-status';
 try{
  await deliverDirect(v);
  feedback('El proveedor confirmó la recepción de tu consulta. Te responderemos por correo.','success');
  form.reset();
 }catch(error){
  pendingLead=v;
  feedback('No pudimos confirmar el envío: '+(error?.message||'problema de conexión')+'. Podés intentar el método tradicional o escribir directamente al correo indicado abajo.','error');
  if(alternateSend)alternateSend.hidden=false;
 }finally{
  sendButton.disabled=false;
  sendButton.innerHTML='Enviar mi consulta <span aria-hidden="true">↗</span>';
 }
});
// Respaldo sin AJAX: un POST HTML normal a FormSubmit, con confirmación de su página.
alternateSend?.addEventListener('click',()=>{
 if(!pendingLead||!form||!contactEnabled)return;
 const error=leadValidationError(currentLead());
 if(error){feedback(error,'error');return;}
 HTMLFormElement.prototype.submit.call(form);
});


// Compartir de forma voluntaria: no accede a contactos ni envía mensajes sin elección.
const shareFluynova=document.getElementById('share-fluynova');
shareFluynova?.addEventListener('click',()=>{
 const url='https://fluynova-web.onrender.com/guia-automatizacion/?utm_source=whatsapp&utm_medium=referral&utm_campaign=lanzamiento';
 const message='¿Tenés un negocio o conocés a alguien que pierde tiempo con planillas y tareas repetitivas? FLUYNOVA publicó una guía gratuita con ideas para automatizarlas. '+url;
 window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
});
