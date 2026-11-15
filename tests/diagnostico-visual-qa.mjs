/**
 * QA visual Chrome CDP: 320, 390 y 1440 px.
 * HTTP exclusivamente 127.0.0.1, sin deploy ni formularios.
 */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const OUTPUT=resolve('qa-diagnostico-capturas');
const views=[{name:'movil_320',width:320,height:780,mobile:true},{name:'movil_390',width:390,height:844,mobile:true},{name:'escritorio_1440',width:1440,height:900,mobile:false}];
function getChrome(){
 for(const bin of (process.env.CHROME_BIN?[process.env.CHROME_BIN]:['google-chrome','google-chrome-stable','chromium'])){
  try{execFileSync(bin,['--version'],{stdio:'ignore',timeout:5000});return bin;}catch{}
 }
 throw Error('Chrome no instalado: QA visual no ejecutado');
}
class Connection{
 constructor(ws){this.ws=ws;this.pending=new Map();this.seq=0;
  ws.addEventListener('message',event=>{try{const msg=JSON.parse(event.data);if(this.pending.has(msg.id)){
   const w=this.pending.get(msg.id);this.pending.delete(msg.id);msg.error?w.reject(Error(JSON.stringify(msg.error))):w.resolve(msg.result||{});
  }}catch(err){for(const w of this.pending.values())w.reject(err);this.pending.clear();}});
 }
 static async open(url){return await new Promise((resolve,reject)=>{
  const ws=new WebSocket(url);const timeout=setTimeout(()=>{ws.close();reject(Error('CDP no responde'));},10000);
  ws.addEventListener('open',()=>{clearTimeout(timeout);resolve(new Connection(ws));});
  ws.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Error WebSocket CDP'));});
 });}
 send(method,params={}){return new Promise((resolve,reject)=>{
  const id=++this.seq;
  const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Tiempo agotado: '+method));},15000);
  this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
  this.ws.send(JSON.stringify({id,method,params}));
 });}
 close(){this.ws.close();}
}
async function ready(cdp){
 for(let i=0;i<80;i++){
  const x=await cdp.send('Runtime.evaluate',{expression:'({state:document.readyState,cards:document.querySelectorAll("article.card").length,url:location.href})',returnByValue:true});
  const v=x.result?.value;
  if(v?.url?.startsWith('chrome-error:'))throw Error('Chrome bloqueó el localhost');
  if(v?.state==='complete'&&v.cards===3)return;
  await sleep(100);
 }
 throw Error('HTML del diagnostico no cargó correctamente');
}
async function run(){
 const html=await readFile(resolve('static/diagnostico/index.html'),'utf8');
 const attribution=await readFile(resolve('static/diagnostico/attribution.js'),'utf8');
 assert.match(html,/data-diagnostic-cta/);
 const chrome=getChrome(),profile=await mkdtemp(join(tmpdir(),'fluynova-headless-'));
 const server=createServer((req,res)=>{
  if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);}
  else if(req.url==='/diagnostico/attribution.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(attribution);}
  else{res.writeHead(404);res.end('Not Found');}
 });
 await new Promise((ok,fail)=>server.listen(0,'127.0.0.1',e=>e?fail(e):ok()));
 let child,cdp;
 try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--remote-allow-origins=*','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  let port=0;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error('Chrome se cerró antes de iniciar');
   try{const data=await readFile(join(profile,'DevToolsActivePort'),'utf8');port=Number(data.trim().split('\n')[0]);if(port)break;}catch{}
   await sleep(100);
  }
  if(!port)throw Error('Chrome no abrió CDP');
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  const target=targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
  assert.ok(target,'Pestaña Chrome ausente');
  cdp=await Connection.open(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611'});
  await ready(cdp);
  await mkdir(OUTPUT,{recursive:true});
  const result=[];
  for(const v of views){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:v.width,height:v.height,deviceScaleFactor:1,mobile:v.mobile});
   await sleep(300);
   const data=await cdp.send('Runtime.evaluate',{expression:"(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,cards:document.querySelectorAll('article.card').length,emails:[...document.querySelectorAll('a')].filter(a=>a.protocol==='mailto:').length,main:document.querySelector('main').getBoundingClientRect().width>0,banner:document.querySelectorAll('[data-diagnostic-cta]').length===2,cta:[...document.querySelectorAll('[data-diagnostic-cta]')].map(a=>a.getAttribute('href'))}))()",returnByValue:true});
   if(data.exceptionDetails)throw Error('Excepción de DOM');
   const m=data.result?.value;
   assert.ok(m,'Faltan métricas');
   assert.equal(m.width,v.width,'Viewport incorrecto '+v.name);
   assert.ok(m.docWidth<=v.width+1&&m.bodyWidth<=v.width+1,'Desborde horizontal '+v.name+': '+JSON.stringify(m));
   assert.equal(m.cards,3);assert.equal(m.emails,2);assert.ok(m.main&&m.banner);
   for(const href of m.cta){const url=new URL(href,'https://fluynova-web.onrender.com');assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('utm_source'),'instagram');assert.equal(url.searchParams.get('utm_medium'),'profile');assert.equal(url.searchParams.get('utm_campaign'),'perfil_ig_202611');}
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
   const png=Buffer.from(shot.data,'base64');
   assert.equal(png.subarray(1,4).toString(),'PNG');
   assert.equal(png.readUInt32BE(16),v.width);
   assert.equal(png.readUInt32BE(20),v.height);
   await writeFile(join(OUTPUT,'diagnostico_'+v.name+'.png'),png);
   // Captura completa: la primera imagen solo muestra el inicio; aquí incluimos las tres tarjetas.
   const layout=await cdp.send('Page.getLayoutMetrics');
   const fullHeight=Math.ceil(layout.cssContentSize?.height||0);
   assert.ok(fullHeight>=v.height&&fullHeight<=12000,'Altura total inválida: '+fullHeight);
   const full=await cdp.send('Page.captureScreenshot',{
    format:'png',fromSurface:true,captureBeyondViewport:true,
    clip:{x:0,y:0,width:v.width,height:fullHeight,scale:1}
   });
   const fullPng=Buffer.from(full.data,'base64');
   assert.equal(fullPng.subarray(1,4).toString(),'PNG');
   assert.equal(fullPng.readUInt32BE(16),v.width);
   assert.equal(fullPng.readUInt32BE(20),fullHeight);
   await writeFile(join(OUTPUT,'diagnostico_'+v.name+'_completo.png'),fullPng);
   result.push({viewport:v.width,height:v.height,fullHeight,bodyWidth:m.bodyWidth,documentWidth:m.docWidth,cards:m.cards,mailto:m.emails,result:'PASS'});
  }
  await writeFile(join(OUTPUT,'reporte-visual.json'),JSON.stringify({result:'PASS',environment:'Chrome CDP sobre servidor local; sin red externa',screenshots:result},null,2));
  console.log('DIAGNOSTICO_VISUAL_PASS '+JSON.stringify(result));
 }finally{
  cdp?.close();child?.kill('SIGTERM');
  await new Promise(ok=>server.close(ok));
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100});
 }
}
run().catch(e=>{console.error('DIAGNOSTICO_VISUAL_FAIL '+e.stack);process.exitCode=1});
