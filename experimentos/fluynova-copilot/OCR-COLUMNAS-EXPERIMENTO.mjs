// OCR REAL por región según API pública Tesseract.js: dos diseños sintéticos.
// EVALUACIÓN solamente: no modifica el parser ni combina cifras sin controles.
import {createCanvas} from '@napi-rs/canvas';
import {createWorker} from 'tesseract.js';
import {assertOfflineModel,OCR_DATA_DIR} from './ocr-model.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {scoreOcrAmounts} from './ocr-score.mjs';
const truth={net_cents:15000000,tax_cents:3150000,total_cents:18150000};
const widths=[0,525,605,655];const height=850,width=1440;
function render(style){
 const canvas=createCanvas(width,height),c=canvas.getContext('2d');
 c.fillStyle='#fbfaf6';c.fillRect(0,0,width,height);
 c.fillStyle='#222';c.font='bold 64px Arial';
 c.fillText('FACTURA DEMO',70,120);
 c.font='35px Arial';
 for(const [i,t] of ['FECHA: 11/11/2026','PROVEEDOR FICTICIO','REFERENCIA 00001',
   'SIN DOCUMENTOS REALES'].entries())c.fillText(t,65,245+i*85);
 c.font=style==='table'?'bold 55px Arial':'bold 57px Arial';
 const data=['NETO: $150.000,00','IVA: $31.500,00','TOTAL: $181.500,00'];
 if(style==='table'){
   c.fillStyle='#e8e8e8';c.fillRect(680,184,750,360);
   c.fillStyle='#222';c.strokeStyle='#555';
   c.strokeRect(680,184,750,360);
   for(let y=294;y<544;y+=110){c.beginPath();c.moveTo(680,y);c.lineTo(1430,y);c.stroke()}
 }
 for(let i=0;i<3;i++)c.fillText(data[i],690,245+i*110);
 return canvas.toBuffer('image/png');
}
await assertOfflineModel();
const worker=await createWorker('spa',1,{langPath:OCR_DATA_DIR,gzip:true,cacheMethod:'none'});
try{
 for(const style of ['columns','table']){
  const bytes=render(style);
  console.log('DOCUMENTO',style);
  let best=0;
  for(const x of widths){
    const started=Date.now();
    const result=await worker.recognize(bytes,x?{
       rectangle:{top:145,left:x,width:width-x,height:650}
    }:undefined);
    const text=result.data.text;
    const checked=verifyMoneyOnly(text,{inputOrigin:'OCR',visualReviewDeclared:true});
    const scored=scoreOcrAmounts(truth,checked.extracted);
    const classification=checked.verified_amounts===0?'NO_VERIFICADO':'ERROR_CERTIFICACION';
    if(classification!=='NO_VERIFICADO'||checked.can_auto_approve)throw Error('VALIDACION_INSEGURA');
    if(scored.correct>best)best=scored.correct;
    console.log('REGION',style,'x',x,
      'correctos',scored.correct+'/3',
      'faltantes',scored.abstentions,
      'incorrectos_legibles',scored.wrongPlausible,
      'confianza_global',result.data.confidence,
      'ms',Date.now()-started);
  }
  console.log('MEJOR_LECTURA_EXPERIMENTAL',style,best+'/3');
 }
}finally{await worker.terminate()}
console.log('RESULTADOS SINTETICOS: no constituyen precisión comercial ni permiso para mezclar lecturas.');
