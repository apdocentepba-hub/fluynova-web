/* AION x Guardián: consultoría guiada sin red, credenciales ni memoria privada.
 * Mantiene el motor existente; el modelo generativo solo se usa con opt-in y API configurada.
 */
(function () {
  'use strict';
  const base = typeof window !== 'undefined'
    ? window.FluynovaGuardianBrain
    : require('./guardian_brain.js');
  if (!base) return;

  function create() {
    const state = base.create();
    state.aion = {stage: 'idle', process: null, volume: null, goal: null};
    return state;
  }
  function classifyProcess(q) {
    if (/turnos?|citas?|agenda|reservas?/.test(q)) return 'turnos';
    if (/stock|inventario|repuestos|productos/.test(q)) return 'stock';
    if (/pedido|presupuest|venta|factur/.test(q)) return 'pedidos';
    if (/planilla|excel|sheets|copiar|cargar datos|duplic/.test(q)) return 'datos';
    return 'proceso';
  }
  function classifyVolume(q) {
    if (/diari|cada dia|todos los dias|por dia|cada jornada/.test(q)) return 'diario';
    if (/seman|varias veces/.test(q)) return 'semanal';
    if (/mensual|por mes|una vez al mes/.test(q)) return 'mensual';
    return 'sin medir';
  }
  function classifyGoal(q) {
    if (/panel|tablero|centraliz|ver todo/.test(q)) return 'panel';
    if (/avis|recordatori|notific/.test(q)) return 'avisos';
    if (/report|informe|estadist/.test(q)) return 'reportes';
    return 'evitar doble carga';
  }
  const tasks = {
    turnos: 'turnos y disponibilidad',
    stock: 'movimientos y existencias',
    pedidos: 'pedidos y presupuestos',
    datos: 'carga y conciliación de datos',
    proceso: 'tareas repetitivas'
  };
  function answer(reply, tag, choices, st) {
    st.lastAnswerType = tag;
    return {
      reply, tag, choices,
      context: {sector: st.sector, features: st.features.slice(), topic: st.topic,
        project: st.project, turn: st.turn}, state: st
    };
  }
  function guided(message, state) {
    const st = state || create();
    if (!st.aion) st.aion = {stage: 'idle', process: null, volume: null, goal: null};
    const q = base.clean(message);
    const regular = base.guided(message, st);
    // Mantener intactas las salvaguardas, privacidad, costos y contacto del motor original.
    if (/contrasen|contrasena|clave secreta|token|dni|tarjeta|dato sensible|privacidad|cuanto cuesta|precio|presupuesto cerrado|hablar con una persona|contacto/.test(q)) {
      st.aion.stage = 'idle';
      return regular;
    }
    if (/cancelar diagnostico|salir del diagnostico|reiniciar diagnostico/.test(q)) {
      st.aion = {stage: 'idle', process: null, volume: null, goal: null};
      return answer('Cerré el diagnóstico guiado. Si querés, podemos explorar otro proceso o preparar una consulta comercial.',
        'aion_cierre', ['Analizar mi proceso', 'Cuánto cuesta', 'Pedir evaluación'], st);
    }
    const start = /analiza mi proceso|analizar mi proceso|diagnostic(a|o|ar) mi|diagnostico guiado|revisar mi proceso|quiero un chat inteligente|asesorame sobre mi negocio/.test(q);
    if (start) {
      st.aion = {stage: 'task', process: null, volume: null, goal: null};
      return answer('Soy Guardián con el método de análisis AION. Vamos a diseñar un diagnóstico orientativo en tres preguntas, sin acceder a tus sistemas ni guardar esta conversación. Primero: ¿qué tarea repetitiva te hace perder más tiempo y cómo la resolvés hoy?',
        'aion_inicio', ['Copio datos en planillas', 'Gestiono turnos', 'Cargo pedidos y presupuestos', 'Controlo stock'], st);
    }
    if (st.aion.stage === 'task') {
      st.aion.process = classifyProcess(q);
      st.aion.stage = 'volume';
      return answer('Identifiqué el área de trabajo: ' + tasks[st.aion.process] + '. Para priorizar sin inventar ahorros, ¿con qué frecuencia realizás esa tarea? No incluyas nombres ni datos de clientes.',
        'aion_frecuencia', ['Todos los días', 'Varias veces por semana', 'Una vez al mes', 'No lo sé'], st);
    }
    if (st.aion.stage === 'volume') {
      st.aion.volume = classifyVolume(q);
      st.aion.stage = 'goal';
      return answer('Anotado: frecuencia ' + (st.aion.volume === 'sin medir' ? 'todavía sin medir' : st.aion.volume) + '. ¿Cuál es el resultado que más necesitás conseguir con una primera versión pequeña?',
        'aion_objetivo', ['Evitar carga doble', 'Tener un panel', 'Avisos automáticos', 'Generar reportes'], st);
    }
    if (st.aion.stage === 'goal') {
      st.aion.goal = classifyGoal(q);
      st.aion.stage = 'done';
      const sector = st.sector ? ' (' + st.sector + ')' : '';
      const source = st.aion.process === 'turnos' ? 'agenda o registro de turnos' :
        st.aion.process === 'stock' ? 'inventario actual' :
        st.aion.process === 'pedidos' ? 'registro de pedidos' : 'archivo o formulario actual';
      return answer('Diagnóstico orientativo de FLUYNOVA' + sector + ':\n\n' +
        '1. Relevar cómo se registran hoy ' + tasks[st.aion.process] + '.\n' +
        '2. Armar un piloto con datos ficticios a partir del ' + source + '.\n' +
        '3. Probar una mejora medible: ' + st.aion.goal + '.\n' +
        '4. Validar permisos, errores, respaldo y aprobación humana antes de conectar servicios reales.\n\n' +
        'Frecuencia declarada: ' + st.aion.volume + '. No es un presupuesto ni una promesa de ahorro; toda integración necesita verificarse. ' +
        '¿Querés que evaluemos este piloto con una persona?',
        'aion_plan', ['Pedir evaluación', 'Cuánto cuesta', 'Analizar mi proceso'], st);
    }
    return regular;
  }
  const api = {create, guided, clean: base.clean};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FluynovaAionGuardian = api;
})();