/* AION x GUARDIÁN: diagnóstico consultivo local.
 * No consulta memoria privada, no almacena mensajes ni usa servicios externos.
 * Las respuestas generativas siguen siendo opcionales en el backend de Guardián.
 */
(function () {
  'use strict';
  const base = typeof window !== 'undefined'
    ? window.FluynovaGuardianBrain
    : require('./guardian_brain.js');
  if (!base) return;

  function newAion() {
    return {stage:'idle',process:null,volume:null,goal:null,source:null,trigger:null,recipient:null};
  }
  function create() {
    const state = base.create();
    state.aion = newAion();
    return state;
  }
  function processOf(q) {
    if (/\b(turnos?|citas?|agenda|reservas?|reservaciones?)\b/.test(q)) return 'turnos';
    if (/\b(stock|inventario|repuestos?|existencias?)\b/.test(q)) return 'stock';
    if (/\b(pedidos?|presupuestos?|ventas?|facturas?|cotizaciones?)\b/.test(q)) return 'pedidos';
    if (/\b(consultas?|mensajes?|whatsapp|clientes? que escriben|responder|atender)\b/.test(q)) return 'consultas';
    if (/\b(vencimientos?|seguimiento|tramites?|expedientes?|etapas?|tareas pendientes)\b/.test(q)) return 'seguimiento';
    if (/\b(planillas?|excel|sheets|datos|papeles?|formularios?|copiar|copio|transcribir|duplicar|cargar)\b/.test(q)) return 'datos';
    return null;
  }
  function volumeOf(q) {
    if (/\b(diario|diaria|diarios|diarias|cada dia|todos los dias|por dia|al dia|cada jornada)\b/.test(q)) return 'diario';
    if (/\b(semanal|semanales|semanas?|por semana|a la semana|varias veces)\b/.test(q)) return 'semanal';
    if (/\b(mensual|mensuales|por mes|al mes|una vez al mes)\b/.test(q)) return 'mensual';
    return null;
  }
  function goalOf(q) {
    if (/\b(panel|tablero|centralizar|centraliz|ver todo|no perder|no se pierdan|trazabilidad)\b/.test(q)) return 'panel';
    if (/\b(avisos?|avisar|alertas?|recordatorios?|notificaciones?|notificar)\b/.test(q)) return 'avisos';
    if (/\b(reportes?|informes?|estadisticas?|indicadores?|medir)\b/.test(q)) return 'reportes';
    if (/\b(evitar|eliminar|reducir|sacar|no repetir|sin repetir|automatizar|copiar menos|carga doble|menos carga|menos tiempo|ahorrar)\b/.test(q)) return 'evitar doble carga';
    return null;
  }
  function triggerOf(q) {
    if (/\b(no lo se|no se|por definir|todavia no)\b/.test(q)) return 'por_definir';
    if (/\b(sin respuesta|no responde|espera|demora|tiempo sin|pasaron|seguimiento a las)\b/.test(q)) return 'sin_respuesta';
    if (/\b(vence|vencimiento|fecha limite|plazo|caduca)\b/.test(q)) return 'vencimiento';
    if (/\b(cambio de estado|cambia de estado|estado cambia|se completo|finalizado|listo el pedido)\b/.test(q)) return 'cambio_estado';
    if (/\b(nueva consulta|llega una consulta|nuevo mensaje|llega un mensaje|recibo un mensaje|entra una consulta|cuando escriben)\b/.test(q)) return 'nueva_consulta';
    return null;
  }
  function recipientOf(q) {
    if (/\b(no lo se|no se|por definir|todavia no)\b/.test(q)) return 'por_definir';
    if (/\b(ambos|los dos|equipo y cliente|cliente y equipo|a todos)\b/.test(q)) return 'ambos';
    if (/\b(clientes|cliente|usuario|solicitante|comprador)\b/.test(q)) return 'clientes';
    if (/\b(equipo|personal|administrador|a mi|para mi|interno|empleados|vendedor|responsable)\b/.test(q)) return 'equipo';
    return null;
  }
  const triggerText={
    nueva_consulta:'cuando ingresa una consulta nueva',
    sin_respuesta:'cuando una consulta sigue sin respuesta tras un plazo a definir',
    vencimiento:'cuando se acerca un vencimiento definido',
    cambio_estado:'cuando cambia el estado de una consulta',
    por_definir:'todavía por definir'
  };
  const recipientText={
    clientes:'clientes (solo con consentimiento y canal habilitado)',
    equipo:'equipo interno',
    ambos:'equipo interno y clientes autorizados',
    por_definir:'todavía por definir'
  };
  function startAlerts(st) {
    st.aion.goal='avisos';
    st.aion.stage='trigger';
    return answer('Entendido: necesitás avisos automáticos, no una frecuencia de trabajo. ¿Qué evento debería disparar cada aviso?',
      'aion_disparador',['Cuando llega una consulta','Sin respuesta después de un tiempo','Cambio de estado','No lo sé todavía'],st);
  }
  function alertPlan(st) {
    const a=st.aion, source=a.source||sources[a.process];
    const trigger=triggerText[a.trigger]||'todavía por definir';
    const recipient=recipientText[a.recipient]||'todavía por definir';
    const integration=a.source==='mensajes'
      ? '\nWhatsApp: integrar únicamente mediante un canal oficial autorizado; hoy NO está conectado ni enviamos mensajes.'
      : '\nEl canal de entrega y sus permisos deben verificarse antes de activar avisos reales.';
    return answer('Diagnóstico orientativo de FLUYNOVA:\n\n'+
      'Proceso: '+tasks[a.process]+' (fuente: '+source+').\n'+
      'Frecuencia: '+(a.volume==='sin medir'?'por determinar':a.volume)+'.\n'+
      'Objetivo: avisos automáticos.\n'+
      'Disparador: '+trigger+'.\n'+
      'Destinatarios: '+recipient+'.\n\n'+
      'Piloto recomendado:\n'+
      '1. Simular consultas y estados con datos ficticios, sin conectar WhatsApp.\n'+
      '2. Definir el evento y el plazo exacto que generan un aviso; evitar duplicados.\n'+
      '3. Simular la entrega al destinatario elegido y revisar permisos antes de cualquier envío real.\n'+
      '4. Medir avisos esperados, generados, omitidos y duplicados; revisar errores manualmente.\n\n'+
      'Frecuencia '+(a.volume==='sin medir'?'por determinar':'declarada: '+a.volume)+
      '. No es un presupuesto ni una promesa de ahorro.'+integration+
      '\n\n¿Querés pedir una evaluación para implementar este piloto?',
      'aion_plan',['Pedir evaluación','Cuánto cuesta','Analizar mi proceso'],st);
  }
  function sourceOf(q) {
    const tools=[];
    if (/\b(excel|sheets|planillas?|csv)\b/.test(q)) tools.push('planillas');
    if (/\b(whatsapp|mensajes?|chat)\b/.test(q)) tools.push('mensajes');
    if (/\b(papel|cuaderno|anotador|carpeta fisica)\b/.test(q)) tools.push('papel');
    if (/\b(sistema|software|programa|erp|crm)\b/.test(q)) tools.push('sistema existente');
    return tools.length ? tools.join(' y ') : null;
  }
  const tasks = {
    turnos:'turnos y disponibilidad', stock:'movimientos de inventario',
    pedidos:'pedidos y presupuestos', consultas:'consultas recibidas',
    seguimiento:'tareas y estados pendientes', datos:'carga y conciliación de datos'
  };
  const sources = {
    turnos:'agenda o registro de turnos', stock:'inventario actual',
    pedidos:'registro de pedidos', consultas:'registro de consultas',
    seguimiento:'lista de tareas y estados', datos:'archivo o formulario actual'
  };
  function answer(reply,tag,choices,st) {
    st.lastAnswerType=tag;
    return {reply,tag,choices,context:{
      sector:st.sector,features:st.features.slice(),topic:st.topic,
      project:st.project,turn:st.turn
    },state:st};
  }
  function guided(message,state) {
    const st=state||create();
    if (!st.aion) st.aion=newAion();
    const q=base.clean(message);
    const regular=base.guided(message,st);
    // Consultas de seguridad, presupuesto y contacto siguen en el motor probado.
    if (/\b(contrasena|contrasenas|claves? secreta|tokens?|dni|tarjetas?|datos? sensibles?|privacidad)\b/.test(q)
      || /\b(cuanto cuesta|cuanto sale|precios?|presupuesto cerrado|hablar con una persona|pedir evaluacion|como contacto|correo de contacto)\b/.test(q)) {
      st.aion=newAion();
      return regular;
    }
    if (/\b(cancelar diagnostico|salir del diagnostico|reiniciar diagnostico)\b/.test(q)) {
      st.aion=newAion();
      return answer('Cerré el diagnóstico guiado. Podés explorar otro proceso o solicitar una evaluación comercial.',
        'aion_cierre',['Analizar mi proceso','Cuánto cuesta','Pedir evaluación'],st);
    }
    const start=/\b(analiza mi proceso|analizar mi proceso|diagnostica mi|diagnostico mi|diagnosticar mi|diagnostico guiado|revisar mi proceso|quiero un chat inteligente|asesorame sobre mi negocio)\b/.test(q);
    if (start) {
      st.aion={...newAion(),stage:'task'};
      return answer('Soy Guardián con el método AION. Voy a analizar tu necesidad mediante preguntas adaptativas, sin acceder a tus sistemas ni conservar este chat. ¿Qué tarea te hace perder tiempo y con qué herramientas trabajás hoy?',
        'aion_inicio',['Copio datos en planillas','Gestiono turnos','Respondo consultas por WhatsApp','Controlo stock'],st);
    }
    if (st.aion.stage==='task') {
      const found=processOf(q);
      if (!found) return answer('Para no adivinar el problema, contame una tarea concreta. Por ejemplo: organizar consultas, controlar stock, cargar datos, registrar pedidos o gestionar turnos. ¿Cuál de esas tareas se parece más a la tuya?',
        'aion_aclaracion_tarea',['Consultas de clientes','Pedidos y presupuestos','Cargar datos en Excel','Turnos'],st);
      st.aion.process=found;
      st.aion.source=sourceOf(q);
      const knownVolume=volumeOf(q);
      if (knownVolume) {
        st.aion.volume=knownVolume;
        st.aion.stage='goal';
        return answer('Entendí que trabajás con '+tasks[found]+', con frecuencia '+knownVolume+'. ¿Qué querés mejorar primero?',
          'aion_objetivo',['Evitar carga doble','Tener un panel','Avisos automáticos','Generar reportes'],st);
      }
      st.aion.stage='volume';
      return answer('Identifiqué el área: '+tasks[found]+(st.aion.source?' usando '+st.aion.source:'')+'. ¿Con qué frecuencia hacés esa tarea? No incluyas nombres ni datos de clientes.',
        'aion_frecuencia',['Todos los días','Varias veces por semana','Una vez al mes','No lo sé'],st);
    }
    if (st.aion.stage==='volume') {
      const earlyGoal=goalOf(q);
      if (earlyGoal) {
        st.aion.volume=volumeOf(q)||'sin medir';
        if (earlyGoal==='avisos') return startAlerts(st);
        st.aion.goal=earlyGoal;
        st.aion.stage='done';
        const source=st.aion.source||sources[st.aion.process];
        const caution=st.aion.source==='mensajes'
          ? ' Los avisos a través de WhatsApp requieren una integración oficial autorizada.'
          : '';
        return answer('Diagnóstico orientativo de FLUYNOVA:\n\n'+
          '1. Relevar '+tasks[st.aion.process]+' (fuente: '+source+').\n'+
          '2. Diseñar un piloto pequeño con datos ficticios.\n'+
          '3. Medir el objetivo: '+earlyGoal+'.\n'+
          '4. Verificar permisos, errores, respaldo y revisión humana.\n\n'+
          'Frecuencia por determinar. No es un presupuesto ni una promesa de ahorro.'+caution,
          'aion_plan',['Pedir evaluación','Cuánto cuesta','Analizar mi proceso'],st);
      }
      st.aion.volume=volumeOf(q)||'sin medir';
      st.aion.stage='goal';
      return answer('Frecuencia: '+(st.aion.volume==='sin medir'?'todavía sin medir':st.aion.volume)+'. Para una primera versión pequeña, ¿qué resultado querés lograr?',
        'aion_objetivo',['Evitar carga doble','Tener un panel','Avisos automáticos','Generar reportes'],st);
    }
    if (st.aion.stage==='goal') {
      const goal=goalOf(q);
      if (!goal) return answer('Necesito un objetivo concreto para no inventar una solución. ¿Querés evitar la carga repetida, ordenar todo en un panel, recibir avisos o generar reportes?',
        'aion_aclaracion_objetivo',['Evitar carga doble','Tener un panel','Avisos automáticos','Generar reportes'],st);
      if (goal==='avisos') return startAlerts(st);
      st.aion.goal=goal;
      st.aion.stage='done';
      const sector=st.sector?' ('+st.sector+')':'';
      const source=st.aion.source||sources[st.aion.process];
      const caveat=st.aion.source&&/\bmensajes\b/.test(st.aion.source)
        ? '\nLos mensajes automáticos necesitarían una integración oficial habilitada y autorizada.':'';
      return answer('Diagnóstico orientativo de FLUYNOVA'+sector+':\n\n'+
        '1. Relevar cómo se registran hoy '+tasks[st.aion.process]+' (fuente: '+source+').\n'+
        '2. Armar un piloto acotado con datos ficticios, sin modificar sistemas actuales.\n'+
        '3. Definir una prueba medible para el objetivo: '+goal+'.\n'+
        '4. Comprobar permisos, errores, respaldo y aprobación humana antes de integrar sistemas reales.\n\n'+
        'Frecuencia declarada: '+(st.aion.volume||'sin medir')+'. No es un presupuesto ni una promesa de ahorro.'+caveat+
        '\n\n¿Querés pedir una evaluación para ese piloto?',
        'aion_plan',['Pedir evaluación','Cuánto cuesta','Analizar mi proceso'],st);
    }
    if (st.aion.stage==='trigger') {
      const trigger=triggerOf(q);
      if (!trigger) return answer('Para definir los avisos necesito el evento que los dispara, no cada cuánto trabajás. ¿Qué debería ocurrir?', 'aion_aclaracion_disparador',
        ['Cuando llega una consulta','Sin respuesta después de un tiempo','Cambio de estado','No lo sé todavía'],st);
      st.aion.trigger=trigger;
      st.aion.stage='recipient';
      return answer('Bien. ¿Quién debe recibir el aviso? Todavía no se enviará ninguno.',
        'aion_destinatarios',['Mi equipo','Los clientes','Ambos','No lo sé todavía'],st);
    }
    if (st.aion.stage==='recipient') {
      const recipient=recipientOf(q);
      if (!recipient) return answer('¿Los avisos serían para tu equipo, para clientes con autorización o para ambos?', 'aion_aclaracion_destinatarios',
        ['Mi equipo','Los clientes','Ambos','No lo sé todavía'],st);
      st.aion.recipient=recipient;
      st.aion.stage='done';
      return alertPlan(st);
    }
    return regular;
  }
  const api={create,guided,clean:base.clean};
  if (typeof module==='object'&&module.exports) module.exports=api;
  if (typeof window!=='undefined') window.FluynovaAionGuardian=api;
})();
