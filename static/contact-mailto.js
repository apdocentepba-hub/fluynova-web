/* FLUYNOVA: respaldo de correo manual; no POST, cookies ni persistencia.
 * Prepara el mensaje únicamente tras una acción explícita.
 */
(() => {
 'use strict';
 const form=document.getElementById('contact-form');
 const prepare=document.getElementById('manual-mailto-prepare');
 const panel=document.getElementById('manual-mailto-panel');
 const preview=document.getElementById('manual-mailto-preview');
 const subjectNode=document.getElementById('manual-mailto-subject');
 const open=document.getElementById('manual-mailto-open');
 const copy=document.getElementById('manual-mailto-copy');
 const status=document.getElementById('manual-mailto-status');
 if(!form||!prepare||!panel||!preview||!subjectNode||!open||!copy||!status)return;
 const address='contacto.fluynova@gmail.com';
 const field=k=>form.elements.namedItem(k);
 const value=k=>String(field(k)?.value||'').trim();
 let activeSubject='';
 const clear=()=>{
  panel.hidden=true;
  preview.value='';
  activeSubject='';
  subjectNode.textContent='';
  copy.disabled=true;
  open.hidden=true;
  open.removeAttribute('href');
  status.textContent='';
 };
 const prepareDraft=()=>{
  if(value('_honey'))return {error:'No se pudo preparar esta consulta.'};
  const name=value('name');
  if(name.length<2||name.length>100)return {error:'Ingresá un nombre de 2 a 100 caracteres.',focus:'name'};
  const email=value('email');
  if(!email||email.length>180||!field('email')?.checkValidity())return {error:'Ingresá un correo electrónico válido.',focus:'email'};
  const category=value('category');
  const select=field('category');
  if(!category||!select||![...select.options].some(o=>o.value===category&&o.value!==''))
   return {error:'Elegí qué tipo de servicio necesitás.',focus:'category'};
  const message=value('message');
  if(message.length<15||message.length>5000)return {error:'Contanos tu idea con al menos 15 caracteres (máximo 5.000).',focus:'message'};
  // Este canal no usa el consentimiento para FormSubmit: el envío lo decide la persona en su correo.
  const lines=['Hola, FLUYNOVA:','','Quiero consultar por un servicio.','',
   'Nombre: '+name,
   'Correo de respuesta: '+email,
   ...(value('organization')?['Empresa / institución: '+value('organization')]:[]),
   'Servicio: '+category,
   ...(value('deadline')?['Plazo: '+value('deadline')]:[]),
   ...(value('stage')?['Estado del proyecto: '+value('stage')]:[]),
   ...(value('budget')?['Presupuesto: '+value('budget')]:[]),
   '',
   'Descripción:',
   message,
   '',
   'Espero su respuesta. Gracias.'];
  // Se agrega atribución únicamente si la persona preparó el borrador.
  // No se guarda actividad ni se consulta la red.
  const campaignValue=key=>{
   const input=value(key);
   return /^[A-Za-z0-9_.-]{1,90}$/.test(input)?input:'';
  };
  const source=campaignValue('origen_fuente');
  if(source&&source!=='web_directo'){
   const parts=['fuente='+source];
   for(const [key,label] of [['origen_canal','canal'],['origen_campania','campaña'],['origen_mensaje','pieza']]){
    const token=campaignValue(key);
    if(token)parts.push(label+'='+token);
   }
   lines.splice(lines.length-2,0,'','Origen de la consulta: '+parts.join(' / '));
  }
  const subject='FLUYNOVA | Consulta: '+category;
  const body=lines.join('\n');
  return {subject,body};
 };
 const syncMailto=()=>{
  if(panel.hidden)return;
  open.hidden=true;
  open.removeAttribute('href');
  const body=preview.value.trim();
  copy.disabled=!body;
  if(!body){
   status.textContent='Escribí un mensaje para preparar el correo.';
   return;
  }
  const mailto='mailto:'+address+'?subject='+encodeURIComponent(activeSubject)+'&body='+encodeURIComponent(preview.value);
  if(mailto.length<=1800){
   open.href=mailto;
   open.hidden=false;
   status.textContent='El mensaje se puede editar. Abrir el correo no significa enviarlo.';
  }else{
   status.textContent='El mensaje es demasiado largo para un enlace de correo. Usá Copiar borrador y pegalo en tu correo.';
  }
 };
 prepare.addEventListener('click',()=>{
  clear();
  const draft=prepareDraft();
  if(draft.error){
   status.textContent=draft.error;
   field(draft.focus)?.focus();
   return;
  }
  activeSubject=draft.subject;
  subjectNode.textContent='Asunto: '+activeSubject;
  preview.value=draft.body;
  panel.hidden=false;
  syncMailto();
 });
 preview.addEventListener('input',syncMailto);
 copy.addEventListener('click',async()=>{
  if(panel.hidden||copy.disabled||!preview.value.trim())return;
  try{
   if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
   await navigator.clipboard.writeText('Para: '+address+'\nAsunto: '+activeSubject+'\n\n'+preview.value);
   status.textContent='Borrador completo copiado. Pegalo en tu aplicación de correo y decidí si querés enviarlo.';
  }catch{
   preview.focus();
   preview.select();
   status.textContent='No se pudo copiar automáticamente. Seleccioná el texto y copialo manualmente.';
  }
 });
 form.addEventListener('input',event=>{if(event?.target!==preview)clear();});
 form.addEventListener('change',event=>{if(event?.target!==preview)clear();});
 form.addEventListener('reset',clear);
})();
