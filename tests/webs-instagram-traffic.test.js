"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"../static");
const landing=fs.readFileSync(path.join(root,"instagram/index.html"),"utf8");
const webs=fs.readFileSync(path.join(root,"webs/index.html"),"utf8");
const {rewriteReferralLink}=require("../static/instagram/referral.js");
const origin="https://fluynova-web.onrender.com";
const inbound="?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611&utm_content=webs";

test("Instagram muestra primero los ejemplos navegables de webs",()=>{
  const first=landing.match(/<a class="card primary" href="([^"]+)"/);
  assert.ok(first);
  const url=new URL(first[1].replaceAll("&amp;","&"),origin);
  assert.equal(url.pathname,"/webs/");
  assert.equal(url.searchParams.get("utm_source"),"instagram");
  assert.equal(url.searchParams.get("utm_content"),"webs");
});
test("landing /webs reconoce como ficticios ambos demos y no inventa clientes",()=>{
  assert.ok(webs.includes("Alba & Miga"));
  assert.ok(webs.includes("Nórdica Pro"));
  assert.match(webs,/No corresponden a clientes/);
  assert.ok(webs.includes("https://fluynova-demo-pasteleria.pages.dev/"));
  assert.ok(webs.includes("https://fluynova-demo-distribuidora.pages.dev/"));
});
test("la venta de webs tiene dos accesos trazables al formulario",()=>{
  const h=[...webs.matchAll(/href="(\/\?utm_source=webs[^"]+)"/g)]
    .map(m=>new URL(m[1].replaceAll("&amp;","&"),origin));
  assert.equal(h.length,2);
  assert.deepEqual(h.map(a=>a.searchParams.get("utm_content")),["hero","cierre"]);
  for(const u of h){
    assert.equal(u.hash,"#contacto");
    assert.equal(u.searchParams.get("utm_source"),"webs");
    assert.equal(u.searchParams.get("utm_campaign"),"webs_202611");
  }
});
test("consulta desde Instagram conserva fuente al recorrer /webs",()=>{
  const href="/?utm_source=webs&utm_medium=landing&utm_campaign=webs_202611&utm_content=hero#contacto";
  const newHref=rewriteReferralLink(href,inbound,origin);
  const u=new URL(newHref,origin);
  assert.equal(u.searchParams.get("utm_source"),"instagram");
  assert.equal(u.searchParams.get("utm_medium"),"profile");
  assert.equal(u.searchParams.get("utm_campaign"),"perfil_ig_202611");
  assert.equal(u.searchParams.get("utm_content"),"webs");
});
test("usuario que llega desde web directa mantiene atribución propia",()=>{
  const href="/?utm_source=webs&utm_medium=landing&utm_campaign=webs_202611&utm_content=cierre#contacto";
  assert.equal(rewriteReferralLink(href,"",origin),href);
  assert.equal(rewriteReferralLink(href,"?utm_source=google",origin),href);
});
test("cotizador y consultas por correo siguen disponibles",()=>{
  assert.ok(webs.includes('id="cotizador"'));
  assert.ok(webs.includes('id="ask"'));
  assert.ok(webs.includes("mailto:contacto.fluynova@gmail.com"));
});
test("solo usa el script local ya probado, sin tracking de visitantes",()=>{
  assert.ok(webs.includes('<script defer src="/instagram/referral.js"></script>'));
  assert.ok(!/google-analytics\.com|connect\.facebook\.net|gtag\(|fbq\(/.test(webs));
});
