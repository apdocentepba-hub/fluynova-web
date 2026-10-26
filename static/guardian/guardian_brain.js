/* GUARDIÁN · Motor conversacional guiado 0.2
   Reglas transparentes, sin llamadas a servidores ni seguimiento del usuario.
   Funciona en el navegador y también en Node para pruebas.
*/
(function(){
"use strict";
const SECTORS=[
 {id:"taller",patterns:[/\btaller( mecanic[oa])?\b/,/\bmecanica\b/,/\bmecanic[oa]\b/,/\bautomotor\b/,/\bautos?\b/,/\bvehiculos?\b/,/\bcoches?\b/,/\breparacion de autos\b/],
  name:"taller mecánico",
  items:["turnos para recibir autos y asignar trabajos","órdenes de reparación con vehículo, tareas y estado","presupuestos de repuestos y mano de obra","avisos de vehículo listo o mantenimiento pendiente","control de repuestos y saldos a cobrar"],
  starter:"Empezaría con turnos + órdenes de trabajo + presupuestos; el inventario puede sumarse después.",
  ask:"¿Qué te hace perder más tiempo hoy: organizar turnos, presupuestar, buscar repuestos o avisar a los clientes?"},
 {id:"peluqueria",patterns:[/\bpeluqueria\b/,/\bbarberia\b/,/\bsalon de belleza\b/,/\bmanicura\b/,/\bestetica\b/],
  name:"peluquería o centro de estética",
  items:["agenda de turnos con duración por servicio","recordatorios para reducir ausencias","ficha de tratamientos y preferencias","control de insumos","caja diaria y cobros pendientes"],
  starter:"Arrancaría por agenda y recordatorios, para ordenar horarios sin comprar un sistema enorme.",
  ask:"¿Hoy tomás turnos por WhatsApp, Instagram o por teléfono?"},
 {id:"comercio",patterns:[/\bcomercio\b/,/\bkiosco\b/,/\bferreteria\b/,/\balmacen\b/,/\btienda\b/,/\bnegocio de ropa\b/,/\bdistribuidora\b/,/\bmayorista\b/,/\blibreria\b/],
  name:"comercio",
  items:["stock mínimo y reposición","control de precios de compra y venta","pedidos pendientes y entregas","caja y cierres diarios","clientes que tienen pagos pendientes"],
  starter:"Si ya usás Excel, podríamos comenzar automatizando el control de stock y las alertas de reposición.",
  ask:"¿El mayor problema es el stock, los pedidos o los cobros?"},
 {id:"gastronomia",patterns:[/\brestaurante\b/,/\bbar\b/,/\bcafeteria\b/,/\bcomida\b/,/\bdelivery\b/,/\bpizzeria\b/,/\brotiseria\b/,/\bpanaderia\b/],
  name:"local gastronómico",
  items:["pedidos y estado de preparación","insumos y compras","costos de recetas y márgenes","reservas y turnos","cierre de caja diario"],
  starter:"El primer piloto podría reunir pedidos y estados en una pantalla, sin prometer integración con aplicaciones de reparto.",
  ask:"¿Necesitás ordenar pedidos, controlar ingredientes o calcular costos?"},
 {id:"inmobiliaria",patterns:[/\binmobiliaria\b/,/\balquileres\b/,/\bpropiedades\b/,/\bcorredor inmobiliario\b/],
  name:"inmobiliaria",
  items:["consultas por inmueble y seguimiento","turnos de visita","vencimientos de alquileres y renovaciones","documentación pendiente","reportes de propiedades y prospectos"],
  starter:"Empezaría por la bandeja de consultas y un calendario de vencimientos.",
  ask:"¿Se pierden más consultas, visitas o vencimientos?"},
 {id:"salud",patterns:[/\bconsultorio\b/,/\bdentista\b/,/\bodontolog\w*\b/,/\bclinica\b/,/\bpsicolog\w*\b/,/\bfisioterapi\w*\b/],
  name:"consultorio",
  items:["turnos y recordatorios administrativos","solicitudes de contacto","control de cobros sin detalles clínicos","lista de espera","reportes administrativos"],
  starter:"Se puede empezar por turnos y consultas administrativas, sin procesar historias clínicas ni información sensible.",
  ask:"¿Querés ordenar turnos o tareas administrativas?"},
 {id:"educacion",patterns:[/\bescuela\b/,/\binstituto\b/,/\bdocentes?\b/,/\bacademia\b/,/\beducacion\b/,/\bsecretaria escolar\b/],
  name:"institución educativa",
  items:["solicitudes y documentación con permisos","seguimiento del estado de trámites","formularios y constancias","avisos de tareas pendientes","reportes administrativos"],
  starter:"Probaría con un solo trámite administrativo, sin almacenar datos de estudiantes hasta revisar seguridad y autorizaciones.",
  ask:"¿Qué trámite te ocupa más tiempo?"},
 {id:"servicios",patterns:[/\belectricista\b/,/\bplomero\b/,/\bgasista\b/,/\binstalaciones?\b/,/\bservicio tecnico\b/,/\breparacion de pc\b/,/\bmantenimiento\b/],
  name:"servicio técnico u oficio",
  items:["turnos y visitas","órdenes de servicio y trabajos abiertos","presupuestos y aceptación","recordatorios de seguimiento","materiales usados y saldos pendientes"],
  starter:"Una agenda vinculada a trabajos y presupuestos suele ser un buen punto de partida.",
  ask:"¿Te cuesta más agendar visitas, presupuestar o seguir trabajos abiertos?"}
];
const EXAMPLES="Te doy ejemplos concretos de tareas que podríamos simplificar:\n\n"+
"• Taller mecánico: turnos, órdenes de reparación y presupuestos de repuestos.\n"+
"• Peluquería: reservas y recordatorios de turnos.\n"+
"• Comercio: stock bajo, pedidos y entregas pendientes.\n"+
"• Inmobiliaria: consultas sin responder y vencimientos.\n"+
"• Oficina: formularios que vuelcan datos a una planilla y generan reportes.\n\n"+
"Son posibilidades para evaluar, no integraciones ya instaladas. ¿Qué tipo de negocio tenés?";
const FEATURES=[
 {id:"turnos",rx:/\b(turnos?|reservas?|agenda|calendario|citas?)\b/,title:"turnos"},
 {id:"presupuestos",rx:/\b(presupuest\w*|cotizaci\w*|cotizar|mano de obra)\b/,title:"presupuestos"},
 {id:"stock",rx:/\b(stock|inventario|repuestos?|insumos?|mercaderia|existencias?)\b/,title:"stock"},
 {id:"avisos",rx:/\b(avisar|avisos?|notific\w*|recordatorios?|alertas?|mensaje automat\w*)\b/,title:"avisos"},
 {id:"cobros",rx:/\b(cobr\w*|pagos?|deudas?|facturas?|vencimient\w*)\b/,title:"cobros"},
 {id:"ordenes",rx:/\b(ordenes?|trabajos?|reparacion\w*|servicios?|seguimiento|estado de)\b/,title:"seguimiento"},
 {id:"clientes",rx:/\b(clientes?|contactos?|consultas?|whatsapp|instagram|formularios?)\b/,title:"consultas"}
];
function clean(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function create(){return {sector:null,features:[],topic:null,turn:0,asked:"",lastAnswerType:"",other:""}}
function selectedSector(q){
 for(const s of SECTORS)if(s.patterns.some(rx=>rx.test(q)))return s;
 return null;
}
function listFeatures(q){return FEATURES.filter(f=>f.rx.test(q)).map(f=>f.id)}
function quote(topic){
 if(topic==="planillas")return "Para ordenar planillas, la referencia inicial es desde $120.000 ARS.";
 if(topic==="seguimiento")return "Para organizar consultas y seguimiento, la referencia inicial es desde $240.000 ARS.";
 if(topic==="sistema")return "Para un mini sistema interno con distintos registros y estados, la referencia inicial es desde $420.000 ARS.";
 return "Tenemos referencias desde $120.000 ARS para planillas, $240.000 ARS para consultas y $420.000 ARS para un mini sistema.";
}
function guided(message,state){
 const st=state||create(),q=clean(message);st.turn++;
 let sector=selectedSector(q);if(sector)st.sector=sector.id;
 const selected=SECTORS.find(s=>s.id===st.sector)||null;
 const ff=listFeatures(q),hasExamples=/\b(ejemplos?|ideas?|casos practicos|mostrame|que podria|que puedo automatizar|automatiza|automatizar|se puede hacer)\b/.test(q);
 const price=/\b(cuanto (sale|cuesta|cobran|cobras|vale)|que (precio|costo|tarifa|valor)|precio|tarifa|costos?|costo aproximado|cotizar mi proyecto)\b/.test(q);
 const greeting=/^(hola|buenas|buen dia|que tal|buenas tardes|buenas noches)$/.test(q);
 const human=/\b(quiero contratar|hablar con (una persona|alguien|un humano)|necesito un asesor|como contacto|correo de contacto|quiero una evaluacion)\b/.test(q);
 const times=/\b(cuanto tarda|plazos?|demora|cuando lo tendria|tiempo de entrega)\b/.test(q);
 const privacy=/\b(contrase\w*|tarjetas?|datos sensibles|privacidad|seguridad de datos|donde guardan)\b/.test(q);
 const integrations=/\b(integrar|conectar|api|mercado pago|afip|arca|factura electronica|whatsapp automaticamente)\b/.test(q);
 const thanks=/^(gracias|joya|genial|perfecto|dale|ok|de una)$/.test(q);
 const context = selected?" para tu "+selected.name:"";
 let out="",tag="general",chips=[];
 if(!q){out="Contame qué negocio tenés o qué tarea querés simplificar.";chips=["Dame ejemplos","Taller mecánico","Precios"]; }
 else if(privacy){
  out="No compartas claves, tarjetas, DNI ni datos sensibles. En el modo guiado los mensajes quedan en esta pestaña: no se guardan en Fluynova. La IA externa, si está configurada, pide permiso antes de enviar tu conversación a otro proveedor. Si tu negocio trata datos personales, primero revisamos permisos y seguridad.";
  tag="privacidad";chips=["Dame ejemplos","Hablar con una persona"];
 }else if(human){
  out="Podés enviar tu consulta en el formulario de Fluynova. Es sin cargo para una primera evaluación orientativa y la revisará una persona. Si me contás el proceso y la prioridad, puedo ayudarte a preparar una descripción para pedir presupuesto, sin enviarla automáticamente.";
  tag="contacto";chips=["Qué datos preparar","Precio orientativo"];
 }else if(price){
  let topic=st.topic|| (st.features.length>1?"sistema":"seguimiento");
  if(!st.sector&&!st.features.length)topic=null;
  out=quote(topic)+" Es un precio orientativo, no una cotización cerrada. Para "+(selected?"un "+selected.name:"tu negocio")+", el costo cambia según módulos, cantidad de usuarios, datos e integraciones. ¿Querés empezar por una sola función o conectar varias?";
  tag="precios";chips=["Empezar con algo simple","Pedir evaluación"];
 }else if(times){
  out="El plazo depende del alcance, las integraciones y las pruebas. No sería serio prometer una fecha sin ver tu proceso. Para empezar, conviene elegir un módulo pequeño y definir el resultado esperado. ¿Qué necesitás resolver primero?";
  tag="plazos";chips=["Dame ejemplos","Pedir evaluación"];
 }else if(integrations){
  out="Podemos estudiar una integración"+context+", pero antes hay que comprobar API oficial, permisos, privacidad y costos. No afirmo que ya esté conectada ni que pueda enviar mensajes o emitir facturas automáticamente. ¿Qué sistemas querés conectar?";
  tag="integracion";chips=["Turnos","Presupuestos","Pedir evaluación"];
 }else if(greeting){
  out="¡Hola! Soy Guardián de Fluynova. Puedo mostrarte soluciones concretas por rubro y ayudarte a definir qué conviene automatizar. ¿Tenés un comercio, un taller, una oficina u otro tipo de negocio?";
  tag="saludo";chips=["Dame ejemplos","Taller mecánico","Comercio","Peluquería"];
 }else if(selected && (sector && (hasExamples||!ff.length) || hasExamples&&!ff.length)){
  out="Para un "+selected.name+" se me ocurren estas automatizaciones:\n\n"+
    selected.items.map((x,i)=>(i+1)+". "+x.charAt(0).toUpperCase()+x.slice(1)+".").join("\n")+
    "\n\n"+selected.starter+"\n\n"+selected.ask;
  st.topic="sistema";tag=selected.id;chips=selected.id==="taller"?["Turnos y presupuestos","Control de repuestos","Avisos a clientes","Cuánto cuesta"]:["Turnos","Stock","Presupuestos","Cuánto cuesta"];
 }else if(hasExamples && (!selected||!ff.length)){
  out=EXAMPLES;tag="ejemplos";chips=["Taller mecánico","Peluquería","Comercio","Inmobiliaria"];
 }else if(ff.length){
  ff.forEach(f=>{if(!st.features.includes(f))st.features.push(f)});
  st.topic=st.features.length>1?"sistema":st.features.some(f=>["turnos","presupuestos","clientes"].includes(f))?"seguimiento":"sistema";
  tag="funciones";
  if(selected?.id==="taller"){
   if(st.features.includes("turnos")&&st.features.includes("presupuestos")){
    out="Para tu taller haría este flujo:\n\n1. El cliente pide turno y registrás vehículo, motivo y disponibilidad.\n2. Cuando llega el auto, abrís una orden de trabajo.\n3. Cargás repuestos y mano de obra, armás el presupuesto y registrás su aprobación.\n4. Actualizás el estado y preparás un aviso cuando termina.\n\nPodemos arrancar con turnos y presupuestos, y sumar stock después. Los mensajes automáticos por WhatsApp necesitan integración oficial. ¿Hoy tomás turnos por WhatsApp, llamadas o anotador?";
   }else if(st.features.includes("stock")){
    out="Para el taller, un control de repuestos podría registrar existencias, costo, proveedor, consumo por orden de reparación y avisos cuando se alcanza el mínimo. Antes de automatizar compras, hay que definir quién las aprueba. ¿Llevás el stock en Excel o en cuaderno?";
   }else if(st.features.includes("avisos")){
    out="Podríamos avisarte cuando una orden está demorada, falta un repuesto o hay un vehículo listo para retirar. Los avisos al cliente por WhatsApp requerirían una integración autorizada. ¿Qué aviso te ahorraría más llamadas?";
   }else{
    out="Para el taller, "+ff.map(f=>FEATURES.find(x=>x.id===f).title).join(" y ")+" podría conectarse a una ficha por vehículo y orden de trabajo, así no copiás los mismos datos. ¿Qué anotás hoy y dónde?";
   }
  }else{
   out="Se puede organizar "+ff.map(f=>FEATURES.find(x=>x.id===f).title).join(" y ")+context+" con un registro simple, estados y reportes que definamos juntos. Para no venderte funciones innecesarias, ¿cómo hacés eso actualmente: planilla, papel, llamadas o mensajes?";
  }
  chips=["Cuánto cuesta","Empezar con algo simple","Pedir evaluación"];
 }else if(selected){
  out="Ya sé que hablamos de tu "+selected.name+". "+selected.starter+" "+selected.ask;
  tag=selected.id;chips=["Dame ejemplos","Turnos y presupuestos","Cuánto cuesta"];
 }else if(/planillas?|excel|google sheets|reportes|formularios|copiar datos/.test(q)){
  st.topic="planillas";tag="planillas";
  out="Podríamos reducir copias de datos, aplicar validaciones, organizar reportes y conectar formularios con una planilla, siempre que las herramientas lo permitan. ¿Qué información copiás o controlás a mano?";
  chips=["Dame ejemplos","Cuánto cuesta","Pedir evaluación"];
 }else if(/apdocente|alertasapd|actos publicos|docentes pba|\bpid\b/.test(q)){
  tag="apdocente";out="AlertasAPD ayuda a organizar búsquedas docentes bonaerenses. Es independiente de ABC/DGCyE: la publicación y postulación oficiales se verifican allí. Podés ver la plataforma en alertasapd.com.ar.";
  chips=["Consultar Fluynova","Pedir evaluación"];
 }else if(thanks){
  out="Perfecto. Ya tenemos una idea de por dónde empezar. Si querés, definimos una primera función pequeña para probar antes de contratar algo más grande. ¿Qué tarea te gustaría resolver primero?";
  tag="continuar";chips=["Cuánto cuesta","Pedir evaluación"];
 }else{
  out=st.sector?"Para tu "+selected.name+" quiero evitar proponerte un sistema que no necesitás. "+selected.ask:
  "Para mostrarte algo útil necesito saber qué negocio tenés o qué tarea repetís. Por ejemplo: un taller puede automatizar órdenes y turnos, y un comercio puede controlar stock y pedidos. ¿Cuál es tu caso?";
  tag="general";chips=["Dame ejemplos","Taller mecánico","Comercio","Planillas"];
 }
 st.lastAnswerType=tag;
 return {reply:out,tag,choices:chips,context:{sector:st.sector,features:st.features.slice(),topic:st.topic,turn:st.turn},state:st};
}
const api={create,guided,clean};
if(typeof module==="object"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.FluynovaGuardianBrain=api;
})();