// Evaluación exploratoria, NO cifras comerciales: imagen generada -> Tesseract español REAL -> importes.
// Las verdades esperadas se anotan manualmente, independientes del motor de parseo.
import {createCanvas} from '@napi-rs/canvas';
import {recognizeImage} from './ocr-image.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {assertOfflineModel} from './ocr-model.mjs';

const cases=[
  {id:'B01',format:'image/png',width:1400,height:650,font:66,line:126,rotate:0,
    fg:'#000000',bg:'#ffffff',
    labels:['NETO: $150.000,00','IVA: $31.500,00','TOTAL: $181.500,00'],
    expected:[15000000,3150000,18150000]},
  {id:'B02',format:'image/png',width:1400,height:650,font:65,line:126,rotate:0,
    fg:'#3f4b55',bg:'#f0efe9',
    labels:['NETO: $1.234,56','IVA: $259,26','TOTAL: $1.493,82'],
    expected:[123456,25926,149382]},
  {id:'B03',format:'image/jpeg',width:1000,height:490,font:41,line:94,rotate:0,
    fg:'#151515',bg:'#fafafa',
    labels:['NETO: $1.000,00','IVA: $210,00','TOTAL: $1.210,00'],
    expected:[100000,21000,121000]},
  {id:'B04',format:'image/png',width:1500,height:740,font:70,line:144,rotate:-0.018,
    fg:'#151515',bg:'#ffffff',
    labels:['NETO: $9.999,99','IVA: $2.100,00','TOTAL: $12.099,99'],
    expected:[999999,210000,1209999]}
];
const keys=['net_cents','tax_cents','total_cents'];
function draw(f){
 const canvas=createCanvas(f.width,f.height),ctx=canvas.getContext('2d');
 ctx.fillStyle=f.bg;ctx.fillRect(0,0,f.width,f.height);
 ctx.save();ctx.translate(60,20);ctx.rotate(f.rotate);
 ctx.fillStyle=f.fg;ctx.font='bold '+f.font+'px Arial';
 ctx.fillText('FACTURA FICTICIA '+f.id,0,100);
 for(let i=0;i<3;i++)ctx.fillText(f.labels[i],0,100+(i+1)*f.line);
 ctx.restore();
 return canvas.toBuffer(f.format);
}
async function main(){
 await assertOfflineModel();
 let fields=0,correct=0,rejected=0,wrong=0,autoApprovals=0;
 console.log('FLUYNOVA OCR - BANCO SINTETICO EXPLORATORIO - TESSERACT REAL, NO QWEN');
 console.log('Cantidad de casos:',cases.length,'| Campos esperados:',cases.length*3);
 for(const f of cases){
  let result,parsed;
  const began=Date.now();
  try{
   result=await recognizeImage(draw(f),{timeoutMs:60000,minimumConfidence:35});
   if(result.model_called!==false||result.can_auto_approve!==false||result.needs_manual_review!==true){
     autoApprovals++;throw Error('UNSAFE_OCR_RESULT');
   }
   parsed=verifyMoneyOnly(result.text);
  }catch(err){
   const code=err?.code||err?.message||'UNKNOWN';
   console.log('CASO',f.id,'OCR_RECHAZADO',code,
     '| milisegundos',Date.now()-began);
   fields+=3;rejected+=3;
   continue;
  }
  for(let i=0;i<3;i++){
   const actual=parsed.extracted[keys[i]],truth=f.expected[i];
   const ok=actual===truth;
   fields++;
   if(ok)correct++;
   else if(actual===null)rejected++;
   else wrong++;
   console.log('CASO',f.id,'CAMPO',keys[i],
     ok?'OK':actual===null?'ABSTENCION':'DIFERENCIA_NUMERICA');
  }
  console.log('CASO',f.id,'confianza_orientativa',result.confidence_percent,
    '| milisegundos',Date.now()-began);
 }
 console.log('RESUMEN: campos correctos',correct+'/'+fields);
 console.log('RESUMEN: abstenciones',rejected+'/'+fields);
 console.log('RESUMEN: valores incorrectos extraidos',wrong+'/'+fields);
 console.log('RESUMEN: aprobaciones automaticas',autoApprovals);
 console.log('IMPORTANTE: 4 imágenes creadas por código NO establecen precisión en facturas reales.');
 if(autoApprovals!==0)process.exitCode=1;
}
await main();
