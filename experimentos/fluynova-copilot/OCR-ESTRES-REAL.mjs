// Estrés exploratorio de Tesseract REAL, sin Qwen y sin comprobantes reales.
// El resultado se imprime incluso si hay errores: son el objetivo de este ensayo.
import {createCanvas} from '@napi-rs/canvas';
import {recognizeImage} from './ocr-image.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {scoreOcrAmounts} from './ocr-score.mjs';
import {assertOfflineModel} from './ocr-model.mjs';

const FIXTURES=[
 {id:'S01',description:'texto base',width:1250,height:560,font:63,mode:'clear',amounts:['150.000,00','31.500,00','181.500,00'],expected:[15000000,3150000,18150000]},
 {id:'S02',description:'cifras parecidas 8-3-0',width:1250,height:560,font:63,mode:'clear',amounts:['8.303,80','1.743,80','10.047,60'],expected:[830380,174380,1004760]},
 {id:'S03',description:'letra chica en JPG',width:950,height:420,font:33,mode:'jpeg',amounts:['1.234,56','259,26','1.493,82'],expected:[123456,25926,149382]},
 {id:'S04',description:'contraste tenue',width:1250,height:560,font:63,mode:'low-contrast',amounts:['150.000,00','31.500,00','181.500,00'],expected:[15000000,3150000,18150000]},
 {id:'S05',description:'difuminado moderado',width:1250,height:560,font:63,mode:'blur-moderate',amounts:['150.000,00','31.500,00','181.500,00'],expected:[15000000,3150000,18150000]},
 {id:'S06',description:'difuminado severo',width:1250,height:560,font:63,mode:'blur-strong',amounts:['150.000,00','31.500,00','181.500,00'],expected:[15000000,3150000,18150000]},
 {id:'S07',description:'raya sobre total',width:1250,height:560,font:63,mode:'strike',amounts:['150.000,00','31.500,00','181.500,00'],expected:[15000000,3150000,18150000]},
 {id:'S08',description:'inclinación leve',width:1250,height:560,font:57,mode:'rotate',amounts:['9.999,99','2.100,00','12.099,99'],expected:[999999,210000,1209999]}
];
const KEYS=['net_cents','tax_cents','total_cents'];
function render(f){
 const base=createCanvas(f.width,f.height);
 const c=base.getContext('2d');
 c.fillStyle='#ffffff';c.fillRect(0,0,f.width,f.height);
 c.save();
 c.translate(54,16);
 if(f.mode==='rotate')c.rotate(-0.027);
 c.fillStyle=f.mode==='low-contrast'?'#bababa':'#111111';
 c.font='bold '+f.font+'px Arial';
 c.fillText('FACTURA FICTICIA '+f.id,0,85);
 for(let k=0;k<3;k++)c.fillText(['NETO: $','IVA: $','TOTAL: $'][k]+f.amounts[k],0,170+k*103);
 c.restore();
 if(f.mode==='strike'){
   c.strokeStyle='#b4b4b4';c.lineWidth=9;
   c.beginPath();c.moveTo(240,405);c.lineTo(740,419);c.stroke();
 }
 if(f.mode.startsWith('blur-')){
   const factor=f.mode==='blur-strong'?0.13:0.37;
   const small=createCanvas(Math.round(f.width*factor),Math.round(f.height*factor));
   const sc=small.getContext('2d');sc.imageSmoothingEnabled=true;
   sc.drawImage(base,0,0,small.width,small.height);
   const blurred=createCanvas(f.width,f.height);
   const bc=blurred.getContext('2d');bc.imageSmoothingEnabled=true;
   bc.imageSmoothingQuality='high';
   bc.drawImage(small,0,0,f.width,f.height);
   return blurred.toBuffer('image/png');
 }
 if(f.mode==='jpeg')return base.toBuffer('image/jpeg');
 return base.toBuffer('image/png');
}
await assertOfflineModel();
const totals={documents:FIXTURES.length,fields:FIXTURES.length*3,correct:0,abstentions:0,
 wrongPlausible:0,arithmeticRisk:0,ocrRejected:0,autoApproved:0};
console.log('FLUYNOVA — ESTRES OCR REAL · datos totalmente sintéticos · NO QWEN');
for(const f of FIXTURES){
 const started=Date.now();
 let out;
 try{
   out=await recognizeImage(render(f),{minimumConfidence:35,timeoutMs:60000});
 }catch(err){
   totals.abstentions+=3;totals.ocrRejected++;
   console.log('CASO',f.id,f.description,'| OCR_RECHAZADO',err?.code||'UNKNOWN',
     '| ms',Date.now()-started);
   continue;
 }
 if(out.can_auto_approve!==false||out.model_called!==false||out.needs_manual_review!==true){
   totals.autoApproved++;
   throw Error('CONTROL_OCR_HUMANO_VIOLADO');
 }
 const parsed=verifyMoneyOnly(out.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 if(parsed.verified_amounts!==0||parsed.can_auto_approve!==false||
   parsed.original_document_verified!==false){
   totals.autoApproved++;throw Error('ORIGEN_OCR_INCORRECTAMENTE_VALIDADO');
 }
 const expected=Object.fromEntries(KEYS.map((k,i)=>[k,f.expected[i]]));
 const score=scoreOcrAmounts(expected,parsed.extracted);
 const quality=out.reading_quality;
 if(!quality||quality.original_document_verified!==false||
    quality.can_auto_approve!==false)throw Error('CALIDAD_OCR_FALSAMENTE_CERTIFICADA');
 if(f.id==='S06'&&quality.classification!=='RECAPTURAR_SUGERIDO')
   throw Error('FALTO_SUGERIR_RECAPTURA_CON_DESENFOQUE_SEVERO');
 totals.correct+=score.correct;totals.abstentions+=score.abstentions;
 totals.wrongPlausible+=score.wrongPlausible;
 totals.arithmeticRisk+=Number(score.silentArithmeticRisk);
 console.log('CASO',f.id,f.description,'| correctos',score.correct+'/3',
  '| abstenciones',score.abstentions,'| cifras_erróneas_legibles',score.wrongPlausible,
  '| error_con_suma_coherente',score.silentArithmeticRisk,
  '| confianza_media',out.confidence_percent,
  '| recomendacion',quality.classification,
  '| ms',Date.now()-started);
}
console.log('RESUMEN corpus',totals.documents,'documentos,',totals.fields,'campos');
console.log('RESUMEN correctos',totals.correct);
console.log('RESUMEN abstenciones',totals.abstentions);
console.log('RESUMEN cifras_erróneas_legibles',totals.wrongPlausible);
console.log('RESUMEN errores_con_suma_coherente',totals.arithmeticRisk);
console.log('RESUMEN OCR_rechazados',totals.ocrRejected);
console.log('RESUMEN aprobaciones_automáticas',totals.autoApproved);
console.log('NO INTERPRETAR COMO PRECISION EN FACTURAS REALES NI COMO DETECCION INFALIBLE.');
if(totals.correct+totals.abstentions+totals.wrongPlausible!==totals.fields)
 throw Error('CONTEO_INCONSISTENTE');
if(totals.autoApproved!==0)process.exitCode=1;
