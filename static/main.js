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

document.querySelectorAll('[data-topic]').forEach(link=>link.addEventListener('click',()=>{
 if(!form)return;
 form.elements.namedItem('category').value='Otro / no estoy seguro';
 const msg=form.elements.namedItem('message');
 if(!msg.value)msg.value='Me interesa: '+link.dataset.topic+'. Quisiera saber cómo se podría implementar. ';
}));

form?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!contactEnabled){feedback('El envío automático todavía no está activo. Escribinos directamente al correo indicado debajo.','error');return;}
 const fd=new FormData(form);
 const name=String(fd.get('name')||'').trim();
 const email=String(fd.get('email')||'').trim();
 const organization=String(fd.get('organization')||'').trim();
 const category=String(fd.get('category')||'').trim();
 const message=String(fd.get('message')||'').trim();
 const deadline=String(fd.get('deadline')||'').trim();
 const stage=String(fd.get('stage')||'').trim();
 const budget=String(fd.get('budget')||'').trim();
 const honey=String(fd.get('website')||'').trim();
 if(honey)return;
 if(!name||name.length<2||name.length>100||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||!category||message.length<15||message.length>5000||!form.elements.namedItem('consent').checked){
  feedback('Completá los campos obligatorios, un correo válido y una descripción de al menos 15 caracteres.','error');return;
 }
 sendButton.disabled=true;
 sendButton.textContent='Enviando consulta…';
 status.className='form-status';
 try{
  const response=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(CONTACT_EMAIL),{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({
    name,email,organization,category,message,plazo:deadline,etapa:stage,presupuesto:budget,
    _subject:'FLUYNOVA | Nueva consulta: '+category,
    _replyto:email,
    _template:'table',
    _honey:honey
   })
  });
  const result=await response.json();
  if(!response.ok||!(result.success===true||result.success==='true')){
   throw new Error(result.message||'No se pudo confirmar el envío.');
  }
  feedback('Consulta enviada correctamente. Te responderemos por correo.','success');
  form.reset();
 }catch(error){
  feedback('No pudimos confirmar el envío. Probá otra vez o escribinos directamente a '+CONTACT_EMAIL+'.','error');
 }finally{
  sendButton.disabled=false;
  sendButton.innerHTML='Enviar mi consulta <span aria-hidden="true">↗</span>';
 }
});