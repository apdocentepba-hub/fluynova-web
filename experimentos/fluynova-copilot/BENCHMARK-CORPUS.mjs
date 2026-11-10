// Informe reproducible de validación MONETARIA (NO es prueba de precisión del LLM).
import {SYNTHETIC_CORPUS} from './corpus-sintetico.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
const stats={
  corpus_version:'1.0',
  synthetic_documents:SYNTHETIC_CORPUS.length,
  fields_checked:0,
  exact_fields:0,
  expected_verified:0,
  expected_abstentions:0,
  correct_verified:0,
  correct_abstentions:0,
  unsafe_accepts:0,
  wrong_amounts:0,
  missed_valid_amounts:0,
  arithmetic_inconsistencies_expected:0,
  arithmetic_inconsistencies_found:0,
  false_arithmetic_alerts:0,
  llm_called:false,
  invoices_autonomously_approved:0,
  failures:[]
};
console.log('FLUYNOVA COPILOT - BANCO DE PRUEBA DETERMINISTA (SIN MODELO IA)');
console.log('Corpus: datos ficticios, conjunto fijo con etiquetas manuales.');
for(const f of SYNTHETIC_CORPUS){
  const r=verifyMoneyOnly(f.source);
  if(r.model_called!==false||r.can_auto_approve!==false){
    stats.failures.push({id:f.id,reason:'CONTROL_HUMANO_O_MODELO'});
  }
  for(const [key,expected] of Object.entries(f.expected)){
    const actual=r.extracted[key];
    stats.fields_checked++;
    if(expected===null){
      stats.expected_abstentions++;
      if(actual===null){stats.exact_fields++;stats.correct_abstentions++}
      else{stats.unsafe_accepts++;stats.failures.push({id:f.id,field:key,reason:'ACEPTACION_INSEGURA'})}
    }else{
      stats.expected_verified++;
      if(actual===expected){stats.exact_fields++;stats.correct_verified++}
      else if(actual===null){
        stats.missed_valid_amounts++;
        stats.failures.push({id:f.id,field:key,reason:'ABSTENCION_INNECESARIA'});
      }else{
        stats.wrong_amounts++;
        stats.failures.push({id:f.id,field:key,reason:'MONTO_INCORRECTO'});
      }
    }
  }
  const issue=r.issues.some(x=>x.includes('Neto + impuestos no coincide con total'));
  if(f.mismatch){
    stats.arithmetic_inconsistencies_expected++;
    if(issue)stats.arithmetic_inconsistencies_found++;
    else stats.failures.push({id:f.id,reason:'INCONSISTENCIA_NO_DETECTADA'});
  }else if(issue){
    stats.false_arithmetic_alerts++;
    stats.failures.push({id:f.id,reason:'FALSA_ALERTA_ARITMETICA'});
  }
}
console.log('Comprobantes ficticios:',stats.synthetic_documents);
console.log('Campos de importe evaluados:',stats.fields_checked);
console.log('Exactitud contra etiquetas manuales:',stats.exact_fields+'/'+stats.fields_checked);
console.log('Importes válidos corroborados:',stats.correct_verified+'/'+stats.expected_verified);
console.log('Abstenciones seguras:',stats.correct_abstentions+'/'+stats.expected_abstentions);
console.log('Aceptaciones inseguras:',stats.unsafe_accepts);
console.log('Importes erróneos aceptados:',stats.wrong_amounts);
console.log('Valores válidos no leídos:',stats.missed_valid_amounts);
console.log('Errores aritméticos detectados:',stats.arithmetic_inconsistencies_found+'/'+stats.arithmetic_inconsistencies_expected);
console.log('Falsas alertas aritméticas:',stats.false_arithmetic_alerts);
console.log('IA consultada: NO. Aprobación automática: NO.');
console.log('Estos datos NO validan PDF/OCR, autenticidad de facturas, ARCA, ni rendimiento de Qwen.');
console.log('RESULTADO:',stats.failures.length===0?'CORPUS DE REGLAS APROBADO':'FALLAS DE REGLAS DETECTADAS');
for(const failure of stats.failures)console.log('ERROR',failure.id,failure.field??'',failure.reason);
if(stats.failures.length)process.exitCode=1;
