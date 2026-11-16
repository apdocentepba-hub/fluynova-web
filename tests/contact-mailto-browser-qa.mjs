/* QA Chrome real: respaldo manual aun con /api/config caído. Ningún POST permitido. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function chromeBinary(){
 for(const name of [process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium'].filter(Boolean)){
  try{execFileSync(name,['--version'],{stdio:'ignore',timeout:3000});return name;}catch{}
 }
 throw Error('Chrome no disponible: no declarar QA visual');
}
class CDP{
 constructor(ws){
  this.ws=ws;this.seq=0;this.jobs=new Map();
  ws.addEventListener('message',e=>{
   let data;try{data=JSON.parse(e.data)}catch{return}
   const job=this.jobs.get(data.id);
   if(job){this.jobs.delete(data.id);data.error?job.reject(Error(JSON.stringify(data.error))):job.resolve(data.result||{});}
  });
 }
 static connect(url){return new Promise((ok,fail)=>{
  const ws=new WebSocket(url);const t=setTimeout(()=>{ws.close();fail(Error('CDP timeout'));},10000);
  ws.addEventListener('open',()=>{clearTimeout(t);ok(new CDP(ws))});
  ws.addEventListener('error',()=>{clearTimeout(t);fail(Error('CDP websocket'));});
 });}
 send(method,params={}){return new Promise((resolve,reject)=>{
  const id=++this.seq,t=setTimeout(()=>{this.jobs.delete(id);reject(Error('CDP timeout: '+method))},15000);
  this.jobs.set(id,{resolve:v=>{clearTimeout(t);resolve(v)},reject:e=>{clearTimeout(t);reject(e)}});
  this.ws.send(JSON.stringify({id,method,params}));
 });}
 close(){this.ws.close();}
}
async function evaluated(cdp,expression){
 const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
 return r.result?.value;
}
const views=[{w:320,h:780,mobile:true},{w:390,h:844,mobile:true},{w:1440,h:900,mobile:false}];
async function main(){
 const files=Object.fromEntries(await Promise.all([
  ['/','static/index.html'],['/index.html','static/index.html'],
  ['/main.js','static/main.js'],['/contact-mailto.js','static/contact-mailto.js'],
  ['/styles.css','static/styles.css'],['/conversion-ux-2026.css','static/conversion-ux-2026.css']
 ].map(async([url,path])=>[url,await readFile(resolve(path))])));
 let posts=0;
 const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method!=='GET'){posts++;res.writeHead(405);res.end('no POST');return;}
  if(pathname==='/api/config'){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"cold start"}');return;}
  const content=files[pathname];
  if(!content){res.writeHead(404);res.end('Not found');return;}
  const type=pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(content);
 });
 await new Promise((ok,fail)=>server.listen(0,'127.0.0.1',e=>e?fail(e):ok()));
 const profile=await mkdtemp(join(tmpdir(),'fluynova-manual-chrome-'));
 const chrome=chromeBinary();let child,cdp;
 try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--no-first-run','--disable-background-networking','--disable-extensions',
   '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
   '--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  let port;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Chrome terminó');
   try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}
   await sleep(100);
  }
  assert.ok(port,'Sin puerto CDP');
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  const target=targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
  assert.ok(target,'Sin pestaña Chrome');
  cdp=await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  await mkdir('qa-correo-manual',{recursive:true});
  const evidence=[];
  for(const v of views){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:v.w,height:v.h,deviceScaleFactor:1,mobile:v.mobile});
   await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
   let ready=false;
   for(let i=0;i<60;i++){
    const q=await evaluated(cdp,"({state:document.readyState,button:!!document.getElementById('manual-mailto-prepare')})");
    if(q?.state==='complete'&&q.button){ready=true;break;}
    await sleep(100);
   }
   assert.ok(ready,'No cargó botón a '+v.w);
   const result=await evaluated(cdp,`(()=>{
    const f=document.getElementById('contact-form');
    const put=(key,value)=>{const node=f.elements.namedItem(key);node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}))};
    put('name','Visitante prueba');put('email','prueba@example.com');
    put('category','Presupuestos y cotizaciones');put('message','Necesito evaluar la gestión de pedidos y presupuestos en mi negocio.');
    document.getElementById('manual-mailto-prepare').click();
    const p=document.getElementById('manual-mailto-panel');
    const o=document.getElementById('manual-mailto-open');
    const preview=document.getElementById('manual-mailto-preview');
    return {width:innerWidth,page:document.documentElement.scrollWidth,panelVisible:!p.hidden,linkVisible:!o.hidden,
      mailto:o.getAttribute('href'),preview:preview.value,consent:f.elements.namedItem('consent').checked,
      action:f.getAttribute('action'),
      buttonWidth:document.getElementById('manual-mailto-prepare').getBoundingClientRect().width};
   })()`);
   assert.equal(result.width,v.w);
   assert.ok(result.page<=v.w+1,'overflow en '+v.w+': '+result.page);
   assert.ok(result.panelVisible&&result.linkVisible,'Correo no preparado en '+v.w);
   assert.equal(result.consent,false,'Consentimiento FormSubmit no exigido para correo manual');
   assert.equal(result.action,'https://formsubmit.co/contacto.fluynova@gmail.com');
   assert.ok(result.buttonWidth>0,'Botón oculto en '+v.w);
   const url=new URL(result.mailto);
   assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,'contacto.fluynova@gmail.com');
   assert.match(url.searchParams.get('body'),/gestión de pedidos y presupuestos/);
   assert.match(url.searchParams.get('subject'),/Presupuestos y cotizaciones/);
   assert.match(result.preview,/Visitante prueba/);
   // Capturar el flujo revisado en lugar de la portada.
   const panelOnScreen=await evaluated(cdp,`(()=>{
    const p=document.getElementById('manual-mailto-panel');
    p.scrollIntoView({behavior:'instant',block:'center'});
    const rect=p.getBoundingClientRect();
    return {top:rect.top,bottom:rect.bottom,height:innerHeight};
   })()`);
   assert.ok(panelOnScreen.bottom>0&&panelOnScreen.top<panelOnScreen.height,'Panel fuera del viewport');
   await sleep(120);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
   const png=Buffer.from(shot.data,'base64');
   assert.equal(png.subarray(1,4).toString(),'PNG');
   assert.equal(png.readUInt32BE(16),v.w);
   await writeFile('qa-correo-manual/correo_'+v.w+'.png',png);
   evidence.push({width:v.w,documentWidth:result.page,preview:true,mailto:true,consentNotRequired:true});
  }
  assert.equal(posts,0,'La preparación no debe enviar POST');
  await writeFile('qa-correo-manual/reporte.json',JSON.stringify({result:'PASS',config:'HTTP 503 simulado',outboundPOST:posts,evidence},null,2));
  console.log('CORREO_MANUAL_CHROME_PASS '+JSON.stringify(evidence));
 }finally{
  cdp?.close();child?.kill('SIGTERM');
  await new Promise(ok=>server.close(ok));
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100});
 }
}
main().catch(e=>{console.error('CORREO_MANUAL_CHROME_FAIL '+e.stack);process.exitCode=1});
