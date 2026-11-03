"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"../static");
const html=fs.readFileSync(path.join(root,"instagram/index.html"),"utf8");
const {buildLeadUrl}=require("../static/diagnostico/attribution.js");
function links(){
  return [...html.matchAll(/<a\s+class="card(?: primary)?"\s+href="([^"]+)"/g)]
    .map(x=>new URL(x[1].replaceAll("&amp;","&"),"https://fluynova-web.onrender.com"));
}
test("cinco CTA y una única CTA primaria",()=>{
  assert.equal(links().length,5);
  assert.equal((html.match(/class="card primary"/g)||[]).length,1);
});
test("los cinco botones atribuyen origen real al perfil Instagram",()=>{
  for(const link of links()){
    assert.equal(link.searchParams.get("utm_source"),"instagram");
    assert.equal(link.searchParams.get("utm_medium"),"profile");
    assert.equal(link.searchParams.get("utm_campaign"),"perfil_ig_202611");
    assert.match(link.searchParams.get("utm_content")||"",/^[a-z0-9_]+$/);
    assert.equal(link.origin,"https://fluynova-web.onrender.com");
  }
});
test("cada CTA tiene etiqueta de contenido distinta para atribución voluntaria",()=>{
  assert.deepEqual(links().map(l=>l.searchParams.get("utm_content")),
    ["webs","diagnostico","soluciones","planillas","contacto"]);
});
test("CTA de diagnóstico llega al formulario y preserva origen",()=>{
  const diagnostic=links()[1];
  assert.equal(diagnostic.pathname,"/diagnostico/");
  const next=new URL(buildLeadUrl(diagnostic.search),diagnostic.origin);
  assert.equal(next.pathname,"/");
  assert.equal(next.hash,"#contacto");
  for(const key of ["utm_source","utm_medium","utm_campaign","utm_content"]){
    assert.equal(next.searchParams.get(key),diagnostic.searchParams.get(key));
  }
});
test("CTA principal muestra demostraciones ficticias y no las atribuye a clientes",()=>{
  assert.equal(links()[0].pathname,"/webs/");
  assert.ok(html.includes("Mirá 2 ejemplos reales de páginas web"));
  assert.ok(html.includes("Son proyectos ficticios, no clientes"));
});
test("los destinos son reales dentro del repositorio y tienen portada",()=>{
  for(const href of links()){
    if(href.pathname==="/")continue;
    const entry=path.join(root,href.pathname,"index.html");
    assert.ok(fs.existsSync(entry),`Falta destino ${entry}`);
  }
});
test("la página del perfil no rastrea visitas ni manda datos",()=>{
  assert.ok(!/<script\b/i.test(html));
  assert.ok(!/<form\b/i.test(html));
  assert.ok(!/fetch\(|sendBeacon|localStorage|document\.cookie/i.test(html));
  assert.ok(!/https?:\/\//.test(html.slice(html.indexOf("<main>"))));
});
test("configuración responsive, con privacidad y sin promesas de clientes",()=>{
  assert.match(html,/<meta name="viewport"/);
  assert.match(html,/<meta name="robots" content="noindex,follow"/);
  assert.match(html,/Primera evaluación orientativa sin cargo/);
  assert.match(html,/No compartas claves ni datos sensibles/);
  assert.ok(html.includes('href="/privacidad"'));
});
