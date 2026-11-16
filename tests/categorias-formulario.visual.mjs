/**
 * FLUYNOVA: QA real del selector comercial, sin envíos ni servidor externo.
 * Sirve el HTML/CSS/JS exacto del PR solo en localhost y bloquea POST.
 */
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {readFile,mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {resolve,join} from "node:path";
import {tmpdir} from "node:os";

const views=[
 {name:"320",width:320,height:780,mobile:true},
 {name:"390",width:390,height:844,mobile:true},
 {name:"1440",width:1440,height:900,mobile:false}
];
const expected=[
 "Automatizar tareas","Desarrollar software","Crear página web / catálogo digital",
 "Gestionar clientes (CRM)","Presupuestos y cotizaciones","Pedidos, ventas y stock",
 "Turnos, reservas y agenda","Planillas, reportes y tableros",
 "WhatsApp, correo y respuestas automáticas",
 "Conectar herramientas / datos","Inteligencia artificial","Otro / no estoy seguro"
];
const OUTPUT=resolve("qa-temas-consultas");
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function chromePath(){
 for(const p of [process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium"].filter(Boolean)){
  try{execFileSync(p,["--version"],{stdio:"ignore",timeout:5000});return p;}catch{}
 }
 throw Error("Chrome/Chromium no disponible. No declarar QA PASS.");
}
class CDP{
 constructor(ws){
  this.ws=ws;this.next=0;this.pending=new Map();
  ws.addEventListener("message",evt=>{
   const msg=JSON.parse(evt.data);
   const p=this.pending.get(msg.id);
   if(!p)return;
   this.pending.delete(msg.id);
   msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result||{});
  });
 }
 static connect(url){return new Promise((resolve,reject)=>{
  const ws=new WebSocket(url);
  const t=setTimeout(()=>{ws.close();reject(Error("CDP timeout"));},10000);
  ws.addEventListener("open",()=>{clearTimeout(t);resolve(new CDP(ws));});
  ws.addEventListener("error",()=>{clearTimeout(t);reject(Error("WebSocket CDP falló"));});
 });}
 send(method,params={}){return new Promise((resolve,reject)=>{
  const id=++this.next,t=setTimeout(()=>{this.pending.delete(id);reject(Error("CDP timeout "+method));},15000);
  this.pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v);},reject:e=>{clearTimeout(t);reject(e);}});
  this.ws.send(JSON.stringify({id,method,params}));
 });}
 close(){this.ws.close();}
}
async function main(){
 const content={};
 for(const [url,path] of [
  ["/","static/index.html"],["/index.html","static/index.html"],
  ["/main.js","static/main.js"],["/styles.css","static/styles.css"],
  ["/contact-mailto.js","static/contact-mailto.js"],
  ["/guardian/guardian_brain.js","static/guardian/guardian_brain.js"],
  ["/guardian/guardian.js","static/guardian/guardian.js"],
  ["/guardian/guardian.css","static/guardian/guardian.css"],
  ["/conversion-ux-2026.css","static/conversion-ux-2026.css"]
 ]) content[url]=await readFile(resolve(path));
 assert.ok(content["/"].includes(Buffer.from('name="category"')));
 const chrome=chromePath();
 const profile=await mkdtemp(join(tmpdir(),"fluynova-category-chrome-"));
 let posts=0;
 const hits={};
 const server=createServer((req,res)=>{
  const pathname=new URL(req.url,"http://127.0.0.1").pathname;
  hits[pathname]=(hits[pathname]||0)+1;
  if(req.method!=="GET"){posts++;res.writeHead(405);res.end("Not allowed");return;}
  if(pathname==="/api/config"){
   res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
   res.end(JSON.stringify({contact_enabled:false,contact_method:"none"}));return;
  }
  const data=content[pathname];
  if(!data){res.writeHead(404);res.end("not found");return;}
  const type=pathname.endsWith(".css")?"text/css":pathname.endsWith(".js")?"application/javascript":"text/html";
  res.writeHead(200,{"Content-Type":type+"; charset=utf-8","Cache-Control":"no-store"});res.end(data);
 });
 await new Promise((ok,fail)=>server.listen(0,"127.0.0.1",e=>e?fail(e):ok()));
 let child,cdp;
 try{
  child=spawn(chrome,[
   "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--no-first-run","--disable-background-networking","--disable-extensions",
   "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
   "--remote-allow-origins=*","--remote-debugging-port=0",
   "--user-data-dir="+profile,"about:blank"
  ],{stdio:"ignore"});
  let port=0;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw Error("Chrome cerró antes de iniciar");
   try{const d=await readFile(join(profile,"DevToolsActivePort"),"utf8");port=Number(d.trim().split("\n")[0]);if(port)break;}catch{}
   await sleep(100);
  }
  if(!port)throw Error("Chrome sin CDP");
  const tabs=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
  const page=tabs.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
  assert.ok(page,"No hay pestaña CDP");
  cdp=await CDP.connect(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate",{url:"http://127.0.0.1:"+server.address().port+"/"});
  let loaded=false;
  for(let i=0;i<80;i++){
   const x=await cdp.send("Runtime.evaluate",{
    expression:"({ready:document.readyState,opts:document.querySelector('select[name=\"category\"]')?.options.length||0})",returnByValue:true
   });
   if(x.result?.value?.ready==="complete"&&x.result?.value?.opts===13){loaded=true;break;}
   await sleep(100);
  }
  assert.ok(loaded,"No cargó el selector de 12 temas");
  await mkdir(OUTPUT,{recursive:true});
  const evidence=[];
  for(const v of views){
   await cdp.send("Emulation.setDeviceMetricsOverride",{width:v.width,height:v.height,deviceScaleFactor:1,mobile:v.mobile});
   await sleep(200);
   const expression="(()=>{const f=document.querySelector('#contact-form'),s=f?.querySelector('select[name=\"category\"]');if(!s)return {error:'sin selector'};s.scrollIntoView({block:'center'});const opts=[...s.options].slice(1).map(x=>x.textContent.trim());const rect=s.getBoundingClientRect();s.value='Presupuestos y cotizaciones';s.dispatchEvent(new Event('change',{bubbles:true}));return {width:innerWidth,page:document.documentElement.scrollWidth,opts,selected:s.value,left:rect.left,right:rect.right,visible:rect.height>0,required:s.required,consent:!!f.querySelector('input[name=\"consent\"][required]'),formAction:f.getAttribute('action'),button:!!f.querySelector('button[type=\"submit\"]'),guardianLaunchers:document.querySelectorAll('#fg-launcher').length,guardianBrainReady:typeof window.FluynovaGuardianBrain?.guided==='function',guardianPanelHidden:document.getElementById('fg-panel')?.hidden===true,manualButton:!!document.getElementById('manual-mailto-prepare')};})()";
   const r=await cdp.send("Runtime.evaluate",{expression,returnByValue:true});
   if(r.exceptionDetails)throw Error("Excepción browser: "+JSON.stringify(r.exceptionDetails));
   const x=r.result?.value;
   assert.ok(x&&!x.error,"Sin formulario: "+JSON.stringify(x));
   assert.equal(x.width,v.width,"viewport");
   assert.deepEqual(x.opts,expected,"las 12 opciones deben coincidir en el DOM");
   assert.equal(x.selected,"Presupuestos y cotizaciones","opción seleccionable");
   assert.ok(x.left>=-1&&x.right<=v.width+1&&x.visible,"selector recortado en "+v.name+": "+JSON.stringify(x));
   assert.ok(x.required&&x.consent&&x.button,"validación nativa y consentimiento deben mantenerse");
   assert.equal(x.formAction,"https://formsubmit.co/contacto.fluynova@gmail.com","No se debe cambiar el canal de envío");
   assert.equal(x.guardianLaunchers,1,"Guardián debe tener exactamente un launcher");
   assert.equal(x.guardianBrainReady,true,"El motor de Guardián debe inicializar");
   assert.equal(x.guardianPanelHidden,true,"No mostrar un chat sin consentimiento");
   assert.equal(x.manualButton,true,"El respaldo comercial debe seguir accesible");
   const shot=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
   const png=Buffer.from(shot.data,"base64");
   assert.equal(png.subarray(1,4).toString(),"PNG");
   assert.equal(png.readUInt32BE(16),v.width);
   assert.equal(png.readUInt32BE(20),v.height);
   await writeFile(join(OUTPUT,"categorias_"+v.name+".png"),png);
   evidence.push({viewport:v.width,options:x.opts.length,selected:x.selected,selectVisible:true,documentWidth:x.page,formNotSubmitted:true,result:"PASS"});
  }
  assert.equal(posts,0,"No se debió enviar ningún formulario");
  for(const resource of ["/guardian/guardian_brain.js","/guardian/guardian.js","/guardian/guardian.css"]){
   assert.equal(hits[resource],1,"Descarga duplicada u omitida: "+resource);
  }
  await writeFile(join(OUTPUT,"reporte.json"),JSON.stringify({result:"PASS",description:"Chrome real localhost sobre HTML/CSS/JS del PR; sin POST ni envío de consultas",evidence,requests:hits},null,2));
  console.log("CATEGORIAS_VISUALES_PASS "+JSON.stringify(evidence));
 }finally{
  cdp?.close();child?.kill("SIGTERM");
  await new Promise(ok=>server.close(ok));
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100});
 }
}
main().catch(err=>{console.error("CATEGORIAS_VISUALES_FAIL "+err.stack);process.exitCode=1});
