import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {diagnoseStartup,formatStartupReport,probeLoopbackPort} from './startup-preflight.mjs';
const base={nodeVersion:'24.0.0',portText:'8767',probe:async()=>({ok:true}),
 exists:async()=>false,verifyOcr:async()=>{}};
test('control textual util sin dependencias opcionales',async()=>{
 const r=await diagnoseStartup(base);
 assert.equal(r.ready,true);assert.equal(r.pdf,false);assert.equal(r.ocr,false);
 assert.match(formatStartupReport(r),/FLUYNOVA_PRECHECK READY/);
 assert.ok(r.warnings.some(x=>x.includes('PREPARAR-PDF')));
});
test('Node anterior a 22 bloquea inicio',async()=>{
 const r=await diagnoseStartup({...base,nodeVersion:'21.8.0'});
 assert.equal(r.ready,false);assert.equal(r.errors[0].code,'NODE_TOO_OLD');
});
test('puerto inyectado invalido se rechaza antes de abrir socket',async()=>{
 let called=false;
 const r=await diagnoseStartup({...base,portText:'8767;otro',
  probe:async()=>{called=true;return {ok:true}}});
 assert.equal(r.ready,false);assert.equal(called,false);
 assert.equal(r.errors[0].code,'PORT_INVALID');
});
test('servidor existente genera PORT_IN_USE sin cerrarlo',async()=>{
 const s=createServer();
 await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok)});
 try{
  const port=s.address().port;
  assert.deepEqual(await probeLoopbackPort(port),{ok:false,code:'PORT_IN_USE'});
  const r=await diagnoseStartup({...base,portText:String(port),probe:probeLoopbackPort});
  assert.equal(r.ready,false);assert.equal(r.errors[0].code,'PORT_IN_USE');
  assert.equal(s.listening,true);
 }finally{await new Promise(ok=>s.close(ok))}
});
test('modelo OCR solo se anuncia verificado al pasar su comprobacion',async()=>{
 const ready=await diagnoseStartup({...base,exists:async()=>true,verifyOcr:async()=>true});
 assert.equal(ready.ready,true);assert.equal(ready.pdf,true);assert.equal(ready.ocr,true);
 const bad=await diagnoseStartup({...base,exists:async()=>true,
  verifyOcr:async()=>{throw Error('INVALID_MODEL_SECRET')}});
 assert.equal(bad.ready,true);assert.equal(bad.ocr,false);
 assert.doesNotMatch(formatStartupReport(bad),/INVALID_MODEL_SECRET/);
});
test('falla inesperada del socket bloquea inicio con mensaje seguro',async()=>{
 const r=await diagnoseStartup({...base,probe:async()=>{throw Error('SENSITIVE')}});
 assert.equal(r.ready,false);assert.equal(r.errors[0].code,'PORT_CHECK_FAILED');
 assert.doesNotMatch(formatStartupReport(r),/SENSITIVE/);
});
test('CLI rechaza puerto invalido con exit code 2',()=>{
 const script=fileURLToPath(new URL('./startup-preflight.mjs',import.meta.url));
 const r=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:12000,
  env:{...process.env,FLUYNOVA_PORT:'INVALID'}});
 assert.equal(r.status,2,r.stderr);
 assert.match(r.stdout,/FLUYNOVA_PRECHECK BLOCKED/);
 assert.match(r.stdout,/PORT_INVALID/);
});