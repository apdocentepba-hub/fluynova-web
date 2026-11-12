import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {openWindowsBrowserWhenReady} from './browser-launch-windows.mjs';

test('no invoca navegador si el launcher no lo autorizó',async()=>{
 let calls=0;
 const fake=()=>{calls++};
 const server=createServer();
 const r=openWindowsBrowserWhenReady(server,{enabled:false,platform:'win32',spawnImpl:fake});
 assert.equal(r.invoked,false);
 assert.equal(r.reason,'DISABLED');
 assert.equal(calls,0);
 server.close();
});
test('Windows no abre navegador antes de que el servidor esté listo',()=>{
 const s=createServer();
 assert.throws(()=>openWindowsBrowserWhenReady(s,{
   enabled:true,platform:'win32',spawnImpl:()=>{throw Error('NO_SPAN_ALLOWED')}
 }),/BROWSER_LAUNCH_SERVER_NOT_READY/);
});
test('tras listen loopback invoca navegador de Windows con URL fija sin shell',async()=>{
 const s=createServer();
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const calls=[];
 try{
  const result=openWindowsBrowserWhenReady(s,{
   enabled:true,platform:'win32',
   spawnImpl:(exe,args,opts)=>{
    calls.push({exe,args,opts});
    return {on:()=>{},unref:()=>{}};
   }
  });
  assert.equal(result.invoked,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].exe,'explorer.exe');
  assert.deepEqual(calls[0].args,['http://127.0.0.1:'+s.address().port+'/']);
  assert.equal(calls[0].opts.shell,false);
  assert.equal(calls[0].opts.windowsHide,true);
  assert.equal(calls[0].opts.detached,true);
 }finally{s.closeAllConnections();await new Promise(r=>s.close(r))}
});
test('fallo de Explorer se informa sin derribar el servidor local',async()=>{
 const s=createServer();
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const warnings=[];
 try{
  const result=openWindowsBrowserWhenReady(s,{
   enabled:true,platform:'win32',
   spawnImpl:()=>{throw Error('EXPLORER_NOT_AVAILABLE')},
   logger:{warn:message=>warnings.push(message)}
  });
  assert.equal(result.invoked,false);
  assert.equal(result.reason,'BROWSER_LAUNCH_UNAVAILABLE');
  assert.equal(s.listening,true);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/ingresá manualmente http:\/\/127\.0\.0\.1:/);
 }finally{s.closeAllConnections();await new Promise(r=>s.close(r))}
});
test('no ejecuta Explorer en Linux, aunque la variable habilite apertura',()=>{
 let called=false;
 const s=createServer();
 const result=openWindowsBrowserWhenReady(s,{
  enabled:true,platform:'linux',spawnImpl:()=>{called=true}
 });
 assert.equal(result.invoked,false);
 assert.equal(result.reason,'NOT_WINDOWS');
 assert.equal(called,false);
});
