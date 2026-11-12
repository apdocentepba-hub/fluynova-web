// Investigación con Tesseract español REAL antes de cambiar el motor.
// Se generan documentos 100% sintéticos, importes etiquetados en 3 zonas.
// No se mezclan ni certifican resultados; se mide cobertura por zona.
import {createCanvas} from '@napi-rs/canvas';
import {createWorker} from 'tesseract.js';
import {assertOfflineModel,OCR_DATA_DIR} from './ocr-model.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {scoreOcrAmounts} from './ocr-score.mjs';

const W=1440,H=850;
const truth={net_cents:15000000,tax_cents:3150000,total_cents:18150000};
const regions=[
 {name:'full',rectangle:null},
 {name:'right',rectangle:{left:800,top:130,width:640,height:660}},
 {name:'center',rectangle:{left:400,top:130,width:740,height:660}},
 {name:'left',rectangle:{left:20,top:130,width:700,height:660}}
];
function fixture(position){
 const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
 ctx.fillStyle='#fbfaf6';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#1a1a1a';ctx.font='bold 56px Arial';
 ctx.fillText('COMPROBANTE FICTICIO',45,90);
 const x={left:45,center:460,right:885}[position];
 ctx.font='bold 47px Arial';
 ['NETO: $150.000,00','IVA: $31.500,00','TOTAL: $181.500,00']
  .forEach((line,i)=>ctx.fillText(line,x,240+i*130));
 const distractors={
  left:[460,900],center:[45,1030],right:[45,460]
 }[position];
 ctx.font='34px Arial';
 for(const dx of distractors){
  ['CLIENTE FICTICIO','REFERENCIA DEMO','OBSERVACIONES'].forEach((s,i)=>
   ctx.fillText(s,dx,230+i*105));
 }
 return canvas.toBuffer('image/png');
}
await assertOfflineModel();
const worker=await createWorker('spa',1,{langPath:OCR_DATA_DIR,gzip:true,cacheMethod:'none'});
try{
 for(const position of ['left','center','right']){
  const bytes=fixture(position);
  console.log('DISEÑO',position);
  for(const region of regions){
   const response=await worker.recognize(bytes,
     region.rectangle?{rectangle:region.rectangle}:undefined);
   const checked=verifyMoneyOnly(response.data.text,
      {inputOrigin:'OCR',visualReviewDeclared:true});
   const score=scoreOcrAmounts(truth,checked.extracted);
   console.log('MEDICION',position,region.name,
     'correctos',score.correct+'/3',
     'abstenciones',score.abstentions,
     'numeros_erroneos',score.wrongPlausible,
     'confianza',Math.round(response.data.confidence));
   if(checked.can_auto_approve||checked.verified_amounts!==0)
    throw Error('OCR_MULTIZONA_CERTIFICO_MONTO');
  }
 }
}finally{await worker.terminate()}
console.log('Este benchmark NO acredita facturas reales ni valida automáticamente importes.');
