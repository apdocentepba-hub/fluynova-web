/* FLUYNOVA · consulta estática, sin red ni almacenamiento. Solo genera un borrador. */
(() => {
 "use strict";
 const form=document.getElementById("consulta");
 const result=document.getElementById("resultado");
 const text=document.getElementById("resumen");
 const link=document.getElementById("abrir-correo");
 const copy=document.getElementById("copiar");
 const status=document.getElementById("estado");
 const valid=/^[A-Za-z0-9_.-]{1,90}$/;
 const allowed=["utm_source","utm_medium","utm_campaign","utm_content"];
 const email="contacto.fluynova@gmail.com";
 form.querySelector('button[type="submit"]').disabled=false;
 const params=new URLSearchParams(window.location.search);
 const tracking=allowed.map(k=>[k,params.get(k)]).filter(([,value])=>value&&valid.test(value));
 const source=tracking.find(([k])=>k==="utm_content")?.[1];
 if(["pasteleria","distribuidora"].includes(source))form.elements.servicio.value="Una página web o catálogo";
 else if(source==="crm")form.elements.servicio.value="Gestión de presupuestos y pedidos";
 const clean=v=>String(v||"").replace(/\s+/g," ").trim();
 let currentSubject="FLUYNOVA | Consulta";
 const syncMailto=()=>{
  const message=text.value;
  const url="mailto:"+email+"?subject="+encodeURIComponent(currentSubject)+"&body="+encodeURIComponent(message);
  if(url.length<=1800 && message.trim()){
   link.href=url;
   link.hidden=false;
   status.textContent="Borrador listo para abrir en tu correo. Todavía no se envió nada.";
  }else{
   link.hidden=true;
   status.textContent="El texto es demasiado largo para abrirlo en el correo. Copialo y envialo manualmente a "+email+".";
  }
 };
 text.addEventListener("input",syncMailto);
 form.addEventListener("submit",(event)=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const data=new FormData(form);
  const service=clean(data.get("servicio"));
  const problem=clean(data.get("problema"));
  if(problem.length<15){form.elements.problema.setCustomValidity("Contanos tu problema con al menos 15 caracteres.");form.reportValidity();return;}
  form.elements.problema.setCustomValidity("");
  const industry=clean(data.get("rubro"))||"No informado";
  const reply=clean(data.get("email"))||"No informado";
  const subject="FLUYNOVA | Consulta: "+service;
  const body=[
    "Hola, FLUYNOVA:",
    "",
    "Quisiera consultar por una primera evaluación orientativa.",
    "Tipo de proyecto: "+service,
    "Rubro: "+industry,
    "Problema: "+problem,
    "Correo para respuesta: "+reply,
    ...(tracking.length?["","Origen de la consulta:",...tracking.map(([key,value])=>key+": "+value)]:[]),
    "",
    "No adjunto información sensible.",
    "Gracias."
  ].join("\n");
  text.value=body;
  currentSubject=subject;
  syncMailto();
  result.hidden=false;
  result.scrollIntoView({behavior:"smooth",block:"start"});
 });
 form.elements.problema.addEventListener("input",()=>form.elements.problema.setCustomValidity(""));
 copy.addEventListener("click",async()=>{
  text.focus();text.select();
  try{
   if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text.value);
   else if(!document.execCommand("copy"))throw Error("no copy");
   status.textContent="Texto copiado. Pegalo en tu correo y enviá a "+email+".";
  }catch{status.textContent="Seleccioná el texto y copialo manualmente (Ctrl+C).";}
 });
})();
