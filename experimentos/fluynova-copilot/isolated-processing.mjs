// Aísla crashes y cuelgues de PDF.js/Tesseract en un proceso Node descartable.
// No ofrece sandbox de sistema operativo: no acepta documentos reales o sin autorización.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CopilotError} from './analysis.mjs';
import {PDF_MAX_BYTES} from './pdf-text.mjs';
import {IMAGE_MAX_BYTES,inspectImageBytes} from './image-input.mjs';

const MAX_OUTPUT=64*1024;
const WORKER_URL=new URL('./processor-child.mjs',import.meta.url);
const MODES={
  pdf:{maxBytes:PDF_MAX_BYTES,timeoutMs:30000,heapMb:384},
  ocr:{maxBytes:IMAGE_MAX_BYTES,timeoutMs:115000,heapMb:512}
};
export async function runIsolated(kind,input,{
  workerUrl=WORKER_URL,timeoutMs,
  spawnImpl=spawn
}={}){
  const defaults=MODES[kind];
  if(!defaults)throw new CopilotError('PROCESSOR_INVALID_KIND',500);
  const bytes=Buffer.isBuffer(input)?input:
    input instanceof Uint8Array?Buffer.from(input):null;
  if(!bytes||bytes.length<30||bytes.length>defaults.maxBytes)
    throw new CopilotError('PROCESSOR_INVALID_SIZE',422);
  if(kind==='pdf'){
    if(bytes.subarray(0,5).toString('latin1')!=='%PDF-')
      throw new CopilotError('PDF_INVALID_HEADER',415);
  }else{
    inspectImageBytes(bytes);
  }
  const timeout=timeoutMs??defaults.timeoutMs;
  if(!Number.isInteger(timeout)||timeout<1||timeout>180000)
    throw new CopilotError('PROCESSOR_BAD_TIMEOUT',500);
  const script=fileURLToPath(workerUrl);
  return new Promise((resolve,reject)=>{
    let settled=false,outputSize=0;
    const chunks=[];
    let child;
    function finish(error,result){
      if(settled)return;
      settled=true;clearTimeout(timer);
      if(error)reject(error);else resolve(result);
    }
    function terminate(error){
      try{child?.kill('SIGKILL')}catch{}
      finish(error);
    }
    let timer;
    try{
      child=spawnImpl(process.execPath,[
        '--max-old-space-size='+defaults.heapMb,
        script,kind
      ],{
        stdio:['pipe','pipe','ignore'],
        windowsHide:true,
        shell:false
      });
      timer=setTimeout(()=>terminate(new CopilotError('PROCESSOR_TIMEOUT',504)),timeout);
      child.on('error',()=>finish(new CopilotError('PROCESSOR_UNAVAILABLE',503)));
      child.stdout.on('data',chunk=>{
        outputSize+=chunk.length;
        if(outputSize>MAX_OUTPUT){
          terminate(new CopilotError('PROCESSOR_OUTPUT_TOO_LARGE',502));return;
        }
        chunks.push(chunk);
      });
      child.on('close',(code,signal)=>{
        if(settled)return;
        if(code!==0||signal){
          finish(new CopilotError('PROCESSOR_CRASHED',502));return;
        }
        let payload;
        try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
        catch{finish(new CopilotError('PROCESSOR_INVALID_OUTPUT',502));return}
        if(!payload||typeof payload!=='object'){
          finish(new CopilotError('PROCESSOR_INVALID_OUTPUT',502));return;
        }
        if(payload.ok===false){
          const status=payload.status;
          const validStatus=Number.isInteger(status)&&status>=400&&status<=599;
          const codeValue=payload.code;
          const validCode=typeof codeValue==='string'&&/^[A-Z][A-Z0-9_]{1,64}$/.test(codeValue);
          finish(new CopilotError(validCode?codeValue:'PROCESSOR_FAILED',validStatus?status:502));
          return;
        }
        const result=payload.result;
        if(payload.ok!==true||!result||typeof result!=='object'||
          typeof result.text!=='string'||result.text.length>6000||
          result.can_auto_approve===true||result.model_called!==false||
          (kind==='ocr'&&(result.ocr_used!==true||result.needs_manual_review!==true))){
          finish(new CopilotError('PROCESSOR_INVALID_OUTPUT',502));return;
        }
        finish(null,result);
      });
      child.stdin.on('error',()=>{}); // EPIPE tras crash; el evento close informa el fallo
      child.stdin.end(bytes);
    }catch{
      if(child)try{child.kill('SIGKILL')}catch{}
      finish(new CopilotError('PROCESSOR_UNAVAILABLE',503));
    }
  });
}
export const isolatedPdf=bytes=>runIsolated('pdf',bytes);
export const isolatedOcr=bytes=>runIsolated('ocr',bytes);
