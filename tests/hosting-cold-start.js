'use strict';
/**
 * FLUYNOVA: diagnóstico manual y de solo lectura para arranques en frío.
 * Único modo online: node tests/hosting-cold-start.js --online
 * Reutiliza check() del monitor de /api/health y /api/config: exclusivamente GET.
 * Nunca prueba ni declara entrega de mensajes de FormSubmit.
 */
const TRANSIENT = new Set(['HTTP_502', 'HTTP_503', 'HTTP_504', 'NETWORK_OR_TIMEOUT']);
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 5000;
function isTransient(sample) {
  return sample?.code === 'NO_CONFIABLE' &&
    (TRANSIENT.has(sample.health) || TRANSIENT.has(sample.config));
}
async function diagnose({checkOnce, wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
  attempts = DEFAULT_ATTEMPTS, delayMs = DEFAULT_DELAY_MS} = {}) {
  if (typeof checkOnce !== 'function' || typeof wait !== 'function' ||
      !Number.isInteger(attempts) || attempts < 1 || attempts > 3 ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10000) {
    throw new TypeError('Configuración de diagnóstico inválida');
  }
  const samples = [];
  for (let i = 0; i < attempts; i++) {
    let sample;
    try {
      sample = await checkOnce();
    } catch {
      sample = {code: 'NO_CONFIABLE', health: 'NETWORK_OR_TIMEOUT', config: 'NETWORK_OR_TIMEOUT'};
    }
    const safe = {
      code: String(sample?.code || 'NO_CONFIABLE'),
      health: String(sample?.health || 'INVALID_SCHEMA'),
      config: String(sample?.config || 'INVALID_SCHEMA'),
    };
    samples.push(safe);
    if (safe.code !== 'NO_CONFIABLE' || !isTransient(safe) || i === attempts - 1) break;
    await wait(delayMs);
  }
  const last = samples[samples.length - 1];
  const classification = last.code !== 'NO_CONFIABLE'
    ? (samples.length > 1 ? 'RECUPERADO_EN_REINTENTO' : 'RESPONDIO_EN_PRIMER_INTENTO')
    : (isTransient(last) ? 'FALLO_TRANSITORIO_REPETIDO' : 'RESPUESTA_INVALIDA_O_ERROR_NO_TRANSITORIO');
  return Object.freeze({classification, samples, requestsMax: samples.length * 2,
    canClaimReception: false, canProveColdStartCause: false});
}
module.exports = Object.freeze({TRANSIENT, isTransient, diagnose});
if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== '--online') {
    console.error('Uso manual: node tests/hosting-cold-start.js --online (solo GET)');
    process.exitCode = 2;
  } else {
    const {check} = require('./contact-readiness.js');
    diagnose({checkOnce: check}).then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.classification === 'RECUPERADO_EN_REINTENTO' ||
        result.classification === 'RESPONDIO_EN_PRIMER_INTENTO' ? 0 : 1;
    }).catch(() => { console.error('No se completó el diagnóstico'); process.exitCode = 1; });
  }
}
