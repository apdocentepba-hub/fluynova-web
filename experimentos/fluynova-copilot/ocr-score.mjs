// Clasificación independiente de la verdad esperada para mediciones OCR.
// No se usa como verificación del documento en producción ni como aprobación.
const KEYS=['net_cents','tax_cents','total_cents'];
export function scoreOcrAmounts(expected,actual){
 if(!expected||!actual)throw new TypeError('expected/actual requeridos');
 const byField={};
 let correct=0,abstentions=0,wrongPlausible=0;
 for(const key of KEYS){
  const reference=expected[key],value=actual[key];
  if(!Number.isSafeInteger(reference)||reference<0)
   throw new TypeError('verdad incorrecta: '+key);
  if(value===reference){byField[key]='CORRECTO';correct++}
  else if(value===null||value===undefined){byField[key]='ABSTENCION';abstentions++}
  else {byField[key]='IMPORTE_INCORRECTO_LEGIBLE';wrongPlausible++}
 }
 const arithmeticallyConsistent=KEYS.every(k=>Number.isSafeInteger(actual[k]))&&
   actual.net_cents+actual.tax_cents===actual.total_cents;
 return {
  byField,correct,abstentions,wrongPlausible,
  arithmeticallyConsistent,
  // Error que pasaría desapercibido si sólo se usara la igualdad de suma.
  silentArithmeticRisk:wrongPlausible>0&&arithmeticallyConsistent,
  neverIndependentlyVerified:true
 };
}
