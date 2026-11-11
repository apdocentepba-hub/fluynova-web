// Laboratorio adversarial: imágenes SINTÉTICAS de comprobantes con Tesseract REAL.
// Perspectiva: cizallamiento afín, NO es una homografía ni fotografía auténtica.
// Cada importe esperado fue definido manualmente; no se deriva del OCR.
import {createCanvas} from '@napi-rs/canvas';
import {assertOfflineModel} from './ocr-model.mjs';
import {recognizeImage} from './ocr-image.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {scoreOcrAmounts} from './ocr-score.mjs';

const W=1440,H=850;
const KEYS=['net_cents','tax_cents','total_cents'];
const expected={net_cents:15000000,tax_cents:3150000,total_cents:18150000};
const CASES=Object.freeze([
 {id:'D01',name:'control tipografía regular',mode:'control'},
 {id:'D02',name:'sombra gradual sobre cifras',mode:'shadow'},
 {id:'D03',name:'reflejo blanco elíptico',mode:'glare'},
 {id:'D04',name:'cizallamiento afín simulando perspectiva',mode:'shear'},
 {id:'D05',name:'comprobante en dos columnas',mode:'columns'},
 {id:'D06',name:'sello superpuesto',mode:'stamp'},
 {id:'D07',name:'ruido de impresión y compresión JPEG',mode:'noise-jpeg'},
 {id:'D08',name:'recorte parcial en borde derecho',mode:'crop'}
]);
function canvasBase(){
  const c=createCanvas(W,H),ctx=c.getContext('2d');
  ctx.fillStyle='#fbfaf6';ctx.fillRect(0,0,W,H);
  return {c,ctx};
}
function drawLines(ctx,{x=80,y=175,spacing=145,font=76}={}){
  ctx.fillStyle='#222222';
  ctx.font='bold '+font+'px Arial';
  ctx.fillText('FACTURA DEMO SINTETICA',x,y);
  ctx.font='bold '+Math.round(font*.89)+'px Arial';
  ctx.fillText('NETO: $150.000,00',x,y+spacing);
  ctx.fillText('IVA: $31.500,00',x,y+spacing*2);
  ctx.fillText('TOTAL: $181.500,00',x,y+spacing*3);
}
function render(f){
  const {c,ctx}=canvasBase();
  if(f.mode==='columns'){
    ctx.fillStyle='#222';ctx.font='bold 64px Arial';
    ctx.fillText('FACTURA DEMO',70,120);
    ctx.font='35px Arial';
    ctx.fillText('FECHA: 11/11/2026',65,245);
    ctx.fillText('PROVEEDOR FICTICIO',65,330);
    ctx.fillText('REFERENCIA 00001',65,415);
    ctx.fillText('SIN DOCUMENTOS REALES',65,500);
    ctx.font='bold 57px Arial';
    ctx.fillText('NETO: $150.000,00',690,245);
    ctx.fillText('IVA: $31.500,00',690,355);
    ctx.fillText('TOTAL: $181.500,00',690,465);
  }else{
    ctx.save();
    if(f.mode==='shear')ctx.transform(.96,.13,-.22,.97,190,30);
    drawLines(ctx);
    ctx.restore();
  }
  if(f.mode==='shadow'){
    const g=ctx.createLinearGradient(600,0,1320,0);
    g.addColorStop(0,'rgba(40,35,30,0)');
    g.addColorStop(.5,'rgba(30,30,30,.34)');
    g.addColorStop(1,'rgba(22,22,22,.62)');
    ctx.fillStyle=g;ctx.fillRect(400,150,970,620);
  }
  if(f.mode==='glare'){
    const g=ctx.createRadialGradient(800,420,0,800,420,340);
    g.addColorStop(0,'rgba(255,255,255,.99)');
    g.addColorStop(.44,'rgba(255,255,255,.85)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(810,430,390,270,-.18,0,Math.PI*2);ctx.fill();
  }
  if(f.mode==='stamp'){
    ctx.save();ctx.translate(850,470);ctx.rotate(-.25);
    ctx.globalAlpha=.26;ctx.strokeStyle='#aa3333';ctx.lineWidth=14;
    ctx.strokeRect(-260,-55,520,112);
    ctx.font='bold 90px Arial';ctx.fillStyle='#aa3333';
    ctx.fillText('PAGADO',-240,40);ctx.restore();
  }
  if(f.mode==='noise-jpeg'){
    for(let i=0;i<280;i++){
      const x=(i*137)%W,y=(i*211)%H;
      ctx.fillStyle=i%2?'rgba(180,170,160,.17)':'rgba(0,0,0,.09)';
      ctx.fillRect(x,y,3+(i%6),1+(i%3));
    }
  }
  if(f.mode==='crop'){
    // Borrar deliberadamente los caracteres finales de los importes, NO el margen vacío.
    // Con 620 px se intercepta el campo numérico en esta tipografía sintética.
    ctx.fillStyle='#fbfaf6';
    ctx.fillRect(620,160,W-620,H-160);
  }
  const buffer=c.toBuffer(f.mode==='noise-jpeg'?'image/jpeg':'image/png');
  return buffer;
}
await assertOfflineModel();
const totals={cases:CASES.length,fields:CASES.length*3,correct:0,abstentions:0,
 wrongPlausible:0,silentArithmeticRisks:0,ocrRejected:0,
 recaptureSuggested:0,reviewRequired:0,automaticApprovals:0,
 suspectedWrongDespiteGoodConfidence:0};
console.log('FLUYNOVA - ESCENARIOS OCR DIFICILES - OCR TESSERACT REAL - 8 CASOS SINTETICOS');
for(const f of CASES){
  let out,score;
  const started=Date.now();
  try{
    out=await recognizeImage(render(f),{minimumConfidence:35,timeoutMs:60000});
  }catch(e){
    totals.abstentions+=3;totals.ocrRejected++;
    console.log('CASO',f.id,f.name,'RECHAZADO',e?.code||'ERROR','ms',Date.now()-started);
    continue;
  }
  const reviewed=verifyMoneyOnly(out.text,{inputOrigin:'OCR',visualReviewDeclared:true});
  if(reviewed.can_auto_approve!==false||reviewed.verified_amounts!==0||
    reviewed.original_document_verified!==false||out.can_auto_approve!==false||
    out.model_called!==false||out.reading_quality?.can_auto_approve!==false){
    totals.automaticApprovals++;
    throw Error('UNSAFE_OCR_APPROVAL_OR_CERTIFICATION');
  }
  score=scoreOcrAmounts(expected,reviewed.extracted);
  // Dos o más etiquetas monetarias perdidas no deben quedar disimuladas por
  // confianza global de 92-95. Es una invariante, no una expectativa de aciertos.
  if(score.abstentions>=2&&out.reading_quality?.classification!=='RECAPTURAR_SUGERIDO')
    throw Error('OCR_LECTURA_INCOMPLETA_SIN_SUGERENCIA_RECAPTURA');
  totals.correct+=score.correct;
  totals.abstentions+=score.abstentions;
  totals.wrongPlausible+=score.wrongPlausible;
  totals.silentArithmeticRisks+=Number(score.silentArithmeticRisk);
  if(out.reading_quality?.classification==='RECAPTURAR_SUGERIDO')
    totals.recaptureSuggested++;
  if(out.reading_quality?.classification==='COTEJAR_VISUALMENTE')
    totals.reviewRequired++;
  if(score.wrongPlausible>0&&out.confidence_percent>=75)
    totals.suspectedWrongDespiteGoodConfidence++;
  console.log('CASO',f.id,f.name,
    'correctos',score.correct+'/3',
    'abstenciones',score.abstentions,
    'equivocados_legibles',score.wrongPlausible,
    'suma_erronea_pero_coherente',score.silentArithmeticRisk,
    'confianza_global',out.confidence_percent,
    'clasificacion',out.reading_quality?.classification,
    'ms',Date.now()-started);
}
console.log('RESUMEN documentos',totals.cases);
console.log('RESUMEN campos',totals.fields);
console.log('RESUMEN correctos',totals.correct);
console.log('RESUMEN abstenciones',totals.abstentions);
console.log('RESUMEN equivocados_legibles',totals.wrongPlausible);
console.log('RESUMEN suma_erronea_pero_coherente',totals.silentArithmeticRisks);
console.log('RESUMEN OCR_rechazados',totals.ocrRejected);
console.log('RESUMEN recapturas_sugeridas',totals.recaptureSuggested);
console.log('RESUMEN errores_con_confianza_global_alta',totals.suspectedWrongDespiteGoodConfidence);
console.log('RESUMEN aprobaciones_automaticas',totals.automaticApprovals);
if(totals.correct+totals.abstentions+totals.wrongPlausible!==totals.fields||
   totals.automaticApprovals!==0){
  process.exitCode=1;
}
console.log('SOLO DOCUMENTOS INVENTADOS: estos resultados no estiman precisión comercial ni permiten aprobar facturas.');
