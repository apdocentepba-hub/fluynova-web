const menuButton=document.querySelector('.mobile-menu');
const menu=document.querySelector('.menu');
menuButton?.addEventListener('click',()=>{const open=menu.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú')});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}));
document.getElementById('year').textContent=new Date().getFullYear();
const form=document.getElementById('contact-form'),status=document.getElementById('form-status');
const topicLinks=document.querySelectorAll('[data-topic]');
topicLinks.forEach(link=>link.addEventListener('click',()=>{const category=form.elements.namedItem('category');category.value='Otro / no estoy seguro';const msg=form.elements.namedItem('message');if(!msg.value)msg.value='Me interesa: '+link.dataset.topic+'. Quisiera saber cómo se podría implementar. ';}));
function feedback(msg,kind){status.textContent=msg;status.className='form-status '+kind;}
form?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const fd=new FormData(form);
  const name=String(fd.get('name')||'').trim();
  const email=String(fd.get('email')||'').trim();
  const organization=String(fd.get('organization')||'').trim();
  const category=String(fd.get('category')||'').trim();
  const message=String(fd.get('message')||'').trim();
  const website=String(fd.get('website')||'');
  if(!name||!email||!category||message.length<15||!form.elements.namedItem('consent').checked){
    feedback('Completá los campos obligatorios y describí tu idea con al menos 15 caracteres.','error');return;
  }
  const btn=form.querySelector('button[type=submit]');
  btn.disabled=true;btn.textContent='Enviando consulta…';status.className='form-status';
  try{
    const response=await fetch('/api/contact',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,email,organization,category,message,website,consent:true})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||'No pudimos guardar la consulta.');
    feedback('¡Listo! Tu consulta fue recibida. Te responderemos al correo indicado.','success');form.reset();
  }catch(error){feedback(error.message||'No pudimos enviar la consulta. Intentá nuevamente.','error');}
  finally{btn.disabled=false;btn.innerHTML='Enviar mi consulta <span aria-hidden="true">↗</span>';}
});