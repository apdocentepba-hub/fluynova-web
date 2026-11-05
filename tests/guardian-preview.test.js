'use strict';
/* Pruebas de interfaz aisladas. No acceden a Render, redes ni proveedores de IA. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const file = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function boot() {
  const items = new Map();
  const clipboard = [];
  const requests = [];
  class FakeNode {
    constructor(id) {
      this.id = id; this.events = {}; this.attrs = {}; this.children = [];
      this.hidden = true; this.dataset = {}; this.value = '';
      this.textContent = ''; this.disabled = false; this.style = {};
    }
    addEventListener(event, callback) { this.events[event] = callback; }
    getAttribute(key) { return this.attrs[key] || null; }
    setAttribute(key, value) { this.attrs[key] = value; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    querySelector(query) { return items.get(query) || null; }
    closest(query) {
      return query === '[data-q]' && this.attrs['data-q'] ? this : null;
    }
    focus() {}
    click() { this.events.click?.({ target: this, preventDefault() {} }); }
  }
  [
    '#fg-launcher', '#fg-panel', '#fg-log', '#fg-form',
    '#fg-question', '#fg-ai-consent', '#fg-ai-option',
    '#fg-send', '#fg-copy', '#fg-clear', '#fg-lead',
    '#fg-prompts', '.fg-close'
  ].forEach(name => items.set(name, new FakeNode(name)));
  const body = new FakeNode('body');
  body.dataset = { guardianPreview: 'true', guardianOpen: 'true' };
  const doc = {
    body,
    head: { appendChild() {} },
    createElement: tag => new FakeNode(tag),
    getElementById: id => body.children.length ? items.get('#' + id) : null
  };
  const sandbox = {
    window: {}, document: doc,
    navigator: { clipboard: { writeText: async value => { clipboard.push(value); } } },
    fetch: async url => {
      requests.push(String(url));
      if (url !== '/api/guardian/capabilities') {
        throw Error('No debe haber llamadas externas desde la vista previa');
      }
      return { ok: true, json: async () => ({ external_ai_enabled: true }) };
    },
    setTimeout: callback => callback(),
    AbortSignal: { timeout: () => ({}) }
  };
  const context = vm.createContext(sandbox);
  for (const p of [
    'static/guardian/guardian_brain.js',
    'static/guardian/guardian_aion.js',
    'static/guardian/guardian.js'
  ]) {
    new vm.Script(file(p), { filename: p }).runInContext(context);
  }
  return {
    item: name => items.get(name),
    clipboard, requests,
    submit(message) {
      items.get('#fg-question').value = message;
      items.get('#fg-form').events.submit({ preventDefault() {} });
    },
    messages() {
      return items.get('#fg-log').children.map(el => el.textContent);
    }
  };
}

test('flujo WhatsApp: frecuencia no se confunde con avisos y genera un diagnóstico', () => {
  const ui = boot();
  for (const text of [
    'Analizar mi proceso', 'Respondo consultas por WhatsApp',
    'Todos los días', 'Avisos automáticos',
    'Cuando llega una consulta', 'Mi equipo'
  ]) ui.submit(text);
  const result = ui.messages().join('\n');
  assert.match(result, /Frecuencia: diario/);
  assert.match(result, /Objetivo: avisos automáticos/);
  assert.match(result, /Disparador: cuando ingresa una consulta nueva/);
  assert.match(result, /Destinatarios: equipo interno/);
  assert.equal(ui.item('#fg-copy').hidden, false);
});

test('la vista previa no envía conversaciones a la IA aunque la API indique capacidad', async () => {
  const ui = boot();
  await Promise.resolve();
  assert.equal(ui.item('#fg-ai-option').hidden, true);
  for (const text of ['Analizar mi proceso','Respondo consultas por WhatsApp',
                      'quiero avisos automaticos','Cambio de estado','Mi equipo']) ui.submit(text);
  assert.equal(ui.requests.length,0,'Un sitio estático no debe intentar conectar a una API que no existe');
  assert.equal(ui.item('#fg-lead').href, 'https://fluynova-web.onrender.com/#contacto');
});

test('copiar diagnóstico no transmite ni altera el texto', async () => {
  const ui = boot();
  for (const text of ['Analizar mi proceso','Respondo consultas por WhatsApp',
                      'avisos automáticos','Cuando llega una consulta','Mi equipo']) ui.submit(text);
  ui.item('#fg-copy').click();
  await Promise.resolve();
  assert.equal(ui.clipboard.length, 1);
  assert.match(ui.clipboard[0], /Piloto recomendado:/);
  assert.match(ui.clipboard[0], /WhatsApp:/);
});

test('borrar chat reinicia estado y descarta historial visible', () => {
  const ui = boot();
  for (const text of ['Analizar mi proceso','Respondo consultas por WhatsApp',
                      'avisos automáticos','Cambio de estado','Mi equipo']) ui.submit(text);
  ui.item('#fg-clear').click();
  assert.equal(ui.messages().length, 1);
  assert.match(ui.messages()[0], /Conversación borrada/);
  assert.equal(ui.item('#fg-copy').hidden, true);
  ui.submit('Analizar mi proceso');
  assert.match(ui.messages().at(-1), /¿Qué tarea te hace perder tiempo/);
});
