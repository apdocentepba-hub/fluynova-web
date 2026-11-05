'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const brain = require('../static/guardian/guardian_aion.js');
function conversation(...messages) {
 const state = brain.create();
 return messages.map(message => brain.guided(message, state));
}

test('AION estructura diagnóstico en tres preguntas', () => {
 const [intro, task, frequency, plan] = conversation(
   'Analizar mi proceso', 'Copio datos en planillas', 'Todos los días', 'Tener un panel');
 assert.equal(intro.tag, 'aion_inicio');
 assert.equal(task.tag, 'aion_frecuencia');
 assert.equal(frequency.tag, 'aion_objetivo');
 assert.equal(plan.tag, 'aion_plan');
 assert.match(plan.reply, /datos ficticios/);
 assert.match(plan.reply, /panel/);
 assert.match(plan.reply, /No es un presupuesto ni una promesa de ahorro/);
});
test('El diagnóstico no interfiere con preguntas comunes de Guardián', () => {
 const r = conversation('tengo un taller mecanico', 'quiero turnos y presupuestos');
 assert.equal(r[1].context.sector, 'taller');
 assert.match(r[1].reply, /orden de trabajo/);
});
test('Precios mantienen el circuito comercial humano', () => {
 const st = brain.create();
 brain.guided('Analizar mi proceso', st);
 const r = brain.guided('cuanto cuesta', st);
 assert.notEqual(r.tag, 'aion_frecuencia');
 assert.equal(st.aion.stage, 'idle');
 assert.match(r.reply, /120\.000|240\.000|420\.000/);
});
test('Palabras sensibles evitan el diagnóstico y no generan acciones', () => {
 const st = brain.create();
 brain.guided('Analizar mi proceso', st);
 const r = brain.guided('¿Te paso mi contraseña o DNI?', st);
 assert.equal(st.aion.stage, 'idle');
 assert.match(r.reply, /No compartas claves/);
});
test('Dos visitantes no comparten el contexto del diagnóstico', () => {
 const a = brain.create(), b = brain.create();
 brain.guided('Analizar mi proceso', a);
 brain.guided('Controlar stock', a);
 assert.equal(b.aion.stage, 'idle');
 assert.equal(b.aion.process, null);
});
test('Salir del diagnóstico limpia el estado sin persistir mensajes', () => {
 const st = brain.create();
 brain.guided('Analizar mi proceso', st);
 const r = brain.guided('cancelar diagnostico', st);
 assert.equal(r.tag, 'aion_cierre');
 assert.deepEqual(st.aion, {stage:'idle', process:null, volume:null, goal:null});
 assert.ok(!JSON.stringify(st).includes('cancelar diagnostico'));
});
test('El motor AION público no incorpora proyectos ni datos personales', () => {
 const source = require('node:fs').readFileSync(require.resolve('../static/guardian/guardian_aion.js'), 'utf8');
 for(const term of ['Podubinio', 'ENSPA', 'AlertasAPD', 'apdocentepba', 'volve', 'Google Drive personal'])
   assert.equal(source.toLowerCase().includes(term.toLowerCase()), false);
});
