#!/usr/bin/env node
'use strict';
/** Herramienta INTERNA, sin red, correo, cobros ni escritura en archivos. */
const PLANES = Object.freeze({
  esencial: Object.freeze({etiqueta: 'Web Esencial', precio: 290000}),
  catalogo: Object.freeze({etiqueta: 'Web Catálogo', precio: 450000}),
  profesional: Object.freeze({etiqueta: 'Web Profesional', precio: 650000}),
});
const PRECIO_SECCION_EXTRA = 70000;
function importe(valor){
  if (!Number.isSafeInteger(valor) || valor < 0) throw new RangeError('Importe inválido');
  return '$' + new Intl.NumberFormat('es-AR', {maximumFractionDigits: 0}).format(valor);
}
function presupuesto(plan, extras = 0){
  if (!Object.hasOwn(PLANES, plan)) throw new RangeError('Plan desconocido');
  if (!Number.isInteger(extras) || extras < 0 || extras > 3) throw new RangeError('Las secciones extra deben ser entre 0 y 3');
  const base = PLANES[plan];
  const adicionales = extras * PRECIO_SECCION_EXTRA;
  const total = base.precio + adicionales;
  return Object.freeze({plan, etiqueta: base.etiqueta, extras, base: base.precio, adicionales, total,
    anticipo: total / 2, saldo: total / 2});
}
function textoPresupuesto(data){
  const x = presupuesto(data.plan, data.extras);
  return ['PRESUPUESTO ORIENTATIVO | FLUYNOVA',
    `Servicio: ${x.etiqueta}`,
    `Desarrollo base: ${importe(x.base)} ARS`,
    `Secciones adicionales: ${x.extras} × ${importe(PRECIO_SECCION_EXTRA)} = ${importe(x.adicionales)} ARS`,
    `Total orientativo: ${importe(x.total)} ARS`,
    `Anticipo orientativo (50%): ${importe(x.anticipo)} ARS`,
    `Saldo orientativo (50%): ${importe(x.saldo)} ARS`, '',
    'Referencia comercial no vinculante. El alcance y el tratamiento impositivo se confirman al presupuestar.',
    'El dominio va a nombre del cliente y se abona aparte. No incluye funciones avanzadas no acordadas.',
    'Herramienta interna: no envía correos, no cobra y no registra clientes.'].join('\n');
}
if (require.main === module){
  const [, , plan, extrasRaw] = process.argv;
  const extras = extrasRaw === undefined ? 0 : Number(extrasRaw);
  try {console.log(textoPresupuesto({plan,extras}));}
  catch(err){console.error(`Uso: node scripts/presupuesto-web.cjs <esencial|catalogo|profesional> [0-3]. ${err.message}`);process.exitCode=1;}
}
module.exports={PLANES, PRECIO_SECCION_EXTRA, presupuesto, importe, textoPresupuesto};
