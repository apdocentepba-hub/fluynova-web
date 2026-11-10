import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPdfText,PDF_MAX_BYTES,PDF_MAX_PAGES} from './pdf-text.mjs';
import {buildSyntheticPdf} from './pdf-fixtures.mjs';
import {verifyMoneyOnly} from './verify-money.mjs';

const sample=['Factura de demostracion 0001',
 'Proveedor: Empresa totalmente ficticia',
 'Neto: $150.000,00',
 'IVA: $31.500,00',
 'Total: $181.500,00'];
test('PDF.js REAL lee PDF binario de una pagina generado en memoria',async()=>{
 const pdf=buildSyntheticPdf({pages:[sample]});
 const r=await extractPdfText(pdf);
 assert.equal(r.pages,1);
 assert.equal(r.document_origin,'PDF_TEXTO_LOCAL');
 assert.equal(r.ocr_used,false);
 assert.equal(r.model_called,false);
 for(const line of sample)assert.ok(r.text.includes(line),'Falta '+line);
 const verified=verifyMoneyOnly(r.text);
 assert.equal(verified.verified_amounts,3);
 assert.equal(verified.extracted.net_cents,15000000);
 assert.equal(verified.extracted.tax_cents,3150000);
 assert.equal(verified.extracted.total_cents,18150000);
 assert.equal(verified.can_auto_approve,false);
});
test('PDF con dos paginas preserva el texto y los limites',async()=>{
 const pdf=buildSyntheticPdf({pages:[sample,['Continuacion ficticia', 'No contiene datos reales']]});
 const r=await extractPdfText(pdf);
 assert.equal(r.pages,2);
 assert.match(r.text,/Continuacion ficticia/);
 assert.ok(r.characters>=r.text.length);
});
test('PDF de mas de seis paginas se rechaza sin inferencia',async()=>{
 const pdf=buildSyntheticPdf({pages:Array.from({length:PDF_MAX_PAGES+1},(_,i)=>['Factura ficticia '+i,'Neto: $10,00','IVA: $2,10','Total: $12,10'])});
 await assert.rejects(extractPdfText(pdf),e=>e.code==='PDF_TOO_MANY_PAGES');
});
test('PDF sin capa de texto se rechaza explicitamente, sin fingir OCR',async()=>{
 const pdf=buildSyntheticPdf({pages:[[]]});
 await assert.rejects(extractPdfText(pdf),e=>e.code==='PDF_PAGE_WITHOUT_TEXT');
});
test('PDF mixto con una pagina no extraible tambien se rechaza',async()=>{
 const pdf=buildSyntheticPdf({pages:[sample,[]]});
 await assert.rejects(extractPdfText(pdf),e=>e.code==='PDF_PAGE_WITHOUT_TEXT');
});
test('solo acepta encabezado binario PDF valido y size acotado',async()=>{
 for(const bytes of [Buffer.alloc(0),Buffer.from('cualquier texto no PDF '.repeat(3)),
  Buffer.alloc(PDF_MAX_BYTES+1)]){
  await assert.rejects(extractPdfText(bytes),e=>['PDF_INVALID_SIZE','PDF_INVALID_HEADER'].includes(e.code));
 }
 const invalid=Buffer.from('%PDF-1.4\nesto no es un PDF realmente');
 await assert.rejects(extractPdfText(invalid),e=>e.code==='PDF_UNREADABLE');
});
test('no revela archivos o rutas locales en errores del motor',async()=>{
 const pdf=buildSyntheticPdf();
 await assert.rejects(extractPdfText(pdf,{pdfLoader:{
   getDocument(){throw new Error('ruta sensible: C:/Users/cliente/documento.pdf')}
 }}),e=>e.code==='PDF_UNREADABLE' && !e.message.includes('Users'));
});
test('simula motor no instalado sin acudir a servicios externos',async()=>{
 const pdf=buildSyntheticPdf();
 await assert.rejects(extractPdfText(pdf,{pdfLoader:{
  getDocument(){const e=new Error("Cannot find package 'pdfjs-dist'");e.code='ERR_MODULE_NOT_FOUND';throw e;}
 }}),e=>e.code==='PDF_ENGINE_NOT_INSTALLED');
});
