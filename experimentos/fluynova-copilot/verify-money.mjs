// Validación documental local y determinista SIN inferencia LLM.
import {reconcileArgentineMoney} from './money-ar.mjs';
import {CopilotError} from './analysis.mjs';

export function verifyMoneyOnly(source) {
  if (typeof source !== 'string' || source.trim().length < 25 || source.length > 6000) {
    throw new CopilotError('INVALID_DOCUMENT_LENGTH',422);
  }
  const proposed = {
    supplier:null, number:null, order:null,
    net_cents:null, tax_cents:null, total_cents:null,
    evidence:[],
    explanation:'Verificación de montos exclusivamente mediante reglas programadas: NO se consultó IA.',
    uncertainty:'El resultado solo contrasta texto ingresado, sin validar el comprobante original.'
  };
  const {extracted,verification,issues} =
    reconcileArgentineMoney(source,proposed,{modelSupplied:false});
  const amounts=['net_cents','tax_cents','total_cents'].map(k=>extracted[k]);
  if(amounts.every(Number.isSafeInteger)){
    if(extracted.net_cents+extracted.tax_cents!==extracted.total_cents){
      issues.push('Neto + impuestos no coincide con total');
    }
  }
  const verified_count=amounts.filter(Number.isSafeInteger).length;
  return {
    mode:'REGLAS_SIN_IA',
    model_used:null,
    model_called:false,
    document_origin:'TEXTO_INGRESADO',
    extracted,
    issues,
    amount_verification:verification,
    verified_amounts:verified_count,
    decision:'REQUIERE_REVISION_HUMANA',
    can_auto_approve:false,
    disclaimer:'El control se limita a líneas monetarias etiquetadas del texto ingresado. No verifica la autenticidad de facturas, ARCA, CAE ni proveedores.'
  };
}
