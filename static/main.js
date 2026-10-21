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
 form.elements.namedItem('category').value='Otro / no estoy seguro';
 const msg=form.elements.namedItem('message');
 if(!msg.value)msg.value='Me interesa: '+link.dataset.topic+'. Quisiera saber cómo se podría implementar. ';
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
  consent:form.elements.namedItem('consent').checked
 };
}
function validLead(v){
 return v.name.length>=2&&v.name.length<=100
  &&/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(v.email)
  &&v.category&&v.message.length>=15&&v.message.length<=5000&&v.consent;
}
async function deliverDirect(v){
 const body={
  name:v.name,email:v.email,organization:v.organization,category:v.category,
  message:v.message,plazo:v.deadline,etapa:v.stage,presupuesto:v.budget,
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
 if(!validLead(v)){
  feedback('Completá nombre, correo válido, categoría, descripción (mínimo 15 caracteres) y consentimiento.','error');
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
 if(!validLead(currentLead()))return;
 HTMLFormElement.prototype.submit.call(form);
});
