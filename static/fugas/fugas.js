(function(){
"use strict";
const $=(sel,root=document)=>root.querySelector(sel);
const money=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const dateFmt=new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
const today=new Date();today.setHours(12,0,0,0);
const todayISO=asISO(today);
let records=[];let currentFilter="todos";let source="sin datos";let invalidCount=0;
const els={count:$("#count"),late:$("#late"),budgets:$("#budgets"),renewals:$("#renewals"),list:$("#records"),hint:$("#result-hint"),summary:$("#summary"),file:$("#csv-file"),alert:$("#import-alert"),demo:$("#demo-button"),download:$("#template-button"),clear:$("#clear-button"),form:$("#add-form"),export:$("#export-button"),toast:$("#toast")};
function asISO(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function slug(s){return String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function dayDate(s){
 const v=String(s??"").trim();let m;
 if((m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v)))m=[m[1],m[2],m[3]];
 else if((m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(v)))m=[m[3],m[2],m[1]];
 else return null;
 const y=+m[0],mo=+m[1],d=+m[2];
 const res=new Date(y,mo-1,d,12);
 return y>=2000&&y<=2100&&res.getFullYear()===y&&res.getMonth()===mo-1&&res.getDate()===d?res:null;
}
function daysSince(d){return Math.round((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()))/86400000)}
function daysAway(d){return -daysSince(d)}
function parseAmount(value){
 let s=String(value??"").trim().replace(/\s/g,"").replace(/(?:ars|\$)/gi,"");if(!s)return null;
 if(!/^[0-9.,]+$/.test(s))return null;
 const cm=s.lastIndexOf(","),dt=s.lastIndexOf(".");let decimal="";
 if(cm>=0&&dt>=0)decimal=cm>dt?",":".";
 else if(cm>=0){let tail=s.length-cm-1;decimal=tail===1||tail===2?",":""}
 else if(dt>=0){let tail=s.length-dt-1;decimal=tail===1||tail===2?".":""}
 if(decimal){let i=s.lastIndexOf(decimal);s=s.slice(0,i).replace(/[.,]/g,"")+"."+s.slice(i+1)}
 else s=s.replace(/[.,]/g,"");
 let n=Number(s);return Number.isFinite(n)&&n>=0&&n<=1e12?n:null;
}
function typeOf(value){let v=slug(value);return ["cobro","factura","cuenta","cuentaporcobrar"].includes(v)?"cobro":["presupuesto","cotizacion","propuesta"].includes(v)?"presupuesto":["renovacion","renovar","suscripcion"].includes(v)?"renovacion":null}
function statusOf(value){let s=slug(value);return ["","pendiente","sinrespuesta","enviado","abierto","noabonado","sinpagar","adeudado"].includes(s)?"pendiente":["pagado","cobrado","aceptado","completado","cerrado","finalizado","renovado"].includes(s)?"cerrado":["rechazado","anulado","cancelado","perdido","descartado"].includes(s)?"descartado":null}
function parseCsv(text){
 const head=String(text||"").replace(/^\uFEFF/,"");let candidate=head.slice(0,600);
 let count=(delimiter)=>{let n=0,quoted=false;for(let i=0;i<candidate.length;i++){let c=candidate[i];if(c==='"'){if(quoted&&candidate[i+1]==='"')i++;else quoted=!quoted}else if(!quoted){if(c===delimiter)n++;if(c==='\n'||c==='\r')break}}return n};
 let delimiter=count(";")>count(",")?";":",";
 let rows=[],row=[],cell="",quoted=false;
 for(let i=0;i<head.length;i++){const c=head[i];
 if(c==='"'){if(quoted&&head[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
 else if(c===delimiter&&!quoted){row.push(cell);cell=""}
 else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&head[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}
 else cell+=c;
 }
 if(quoted)throw Error("El CSV tiene comillas sin cerrar.");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
function normalize(entry){
 const client=String(entry.cliente||"").trim().slice(0,100),type=typeOf(entry.tipo),amount=parseAmount(entry.monto),date=dayDate(entry.fecha),status=statusOf(entry.estado),last=entry.ultimo_contacto?dayDate(entry.ultimo_contacto):null;
 if(!client||!type||amount===null||!date||!status||(entry.ultimo_contacto&&!last))return null;
 return {cliente:client,tipo:type,monto:amount,fecha:asISO(date),estado:status,telefono:String(entry.telefono||"").trim().slice(0,35),referencia:String(entry.referencia||"").trim().slice(0,80),ultimo_contacto:last?asISO(last):""};
}
const aliases={cliente:["cliente","nombre","razonsocial"],tipo:["tipo","clase"],monto:["monto","importe","total","valor"],fecha:["fecha","vencimiento","fechavencimiento","fechaenvio"],estado:["estado","situacion"],telefono:["telefono","celular","whatsapp","movil"],referencia:["referencia","numero","factura","id"],ultimo_contacto:["ultimocontacto","fechacontacto","ultimoseguimiento"]};
function importCsv(text){
 const rows=parseCsv(text);if(rows.length<2)throw Error("Necesitamos encabezados y al menos una fila.");
 if(rows.length>2001)throw Error("Esta versión admite hasta 2000 registros por archivo.");
 const headers=rows[0].map(slug);const map={};
 for(const [key,list] of Object.entries(aliases)){let i=headers.findIndex(h=>list.includes(h));if(i>=0)map[key]=i}
 const missing=["cliente","tipo","monto","fecha","estado"].filter(k=>map[k]===undefined);
 if(missing.length)throw Error("Faltan columnas: "+missing.join(", ")+". Usá la plantilla.");
 const imported=[];let omitted=0;
 for(const cells of rows.slice(1)){let obj={};for(const [key,index] of Object.entries(map))obj[key]=cells[index]||"";let record=normalize(obj);if(record)imported.push(record);else omitted++}
 if(imported.length===0)throw Error("No encontré registros válidos. Revisá el tipo, la fecha, el estado y el monto.");
 records=imported;invalidCount=omitted;source="CSV importado";currentFilter="todos";render();
 message("Se cargaron "+imported.length+" registros"+(omitted?", "+omitted+" filas omitidas.":"."));
}
function relativeDate(n){const d=new Date(today);d.setDate(d.getDate()+n);return asISO(d)}
function demo(){
 const fake=[
 ["Taller El Jacarandá","cobro",95000,relativeDate(-17),"pendiente","", "FAC-101",""],
 ["Servicios Delta","cobro",180000,relativeDate(-4),"pendiente","", "FAC-102",""],
 ["Ferretería del Puerto","presupuesto",220000,relativeDate(-21),"pendiente","", "PRES-301",relativeDate(-15)],
 ["Estudio La Ribera","presupuesto",79000,relativeDate(-10),"pendiente","", "PRES-302",""],
 ["Comercio Norte","cobro",35000,relativeDate(5),"pendiente","", "FAC-103",""],
 ["Comercial Sur","renovacion",19000,relativeDate(9),"pendiente","", "REN-10",""],
 ["Cliente Ejemplo","cobro",120000,relativeDate(-2),"cobrado","", "FAC-104",""]
 ];
 records=fake.map(v=>normalize({cliente:v[0],tipo:v[1],monto:v[2],fecha:v[3],estado:v[4],telefono:v[5],referencia:v[6],ultimo_contacto:v[7]}));
 source="ejemplo ficticio";invalidCount=0;currentFilter="todos";render();message("Cargamos datos ficticios para probar la herramienta.");
}
function analyze(r,i){
 if(r.estado!=="pendiente")return null;
 const date=dayDate(r.fecha),delta=daysSince(date);
 let kind=null,priority=0,title="";
 if(r.tipo==="cobro"){
   if(delta>0){kind="cobro";priority=delta>14?3:2;title="Cobro vencido hace "+delta+" días"}
   else if(delta>=-7){kind="proximo";priority=1;title=delta===0?"Vence hoy":"Vence en "+(-delta)+" días"}
 }else if(r.tipo==="presupuesto"){
   const d=dayDate(r.ultimo_contacto||r.fecha),age=daysSince(d);
   if(age>=7){kind="presupuesto";priority=age>=14?3:2;title="Presupuesto sin seguimiento hace "+age+" días"}
 }else if(r.tipo==="renovacion"){
   if(delta>=-3&&delta<=10){kind="renovacion";priority=delta>=0?2:1;title=delta>0?"Renovación vencida hace "+delta+" días":delta===0?"Renovación hoy":"Renovación en "+(-delta)+" días"}
 }
 if(!kind)return null;
 const score=priority*1000000+Math.min(900000,r.monto/10)+Math.max(0,delta)*200;
 return {r,i,kind,priority,title,score};
}
function analyzeAll(){
 const unique=new Set(),dups=[];let active=[];
 records.forEach((r,i)=>{const key=[r.cliente.toLowerCase(),r.tipo,r.monto,r.fecha,r.estado,r.referencia.toLowerCase()].join("|");if(unique.has(key)){dups.push(i);return}unique.add(key);const entry=analyze(r,i);if(entry)active.push(entry)});
 active.sort((a,b)=>b.score-a.score);return {active,dups};
}
function reminder(a){
 const r=a.r,as=r.cliente,ref=r.referencia?" (ref. "+r.referencia+")":"";
 if(a.kind==="cobro")return "Hola, ¿cómo estás? Te escribo para consultar por el pago pendiente"+ref+" de "+money.format(r.monto)+", con vencimiento el "+dateFmt.format(dayDate(r.fecha))+". ¿Podés confirmarme cuándo estaría disponible? Muchas gracias.";
 if(a.kind==="proximo")return "Hola, ¿cómo estás? Te recuerdo que el pago"+ref+" de "+money.format(r.monto)+" vence el "+dateFmt.format(dayDate(r.fecha))+". Si ya lo realizaste, desestimá este mensaje. ¡Gracias!";
 if(a.kind==="presupuesto")return "Hola, ¿cómo estás? Quería saber si pudiste revisar el presupuesto"+ref+" que te compartimos. Si tenés dudas o querés avanzar, quedamos a disposición. ¡Gracias!";
 return "Hola, ¿cómo estás? Te contacto porque se acerca la fecha de renovación"+ref+" ("+dateFmt.format(dayDate(r.fecha))+"). ¿Querés que revisemos las condiciones para continuar? ¡Gracias!";
}
function cards(items){
 if(!items.length){els.list.innerHTML='<div class="empty">No hay acciones en esta categoría. Probá otro filtro o cargá una planilla.</div>';return}
 els.list.innerHTML=items.map(a=>{
  const r=a.r,cls=a.priority>=3?"urgent":a.priority===2?"soon":"normal",p=a.priority>=3?"Alta":a.priority===2?"Media":"Próxima",type=a.kind==="cobro"||a.kind==="proximo"?"Cobranza":a.kind==="presupuesto"?"Venta pendiente":"Renovación";
  const phone=String(r.telefono||"").replace(/\D/g,"");const whatsapp=phone.length>=10&&phone.length<=15?' <a class="button small secondary" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+encodeURIComponent(phone)+'?text='+encodeURIComponent(reminder(a))+'">Abrir WhatsApp ↗</a>':"";
  return '<article class="record"><div class="record-head"><div><h3>'+esc(r.cliente)+'</h3><span class="pill '+cls+'">'+p+'</span><span class="pill normal">'+esc(type)+'</span><div class="info">'+esc(r.referencia||"Sin referencia")+' · '+esc(dateFmt.format(dayDate(r.fecha)))+'</div></div><strong class="value">'+esc(money.format(r.monto))+'</strong></div><p>'+esc(a.title)+'. '+(a.kind==="presupuesto"?"Monto propuesto, no una cuenta por cobrar.":"Verificá la situación actual antes de contactar.")+'</p><div class="act"><button type="button" class="button small" data-copy="'+a.i+'">Copiar mensaje</button>'+whatsapp+'</div></article>'
 }).join("");
}
function render(){
 const result=analyzeAll(),arr=result.active,cobros=arr.filter(a=>a.kind==="cobro"),budgets=arr.filter(a=>a.kind==="presupuesto"),renewals=arr.filter(a=>a.kind==="renovacion");
 const totalCobros=cobros.reduce((sum,a)=>sum+a.r.monto,0),totalBudgets=budgets.reduce((sum,a)=>sum+a.r.monto,0);
 els.count.textContent=String(arr.length);
 els.late.textContent=money.format(totalCobros);els.budgets.textContent=money.format(totalBudgets);els.renewals.textContent=String(renewals.length);
 els.hint.textContent=records.length?records.length+" registros · "+source+(invalidCount?" · "+invalidCount+" filas inválidas omitidas":"")+(result.dups.length?" · "+result.dups.length+" duplicados exactos ignorados":""):"Sin datos cargados. Probá con el ejemplo o importá tu archivo.";
 els.summary.textContent=records.length?"El total de cobros vencidos es deuda registrada pendiente, no plata recuperada. Los presupuestos son oportunidades comerciales, no ingresos garantizados.":"Esta herramienta no accede a cuentas bancarias ni verifica si un pago ya se realizó.";
 document.querySelectorAll("[data-filter]").forEach(b=>{const selected=b.dataset.filter===currentFilter;b.classList.toggle("active",selected);b.setAttribute("aria-pressed",selected?"true":"false")});
 cards(arr.filter(a=>currentFilter==="todos"||a.kind===currentFilter||(currentFilter==="cobros"&&(a.kind==="cobro"||a.kind==="proximo"))));
 els.export.disabled=!arr.length;els.clear.disabled=!records.length;
}
function message(s,bad=false){els.toast.textContent=s;els.toast.style.background=bad?"#ffe0d5":"#d8ffe0";els.toast.hidden=false;els.alert.textContent=s;els.alert.classList.toggle("danger",bad)}
function escapeCSV(value){const s=String(value??"");const safe=/^[=+@\-\t\r]/.test(s.trimStart())?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"'}
function download(name,body){const blob=new Blob(["\uFEFF",body],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const csvHeader=["cliente","tipo","monto","fecha","estado","telefono","referencia","ultimo_contacto"];
function csv(items){return [csvHeader.join(";"),...items.map(r=>csvHeader.map(k=>escapeCSV(r[k]||"")).join(";"))].join("\r\n")}
els.demo.addEventListener("click",demo);
els.download.addEventListener("click",()=>download("fluynova-fugas-plantilla.csv",csv([{cliente:"Cliente de ejemplo",tipo:"cobro",monto:65000,fecha:relativeDate(-8),estado:"pendiente",telefono:"",referencia:"FAC-001",ultimo_contacto:""},{cliente:"Otro ejemplo",tipo:"presupuesto",monto:120000,fecha:relativeDate(-15),estado:"pendiente",telefono:"",referencia:"PRES-002",ultimo_contacto:""}])));
els.file.addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){message("El archivo debe pesar menos de 2 MB.",true);return}try{importCsv(await file.text())}catch(err){message(err.message||"Error al importar CSV",true)}finally{e.target.value=""}});
els.form.addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.target);const raw=Object.fromEntries(fd.entries());let r=normalize(raw);if(!r){message("Revisá el cliente, monto, fecha y los campos del formulario.",true);return}records.push(r);source=source==="sin datos"?"carga manual":source+" + manual";currentFilter="todos";invalidCount=0;render();e.target.reset();$("#field-date").value=todayISO;message("Registro agregado a esta sesión (no se guardó en un servidor).")});
els.clear.addEventListener("click",()=>{records=[];source="sin datos";invalidCount=0;currentFilter="todos";render();message("Datos borrados de esta sesión.")});
els.export.addEventListener("click",()=>{const actionable=analyzeAll().active.map(a=>({cliente:a.r.cliente,tipo:a.r.tipo,monto:a.r.monto,fecha:a.r.fecha,estado:a.r.estado,telefono:a.r.telefono,referencia:a.r.referencia,ultimo_contacto:a.r.ultimo_contacto}));download("fluynova-fugas-acciones.csv",csv(actionable));message("Lista de acciones descargada.")});
$("#filters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;currentFilter=b.dataset.filter;render()});
els.list.addEventListener("click",async e=>{const b=e.target.closest("[data-copy]");if(!b)return;let idx=Number(b.dataset.copy);let a=analyze(records[idx],idx);if(!a)return;try{await navigator.clipboard.writeText(reminder(a));message("Mensaje copiado. Revisalo antes de enviarlo.")}catch(_){message("No se pudo copiar. Probá abrir WhatsApp o usar HTTPS.",true)}});
$("#field-date").value=todayISO;
render();
})();