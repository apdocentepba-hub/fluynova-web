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
 assert.deepEqual(st.aion, {stage:'idle', process:null, volume:null, goal:null, source:null, trigger:null, recipient:null});
 assert.ok(!JSON.stringify(st).includes('cancelar diagnostico'));
});
test('El motor AION público no incorpora proyectos ni datos personales', () => {
 const source = require('node:fs').readFileSync(require.resolve('../static/guardian/guardian_aion.js'), 'utf8');
 for(const term of ['Podubinio', 'ENSPA', 'AlertasAPD', 'apdocentepba', 'volve', 'Google Drive personal'])
   assert.equal(source.toLowerCase().includes(term.toLowerCase()), false);
});

test('La tarea libre reconoce WhatsApp, frecuencia y objetivo sin inventar integraciones', () => {
 const r=conversation('Analizar mi proceso','Respondo consultas por WhatsApp todos los días','Quiero avisos automáticos','Cuando llega una consulta','Mi equipo');
 assert.equal(r[1].tag,'aion_objetivo');
 assert.equal(r[2].tag,'aion_disparador');
 assert.equal(r[3].tag,'aion_destinatarios');
 assert.equal(r[4].tag,'aion_plan');
 assert.match(r[4].reply,/consultas recibidas/);
 assert.match(r[4].reply,/canal oficial autorizado/);
 assert.match(r[4].reply,/diario/);
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


test('Captura 05/11: objetivo adelantado no se confunde con frecuencia', () => {
 const r=conversation('Analizar mi proceso','Respondo consultas por WhatsApp','quiero avisos automaticos','Cuando llega una consulta','Mi equipo');
 assert.equal(r[1].tag,'aion_frecuencia');
 assert.equal(r[2].tag,'aion_disparador');
 assert.equal(r[3].tag,'aion_destinatarios');
 assert.equal(r[4].tag,'aion_plan');
 assert.match(r[4].reply,/Objetivo: avisos automáticos/);
 assert.match(r[4].reply,/Frecuencia por determinar/);
 assert.match(r[4].reply,/WhatsApp: integrar únicamente/);
});
test('La misma captura funciona con botones predefinidos y no mezcla sesiones', () => {
 const a=brain.create();brain.guided('Analizar mi proceso',a);brain.guided('Consultas de clientes',a);
 assert.equal(brain.guided('Avisos automáticos',a).tag,'aion_disparador');
 assert.equal(brain.guided('Cambio de estado',a).tag,'aion_destinatarios');
 assert.equal(brain.guided('Mi equipo',a).tag,'aion_plan');
 assert.equal(a.aion.stage,'done');
 const b=brain.create();assert.equal(b.aion.goal,null);
});

test('Distingue la frecuencia del evento que dispara avisos',()=>{
 const s=brain.create();for(const m of ['Analizar mi proceso','Respondo consultas por WhatsApp','Todos los días','Avisos automáticos'])brain.guided(m,s);
 assert.equal(brain.guided('Todos los días',s).tag,'aion_aclaracion_disparador');
 assert.equal(s.aion.volume,'diario');assert.equal(s.aion.trigger,null);
});
test('No inventa disparador ni destinatario si la persona no sabe',()=>{
 const r=conversation('Analizar mi proceso','Respondo consultas por WhatsApp','Avisos automáticos','No lo sé todavía','No lo sé todavía');
 assert.equal(r[4].tag,'aion_plan');assert.match(r[4].reply,/todavía por definir/);assert.match(r[4].reply,/NO está conectado/);
});
test('No conserva frases libres en las categorias del diagnóstico',()=>{
 const s=brain.create();for(const m of ['Analizar mi proceso','Respondo consultas por WhatsApp','Todos los días','Avisos automáticos','Cuando llega una consulta','Mi equipo'])brain.guided(m,s);
 assert.equal(s.aion.trigger,'nueva_consulta');assert.equal(s.aion.recipient,'equipo');
 assert.ok(!JSON.stringify(s.aion).includes('Respondo consultas'));
});
test('Vuelve a preguntar ante un evento y un destinatario ambiguos',()=>{
 const s=brain.create();for(const m of ['Analizar mi proceso','Respondo consultas por WhatsApp','Avisos automáticos'])brain.guided(m,s);
 assert.equal(brain.guided('necesito algo urgente',s).tag,'aion_aclaracion_disparador');
 assert.equal(brain.guided('Cambio de estado',s).tag,'aion_destinatarios');
 assert.equal(brain.guided('esta semana',s).tag,'aion_aclaracion_destinatarios');
});
