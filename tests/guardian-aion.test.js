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
 assert.deepEqual(st.aion, {stage:'idle', process:null, volume:null, goal:null, source:null});
 assert.ok(!JSON.stringify(st).includes('cancelar diagnostico'));
});
test('El motor AION público no incorpora proyectos ni datos personales', () => {
 const source = require('node:fs').readFileSync(require.resolve('../static/guardian/guardian_aion.js'), 'utf8');
 for(const term of ['Podubinio', 'ENSPA', 'AlertasAPD', 'apdocentepba', 'volve', 'Google Drive personal'])
   assert.equal(source.toLowerCase().includes(term.toLowerCase()), false);
});

test('La tarea libre reconoce WhatsApp, frecuencia y objetivo sin inventar integraciones', () => {
  const [,question,objective,plan]=conversation(
    'Analizar mi proceso',
    'Respondo consultas por WhatsApp todos los días',
    'Quiero avisos automáticos',
    'no debería llegar a esta etapa'
  );
  assert.equal(question.tag, 'aion_objetivo');
  assert.equal(objective.tag, 'aion_plan');
  assert.match(objective.reply, /consultas recibidas/);
  assert.match(objective.reply, /integración oficial/);
  assert.match(objective.reply, /diario/);
  assert.notEqual(plan.tag, 'aion_plan');
});
test('No se inventa una tarea si el visitante no explicó qué hace', () => {
  const [,reply]=conversation('Analizar mi proceso','no sé qué necesito');
  assert.equal(reply.tag,'aion_aclaracion_tarea');
  assert.match(reply.reply,/no adivinar el problema/);
});
test('El pedido de seguimiento se clasifica por rubro y propone piloto', () => {
  const [,step,,plan]=conversation(
    'Analizar mi proceso',
    'Llevo seguimiento de vencimientos en un cuaderno',
    'Una vez al mes',
    'Tener un panel'
  );
  assert.equal(step.tag,'aion_frecuencia');
  assert.match(plan.reply,/tareas y estados pendientes/);
  assert.match(plan.reply,/papel/);
});
test('Un objetivo desconocido no fabrica una promesa ni cierra el diagnóstico', () => {
  const state=brain.create();
  brain.guided('Analizar mi proceso',state);
  brain.guided('Controlo stock',state);
  brain.guided('todos los días',state);
  const answer=brain.guided('quiero algo lindo',state);
  assert.equal(answer.tag,'aion_aclaracion_objetivo');
  assert.equal(state.aion.stage,'goal');
});
test('Respuestas comerciales habituales se mantienen disponibles después del diagnóstico', () => {
  const state=brain.create();
  brain.guided('Analizar mi proceso',state);
  brain.guided('Gestiono turnos',state);
  brain.guided('semanal',state);
  brain.guided('generar reportes',state);
  const r=brain.guided('cuanto cuesta',state);
  assert.match(r.reply,/orientativo|120\.000|240\.000|420\.000/);
  assert.equal(state.aion.stage,'idle');
});
test('El estado AION no almacena texto libre ni datos particulares', () => {
  const state=brain.create();
  brain.guided('Analizar mi proceso',state);
  brain.guided('Consultas de clientes por WhatsApp',state);
  assert.equal(state.aion.process,'consultas');
  assert.equal(state.aion.source,'mensajes');
  assert.ok(!JSON.stringify(state.aion).includes('clientes por WhatsApp'));
});
