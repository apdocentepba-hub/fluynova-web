'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const brain = require('../static/guardian/guardian_brain.js');
function conversation(...messages){const state=brain.create();return messages.map(q=>brain.guided(q,state));}
test('Primer mensaje: ejemplos concretos, no respuesta genérica',()=>{
 const [r]=conversation('dame ejemplos');
 assert.match(r.reply,/Taller mecánico/);
 assert.match(r.reply,/Peluquería/);
 assert.match(r.reply,/Comercio/);
 assert.match(r.reply,/¿Qué tipo de negocio tenés\?/);
});
test('Captura real: taller mecánico produce 5 ejemplos de rubro',()=>{
 const [r]=conversation('automatizar mi taller mecanico');
 assert.equal(r.context.sector,'taller');
 assert.match(r.reply,/Órdenes de reparación/);
 assert.match(r.reply,/repuestos y mano de obra/);
 assert.match(r.reply,/¿Qué te hace perder más tiempo/);
});
test('Seguimiento: presupuesto y turnos conduce a proceso real y pregunta',()=>{
 const [,r]=conversation('automatizar mi taller mecanico','quiero turnos y presupuestos');
 assert.match(r.reply,/cliente pide turno/);
 assert.match(r.reply,/vehículo/);
 assert.match(r.reply,/aprobación/);
 assert.match(r.reply,/¿Hoy tomás turnos por WhatsApp/);
 assert.deepEqual(r.context.features.sort(),['presupuestos','turnos'].sort());
});
test('Precio contextual sin afirmar presupuesto fijo',()=>{
 const [,,r]=conversation('automatizar mi taller mecanico','quiero turnos y presupuestos','y cuanto cuesta?');
 assert.match(r.reply,/\$420\.000/);
 assert.match(r.reply,/orientativo, no una cotización cerrada/);
 assert.match(r.reply,/taller mecánico/);
});
test('Ejemplos contextualizados cuando ya conocemos el rubro',()=>{
 const [,r]=conversation('tengo una peluqueria','dame ejemplos');
 assert.match(r.reply,/peluquería/);
 assert.match(r.reply,/recordatorios/);
 assert.doesNotMatch(r.reply,/Taller mecánico:/);
});
test('Control de stock en una ferretería',()=>{
 const [,r]=conversation('Tengo una ferreteria','quiero controlar stock');
 assert.match(r.reply,/stock/);
 assert.equal(r.context.sector,'comercio');
});
test('Seguridad y datos personales',()=>{
 const [r]=conversation('¿Es seguro pasar contraseñas y DNI?');
 assert.match(r.reply,/No compartas claves/);
 assert.match(r.reply,/no se guardan en Fluynova/);
});
test('La integración externa no se promete como disponible',()=>{
 const [,r]=conversation('tengo un taller mecanico','¿Podés integrar Mercado Pago y WhatsApp automáticamente?');
 assert.match(r.reply,/API oficial/);
 assert.match(r.reply,/No afirmo que ya esté conectada/);
});
test('Precios genéricos sin rubro incluyen tres entradas',()=>{
 const [r]=conversation('cuanto sale?');
 assert.match(r.reply,/120\.000/);
 assert.match(r.reply,/240\.000/);
 assert.match(r.reply,/420\.000/);
});
test('Consultas comerciales siempre requieren una persona para presupuesto',()=>{
 const [r]=conversation('quiero hablar con una persona');
 assert.match(r.reply,/formulario de Fluynova/);
 assert.match(r.reply,/la revisará una persona/);
});
test('Alerta realista sin prometer envío autónomo',()=>{
 const [,r]=conversation('taller mecánico','quiero avisos automáticos a clientes');
 assert.match(r.reply,/WhatsApp requerirían una integración autorizada/);
});
test('La conversación no guarda datos globales y estados separados no contaminan',()=>{
 const a=brain.create(),b=brain.create();
 brain.guided('taller mecánico',a);
 const response=brain.guided('dame ejemplos',b);
 assert.equal(b.sector,null);
 assert.match(response.reply,/Taller mecánico:/);
 assert.equal(a.sector,'taller');
});

