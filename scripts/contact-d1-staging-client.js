/* FLUYNOVA: cliente de pruebas D1. Solo se copia al artefacto opt-in,
 * nunca a la web oficial ni al build estático por defecto.
 * Un operador debe revisar/configurar manualmente endpoint y siteKey.
 */
'use strict';
(() => {
  const cfg=Object.freeze({endpoint:'',siteKey:''});
  const form=document.getElementById('contact-form');
  const fieldset=form?.querySelector('fieldset[data-d1-gate="closed"]');
  const send=form?.querySelector('button[type="submit"]');
  const status=document.getElementById('form-status');
  const captcha=document.getElementById('d1-turnstile');
  const notice=(message,kind='error')=>{
    if(status){status.className='form-status '+kind;status.textContent=message;}
  };
  let endpoint=null;
  try{endpoint=new URL(cfg.endpoint)}catch{}
  const ready=endpoint?.protocol==='https:' && endpoint.pathname==='/api/contact' &&
    endpoint.username==='' && endpoint.password==='' && endpoint.search==='' && endpoint.hash==='' &&
    (endpoint.hostname.endsWith('.workers.dev')||endpoint.hostname==='contact.fluynova.com.ar') &&
    cfg.siteKey.length>=15 && cfg.siteKey!=='UNCONFIGURED' &&
    window.location.protocol==='https:';
  if(!ready||!form||!fieldset||!send||!captcha){
    notice('El formulario de prueba no está habilitado. Escribinos al correo visible.');
    return;
  }
  let token='',widget=null,pending=false;
  // Reutilizar la MISMA clave cuando una respuesta se pierde tras guardar D1.
  // Al editar datos de la consulta, se inicia una intención nueva.
  let requestId='',draftSignature='';
  const messages={
    CAPTCHA_FAILED:'El CAPTCHA no se pudo verificar. Intentá de nuevo.',
    TOO_MANY_REQUESTS:'Demasiadas consultas. Escribinos al correo.',
    CONTACT_UNAVAILABLE:'Recepción en mantenimiento. Usá el correo.',
    PERSISTENCE_UNAVAILABLE:'No quedó guardada la consulta. Escribinos al correo.',
    CAPTCHA_TEMPORARILY_UNAVAILABLE:'CAPTCHA no disponible. Usá el correo.',
    IDEMPOTENCY_CONFLICT:'La consulta cambió durante el reintento. Revisá los datos y volvé a verificar el CAPTCHA.',
    INVALID_REQUEST_ID:'No pudimos identificar el envío. Probá nuevamente o usá el correo.'
  };
  const script=document.createElement('script');
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;
  script.onload=()=>{
    if(!window.turnstile?.render){notice('No cargó el CAPTCHA. Escribinos al correo.');return;}
    try{
      widget=window.turnstile.render(captcha,{
        sitekey:cfg.siteKey,action:'contact',
        callback:value=>{token=String(value||'');send.disabled=pending||!token;},
        'expired-callback':()=>{token='';send.disabled=true;notice('La verificación venció. Completá el CAPTCHA nuevamente.');},
        'timeout-callback':()=>{token='';send.disabled=true;notice('Se agotó el tiempo del CAPTCHA. Intentá otra vez.');},
        'error-callback':()=>{token='';send.disabled=true;notice('CAPTCHA no disponible. Usá el correo.');},
        'unsupported-callback':()=>{token='';send.disabled=true;notice('Tu navegador no admite el CAPTCHA. Escribinos al correo.');}
      });
      fieldset.disabled=false;
      fieldset.style.opacity='1';
      send.disabled=true;
    }catch{notice('No se pudo iniciar el CAPTCHA. Usá el correo.');}
  };
  script.onerror=()=>notice('No se pudo cargar el CAPTCHA. Escribinos al correo.');
  document.head.appendChild(script);

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(pending)return; // Un envío en progreso no debe dispararse ni reescribir el estado.
    if(!ready||!token||!form.checkValidity()){
      form.reportValidity?.();
      notice('Completá los datos y verificá el CAPTCHA.');
      return;
    }
    const fd=new FormData(form),get=key=>String(fd.get(key)||'').trim();
    if(get('_honey')||!form.elements.namedItem('consent')?.checked){
      notice('Revisá los datos y aceptá el tratamiento de información.');
      return;
    }
    const body={
      name:get('name'),email:get('email'),organization:get('organization'),
      category:get('category'),message:get('message'),
      deadline:get('deadline'),stage:get('stage'),budget:get('budget'),
      website:get('_honey'),consent:true,
      origen_fuente:get('origen_fuente'),origen_canal:get('origen_canal'),
      origen_campania:get('origen_campania'),origen_mensaje:get('origen_mensaje'),
      turnstile_token:token
    };
    const stable=JSON.stringify({...body,turnstile_token:undefined});
    if(!requestId||draftSignature!==stable){
      if(typeof window.crypto?.randomUUID!=='function'){
        notice('Tu navegador no puede preparar un envío seguro. Usá el correo visible.');
        return;
      }
      requestId=window.crypto.randomUUID();
      draftSignature=stable;
    }
    body.request_id=requestId;
    pending=true;send.disabled=true;
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),12000);
    try{
      const response=await fetch(endpoint.href,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),signal:abort.signal,credentials:'omit',cache:'no-store'
      });
      let result;try{result=await response.json()}catch{result={};}
      const accepted=response.status===201||
        (response.status===200&&result?.duplicate===true);
      if(!accepted||result?.ok!==true||result?.stored!==true||
         result?.delivery!=='database'||!/^[a-f0-9-]{36}$/i.test(String(result.id||'')))
        throw Object.assign(new Error('NOT_SAVED'),{code:result?.error||'NOT_SAVED'});
      notice('Consulta guardada con código '+result.id+'. Esto no confirma entrega por correo.','success');
      form.reset();
      requestId='';draftSignature='';
    }catch(error){
      notice(messages[error?.code]||'No pudimos guardar tu consulta. Escribinos al correo.');
    }finally{
      clearTimeout(timeout);pending=false;token='';send.disabled=true;
      if(widget!==null&&window.turnstile?.reset)window.turnstile.reset(widget);
    }
  });
})();
