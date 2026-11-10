// Preflight reproducible de PDF raster artificial sin documentos ni OCR.
// Ejecutar: node PDF-SCAN-PREFLIGHT.mjs
import {buildScannedPdf} from './pdf-scan-fixtures.mjs';
import {inspectImageBytes} from './image-input.mjs';
const pdf=buildScannedPdf();
console.log('PREFLIGHT_1 fixture_generated',pdf.length);
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const task=pdfjs.getDocument({
 data:new Uint8Array(pdf),useSystemFonts:false,disableFontFace:true,
 isEvalSupported:false,stopAtErrors:true,disableAutoFetch:true,disableStream:true
});
const document=await task.promise;
console.log('PREFLIGHT_2 pages',document.numPages);
const page=await document.getPage(1);
console.log('PREFLIGHT_3 page_loaded');
const tc=await page.getTextContent();
console.log('PREFLIGHT_4 text_items',tc.items.length);
const viewport=page.getViewport({scale:2});
const {createCanvas}=await import('@napi-rs/canvas');
const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
console.log('PREFLIGHT_5 canvas_ready',canvas.width,canvas.height);
await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
console.log('PREFLIGHT_6 raster_rendered');
const png=canvas.toBuffer('image/png');
const dims=inspectImageBytes(png);
console.log('PREFLIGHT_7 png_valid',dims.format,dims.width,dims.height,png.length);
await document.destroy();await task.destroy().catch(()=>{});
console.log('PREFLIGHT_8 success');
