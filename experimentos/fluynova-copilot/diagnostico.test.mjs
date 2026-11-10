import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const A={
 supplier:'Proveedor Demo Norte',number:'A-0001-00000121',order:'OC-1001',
 net_cents:15000000,tax_cents:3150000,total_cents:18150000,
 explanation:'Ejemplo sintético',uncertainty:'No verificado',
 evidence:['Factura A-0001-00000121']
};
const B={
 supplier:'Proveedor Demo Centro',number:'B-0004-00000105',order:null,
 net_cents:20000000,tax_cents:4200000,total_cents:24200000,
 explanation:'Ejemplo sintético',uncertainty:'No verificado',
 evidence:['Comprobante B-0004-00000105']
};

test('diagnóstico usa HTTP local, dos documentos ficticios y no expone textos en informe',async()=>{
 let called=0;
 const fakeOllama=createServer(async(req,res)=>{
   const parts=[];for await (const buf of req)parts.push(buf);
   res.setHeader('content-type','application/json');
   if(req.method==='GET'&&req.url==='/api/tags'){
     res.end(JSON.stringify({models:[{name:'qwen3:1.7b',model:'qwen3:1.7b'}]}));return;
   }
   if(req.method==='POST'&&req.url==='/api/chat'){
     const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
     assert.equal(data.model,'qwen3:1.7b');assert.equal(data.stream,false);
     assert.match(data.messages[0].content,/NO CONFIABLE/);
     const source=data.messages[1].content;
     const fixture=source.includes('Comprobante B-0004-00000105')?B:A;
     called++;
     res.end(JSON.stringify({message:{content:JSON.stringify(fixture)}}));return;
   }
   res.writeHead(404).end();
 });
 await new Promise((resolve,reject)=>{
   fakeOllama.once('error',reject);
   fakeOllama.listen(11434,'127.0.0.1',resolve);
 });
 try{
   const script=fileURLToPath(new URL('./DIAGNOSTICO-IA-LOCAL.mjs',import.meta.url));
   const p=spawn(process.execPath,[script],{stdio:['ignore','pipe','pipe'],windowsHide:true});
   let output='',stderr='';
   p.stdout.on('data',c=>{output+=String(c)});
   p.stderr.on('data',c=>{stderr+=String(c)});
   const code=await new Promise((resolve,reject)=>{
     const kill=setTimeout(()=>{p.kill();reject(new Error('diagnostico timeout'))},20000);
     p.once('error',e=>{clearTimeout(kill);reject(e)});
     p.once('exit',x=>{clearTimeout(kill);resolve(x)});
   });
   assert.equal(code,0,output+'\n'+stderr);
   assert.equal(called,2);
   assert.match(output,/Respuestas obtenidas: 2\/2/);
   assert.match(output,/Extracción propuesta por IA: 12\/12/);
   assert.match(output,/Extracción tras reglas de texto: 12\/12/);
   assert.match(output,/RESULTADO: CONTRASTE TEXTUAL APROBADO/);
   assert.doesNotMatch(output,/Proveedor Demo Norte|Factura A-0001-00000121/);
   assert.doesNotMatch(output,/\bC:\\Users\\/);
 }finally{
   fakeOllama.closeAllConnections();
   await new Promise(r=>fakeOllama.close(r));
 }
});
