/* GUARDIÁN · Motor conversacional guiado 0.4
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
 {id:"educacion",patterns:[/\bescuela\b/,/\binstitucion educativa\b/,/\bcolegio\b/,/\bescuela secundaria\b/,/\binstituto\b/,/\bdocentes?\b/,/\bacademia\b/,/\beducacion\b/,/\bsecretaria escolar\b/],
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

const SCHOOL_PROJECTS=[
 {id:"legajos",re:/\b(legajos?( y libros? matriz| digital(es)?| estudiantil(es)?| de alumnos?)|matricula escolar|matriculacion|sistema de alumnos?|gestion academica|registro academico integral|historial academico|trayectoria escolar|carga(r|do)? (de )?(notas|calificaciones)|volcar (las )?(notas|calificaciones)|completar (el |los )?libros? matriz)\b/,
 name:"legajos, calificaciones y matriz escolar",
 steps:[
  "Inscripción: Secretaría da de alta al estudiante una sola vez con un identificador interno, datos de contacto mínimos y documentación necesaria. El sistema controla duplicados y cambios posteriores.",
  "Trayectoria anual: se crea cada ciclo lectivo con establecimiento, curso, división, modalidad, plan de estudios y materias correspondientes. Los cambios de escuela o plan quedan registrados.",
  "Calificaciones: docentes autorizados cargan notas en períodos definidos; se valida materia, alumno, curso y usuario. Las rectificaciones requieren permisos, registro de cambios y revisión.",
  "Consolidación: al cerrar cada ciclo, el sistema calcula un resumen académico por alumno y año desde los registros verificados, sin volver a transcribir datos.",
  "Libro matriz: se prepara una vista o borrador conforme al modelo y plan realmente aplicables, con materias, notas, años y observaciones para control de Secretaría.",
  "Emisión oficial: el personal competente revisa y autoriza cualquier registro, analítico o constancia. Las firmas, decisiones y sistemas oficiales no se reemplazan por generación automática."
 ],
 constraint:"Esto sería un gestor de legajos y trayectoria académica, no una modificación automática del libro matriz oficial. Para usar datos reales de menores deben existir autorización institucional, perfiles de acceso, respaldo, auditoría y protección de datos. ENSPA y Motor Académico no están conectados; la importación o exportación solo se haría si hay un mecanismo permitido.",
 question:"¿Hoy los datos del alumnado y las calificaciones están en planillas, libros matriz, ENSPA, Motor Académico u otro sistema?"
 },
 {id:"analiticos",re:/\banaliticos?\b|\bcertificado analitico\b|\btitulos? secundarios?\b/,
 name:"analíticos",
 steps:[
 "La persona envía una solicitud por un formulario web y recibe un número de seguimiento.",
 "El pedido ingresa a una bandeja privada de Secretaría, con estados y documentación pendiente.",
 "Personal autorizado verifica identidad, trayectoria, materias y plan de estudios en las fuentes oficiales.",
 "El sistema prepara un borrador a partir de datos verificados, con controles de materias faltantes y duplicados.",
 "Secretaría revisa el borrador y las equivalencias aplicables; la emisión y las firmas oficiales siguen a cargo del personal competente.",
 "Se informa el estado o forma de retiro por un canal autorizado, sin publicar datos académicos."
 ],
 constraint:"No emitiría ni firmaría analíticos automáticamente. Hay que verificar normas DGCyE, protección de datos y la posibilidad real de obtener datos de ENSPA o Motor Académico: no tenemos una integración confirmada.",
 question:"¿Los datos ya están en ENSPA, Motor Académico o planillas, o hay que revisar libros matriz?"
 },
 {id:"equivalencias",re:/\bequivalencias?\b|\bdictamen(es)?\b/,name:"equivalencias",
 steps:["Se recibe la solicitud y la documentación por un canal autorizado.","Se identifican plan de origen y destino y espacios curriculares acreditados.","Una tabla de reglas validada permite contrastar materias y señalar diferencias.","Se prepara un borrador de dictamen para revisión y decisión del personal competente.","Se registra el estado y se avisa al solicitante sin divulgar datos sensibles."],
 constraint:"Las correspondencias deben venir de fuentes normativas verificadas; la resolución administrativa no puede decidirse ni firmarse automáticamente.",
 question:"¿Ya cuentan con tablas oficiales de equivalencias y diseños curriculares digitalizados?"},
 {id:"pases",re:/\bpases? escolares?\b|\bsolicitudes? de pases?\b|\bpases? de alumn\w*\b|\btramite de pases?\b/,name:"pases escolares",
 steps:["Se recibe la solicitud web mediante acceso autorizado y se genera un número de trámite.","Secretaría verifica documentación, situación académica y datos pendientes.","El equipo consulta estados y responsables desde una bandeja privada.","Se preparan constancias o borradores para revisión antes de cualquier trámite oficial.","Se comunica el avance al solicitante sin revelar información académica de terceros."],
 constraint:"El procedimiento oficial y los requisitos vigentes deben verificarse antes de automatizar etapas administrativas.",
 question:"¿Querés organizar las solicitudes de pase, su seguimiento o la documentación?"},
 {id:"solicitudes",re:/\bsolicitudes? (desde|por|en) (la )?web\b|\bformularios? web\b|\btramites? escolares? online\b/,name:"solicitudes web",
 steps:["Se diseña un formulario con los datos estrictamente necesarios y aviso de privacidad.","Cada ingreso recibe un número de caso y entra a una bandeja para personal autorizado.","Se asignan estados, responsables y pendientes con historial de cambios.","La persona consulta el estado con un mecanismo de acceso seguro.","La revisión y resolución administrativa quedan bajo control humano."],
 constraint:"Antes de recibir documentación de estudiantes, familias o terceros hay que definir permisos, seguridad, respaldo, plazo de conservación y autorización institucional.",
 question:"¿La primera solicitud sería de analíticos, pases, certificados u otro trámite?"}
];
function projectFor(q,previous){
 // "Libro matriz" como fuente de un analítico no debe cambiar el tema por sí solo.
 const registry=SCHOOL_PROJECTS.find(x=>x.id==="legajos");
 const detailed=/\b(alumn\w*|estudiant\w*)\b/.test(q)&&
   /\b(ingres\w*|inscrib\w*|calificaci\w*|notas?|matriz|materias?|anos?|cursad\w*)\b/.test(q);
 const academicCycle=/\b(matriz|legajos?|matricula|calificaci\w*|notas?|materias?)\b/.test(q)&&
   /\b(anos?|ciclo lectivo|cada ano|todos sus datos|ingres\w*|se vaya completando|registro|sistema|alumn\w*)\b/.test(q);
 const registryStrong=registry.re.test(q)||detailed||academicCycle||
   (/\blegajos?\b/.test(q)&&/\b(cargar|carga|cargamos|notas|materias|alumnos|registro|sistema)\b/.test(q))||
   (/\b(libros? matriz|matriz escolar)\b/.test(q)&&/\b(legajos?|completar|armar|cargar|sistema)\b/.test(q));
 const explicitAnalytic=/\banaliticos?\b|\bcertificado analitico\b|\btitulos? secundarios?\b/.test(q);
 if(registryStrong && (!explicitAnalytic || /\b(sistema integral|legajo digital|matricula escolar|todos los alumnos|cargar las notas)\b/.test(q)))return registry;
 if(explicitAnalytic)return SCHOOL_PROJECTS.find(x=>x.id==="analiticos");
 // Una mención aislada a libros matriz como fuente no redefine el proyecto previo.
 if(previous==="analiticos"&&/\blibros? matriz\b/.test(q)&&!registryStrong)return null;
 return SCHOOL_PROJECTS.find(x=>x.id!=="legajos"&&x.re.test(q))||null;
}
function schoolReply(p,mode){
 if(p.id==="legajos"){
  const chips=["Cómo se carga cada año","Cómo funciona el libro matriz","Empezar piloto","Pedir evaluación"];
  if(mode==="fuentes")return {
   text:"Para el legajo académico, primero inventariaría qué fuentes están autorizadas: planillas, libros matriz, ENSPA o Motor Académico. De cada fuente habría que definir campos, plan de estudios y responsable de verificación. Si existe un CSV/Excel autorizado, se puede estudiar importar información al borrador del sistema; no afirmo que ENSPA tenga API ni permiso de escritura. ¿Qué datos podés exportar legalmente hoy y qué parte sigue en papel?",
   chips:["Ver circuito completo","Cómo se carga cada año","Empezar piloto"]};
  if(mode==="piloto")return {
   text:"Haría un piloto con alumnos ficticios y un curso de prueba: alta inicial, asignación de materias según plan, carga de calificaciones de un ciclo, consolidación anual y vista previa de un borrador de matriz. Validaríamos permisos y auditoría antes de evaluar datos reales. ¿Qué plan de estudios y año conviene usar para el ejemplo?",
   chips:["Ver circuito completo","Cómo funciona el libro matriz","Pedir evaluación"]};
  if(mode==="anual")return {
   text:"Cada ciclo lectivo se crea una ficha anual vinculada al mismo legajo: año, curso, división, modalidad, plan vigente y materias. Los docentes cargan y validan calificaciones por período; Secretaría supervisa rectificaciones, pendientes y acreditaciones. Al cierre, se consolida un resumen anual y se actualiza la vista del borrador del libro matriz sin transcribir dos veces. ¿La escuela trabaja con distintas modalidades y planes de estudio, o todos los cursos comparten el mismo?",
   chips:["Cómo funciona el libro matriz","Cómo se cargan las notas","Empezar piloto"]};
 if(mode==="notas")return {
   text:"Las notas no deberían ir directamente al libro matriz sin control: un docente habilitado carga calificaciones por materia y período; Secretaría revisa rectificaciones y pendientes; al cierre del ciclo se consolida la trayectoria anual. El sistema permitiría advertir materias faltantes y modificaciones, conservando quién cambió qué y cuándo. ¿La escuela usa calificaciones por trimestre, cuatrimestre u otro régimen?",
   chips:["Cómo funciona el libro matriz","Ver circuito completo","Empezar piloto"]};
  if(mode==="matriz")return {
   text:"La matriz se iría armando desde las cursadas cerradas y verificadas, por año y plan de estudios; el sistema mostraría materias, calificaciones finales, pendientes y observaciones para revisión. Podría generar un borrador o exportación si el formato oficial lo permite, pero no completar ni firmar automáticamente el libro matriz oficial. ¿La escuela maneja libros matriz en papel, digitales o ambos?",
   chips:["Cómo se carga cada año","Ver circuito completo","Empezar piloto"]};
  return {
   text:"Sí, lo que describís sería un sistema integral de gestión académica: cargás al alumno una vez, sus materias y notas quedan asociadas a cada ciclo y se prepara progresivamente un borrador del libro matriz.\n\n"+p.steps.map((step,i)=>(i+1)+". "+step).join("\n")+"\n\n"+p.constraint+"\n\n"+p.question,
   chips};
 }
 let chips=p.id==="analiticos"?["Fuentes ENSPA y planillas","Empezar piloto","Cuánto cuesta","Pedir evaluación"]:["Empezar piloto","Cuánto cuesta","Pedir evaluación"];
 if(mode==="fuentes"&&p.id==="analiticos")return {
  text:"Si los registros están en ENSPA, Motor Académico, planillas o libros matriz, primero habría que comprobar qué información puede consultarse o exportarse legalmente. Podríamos normalizar materias, cursos y planes para detectar faltantes y preparar borradores. No hay integración confirmada con esos sistemas y no modificaríamos registros oficiales automáticamente. ¿Podés exportar un listado autorizado en CSV o Excel, o solo consultar los datos pantalla por pantalla? Para el piloto usaríamos datos ficticios, no registros reales de estudiantes.",
  chips:["Ver circuito completo","Empezar piloto","Pedir evaluación"]};
 if(mode==="piloto")return {
  text:"Empezaría con un piloto de "+p.name+" sobre datos ficticios: formulario simple, bandeja de seguimiento, verificación de registros y borrador revisable. Solo después de probar roles, procedimientos, privacidad y autorización institucional se evaluaría usar datos reales. "+p.question,
  chips:["Ver circuito completo","Cuánto cuesta","Pedir evaluación"]};
 return {text:"Para automatizar "+p.name+" en una institución educativa propondría este circuito:\n\n"+p.steps.map((step,i)=>(i+1)+". "+step).join("\n")+"\n\n"+p.constraint+"\n\n"+p.question,chips};
}
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
function create(){return {sector:null,features:[],topic:null,project:null,turn:0,asked:"",lastAnswerType:"",other:""}}
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
 let sector=selectedSector(q);
 if(sector&&st.sector&&sector.id!==st.sector)st.project=null;
 if(sector)st.sector=sector.id;
 const explicitProject=projectFor(q,st.project);
 if(explicitProject){st.project=explicitProject.id;st.sector="educacion";}
 const knownProject=SCHOOL_PROJECTS.find(x=>x.id===st.project)||null;
 const selected=SECTORS.find(s=>s.id===st.sector)||null;
 const ff=listFeatures(q),hasExamples=/\b(ejemplos?|ideas?|casos practicos|mostrame|que podria|que puedo automatizar|automatiza|automatizar|se puede hacer)\b/.test(q);
 const price=/\b(cuanto (sale|cuesta|cobran|cobras|vale)|que (precio|costo|tarifa|valor)|precio|tarifa|costos?|costo aproximado|cotizar mi proyecto)\b/.test(q);
 const greeting=/^(hola|buenas|buen dia|que tal|buenas tardes|buenas noches)$/.test(q);
 const human=/\b(quiero contratar|hablar con (una persona|alguien|un humano)|necesito un asesor|como contacto|correo de contacto|quiero una evaluacion|pedir evaluacion|solicitar evaluacion)\b/.test(q);
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
 }else if(knownProject&&(explicitProject||
 /\b(analitico|paso a paso|etapas?|borrador|formulario|web|enspa|motor academico|libros? matriz|registro academico|digitalizar|automatizar|solicitudes?|exportar|datos|materias|firmas?|empezar|piloto|implementacion|como funcionaria|como se haria|fuentes|ver circuito|calificaciones?|notas?|ciclo|curso|division|alumnos?|matriculacion|legajo|matriz|exportacion|cada ano|complet\w*|carga|cargar)\b/.test(q)||
 (st.lastAnswerType==="proyecto_educativo"&&/\b(si|dale|quiero|hacerlo|avanzar|continuar)\b/.test(q)))) {
  const mode=knownProject.id==="legajos"?
   (/\b(enspa|motor academico|planillas|fuentes|exportar|importar|csv|excel)\b/.test(q)?"fuentes":
    /\b(empezar|piloto|arrancar|implementacion)\b/.test(q)?"piloto":
    /\b(cada ano|cada ciclo|ciclo lectivo|ciclo anual|cargar cada ano|carga cada ano|curso por ano)\b/.test(q)&&!explicitProject?"anual":
    /\b(matriz|libro matriz)\b/.test(q)&&!explicitProject?"matriz":
    /\b(calificaciones|notas|materias|periodos|evaluacion)\b/.test(q)&&!explicitProject?"notas":"pasos"):
   (/\b(enspa|motor academico|libros? matriz|planillas|fuentes|exportar|registros? academicos?)\b/.test(q)?"fuentes":
    /\b(empezar|piloto|arrancar|implementacion|como se haria)\b/.test(q)?"piloto":"pasos");
  const result=schoolReply(knownProject,mode);out=result.text;chips=result.chips;tag="proyecto_educativo";st.topic="sistema";
 }else if(price){
  let topic=st.topic|| (st.features.length>1?"sistema":"seguimiento");
  if(!st.sector&&!st.features.length)topic=null;
  out=quote(topic)+" Es un precio orientativo, no una cotización cerrada. Para "+(selected?(selected.id==="educacion"?"una ":"un ")+selected.name:"tu negocio")+", el costo cambia según módulos, cantidad de usuarios, datos e integraciones. ¿Querés empezar por una sola función o conectar varias?";
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
  out="Para "+(selected.id==="educacion"?"una ":"un ")+selected.name+" se me ocurren estas automatizaciones:\n\n"+
    selected.items.map((x,i)=>(i+1)+". "+x.charAt(0).toUpperCase()+x.slice(1)+".").join("\n")+
    "\n\n"+selected.starter+"\n\n"+selected.ask;
  st.topic="sistema";tag=selected.id;chips=selected.id==="taller"?["Turnos y presupuestos","Control de repuestos","Avisos a clientes","Cuánto cuesta"]:selected.id==="educacion"?["Legajos y libro matriz","Analíticos por solicitud web","Pases escolares","Equivalencias"]:["Turnos","Stock","Presupuestos","Cuánto cuesta"];
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
  // Una descripción operativa concreta merece una ruta útil, no reiterar "¿qué trámite?"
  const meaningful=q.split(" ").length>=8 && /\b(necesit\w*|quier\w*|sistema|automatiz\w*|volcar|cargar|registrar|ingresar|conectar|completar)\b/.test(q);
  if(meaningful && selected.id==="educacion"){
   out="Entiendo que querés conectar varias etapas de trabajo escolar en un mismo sistema, evitando cargar la misma información más de una vez. Primero habría que definir qué datos entran, qué personal puede modificarlos, qué validaciones se realizan y qué documentos o informes se generan, con revisión autorizada y un registro de cambios. Podríamos probar una sola etapa con datos ficticios. ¿Cuál sería el primer dato o trámite que ingresa al sistema?";
   tag="propuesta_escolar";chips=["Legajos y libro matriz","Analíticos por solicitud web","Empezar piloto","Pedir evaluación"];
  }else if(meaningful){
   out="Para tu "+selected.name+" propondría un circuito simple: registrar una vez la información de entrada, asignar estados y responsables, validar los cambios y generar un reporte o aviso según el resultado. Antes de prometer integraciones hay que revisar las herramientas actuales. ¿En qué programa o planilla registrás hoy esos datos?";
   tag="propuesta";chips=["Dame ejemplos","Cuánto cuesta","Pedir evaluación"];
  }else{
   out="Ya sé que hablamos de tu "+selected.name+". "+selected.starter+" "+selected.ask;
   tag=selected.id;chips=selected.id==="educacion"?["Legajos y libro matriz","Analíticos por solicitud web","Pases escolares","Equivalencias"]:["Dame ejemplos","Turnos y presupuestos","Cuánto cuesta"];
  }
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
 return {reply:out,tag,choices:chips,context:{sector:st.sector,features:st.features.slice(),topic:st.topic,project:st.project,turn:st.turn},state:st};
}
const api={create,guided,clean};
if(typeof module==="object"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.FluynovaGuardianBrain=api;
})();