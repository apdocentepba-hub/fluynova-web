// Preflight de solo lectura: sin descargas, documentos ni conexiones externas.
import {createServer} from 'node:net';
import {access} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertOfflineModel} from './ocr-model.mjs';
const base=dirname(fileURLToPath(import.meta.url));

export async function probeLoopbackPort(port){
 return new Promise(done=>{
  const s=createServer();
  s.once('error',e=>done({ok:false,code:e?.code==='EADDRINUSE'?'PORT_IN_USE':'PORT_UNAVAILABLE'}));
  s.listen({host:'127.0.0.1',port,exclusive:true},()=>{
   s.close(e=>done(e?{ok:false,code:'PORT_CHECK_FAILED'}:{ok:true}));
  });
 });
}

export async function diagnoseStartup({
 nodeVersion=process.versions.node,portText=process.env.FLUYNOVA_PORT||'8767',
 probe=probeLoopbackPort,
 exists=async p=>{try{await access(p);return true}catch{return false}},
 verifyOcr=assertOfflineModel
}={}){
 const errors=[],warnings=[];
 const major=Number(String(nodeVersion).split('.')[0]);
 if(!Number.isSafeInteger(major)||major<22)
  errors.push({code:'NODE_TOO_OLD',fix:'Instala Node.js 22 o superior (recomendado 24) desde nodejs.org'});
 const raw=String(portText);
 const port=/^[0-9]+$/.test(raw)?Number(raw):NaN;
 if(!Number.isSafeInteger(port)||port<1024||port>65535){
  errors.push({code:'PORT_INVALID',fix:'Quita FLUYNOVA_PORT o usa un puerto entre 1024 y 65535'});
 }else{
  try{
   const result=await probe(port);
   if(!result?.ok){
    const code=result?.code==='PORT_IN_USE'?'PORT_IN_USE':'PORT_UNAVAILABLE';
    errors.push({code,fix:code==='PORT_IN_USE'
     ?'Cierra otra ventana de Copilot o cambia FLUYNOVA_PORT'
     :'Comprueba permisos o bloqueo de seguridad de Windows'});
   }
  }catch{
   errors.push({code:'PORT_CHECK_FAILED',fix:'Reinicia la consola e intenta nuevamente'});
  }
 }
 const pdf=await exists(join(base,'node_modules','pdfjs-dist','build','pdf.mjs'));
 const tesseract=await exists(join(base,'node_modules','tesseract.js','package.json'));
 const canvas=await exists(join(base,'node_modules','@napi-rs','canvas','package.json'));
 let ocr=false;
 if(!pdf)warnings.push('Lector PDF opcional ausente: PREPARAR-PDF-WINDOWS.cmd');
 if(!tesseract||!canvas)warnings.push('OCR opcional sin bibliotecas: PREPARAR-OCR-WINDOWS.cmd requiere autorizacion');
 else{
  try{await verifyOcr();ocr=true}
  catch{warnings.push('OCR sin modelo espanol verificado: PREPARAR-OCR-WINDOWS.cmd')}
 }
 return {ready:errors.length===0,nodeVersion:String(nodeVersion),
  port:Number.isSafeInteger(port)?port:null,errors,warnings,pdf,ocr};
}

export function formatStartupReport(r){
 const lines=['FLUYNOVA_PRECHECK '+(r.ready?'READY':'BLOCKED'),
  'Node: '+r.nodeVersion,'Puerto loopback: '+(r.port??'invalido'),
  'PDF: '+(r.pdf?'PRESENTE':'OPCIONAL_AUSENTE'),
  'OCR espanol verificado: '+(r.ocr?'SI':'NO')];
 for(const e of r.errors)lines.push('ERROR '+e.code+': '+e.fix);
 for(const w of r.warnings)lines.push('INFO '+w);
 lines.push('Solo demostracion con documentos ficticios. No certifica facturas.');
 return lines.join('\n');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const r=await diagnoseStartup();
  console.log(formatStartupReport(r));
  if(!r.ready)process.exitCode=2;
 }catch{
  console.error('FLUYNOVA_PRECHECK ERROR_INESPERADO: inicio bloqueado');
  process.exitCode=2;
 }
}