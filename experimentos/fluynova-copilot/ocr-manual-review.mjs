// Revisión humana asistida de importes OCR. Sin red, almacenamiento ni certificación.
// Este módulo es compartido por los tests Node y la interfaz del navegador.
import {extractLiteralAmounts,parseArgentineAmount} from './money-ar.mjs';

const FIELDS=Object.freeze({
 net_cents:{label:'Neto',display:'Neto',pattern:/^(?:neto|neto gravado|subtotal)$/i},
 tax_cents:{label:'IVA',display:'IVA o impuestos',pattern:/^(?:iva(?:\s+\d+(?:[.,]\d+)?\s*%)?|impuesto)$/i},
 total_cents:{label:'Total',display:'Total',pattern:/^(?:total|total a pagar)$/i}
});
const KEYS=Object.keys(FIELDS);
const MAX_TEXT=6000;
function matchingKey(line){
 const parts=line.trim().match(/^(.{2,40}?)\s*:\s*(.*?)\s*$/u);
 if(!parts)return null;
 return KEYS.find(key=>FIELDS[key].pattern.test(parts[1].trim()))??null;
}
function formatARS(value){
 if(!Number.isSafeInteger(value)||value<0)throw new TypeError('MANUAL_REVIEW_INVALID_CENTS');
 return '$'+String(Math.trunc(value/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+
  ','+String(value%100).padStart(2,'0');
}
export function describeOcrMoneyFields(source){
 if(typeof source!=='string'||source.length>MAX_TEXT)
  throw new TypeError('MANUAL_REVIEW_INVALID_TEXT');
 const found=extractLiteralAmounts(source);
 return KEYS.map(key=>{
  const entries=found[key];
  const valid=entries.length===1&&entries[0].valid;
  const status=entries.length===0?'AUSENTE':valid?'LEGIBLE':'AMBIGUO_O_INVALIDO';
  return {
   key,label:FIELDS[key].display,status,
   suggested_text:valid?formatARS(entries[0].value):null,
   must_compare_with_original:true,
   independent_source_verified:false
  };
 });
}
export function applyManualOcrCorrections(source,corrections,{operatorComparedOriginal=false}={}){
 if(typeof source!=='string'||source.trim().length<25||source.length>MAX_TEXT)
  throw new TypeError('MANUAL_REVIEW_INVALID_TEXT');
 if(!corrections||typeof corrections!=='object'||Array.isArray(corrections))
  throw new TypeError('MANUAL_REVIEW_INVALID_FIELDS');
 if(operatorComparedOriginal!==true)
  throw new TypeError('MANUAL_REVIEW_ORIGINAL_NOT_COMPARED');
 const keys=Object.keys(corrections);
 if(keys.length<1||keys.length>KEYS.length||keys.some(key=>!KEYS.includes(key)))
  throw new TypeError('MANUAL_REVIEW_INVALID_FIELDS');
 const values=new Map();
 for(const key of keys){
  const input=corrections[key];
  if(typeof input!=='string'||input.trim().length===0||input.length>70)
   throw new TypeError('MANUAL_REVIEW_INVALID_AMOUNT_'+key);
  const cents=parseArgentineAmount(input);
  if(!Number.isSafeInteger(cents))
   throw new TypeError('MANUAL_REVIEW_INVALID_AMOUNT_'+key);
  values.set(key,cents);
 }
 // Eliminar SOLO las líneas monetarias de los campos explícitamente corregidos;
 // esto incluye duplicados OCR o lecturas contradictorias.
 // Preservar las demás líneas y NO alterar automáticamente otros importes.
 const lines=source.split(/\r?\n/);
 const removed=Object.fromEntries(keys.map(key=>[key,0]));
 const kept=lines.filter(line=>{
  const key=matchingKey(line);
  if(key&&values.has(key)){removed[key]++;return false}
  return true;
 });
 kept.push('[CORRECCION HUMANA DECLARADA - NO VERIFICADA POR EL SISTEMA]');
 for(const key of KEYS){
  if(values.has(key))kept.push(FIELDS[key].label+': '+formatARS(values.get(key)));
 }
 const text=kept.join('\n');
 if(text.length>MAX_TEXT)throw new TypeError('MANUAL_REVIEW_TEXT_TOO_LONG');
 const parsed=extractLiteralAmounts(text);
 for(const key of keys){
  if(parsed[key].length!==1||!parsed[key][0].valid||
    parsed[key][0].value!==values.get(key))
   throw new TypeError('MANUAL_REVIEW_AMBIGUOUS_RESULT');
 }
 return {
  text,corrected_fields:keys,
  removed_ocr_lines:removed,
  operator_compared_original_declared:true,
  original_document_verified:false,can_auto_approve:false,
  note:'Corrección ingresada por una persona, no verificada por el sistema. Repetir cotejo visual del texto final.'
 };
}
