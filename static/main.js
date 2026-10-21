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
  contactEnabled=info.contact_enabled===true&&info.contact_method==='server_proxy';
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

function getLeadFromForm(){
 const fd=new FormData(form);
 const str=k=>String(fd.get(k)||'').trim();
 return {
  name:str('name'),email:str('email'),organization:str('organization'),
  category:str('category'),message:str('message'),deadline:str('deadline'),
  stage:str('stage'),budget:str('budget'),website:str('_honey'),
  consent:form.elements.namedItem('consent').checked
 };
}
function validateLead(v){
 return v.name.length>=2&&v.name.length<=100
  &&/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(v.email)
  &&v.category&&v.message.length>=15&&v.message.length<=5000&&v.consent;
}
async function deliverLead(v,method){
 let url,body;
 if(method==='server'){
  url='/api/lead';
  body=v;
 }else{
  url='https://formsubmit.co/ajax/'+encodeURIComponent(CONTACT_EMAIL);
  body={
   name:v.name,email:v.email,organization:v.organization,category:v.category,
   message:v.message,plazo:v.deadline,etapa:v.stage,presupuesto:v.budget,
   _subject:'FLUYNOVA | Nueva consulta: '+v.category,
   _replyto:v.email,_template:'table',_honey:v.website
  };
 }
 const response=await fetch(url,{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify(body)
 });
 let result;
 try{result=await response.json();}catch{throw new Error('El servidor no devolvió una confirmación válida.');}
 const accepted=method==='server'?(result.ok===true):(result.success===true||result.success==='true');
 if(!response.ok||!accepted){
  throw new Error(String(result.detail||result.message||'El servicio rechazó la consulta.').slice(0,200));
 }
 return true;
}
async function sendLead(v,method){
 sendButton.disabled=true;
 sendButton.textContent='Enviando consulta…';
 if(alternateSend)alternateSend.hidden=true;
 status.className='form-status';
 try{
  await deliverLead(v,method);
  pendingLead=null;
  feedback('El proveedor confirmó la recepción del formulario. Te responderemos por correo.','success');
  form.reset();
 }catch(error){
  feedback('No se pudo confirmar el envío. '+(error?.message||'Problema de conexión.')+' Si el problema continúa, escribinos al correo indicado abajo.','error');
  if(method==='direct'){
   pendingLead=v;
   if(alternateSend)alternateSend.hidden=false;
  }else{
   pendingLead=null;
  }
 }finally{
  sendButton.disabled=false;
  sendButton.innerHTML='Enviar mi consulta <span aria-hidden="true">↗</span>';
 }
}
form?.addEventListener('submit',event=>{
 event.preventDefault();
 if(!contactEnabled){
  feedback('El envío automático todavía no está activo. Usá el correo de contacto indicado debajo.','error');
  return;
 }
 const lead=getLeadFromForm();
 if(lead.website)return;
 if(!validateLead(lead)){
  feedback('Completá nombre, correo válido, categoría, descripción (mínimo 15 caracteres) y consentimiento.','error');
  return;
 }
 sendLead(lead,'direct');
});
alternateSend?.addEventListener('click',()=>{
 if(!pendingLead||!contactEnabled)return;
 sendLead(pendingLead,'server');
});
