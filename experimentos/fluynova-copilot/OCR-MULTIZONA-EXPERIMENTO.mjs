// Investigación con Tesseract español REAL antes de cambiar el motor.
// Se generan documentos 100% sintéticos, importes etiquetados en 3 zonas.
// No se mezclan ni certifican resultados; se mide cobertura por zona.
import {makeMultizoneFixture,MULTIZONE_TRUTH} from './ocr-multizona-fixtures.mjs';
import {createWorker} from 'tesseract.js';
import {assertOfflineModel,OCR_DATA_DIR} from './ocr-model.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {scoreOcrAmounts} from './ocr-score.mjs';

const truth=MULTIZONE_TRUTH;
const regions=[
 {name:'full',rectangle:null},
 {name:'right',rectangle:{left:800,top:130,width:640,height:660}},
 {name:'center',rectangle:{left:400,top:130,width:740,height:660}},
 {name:'left',rectangle:{left:20,top:130,width:700,height:660}}
];
await assertOfflineModel();
const worker=await createWorker('spa',1,{langPath:OCR_DATA_DIR,gzip:true,cacheMethod:'none'});
try{
 for(const position of ['left','center','right']){
  const bytes=makeMultizoneFixture(position);
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
