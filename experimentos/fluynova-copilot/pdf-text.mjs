// PDF de texto local: SIN OCR, SIN IA, SIN archivo persistido ni URLs remotas.
// La biblioteca PDF.js se carga solo al procesar un PDF.
import {CopilotError} from './analysis.mjs';

export const PDF_MAX_BYTES=4*1024*1024;
export const PDF_MAX_PAGES=6;
export const PDF_MAX_TEXT_CHARS=6000;

export async function extractPdfText(input,{pdfLoader}={}){
  const buffer=Buffer.isBuffer(input)?input:
    input instanceof Uint8Array?Buffer.from(input):null;
  if(!buffer||buffer.length<30||buffer.length>PDF_MAX_BYTES)
    throw new CopilotError('PDF_INVALID_SIZE',422);
  // No fiarse de MIME o extensión; rechazar archivos renombrados.
  if(buffer.subarray(0,5).toString('latin1')!=='%PDF-')
    throw new CopilotError('PDF_INVALID_HEADER',415);
  let loadingTask,document;
  try{
    const pdfjs=pdfLoader||await import('pdfjs-dist/legacy/build/pdf.mjs');
    loadingTask=pdfjs.getDocument({
      data:new Uint8Array(buffer),
      useSystemFonts:false,
      disableFontFace:true,
      isEvalSupported:false,
      stopAtErrors:true,
      disableAutoFetch:true,
      disableStream:true,
      enableXfa:false
    });
    document=await loadingTask.promise;
    if(document.numPages<1||document.numPages>PDF_MAX_PAGES)
      throw new CopilotError('PDF_TOO_MANY_PAGES',422);
    const pages=[];
    let total=0;
    for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
      const page=await document.getPage(pageNumber);
      const tc=await page.getTextContent();
      const lines=[];let line='',lastY=null;
      for(const item of tc.items){
        if(typeof item.str!=='string')continue;
        const str=item.str.replace(/\s+/g,' ').trim();
        if(!str)continue;
        const y=Array.isArray(item.transform)?Number(item.transform[5]):null;
        const lineChanged=lastY!==null&&y!==null&&Math.abs(lastY-y)>2;
        if(lineChanged){
          if(line.trim())lines.push(line.trim());
          line='';
        }
        // Se preservan líneas para el parser estricto de etiquetas ARS.
        line+=(line?' ':'')+str;
        if(item.hasEOL){
          lines.push(line.trim());line='';lastY=null;
        }else lastY=y;
      }
      if(line.trim())lines.push(line.trim());
      const pageText=lines.join('\n').trim();
      // Un PDF mixto (texto e imágenes) no se considera íntegramente interpretado.
      if(pageText.length<4)throw new CopilotError('PDF_PAGE_WITHOUT_TEXT',422);
      total+=pageText.length+1;
      if(total>PDF_MAX_TEXT_CHARS)
        throw new CopilotError('PDF_TEXT_TOO_LONG',422);
      pages.push(pageText);
    }
    const text=pages.join('\n').trim();
    if(text.length<25)throw new CopilotError('PDF_INSUFFICIENT_TEXT',422);
    return {
      document_origin:'PDF_TEXTO_LOCAL',
      text,
      pages:document.numPages,
      characters:text.length,
      ocr_used:false,
      model_called:false,
      pages_without_extractable_text:0,
      disclaimer:'Se extrajo texto seleccionable, NO se verificó visualmente su posición ni autenticidad. PDF escaneado requiere OCR no implementado.'
    };
  }catch(error){
    if(error instanceof CopilotError)throw error;
    const msg=String(error?.name||'')+' '+String(error?.message||'');
    if(/Password|encrypted|password/i.test(msg))
      throw new CopilotError('PDF_PASSWORD_PROTECTED',422);
    if(/Cannot find package|Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i.test(msg))
      throw new CopilotError('PDF_ENGINE_NOT_INSTALLED',503);
    throw new CopilotError('PDF_UNREADABLE',422);
  }finally{
    try{await document?.destroy()}catch{}
    try{await loadingTask?.destroy()}catch{}
  }
}
