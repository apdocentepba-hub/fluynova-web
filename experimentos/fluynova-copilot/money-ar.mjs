// FLUYNOVA Copilot: lectura reproducible de montos ARS escritos en texto etiquetado.
// No es OCR, validación tributaria ni verificación del documento original.
const LABELS={
  net_cents:/^(?:neto|neto gravado|subtotal)$/i,
  tax_cents:/^(?:iva(?:\s+\d+(?:[.,]\d+)?\s*%)?|impuesto)$/i,
  total_cents:/^(?:total|total a pagar)$/i
};
const WORDS={net_cents:'neto',tax_cents:'impuesto',total_cents:'total'};
const MAX=100_000_000_000_000n;
export function parseArgentineAmount(raw){
  if(typeof raw!=='string'||raw.length>100)return null;
  const match=raw.replaceAll('\u00a0',' ').trim().match(/^(?:ARS\s*)?(?:\$\s*)?(\d[\d.,]*)(?:\s*(?:ARS|pesos))?$/i);
  if(!match)return null;
  // No adivinar formatos estadounidenses, decimales ambiguos ni miles mal agrupados.
  const literal=match[1];
  if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?$/.test(literal))return null;
  const [whole,dec='00']=literal.split(',');
  const cents=BigInt(whole.replaceAll('.',''))*100n+BigInt(dec);
  return cents<=MAX?Number(cents):null;
}
export function extractLiteralAmounts(source){
  const found={};
  for(const key of Object.keys(LABELS))found[key]=[];
  if(typeof source!=='string')return found;
  for(const line of source.split(/\r?\n/)){
    const parts=line.trim().match(/^(.{2,40}?)\s*:\s*(.*?)\s*$/u);
    if(!parts)continue;
    for(const [key,label] of Object.entries(LABELS))
      if(label.test(parts[1].trim()))found[key].push({
        value:parseArgentineAmount(parts[2]),
        // No registrar el texto completo del documento en los resultados.
        valid:parseArgentineAmount(parts[2])!==null
      });
  }
  return found;
}
export function reconcileArgentineMoney(source,modelExtracted){
  const found=extractLiteralAmounts(source);
  const extracted={...modelExtracted};
  const verification={};
  const issues=[];
  for(const key of Object.keys(LABELS)){
    const matches=found[key],modelProposal=modelExtracted[key];
    if(matches.length===1 && matches[0].valid){
      const literal=matches[0].value;
      extracted[key]=literal;
      const disagreement=modelProposal!==literal;
      verification[key]={
        origin:'LECTURA_LITERAL_ETIQUETADA',model_proposal_cents:modelProposal,
        verified_text_cents:literal,disagreement
      };
      if(disagreement)issues.push(
        'El importe '+WORDS[key]+' sugerido por la IA difiere de la línea literal; se utilizó el valor textual, sujeto a revisión humana'
      );
    }else{
      // Sin etiqueta legible no usar como verificado un número generado por IA.
      extracted[key]=null;
      verification[key]={
        origin:matches.length===0?'NO_ENCONTRADO':'AMBIGUO_O_INVALIDO',
        model_proposal_cents:modelProposal,verified_text_cents:null,disagreement:null
      };
      issues.push(
        'El importe '+WORDS[key]+' no se pudo corroborar con una línea etiquetada única y válida; requiere revisión humana'
      );
    }
  }
  return {extracted,verification,issues};
}
