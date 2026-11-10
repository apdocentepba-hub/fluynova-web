// PDF ESCANEADO -> renderizar imagen por página -> OCR español LOCAL.
// Sin datos persistentes ni aprobación automática. NO utilizar con PDFs reales sin aislamiento.
import {CopilotError} from './analysis.mjs';
import {PDF_MAX_BYTES} from './pdf-text.mjs';
import {IMAGE_MAX_PIXELS,OCR_MAX_TEXT_CHARS} from './image-input.mjs';
import {recognizeImage} from './ocr-image.mjs';

export const SCAN_MAX_PAGES=2;
const RENDER_SCALE=2;

export async function recognizeScannedPdf(input,{
 ocrRecognizer=recognizeImage,pdfLoader,canvasFactory
}={}){
 const bytes=Buffer.isBuffer(input)?input:
   input instanceof Uint8Array?Buffer.from(input):null;
 if(!bytes||bytes.length<30||bytes.length>PDF_MAX_BYTES)
   throw new CopilotError('PDF_INVALID_SIZE',422);
 if(bytes.subarray(0,5).toString('latin1')!=='%PDF-')
   throw new CopilotError('PDF_INVALID_HEADER',415);
 let loadingTask,document;
 try{
   const pdfjs=pdfLoader||await import('pdfjs-dist/legacy/build/pdf.mjs');
   const {createCanvas}=canvasFactory||await import('@napi-rs/canvas');
   loadingTask=pdfjs.getDocument({
     data:new Uint8Array(bytes),useSystemFonts:false,disableFontFace:true,
     isEvalSupported:false,stopAtErrors:true,disableAutoFetch:true,
     disableStream:true,enableXfa:false
   });
   document=await loadingTask.promise;
   if(document.numPages<1||document.numPages>SCAN_MAX_PAGES)
     throw new CopilotError('OCR_PDF_TOO_MANY_PAGES',422);
   const parts=[],confidence=[];
   for(let i=1;i<=document.numPages;i++){
     const page=await document.getPage(i);
     const tc=await page.getTextContent();
     if(tc.items.some(item=>typeof item.str==='string'&&item.str.trim().length)){
       throw new CopilotError('OCR_PDF_HAS_TEXT_USE_PDF_EXTRACT',422);
     }
     const viewport=page.getViewport({scale:RENDER_SCALE});
     const w=Math.ceil(viewport.width),h=Math.ceil(viewport.height);
     if(w<80||h<40||w>6000||h>6000||w*h>IMAGE_MAX_PIXELS)
       throw new CopilotError('OCR_PDF_DIMENSIONS_REJECTED',422);
     const canvas=createCanvas(w,h);
     const ctx=canvas.getContext('2d');
     await page.render({canvasContext:ctx,viewport,canvas}).promise;
     const png=canvas.toBuffer('image/png');
     const ocr=await ocrRecognizer(png);
     if(ocr?.ocr_used!==true||ocr?.model_called!==false||
        ocr?.can_auto_approve!==false||typeof ocr.text!=='string'||
        ocr.text.trim().length<25||!Number.isFinite(ocr.confidence_percent))
       throw new CopilotError('OCR_INVALID_RESULT',502);
     parts.push(ocr.text.trim());
     confidence.push(ocr.confidence_percent);
     if(parts.join('\n').length>OCR_MAX_TEXT_CHARS)
       throw new CopilotError('OCR_TEXT_TOO_LONG',422);
   }
   const text=parts.join('\n');
   return {
     document_origin:'PDF_SCAN_OCR_LOCAL',
     text,characters:text.length,pages:document.numPages,
     confidence_percent:Math.round(
       confidence.reduce((acc,n)=>acc+n,0)/confidence.length*10
     )/10,
     ocr_used:true,ocr_engine:'TESSERACT_LOCAL_SPA',model_called:false,
     needs_manual_review:true,can_auto_approve:false,
     disclaimer:'Texto aproximado por OCR de páginas escaneadas. Debe cotejarse visualmente; no representa validación fiscal ni lectura garantizada.'
   };
 }catch(err){
   if(err instanceof CopilotError)throw err;
   const msg=String(err?.name||'')+' '+String(err?.message||'');
   if(/Password|encrypted|password/i.test(msg))
     throw new CopilotError('PDF_PASSWORD_PROTECTED',422);
   if(/Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND/i.test(msg))
     throw new CopilotError('OCR_PDF_ENGINE_NOT_INSTALLED',503);
   throw new CopilotError('OCR_PDF_PROCESSING_FAILED',422);
 }finally{
   try{await document?.destroy()}catch{}
   try{await loadingTask?.destroy()}catch{}
 }
}
