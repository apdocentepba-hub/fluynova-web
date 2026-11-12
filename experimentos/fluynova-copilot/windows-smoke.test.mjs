// Smoke test en Windows NATIVO de GitHub Actions. 100% datos inventados.
// Nunca requiere ni consulta Ollama. No abre el puerto a redes externas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createApp} from './server.mjs';
import {buildSyntheticPdf} from './pdf-fixtures.mjs';
import {assertOfflineModel} from './ocr-model.mjs';

const source='Factura demo WINDOWS-0001\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
const damaged='Factura demo WINDOWS-0001\nNeto: $150.800,00\nIVA: $31.500,00\nTotal: $182.300,00';
const expected={net_cents:15000000,tax_cents:3150000,total_cents:18150000};
const declared={document:damaged,input_origin:'OCR',visual_review_declared:true,
 manual_amounts:{net_cents:'150.000,00',tax_cents:'31.500,00',total_cents:'181.500,00'}};
const moneyKeys=['net_cents','tax_cents','total_cents'];
function assertAmounts(extracted){
 for(const key of moneyKeys)assert.equal(extracted[key],expected[key],key);
}
function makeImage(){
 const c=createCanvas(1300,570),ctx=c.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 ctx.fillStyle='#111';ctx.font='bold 65px Arial';
 ctx.fillText('FACTURA FICTICIA',48,110);
 ctx.fillText('NETO: $150.000,00',48,230);
 ctx.fillText('IVA: $31.500,00',48,345);
 ctx.fillText('TOTAL: $181.500,00',48,460);
 return c.toBuffer('image/png');
}
function assertNotApproved(data){
 assert.equal(data.model_called,false);
 assert.equal(data.can_auto_approve,false);
}
test('Windows nativo: servidor local, PDF real, OCR real, revisión humana y seguridad HTTP',
 {timeout:240000},async()=>{
 if(process.platform!=='win32')throw new Error('THIS_TEST_MUST_RUN_ON_REAL_WINDOWS');
 await assertOfflineModel();
 let modelCalls=0;
 const app=createApp({analyzer:async()=>{modelCalls++;throw Error('LLM_MUST_NOT_BE_CALLED')}});
 await new Promise((resolve,reject)=>{
  app.once('error',reject);
  app.listen(0,'127.0.0.1',resolve);
 });
 const base='http://127.0.0.1:'+app.address().port;
 const post=(path,body,ct)=>fetch(base+path,{
  method:'POST',headers:{origin:base,'content-type':ct},body
 });
 try{
  const status=await fetch(base+'/api/status');
  assert.equal(status.status,200);
  assert.equal((await status.json()).runtime,'LOCAL_ONLY');
  const html=await fetch(base+'/');
  assert.equal(html.status,200);
  const body=await html.text();
  assert.ok(body.includes('id="manual-control"'));
  assert.ok(body.includes('id="ocr-confirm"'));
  const pdfJs=await fetch(base+'/assets/pdfjs/pdf.mjs');
  assert.equal(pdfJs.status,200);
  assert.ok((await pdfJs.text()).length>50000);
  // Contrato del control textual sin LLM.
  const manualText=await post('/api/verify-money',
   JSON.stringify({document:source}),'application/json');
  assert.equal(manualText.status,200);
  const parsed=await manualText.json();
  assertNotApproved(parsed);assertAmounts(parsed.extracted);
  // PDF REAL: binario generado en memoria -> subproceso de Windows -> parser.
  const pdf=buildSyntheticPdf({pages:[[
   'FACTURA DEMO WINDOWS','Neto: $150.000,00',
   'IVA: $31.500,00','Total: $181.500,00'
  ]]});
  const pdfResponse=await post('/api/pdf/extract',pdf,'application/pdf');
  assert.equal(pdfResponse.status,200);
  const extracted=await pdfResponse.json();
  assertNotApproved(extracted);
  assert.equal(extracted.document_origin,'PDF_TEXTO_LOCAL');
  assert.match(extracted.text,/Neto: \$150.000,00/);
  const pdfMoney=await post('/api/verify-money',
   JSON.stringify({document:extracted.text}),'application/json');
  assert.equal(pdfMoney.status,200);
  assertAmounts((await pdfMoney.json()).extracted);
  // OCR REAL: PNG en memoria -> subproceso Windows Tesseract español offline.
  const png=makeImage();
  const ocrResponse=await post('/api/ocr/image',png,'image/png');
  assert.equal(ocrResponse.status,200);
  const ocr=await ocrResponse.json();
  assertNotApproved(ocr);
  assert.equal(ocr.ocr_used,true);
  assert.equal(ocr.needs_manual_review,true);
  assert.ok(ocr.characters>=30);
  assert.match(ocr.text,/FACTURA/i);
  assert.match(ocr.text,/TOTAL/i);
  // Transcripción humana no destructiva: cifras alteradas del OCR se comparan
  // pero NUNCA se cambia el texto OCR original ni se certifica su autenticidad.
  const reviewed=await post('/api/manual-review',
   JSON.stringify(declared),'application/json');
  assert.equal(reviewed.status,200);
  const result=await reviewed.json();
  assertNotApproved(result);
  assert.equal(result.original_document_verified,false);
  assert.equal(result.verified_amounts,0);
  assert.equal(result.input_origin,'OCR');
  assertAmounts(result.extracted);
  assert.equal(result.amount_verification.net_cents.disagreement_with_ocr,true);
  assert.equal(result.amount_verification.total_cents.disagreement_with_ocr,true);
  assert.equal(result.arithmetic_consistent,true);
  const invalid=await post('/api/manual-review',JSON.stringify({
   ...declared,manual_amounts:{...declared.manual_amounts,total_cents:'181,500.00'}
  }),'application/json');
  assert.equal(invalid.status,422);
  assert.equal((await invalid.json()).error,'MANUAL_AMOUNT_INVALID');
  // Hosts/orígenes ajenos y rutas arbitrarias siguen bloqueados.
  const attack=await fetch(base+'/api/manual-review',{
   method:'POST',headers:{origin:'https://externo.invalid','content-type':'application/json'},
   body:JSON.stringify(declared)
  });
  assert.equal(attack.status,403);
  assert.equal((await attack.json()).error,'ORIGIN_REJECTED');
  const unknown=await fetch(base+'/node_modules/pdfjs-dist/build/pdf.mjs');
  assert.equal(unknown.status,404);
  assert.equal(modelCalls,0);
  console.log('WINDOWS_NATIVE_SMOKE: PASS | PDF real | OCR real offline | manual review | no LLM | no auto approval');
 }finally{
  app.closeAllConnections();
  await new Promise(r=>app.close(r));
 }
});
