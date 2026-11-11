// Indicador exploratorio para priorizar recapturas, NO detector de cifras falsas.
// Usa legibilidad de etiquetas y confianza global; no coteja la imagen original.
import {extractLiteralAmounts} from './money-ar.mjs';

export const OCR_RECAPTURE_HINT_BELOW_CONFIDENCE=75;
const KEYS=['net_cents','tax_cents','total_cents'];

export function assessOcrReadability(text,confidence){
  if(typeof text!=='string'||!Number.isFinite(confidence)||confidence<0||confidence>100){
    throw new TypeError('OCR_READABILITY_INVALID_INPUT');
  }
  const rows=extractLiteralAmounts(text);
  const parsed={};
  for(const key of KEYS){
    const matches=rows[key];
    parsed[key]=matches.length===1&&matches[0].valid?matches[0].value:null;
  }
  const readable=KEYS.filter(key=>Number.isSafeInteger(parsed[key])).length;
  const sumConsistent=readable===3?
    parsed.net_cents+parsed.tax_cents===parsed.total_cents:null;
  const lowConfidence=confidence<OCR_RECAPTURE_HINT_BELOW_CONFIDENCE;
  const reasons=[];
  if(lowConfidence)reasons.push('CONFIANZA_GLOBAL_BAJA');
  if(readable===0)reasons.push('SIN_IMPORTES_LEGIBLES');
  else if(readable===1)reasons.push('DOS_O_MAS_IMPORTES_INLEGIBLES');
  else if(readable<3)reasons.push('CAMPOS_MONETARIOS_INCOMPLETOS');
  if(sumConsistent===false)reasons.push('ARITMETICA_INCONSISTENTE');
  let nextAction='COTEJAR_VISUALMENTE';
  // La confianza global puede ser 95 incluso si Tesseract perdió 2/3 montos.
  // En ese caso recomendar nueva captura o transcripción manual del original.
  if(lowConfidence||readable<=1)nextAction='RECAPTURAR_SUGERIDO';
  else if(readable<3||sumConsistent===false)nextAction='CORREGIR_O_RECAPTURAR';
  return {
    classification:nextAction,
    readable_amounts:readable,
    missing_amounts:3-readable,
    arithmetic_consistent:sumConsistent,
    reasons,
    confidence_warning_threshold:OCR_RECAPTURE_HINT_BELOW_CONFIDENCE,
    original_document_verified:false,
    can_auto_approve:false,
    disclaimer:'Heurística para priorizar recaptura. La confianza media y una suma consistente NO prueban que el OCR leyó correctamente ningún importe.'
  };
}
