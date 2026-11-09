import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {analyzeDocument,CopilotError} from './analysis.mjs';

const HEADERS={
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none';"
};
const json=(res,status,body)=>{
  res.writeHead(status,{...HEADERS,'content-type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
};
async function readBody(req,maxBytes=8000){
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>maxBytes)throw new CopilotError('BODY_TOO_LARGE',413);
    chunks.push(chunk);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
  catch{throw new CopilotError('INVALID_JSON',400)}
}
export function createApp({analyzer=analyzeDocument,model='qwen3:1.7b'}={}){
  return createServer(async(req,res)=>{
    if(req.url==='/' && req.method==='GET') {
      res.writeHead(200,{...HEADERS,'content-type':'text/html; charset=utf-8'});
      res.end(await readFile(new URL('./index.html',import.meta.url)));
      return;
    }
    if(req.url==='/api/status' && req.method==='GET'){
      json(res,200,{service:'FLUYNOVA Copilot',runtime:'LOCAL_ONLY',model_configured:model,
        model_connection:'NO_VERIFICADA',human_review_required:true});
      return;
    }
    if(req.url!=='/api/analyze'||req.method!=='POST'){
      json(res,404,{error:'NOT_FOUND'});return;
    }
    const origin=req.headers.origin;
    const expected='http://127.0.0.1:'+req.socket.localPort;
    if(origin && origin!==expected){json(res,403,{error:'ORIGIN_REJECTED'});return}
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){
      json(res,415,{error:'CONTENT_TYPE_NOT_SUPPORTED'});return;
    }
    try {
      const body=await readBody(req);
      if(!body||typeof body!=='object'||Array.isArray(body)||
        Object.keys(body).length!==1||!Object.hasOwn(body,'document')){
        throw new CopilotError('INVALID_REQUEST',422);
      }
      const result=await analyzer(body.document,{model});
      json(res,200,result);
    }catch(err){
      if(err instanceof CopilotError){json(res,err.status,{error:err.code,decision:'REQUIERE_REVISION_HUMANA'});return}
      json(res,500,{error:'INTERNAL_ERROR',decision:'REQUIERE_REVISION_HUMANA'});
    }
  });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath('file://'+process.argv[1].replaceAll('\\','/'))) {
  const port=Number(process.env.FLUYNOVA_PORT||8767);
  const model=process.env.FLUYNOVA_MODEL||'qwen3:1.7b';
  if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('FLUYNOVA_PORT inválido');
  const server=createApp({model});
  server.listen(port,'127.0.0.1',()=>console.log('FLUYNOVA Copilot demo local: http://127.0.0.1:'+port+'/; modelo configurado: '+model));
}
