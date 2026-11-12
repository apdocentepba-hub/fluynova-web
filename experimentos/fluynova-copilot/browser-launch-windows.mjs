// Abre el navegador predeterminado SOLO DESPUÉS de levantar el servidor local.
// No inicia servicios ni acepta URLs de entrada. No ejecuta el shell de Windows.
// La acción es opt-in, usada únicamente por INICIAR-COPILOT-WINDOWS.cmd.
import {spawn} from 'node:child_process';

export function openWindowsBrowserWhenReady(server,{
 enabled=false,platform=process.platform,spawnImpl=spawn,logger=console
}={}){
 if(!enabled)return {invoked:false,reason:'DISABLED'};
 if(platform!=='win32')return {invoked:false,reason:'NOT_WINDOWS'};
 if(!server?.listening)
  throw new Error('BROWSER_LAUNCH_SERVER_NOT_READY');
 const addr=server.address();
 if(!addr||addr.address!=='127.0.0.1'||
    !Number.isSafeInteger(addr.port)||addr.port<1||addr.port>65535)
  throw new Error('BROWSER_LAUNCH_NOT_LOOPBACK');
 const url='http://127.0.0.1:'+addr.port+'/';
 try{
  // explorer.exe resuelve el navegador registrado en Windows.
  // El argumento es constante salvo por el puerto entero elegido por el servidor.
  const child=spawnImpl('explorer.exe',[url],{
   shell:false,windowsHide:true,stdio:'ignore',detached:true
  });
  child?.on?.('error',()=>{
   logger?.warn?.('No se pudo abrir el navegador; ingresá manualmente '+url);
  });
  child?.unref?.();
  // Señala invocación, no que el navegador haya representado correctamente la página.
  return {invoked:true,url};
 }catch{
  logger?.warn?.('No se pudo iniciar el navegador; ingresá manualmente '+url);
  return {invoked:false,reason:'BROWSER_LAUNCH_UNAVAILABLE',url};
 }
}
