// Segunda pasada de OCR por región: solo si faltan importes literales.
// NUNCA certifica importes; cualquier discrepancia fuerza ambigüedad.
import {extractLiteralAmounts} from './money-ar.mjs';

const LABELS={net_cents:'Neto',tax_cents:'IVA',total_cents:'Total'};
const KEYS=Object.keys(LABELS);

function validUnique(items){
 return items.length===1&&items[0].valid&&Number.isSafeInteger(items[0].value);
}
function formatARS(cents){
 if(!Number.isSafeInteger(cents)||cents<0)throw new TypeError('OCR_LAYOUT_INVALID_CENTS');
 const pesos=String(Math.floor(cents/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 return '$'+pesos+','+String(cents%100).padStart(2,'0');
}
export function planOcrRegionRetry(text,width,height){
 if(typeof text!=='string'||!Number.isInteger(width)||!Number.isInteger(height))
  throw new TypeError('OCR_LAYOUT_INVALID_INPUT');
 if(width<900||height<350)return null;
 const found=extractLiteralAmounts(text);
 const missing=KEYS.filter(k=>!validUnique(found[k]));
 if(!missing.length)return null;
 // Proporción medida con comprobantes sintéticos de dos columnas y una tabla.
 const left=Math.round(width*.42);
 const top=Math.round(height*.17);
 return {
  rectangle:{top,left,width:width-left,height:Math.min(height-top,Math.round(height*.77))},
  missing_fields:missing
 };
}
export function reconcileOcrRegionTexts(primaryText,regionalText){
 if(typeof primaryText!=='string'||typeof regionalText!=='string')
  throw new TypeError('OCR_LAYOUT_INVALID_TEXT');
 const base=extractLiteralAmounts(primaryText);
 const extra=extractLiteralAmounts(regionalText);
 const recovered=[],conflicts=[],lines=[];
 for(const key of KEYS){
  const a=base[key],b=extra[key];
  if(!b.length)continue;
  if(!validUnique(b)){
    if(!validUnique(a))conflicts.push(key);
    continue;
  }
  const cand=b[0].value;
  if(a.length===0){
    recovered.push(key);
    lines.push(LABELS[key]+': '+formatARS(cand));
  }else if(!validUnique(a)){
    conflicts.push(key);
    // La lectura primaria ya sigue sin ser corroborable.
  }else if(a[0].value!==cand){
    conflicts.push(key);
    // Segunda etiqueta incompatible: el parser ESTRICTO devuelve null.
    lines.push(LABELS[key]+': '+formatARS(cand));
  }
 }
 const appended=lines.length
  ?'\n[LECTURA OCR REGIONAL — SIN VERIFICACION INDEPENDIENTE]\n'+lines.join('\n')
  :'';
 return {
  text:primaryText+appended,
  recovered_fields:recovered,
  conflict_fields:conflicts,
  additional_labeled_lines:lines.length,
  independent_source_verified:false,
  can_auto_approve:false
 };
}
