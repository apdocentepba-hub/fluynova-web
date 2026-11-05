'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {diagnose, isTransient} = require('./hosting-cold-start.js');
const failure = {code: 'NO_CONFIABLE', health: 'HTTP_503', config: 'HTTP_503'};
const available = {code: 'FORMULARIO_DESHABILITADO', health: 'OK', config: 'OK'};
const enabled = {code: 'CONFIG_HABILITADA_SIN_RECEPCION_PROBADA', health: 'OK', config: 'OK'};
function setup(sequence) {
  let count = 0; const waits = [];
  return {waits, calls: () => count,
    checkOnce: async () => { count++; return sequence[Math.min(count - 1, sequence.length - 1)]; },
    wait: async ms => {waits.push(ms);}};
}
test('sin error no repite ni declara entrega', async () => {
  const x = setup([available]); const r = await diagnose(x);
  assert.equal(r.classification, 'RESPONDIO_EN_PRIMER_INTENTO');
  assert.equal(x.calls(), 1); assert.equal(r.canClaimReception, false);
  assert.equal(r.canProveColdStartCause, false); assert.deepEqual(x.waits, []);
});
test('HTTP 503 seguido de 200 se clasifica como recuperación, no causa comprobada', async () => {
  const x = setup([failure, available]); const r = await diagnose(x);
  assert.equal(r.classification, 'RECUPERADO_EN_REINTENTO');
  assert.equal(r.samples.length, 2); assert.equal(r.requestsMax, 4);
  assert.deepEqual(x.waits, [5000]); assert.equal(r.canProveColdStartCause, false);
});
test('tres HTTP 503 no se declaran como disponible', async () => {
  const x = setup([failure]); const r = await diagnose(x);
  assert.equal(r.classification, 'FALLO_TRANSITORIO_REPETIDO');
  assert.equal(x.calls(), 3); assert.deepEqual(x.waits, [5000, 5000]);
});
test('JSON incorrecto se detiene y no confunde el error con frío', async () => {
  const x = setup([{code:'NO_CONFIABLE',health:'OK',config:'INVALID_SCHEMA'}]);
  const r = await diagnose(x); assert.equal(x.calls(),1);
  assert.equal(r.classification,'RESPUESTA_INVALIDA_O_ERROR_NO_TRANSITORIO');
});
test('configuración activa tampoco demuestra entrega', async () => {
  const x = setup([enabled]); const r = await diagnose(x);
  assert.equal(r.canClaimReception,false);
});
test('acepta error de red para reintento limitado', async () => {
  const x=setup([{code:'NO_CONFIABLE',health:'NETWORK_OR_TIMEOUT',config:'OK'},available]);
  const r=await diagnose(x); assert.equal(r.classification,'RECUPERADO_EN_REINTENTO');
});
test('no reintenta cualquier status no transitorio', async () => {
  assert.equal(isTransient({code:'NO_CONFIABLE',health:'HTTP_404',config:'OK'}),false);
  const x=setup([{code:'NO_CONFIABLE',health:'HTTP_404',config:'OK'}]);
  await diagnose(x); assert.equal(x.calls(),1);
});
test('valida máximos para no generar sondeos ilimitados', async () => {
  const x=setup([available]);
  await assert.rejects(diagnose({...x,attempts:100}),TypeError);
  await assert.rejects(diagnose({...x,delayMs:100000}),TypeError);
  await assert.rejects(diagnose({}),TypeError);
  assert.equal(x.calls(),0);
});
test('error lanzado por verificación no produce datos personales', async () => {
  const x={checkOnce:async()=>{throw Error('credenciales de prueba')},wait:async()=>{}};
  const r=await diagnose({...x,attempts:1});
  assert.equal(r.classification,'FALLO_TRANSITORIO_REPETIDO');
  assert.equal(JSON.stringify(r).includes('credenciales'),false);
});
