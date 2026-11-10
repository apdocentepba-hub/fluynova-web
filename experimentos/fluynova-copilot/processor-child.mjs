// Proceso DESCARTABLE para bibliotecas de PDF/OCR: no abre servidor, no persiste bytes.
// NO es un sandbox contra código malicioso. Contiene fallos/crashes y libera recursos al salir.
import {extractPdfText,PDF_MAX_BYTES} from './pdf-text.mjs';
import {recognizeImage} from './ocr-image.mjs';
import {IMAGE_MAX_BYTES} from './image-input.mjs';
import {CopilotError} from './analysis.mjs';

const kind=process.argv[2];
if(!['pdf','ocr'].includes(kind))process.exit(64);
const limit=kind==='pdf'?PDF_MAX_BYTES:IMAGE_MAX_BYTES;
async function readInput(){
  let size=0;const chunks=[];
  for await(const chunk of process.stdin){
    size+=chunk.length;
    if(size>limit)throw new CopilotError('PROCESSOR_INPUT_TOO_LARGE',413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
try{
  const data=await readInput();
  const result=kind==='pdf'?await extractPdfText(data):await recognizeImage(data);
  process.stdout.write(JSON.stringify({ok:true,result}));
}catch(err){
  const trusted=err instanceof CopilotError;
  process.stdout.write(JSON.stringify({
    ok:false,
    code:trusted?err.code:'PROCESSOR_FAILED',
    status:trusted?err.status:502
  }));
}
