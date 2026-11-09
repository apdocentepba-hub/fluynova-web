/* FLUYNOVA - Panel candidato: solo lectura; sin JWT en JavaScript.
 * La sesión la gestiona el proxy Cloudflare Access en el MISMO ORIGEN.
 * Este recurso NO está servido ni desplegado por el Worker administrativo.
 */
const STATES=Object.freeze([
 ['pending','Pendiente','Aviso registrado; no confirma envío'],
 ['sending','En proceso','Envío iniciado; resultado pendiente'],
 ['accepted','Aceptado por proveedor','El proveedor aceptó el aviso; no implica entrega'],
 ['delivered','Entregado por SMTP','No implica lectura ni entrada en la bandeja'],
 ['bounced','Rechazado','El servidor de destino rechazó el correo'],
 ['uncertain','Revisión necesaria','Resultado ambiguo; no reenviar automáticamente']
]);
const KEYS=STATES.map(([key])=>key);
const status=document.getElementById('status');
const results=document.getElementById('results');
const refresh=document.getElementById('refresh');
const rows=document.getElementById('rows');
const format=new Intl.NumberFormat('es-AR');
let requestSerial=0,controller=null;

function validCount(value){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0}
function validResponse(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.ok!==true||
  typeof data.generatedAt!=='string'||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data.generatedAt)||
  !Number.isFinite(Date.parse(data.generatedAt))||
  !data.counts||typeof data.counts!=='object'||Array.isArray(data.counts)||
  Object.keys(data.counts).length!==KEYS.length||
  Object.keys(data.counts).some(key=>!KEYS.includes(key))||
  KEYS.some(key=>!validCount(data.counts[key]))||
  !validCount(data.total)||!validCount(data.needsReview))return false;
 const total=KEYS.reduce((sum,key)=>sum+data.counts[key],0);
 return Number.isSafeInteger(total)&&total===data.total&&
  data.needsReview===data.counts.uncertain+data.counts.bounced;
}
function displayStatus(message,kind='info'){
 status.textContent=message;
 status.dataset.kind=kind;
}
function resetDisplay(){
 results.hidden=true;
 rows.replaceChildren();
 for(const id of ['total','review','delivered'])document.getElementById(id).textContent='—';
 document.getElementById('generated').replaceChildren();
}
function show(data){
 document.getElementById('total').textContent=format.format(data.total);
 document.getElementById('review').textContent=format.format(data.needsReview);
 document.getElementById('delivered').textContent=format.format(data.counts.delivered);
 const fragment=document.createDocumentFragment();
 for(const [key,label,detail] of STATES){
  const tr=document.createElement('tr');
  const th=document.createElement('th');
  th.scope='row';th.textContent=label;
  const amount=document.createElement('td');amount.className='num';
  amount.textContent=format.format(data.counts[key]);
  const barCell=document.createElement('td');
  const bar=document.createElement('div');bar.className='meter';
  const span=document.createElement('span');
  span.style.width=(data.total?Math.round(data.counts[key]*100/data.total):0)+'%';
  bar.append(span);barCell.append(bar);
  const explanation=document.createElement('td');
  const small=document.createElement('small');small.textContent=detail;
  explanation.append(small);
  tr.append(th,amount,barCell,explanation);fragment.append(tr);
 }
 rows.replaceChildren(fragment);
 const time=document.getElementById('generated');
 time.dateTime=data.generatedAt;time.textContent=data.generatedAt;
 results.hidden=false;
}

async function load(){
 const serial=++requestSerial;
 if(controller)controller.abort();
 controller=new AbortController();
 const signal=controller.signal;
 refresh.disabled=true;
 resetDisplay();displayStatus('Verificando acceso y consultando el estado…');
 try{
  // Solo mismo origen: sin tokens en JS, URLs externas ni contraseñas.
  const response=await fetch('/api/admin/mail-summary',{
   method:'GET',credentials:'same-origin',cache:'no-store',
   redirect:'error',headers:{'Accept':'application/json'},signal
  });
  if(serial!==requestSerial)return;
  if(response.status===401||response.status===403){
   displayStatus('Acceso denegado. Esta cuenta no tiene autorización para ver el panel.','error');
   return;
  }
  if(response.status===503){
   displayStatus('Servicio administrativo no disponible. No se muestran datos desactualizados.','warn');
   return;
  }
  if(!response.ok){
   displayStatus('No se pudieron consultar los avisos. Intentá actualizar.','error');
   return;
  }
  const contentType=response.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(contentType)){
   displayStatus('Respuesta inesperada del servidor. No se muestran datos.','error');
   return;
  }
  const text=await response.text();
  if(text.length>4096){
   displayStatus('Respuesta demasiado grande. No se muestran datos.','error');
   return;
  }
  const data=JSON.parse(text);
  if(!validResponse(data)){
   displayStatus('Los datos recibidos no superaron la validación.','error');
   return;
  }
  show(data);displayStatus('Estadísticas actualizadas. La información es de solo lectura.');
 }catch(err){
  if(serial!==requestSerial)return;
  if(err?.name==='AbortError')return;
  displayStatus('No fue posible conectarse al servicio. No se muestran datos.','warn');
 }finally{
  if(serial===requestSerial){refresh.disabled=false;controller=null;}
 }
}
refresh.addEventListener('click',load);
load();
