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
 assert.match(r.reply,/sin enviarlas ni guardarlas/);
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
