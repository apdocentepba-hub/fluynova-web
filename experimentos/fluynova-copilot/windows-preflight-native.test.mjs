import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cmd=fileURLToPath(new URL('./DIAGNOSTICAR-COPILOT-WINDOWS.cmd',import.meta.url));
function run(port){return spawnSync('cmd.exe',['/d','/c',cmd],{encoding:'utf8',timeout:15000,
 env:{...process.env,FLUYNOVA_PORT:String(port)}})}
test('Windows CMD real rechaza puerto invalido',{skip:process.platform!=='win32'},()=>{
 const r=run('PUERTO_INVALIDO');
 assert.equal(r.status,2,r.stderr);assert.match(r.stdout,/PORT_INVALID/);
});
test('Windows CMD real detecta puerto ocupado',{skip:process.platform!=='win32'},async()=>{
 const s=createServer();
 await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok)});
 try{
  const r=run(s.address().port);
  assert.equal(r.status,2,r.stderr);assert.match(r.stdout,/PORT_IN_USE/);
  assert.equal(s.listening,true);
 }finally{await new Promise(ok=>s.close(ok))}
});