/*
 * FLUYNOVA — demostración comercial offline de flujo municipal.
 * NO IA, NO fetch(), NO network, NO storage, NO datos personales.
 * El prototipo no habilita ninguna operación administrativa real.
 */
(() => {
  'use strict';
  const labels = Object.freeze({
    new: 'Nueva',
    assigned: 'Derivada',
    resolved: 'Resuelta'
  });
  const transitions = Object.freeze({
    new: 'assigned',
    assigned: 'resolved'
  });
  const actions = Object.freeze({
    new: 'Derivar al área',
    assigned: 'Marcar resuelta',
    resolved: 'Resuelta'
  });
  const list = document.getElementById('case-list');
  const notice = document.getElementById('demo-notice');
  const countNew = document.getElementById('count-new');
  const countAssigned = document.getElementById('count-assigned');
  const countResolved = document.getElementById('count-resolved');
  const reset = document.getElementById('reset-demo');
  if (!list || !notice || !countNew || !countAssigned || !countResolved || !reset) {
    return;
  }
  const rows = [...list.querySelectorAll('[data-case]')];
  const initialIds = new Set(['DEMO-001', 'DEMO-002', 'DEMO-003']);
  if (rows.length !== 3 || rows.some(row => !initialIds.has(row.dataset.case))) {
    return;
  }
  function sync() {
    const counts = {new: 0, assigned: 0, resolved: 0};
    for (const row of rows) {
      const state = row.dataset.state;
      if (!Object.hasOwn(counts, state)) continue;
      counts[state] += 1;
      const stateElement = row.querySelector('.case-status');
      const button = row.querySelector('button[data-advance]');
      if (!stateElement || !button) continue;
      stateElement.textContent = labels[state];
      button.textContent = actions[state];
      button.disabled = state === 'resolved';
      button.setAttribute('aria-label', actions[state] + ' — ' + row.dataset.case);
    }
    countNew.textContent = String(counts.new);
    countAssigned.textContent = String(counts.assigned);
    countResolved.textContent = String(counts.resolved);
  }
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-advance]');
    if (!button || button.disabled || !list.contains(button)) return;
    const row = rows.find(item => item.dataset.case === button.dataset.advance);
    if (!row || !Object.hasOwn(transitions, row.dataset.state)) return;
    row.dataset.state = transitions[row.dataset.state];
    sync();
    notice.textContent = 'Solicitud ficticia ' + row.dataset.case + ': ' +
      labels[row.dataset.state].toLowerCase() + '. No se enviaron datos ni se modificó ningún sistema.';
  });
  reset.addEventListener('click', () => {
    for (const row of rows) row.dataset.state = 'new';
    sync();
    notice.textContent = 'Ejemplo reiniciado. Todos los casos son ficticios.';
  });
  sync();
})();