test('Captura 26/10: el pedido concreto de analíticos recibe un circuito en lugar de repetir una pregunta',()=>{
 const [first,next]=conversation('tengo una institucion educativa','diseño automatico de analiticos segun solicitud web');
 assert.equal(next.context.sector,'educacion');
 assert.equal(next.context.project,'analiticos');
 assert.match(next.reply,/formulario web/);
 assert.match(next.reply,/borrador/);
 assert.match(next.reply,/Secretaría/);
 assert.match(next.reply,/las firmas oficiales/);
 assert.doesNotMatch(next.reply,/¿Qué trámite te ocupa más tiempo\?/);
 assert.notEqual(next.reply,first.reply);
});
test('Un analítico pedido directamente sin decir rubro es reconocido',()=>{
 const [r]=conversation('quisiera un sistema de analíticos automáticos por solicitudes web');
 assert.equal(r.context.project,'analiticos');
 assert.match(r.reply,/bandeja privada/);
 assert.match(r.reply,/Secretaría revisa el borrador/);
});
test('Seguimiento ENSPA específico, sin inventar API ni permisos',()=>{
 const [,,r]=conversation('trabajo en una escuela','diseño de analiticos segun solicitud web','uso ENSPA y Motor Academico y planillas');
 assert.equal(r.context.project,'analiticos');
 assert.match(r.reply,/No hay integración confirmada/);
 assert.match(r.reply,/ENSPA/);
});
test('Ruta de primer piloto para analíticos',()=>{
 const [,,r]=conversation('institución educativa','analíticos desde la web','Empezar piloto');
 assert.match(r.reply,/datos ficticios/);
 assert.match(r.reply,/autorización institucional/);
});
test('El chat educativo ofrece chips relacionados, no turnos de taller',()=>{
 const [r]=conversation('tengo una institucion educativa');
 assert.deepEqual(r.choices.slice(0,4),['Legajos y libro matriz','Analíticos por solicitud web','Pases escolares','Equivalencias']);
});
test('Opciones educativas seleccionadas se convierten en proyecto',()=>{
 const [a,b]=conversation('tengo una institucion educativa','Analíticos por solicitud web');
 assert.equal(b.context.project,'analiticos');
 assert.match(b.reply,/Secretaría/);
});
test('Equivalencias no se convierten en decisiones automáticas',()=>{
 const [r]=conversation('quiero hacer dictamen de equivalencias');
 assert.equal(r.context.project,'equivalencias');
 assert.match(r.reply,/tabla de reglas/);
 assert.match(r.reply,/resolución administrativa/);
});
test('Pases escolares con estado y revisión autorizada',()=>{
 const [r]=conversation('solicitudes de pases escolares');
 assert.equal(r.context.project,'pases');
 assert.match(r.reply,/Secretaría/);
});
test('Proyectos distintos no contaminan una nueva conversación',()=>{
 const a=brain.create(),b=brain.create();
 brain.guided('analiticos escolares',a);
 const other=brain.guided('mi taller mecanico',b);
 assert.equal(a.project,'analiticos');
 assert.equal(b.project,null);
 assert.equal(other.context.sector,'taller');
});
test('La consulta por precio sigue contextualizada a la gestión escolar',()=>{
 const [,,r]=conversation('institucion educativa','analiticos web','cuanto cuesta?');
 assert.match(r.reply,/420\.000/);
 assert.match(r.reply,/una institución educativa/);
});

test('Tras informar ENSPA y planillas, pregunta por exportación y no vuelve a pedir fuentes',()=>{
 const [,,r]=conversation('institución educativa','analíticos por solicitud web','uso ENSPA y planillas');
 assert.match(r.reply,/¿Podés exportar un listado autorizado en CSV o Excel/);
 assert.doesNotMatch(r.reply,/¿Los datos ya están en ENSPA/);
});


