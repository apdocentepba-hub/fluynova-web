// Validación documental local y determinista SIN inferencia LLM.
import {reconcileArgentineMoney} from './money-ar.mjs';
import {CopilotError} from './analysis.mjs';

export function verifyMoneyOnly(source,{inputOrigin='TEXT',visualReviewDeclared=false}={}) {
  if(!['TEXT','OCR'].includes(inputOrigin)||typeof visualReviewDeclared!=='boolean'){
    throw new CopilotError('INVALID_SOURCE_PROVENANCE',422);
  }
  if(inputOrigin==='OCR'&&!visualReviewDeclared){
    throw new CopilotError('OCR_VISUAL_REVIEW_REQUIRED',422);
  }
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
  // El OCR puede cambiar varios dígitos y conservar exactamente la misma suma.
  // Una etiqueta numérica legible NO equivale a un importe verificado contra la imagen.
  const parsed_count=amounts.filter(Number.isSafeInteger).length;
  if(inputOrigin==='OCR'){
    for(const key of ['net_cents','tax_cents','total_cents']){
      if(verification[key]?.origin==='LECTURA_LITERAL_ETIQUETADA'){
        verification[key].origin='OCR_COTEJO_VISUAL_DECLARADO_NO_VERIFICADO';
        verification[key].independent_source_verified=false;
      }
    }
    issues.push('Los importes provienen de OCR; aun cuando la suma cierre, un dígito puede ser incorrecto. El usuario declaró el cotejo visual, pero el sistema NO verificó el original.');
  }
  return {
    mode:'REGLAS_SIN_IA',
    input_origin:inputOrigin,
    visual_review_declared:inputOrigin==='OCR'&&visualReviewDeclared,
    original_document_verified:false,
    parsed_amounts:parsed_count,
    model_used:null,
    model_called:false,
    document_origin:'TEXTO_INGRESADO',
    extracted,
    issues,
    amount_verification:verification,
    verified_amounts:inputOrigin==='OCR'?0:parsed_count,
    decision:'REQUIERE_REVISION_HUMANA',
    can_auto_approve:false,
    disclaimer:inputOrigin==='OCR'
      ?'Importes leídos de texto OCR con cotejo visual declarado por una persona, NO certificado por el sistema. No se garantiza ningún dígito aunque la aritmética sea consistente; no se autentica factura, ARCA ni CAE.'
      :'El control se limita a líneas monetarias etiquetadas del texto ingresado. No verifica la autenticidad de facturas, ARCA, CAE ni proveedores.'
  };
}
