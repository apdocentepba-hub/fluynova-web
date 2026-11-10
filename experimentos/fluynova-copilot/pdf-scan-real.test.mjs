// OCR VERDADERO del PDF de una sola página cuya única capa es una imagen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScannedPdf} from './pdf-scan-fixtures.mjs';
import {recognizeScannedPdf} from './pdf-image-ocr.mjs';
import {assertOfflineModel} from './ocr-model.mjs';

test('PDF escaneado de laboratorio: PDF.js -> Canvas -> OCR Tesseract ESPAÑOL real',async()=>{
 await assertOfflineModel();
 const pdf=buildScannedPdf();
 const result=await recognizeScannedPdf(pdf);
 assert.equal(result.document_origin,'PDF_SCAN_OCR_LOCAL');
 assert.equal(result.pages,1);
 assert.equal(result.ocr_used,true);
 assert.equal(result.model_called,false);
 assert.equal(result.can_auto_approve,false);
 assert.equal(result.needs_manual_review,true);
 assert.ok(result.characters>=30);
 assert.match(result.text,/FACTURA/i);
 assert.match(result.text,/TOTAL/i);
});