test('Captura: pedido integral de alumno, notas y libro matriz genera una arquitectura específica',()=>{
 const [first,r]=conversation('tengo una institucion educativa','necesito un sistema para volcar al alumno apenas ingresa ingresar todos sus datos volcar calificaciones que se vaya completando el matriz de cada año y demas cosas');
 assert.equal(r.context.project,'legajos');
 assert.equal(r.context.sector,'educacion');
 assert.match(r.reply,/sistema integral de gestión académica/);
 assert.match(r.reply,/Inscripción/);
 assert.match(r.reply,/Trayectoria anual/);
 assert.match(r.reply,/Calificaciones/);
 assert.match(r.reply,/Libro matriz/);
 assert.match(r.reply,/borrador/);
 assert.match(r.reply,/protección de datos/);
 assert.notEqual(r.reply,first.reply);
 assert.doesNotMatch(r.reply,/¿Qué trámite te ocupa más tiempo/);
});
test('Un pedido integral sin hablar antes de una escuela se identifica',()=>{
 const [r]=conversation('necesito un sistema para ingresar alumnos, cargar notas y completar libro matriz cada año');
 assert.equal(r.context.project,'legajos');
 assert.match(r.reply,/identificador interno/);
 assert.match(r.reply,/libro matriz/);
});
test('Variantes de vocabulario: cargar legajos y notas',()=>{
 const [,r]=conversation('institucion educativa','quiero cargar legajos y notas');
 assert.equal(r.context.project,'legajos');
 assert.match(r.reply,/gestión académica/);
});
test('Consulta contextual sobre libro matriz explica revisión humana y no vuelve al inicio',()=>{
 const [,,r]=conversation('institucion educativa','quiero cargar legajos y notas','cómo se completa la matriz?');
 assert.equal(r.context.project,'legajos');
 assert.match(r.reply,/cursadas cerradas/);
 assert.match(r.reply,/no completar ni firmar automáticamente el libro matriz oficial/);
 assert.doesNotMatch(r.reply,/¿Qué trámite te ocupa más tiempo/);
});
test('Seguimiento anual responde cómo se arma el registro de cada año',()=>{
 const [,,r]=conversation('institucion educativa','Legajos y libro matriz','Cómo se carga cada año');
 assert.match(r.reply,/Cada ciclo lectivo se crea una ficha anual/);
 assert.match(r.reply,/plan vigente/);
 assert.match(r.reply,/sin transcribir dos veces/);
});
test('Seguimiento de calificaciones indica roles y rectificaciones',()=>{
 const [,,r]=conversation('institucion educativa','Legajos y libro matriz','Cómo se cargan las notas');
 assert.match(r.reply,/docente habilitado/);
 assert.match(r.reply,/Secretaría revisa rectificaciones/);
});
test('Fuentes educativas no se convierten en promesas de integración con ENSPA',()=>{
 const [,,r]=conversation('institucion educativa','Legajos y libro matriz','uso ENSPA y planillas');
 assert.equal(r.context.project,'legajos');
 assert.match(r.reply,/no afirmo que ENSPA tenga API/i);
 assert.match(r.reply,/autorizada/);
});
test('El piloto escolar usa registros ficticios, no datos de menores reales',()=>{
 const [,,r]=conversation('institucion educativa','Legajos y libro matriz','Empezar piloto');
 assert.match(r.reply,/alumnos ficticios/);
 assert.match(r.reply,/autorización institucional/);
});
test('Intención corta: digitalizar legajo escolar',()=>{
 const [r]=conversation('quiero digitalizar el legajo escolar');
 assert.equal(r.context.project,'legajos');
});
test('Botones del rubro escolar incluyen legajos',()=>{
 const [r]=conversation('tengo una institucion educativa');
 assert.equal(r.choices[0],'Legajos y libro matriz');
 assert.ok(r.choices.includes('Analíticos por solicitud web'));
});
test('Un proyecto no reconocido pero detallado obtiene una propuesta, no repetición genérica',()=>{
 const [first,r]=conversation('institucion educativa','necesito un sistema que revise mis tareas y me permita generar constancias');
 assert.equal(r.tag,'propuesta_escolar');
 assert.match(r.reply,/definir qué datos entran/);
 assert.notEqual(r.reply,first.reply);
 assert.doesNotMatch(r.reply,/¿Qué trámite te ocupa más tiempo/);
});
test('Pedir evaluación funciona como instrucción de contacto',()=>{
 const [,,r]=conversation('institucion educativa','Legajos y libro matriz','Pedir evaluación');
 assert.equal(r.tag,'contacto');
 assert.match(r.reply,/formulario de Fluynova/);
});
test('Un analítico desde libros matriz conserva el proyecto analítico, no legajos',()=>{
 const [,,r]=conversation('institucion educativa','analíticos por solicitud web','uso ENSPA y libros matriz');
 assert.equal(r.context.project,'analiticos');
 assert.match(r.reply,/No hay integración confirmada/);
});
test('Consultas de taller conservan funcionalidad anterior',()=>{
 const [a,b]=conversation('automatizar mi taller mecanico','quiero turnos y presupuestos');
 assert.equal(a.context.sector,'taller');
 assert.equal(b.context.project,null);
 assert.match(b.reply,/orden de trabajo/);
});
