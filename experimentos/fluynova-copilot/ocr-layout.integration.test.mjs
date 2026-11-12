import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {recognizeImage} from './ocr-image.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

const first='FACTURA FICTICIA\nNeto: $150.000,00';
const complete=first+'\nIVA: $31.500,00\nTotal: $181.500,00';
function png(){
 const c=createCanvas(1200,520),ctx=c.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,520);
 ctx.font='bold 48px Arial';ctx.fillStyle='#111';
 ctx.fillText('FACTURA FICTICIA',40,90);
 ctx.fillText('Neto: $150.000,00',40,180);
 return c.toBuffer('image/png');
}
function setupMock(rawSecond){
 let calls=[],terminated=false;
 return {
  calls,terminated:()=>terminated,
  workerFactory:async()=>({
    recognize:async(_b,options)=>{
      calls.push(options??null);
      return {data:{text:calls.length===1?first:rawSecond,confidence:92}};
    },
    terminate:async()=>{terminated=true}
  })
 };
}
test('motor OCR hace sólo segunda pasada por región cuando faltan importes',async()=>{
 const mock=setupMock(complete);
 const output=await recognizeImage(png(),{
  checkModel:async()=>{},workerFactory:mock.workerFactory
 });
 assert.equal(mock.calls.length,2);
 assert.equal(mock.calls[0],null);
 assert.ok(mock.calls[1].rectangle.left>0);
 assert.deepEqual(output.layout_region.recovered_fields,['tax_cents','total_cents']);
 assert.equal(output.layout_region.region_retry_attempted,true);
 assert.equal(output.layout_region.conflict_fields.length,0);
 assert.equal(output.reading_quality.classification,'COTEJAR_VISUALMENTE');
 const checked=verifyMoneyOnly(output.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 assert.deepEqual([checked.extracted.net_cents,checked.extracted.tax_cents,
   checked.extracted.total_cents],[15000000,3150000,18150000]);
 assert.equal(checked.verified_amounts,0);
 assert.equal(checked.can_auto_approve,false);
 assert.equal(mock.terminated(),true);
});
test('motor OCR anula cifra primaria cuando segunda lectura regional la contradice',async()=>{
 const mock=setupMock('FACTURA FICTICIA\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00');
 const out=await recognizeImage(png(),{checkModel:async()=>{},
  workerFactory:mock.workerFactory});
 assert.deepEqual(out.layout_region.conflict_fields,['net_cents']);
 const checked=verifyMoneyOnly(out.text,{inputOrigin:'OCR',visualReviewDeclared:true});
 assert.equal(checked.extracted.net_cents,null);
 assert.equal(checked.extracted.tax_cents,3150000);
 assert.equal(checked.extracted.total_cents,18230000);
 assert.equal(checked.verified_amounts,0);
 assert.equal(checked.can_auto_approve,false);
 assert.equal(out.reading_quality.classification,'CORREGIR_O_RECAPTURAR');
});
test('OCR regional de baja confianza no añade importes de forma silenciosa',async()=>{
 let calls=0;
 const out=await recognizeImage(png(),{
  checkModel:async()=>{},
  workerFactory:async()=>({
    recognize:async()=>{
      calls++;
      return {data:{text:calls===1?first:complete,confidence:calls===1?92:20}};
    },terminate:async()=>{}
  })
 });
 assert.equal(calls,2);
 assert.equal(out.layout_region.region_retry_attempted,true);
 assert.deepEqual(out.layout_region.recovered_fields,[]);
 assert.equal(out.reading_quality.readable_amounts,1);
 assert.equal(out.reading_quality.classification,'RECAPTURAR_SUGERIDO');
});
test('OCR con tres campos completos no reintenta región',async()=>{
 let calls=0;
 const out=await recognizeImage(png(),{
  checkModel:async()=>{},
  workerFactory:async()=>({
    recognize:async()=>{calls++;return {data:{text:complete,confidence:92}}},
    terminate:async()=>{}
  })
 });
 assert.equal(calls,1);
 assert.equal(out.layout_region.region_retry_attempted,false);
});
