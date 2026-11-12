// Medición REAL del producto ya integrado, no sólo de regiones manualmente elegidas.
// La seguridad se evalúa por monto frente a verdad sintética; no valida facturas.
import {recognizeImage} from './ocr-image.mjs';
import {assertOfflineModel} from './ocr-model.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';
import {scoreOcrAmounts} from './ocr-score.mjs';
import {makeMultizoneFixture,MULTIZONE_TRUTH} from './ocr-multizona-fixtures.mjs';

await assertOfflineModel();
const total={cases:3,fields:9,correct:0,missing:0,wrong:0,autoApproved:0};
for(const pos of ['left','center','right']){
 const result=await recognizeImage(makeMultizoneFixture(pos),{timeoutMs:45000});
 const control=verifyMoneyOnly(result.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 const score=scoreOcrAmounts(MULTIZONE_TRUTH,control.extracted);
 total.correct+=score.correct;total.missing+=score.abstentions;total.wrong+=score.wrongPlausible;
 if(result.can_auto_approve!==false||control.can_auto_approve!==false||
    control.verified_amounts!==0||control.original_document_verified!==false){
  total.autoApproved++;throw Error('OCR_MULTIZONA_CERTIFICACION_INDEBIDA');
 }
 const evidence=result.layout_region?.regions_checked||[];
 console.log('INTEGRADO',pos,'correctos',score.correct+'/3',
  'abstenciones',score.abstentions,
  'equivocados_legibles',score.wrongPlausible,
  'clasificacion',result.reading_quality?.classification,
  'zonas_visitadas',evidence.map(x=>x.zone).join(','),
  'zonas_descartadas',evidence.filter(x=>!x.merged).map(x=>x.zone+':'+x.reason).join(','),
  'conflictos',result.layout_region?.conflict_fields?.length||0);
}
console.log('RESUMEN INTEGRADO correctos',total.correct+'/9');
console.log('RESUMEN INTEGRADO abstenciones',total.missing);
console.log('RESUMEN INTEGRADO importes_erroneos_legibles',total.wrong);
console.log('RESUMEN INTEGRADO aprobaciones',total.autoApproved);
if(total.correct+total.missing+total.wrong!==total.fields||
   total.autoApproved>0||total.wrong>0)
 throw Error('OCR_MULTIZONA_REGRESION_O_IMPORTES_INCORRECTOS');
console.log('La ausencia de importes falsos en 3 muestras sintéticas no demuestra seguridad comercial.');
