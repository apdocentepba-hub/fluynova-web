// FLUYNOVA Copilot — revisión asistida con transcripción humana explícita.
// Las cifras se ingresan separadamente del texto OCR; no se modifican sus bytes.
// Ni la transcripción ni una suma correcta certifican la imagen o autenticidad fiscal.
import {CopilotError} from './analysis.mjs';
import {parseArgentineAmount} from './money-ar.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

const KEYS=['net_cents','tax_cents','total_cents'];
const NAMES={net_cents:'Neto',tax_cents:'IVA',total_cents:'Total'};
export function reviewManualAmounts(source,manualAmounts,{
 inputOrigin='OCR',visualReviewDeclared=false
}={}){
 if(inputOrigin!=='OCR'||visualReviewDeclared!==true)
  throw new CopilotError('MANUAL_OCR_REVIEW_REQUIRED',422);
 if(!manualAmounts||typeof manualAmounts!=='object'||Array.isArray(manualAmounts)||
    Object.keys(manualAmounts).length!==3||!KEYS.every(k=>Object.hasOwn(manualAmounts,k)))
  throw new CopilotError('MANUAL_AMOUNT_FIELDS_REQUIRED',422);
 const cents={};
 for(const key of KEYS){
  const raw=manualAmounts[key];
  if(typeof raw!=='string'||raw.length>50||!raw.trim())
   throw new CopilotError('MANUAL_AMOUNT_INVALID',422);
  const parsed=parseArgentineAmount(raw);
  if(!Number.isSafeInteger(parsed)||parsed<0)
   throw new CopilotError('MANUAL_AMOUNT_INVALID',422);
  cents[key]=parsed;
 }
 // Valida también que el documento original OCR tenga longitud permitida.
 const ocr=verifyMoneyOnly(source,{inputOrigin:'OCR',visualReviewDeclared:true});
 const extracted={
  supplier:null,number:null,order:null,evidence:[],
  explanation:'Importes transcriptos por una persona y contrastados solo aritméticamente, SIN IA.',
  uncertainty:'La transcripción no demuestra coincidencia con la imagen.',
  ...cents
 };
 const amount_verification={};
 const issues=[
  'Revisión asistida: los tres importes fueron ingresados manualmente. La aplicación no certificó el cotejo, la factura ni su autenticidad.'
 ];
 for(const key of KEYS){
  const raw=ocr.extracted[key];
  const comparison=Number.isSafeInteger(raw)?raw!==cents[key]:null;
  amount_verification[key]={
   origin:'INGRESADO_MANUALMENTE_NO_CERTIFICADO',
   manually_entered_cents:cents[key],ocr_text_cents:raw,
   disagreement_with_ocr:comparison,independent_source_verified:false
  };
  if(comparison===true)issues.push(
   NAMES[key]+': la transcripción humana difiere de la lectura OCR; revisar con la imagen.'
  );
  else if(comparison===null)issues.push(
   NAMES[key]+': el OCR no aportó un importe único válido; no existe corroboración automática.'
  );
 }
 const arithmetic_consistent=cents.net_cents+cents.tax_cents===cents.total_cents;
 issues.push(arithmetic_consistent
  ?'La suma de los importes transcriptos coincide; eso NO verifica la imagen.'
  :'Los importes transcriptos NO cumplen Neto + IVA = Total. Revisá los tres campos.');
 return {
  mode:'REVISION_MANUAL_SIN_IA',model_used:null,model_called:false,
  input_origin:'OCR',document_origin:'OCR_MAS_TRANSCRIPCION_HUMANA',
  visual_review_declared:true,manual_entry_declared:true,
  manual_entered_amounts:3,original_document_verified:false,
  verified_amounts:0,parsed_amounts:3,arithmetic_consistent,
  extracted,amount_verification,issues,
  decision:'REQUIERE_REVISION_HUMANA',can_auto_approve:false,
  disclaimer:'Importes transcriptos manualmente de un documento de prueba; aritmética comprobada con reglas, SIN IA. Ninguna cifra está certificada contra la imagen por este sistema. No constituye aprobación fiscal ni contable.'
 };
}
