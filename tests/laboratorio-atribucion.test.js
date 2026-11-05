'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../static');
const html=fs.readFileSync(path.join(root,'laboratorio/index.html'),'utf8');
const {rewriteReferralLink}=require('../static/instagram/referral.js');
const {buildLeadUrl}=require('../static/diagnostico/attribution.js');
const origin='https://fluynova-web.onrender.com';
const links=[...html.matchAll(/href="([^"\n]+)"/g)].map(x=>x[1].replaceAll('&amp;','&'));
const entries=links.filter(u=>u.startsWith('/diagnostico/?')||u.startsWith('/webs/?'));
const parsed=entries.map(u=>new URL(u,origin));

test('seis CTAs de galería identifican demo sin datos personales ni scripts',()=>{
 assert.equal(entries.length,6);
 assert.deepEqual(parsed.map(u=>u.searchParams.get('utm_content')),['hero','crm','pasteleria','distribuidora','cotizador','cierre']);
 for(const u of parsed){
  assert.equal(u.origin,origin);assert.equal(u.searchParams.get('utm_source'),'laboratorio');
  assert.equal(u.searchParams.get('utm_medium'),'portfolio');
  assert.equal(u.searchParams.get('utm_campaign'),'demostraciones_202611');
  assert.equal([...u.searchParams.keys()].length,4);
 }
 assert.doesNotMatch(html,/<script\b|document\.cookie|localStorage\./i);
});

test('diagnóstico preserva origen y demo al enviar hacia contacto voluntario',()=>{
 for(const u of parsed.filter(x=>x.pathname==='/diagnostico/')){
  const dest=new URL(buildLeadUrl(u.search),origin);
  assert.equal(dest.hash,'#contacto');
  assert.equal(dest.searchParams.get('utm_source'),'laboratorio');
  assert.equal(dest.searchParams.get('utm_content'),u.searchParams.get('utm_content'));
 }
});

test('webs conserva origen de pastelería/distribuidora al formulario',()=>{
 for(const u of parsed.filter(x=>x.pathname==='/webs/')){
  const dest=rewriteReferralLink('/?utm_source=webs&utm_medium=landing&utm_campaign=webs_202611&utm_content=hero#contacto',u.search,origin);
  const final=new URL(dest,origin);
  assert.equal(final.searchParams.get('utm_source'),'laboratorio');
  assert.equal(final.searchParams.get('utm_content'),u.searchParams.get('utm_content'));
  assert.equal(final.hash,'#contacto');
 }
});

test('no se reescriben enlaces externos ni fuentes ajenas a Instagram o galería',()=>{
 const direct='/?utm_source=webs&utm_medium=landing&utm_campaign=webs_202611&utm_content=hero#contacto';
 assert.equal(rewriteReferralLink(direct,'?utm_source=google&utm_campaign=foo',origin),direct);
 assert.equal(rewriteReferralLink(direct,'?utm_source=laboratorio&utm_campaign=malicioso',origin),direct);
 assert.equal(rewriteReferralLink('https://attacker.test/#contacto','?utm_source=laboratorio&utm_campaign=demostraciones_202611',origin),'https://attacker.test/#contacto');
});

test('Instagram existente sigue preservando sus campañas explícitas',()=>{
 const dest=rewriteReferralLink('/?utm_source=webs&utm_campaign=webs_202611#contacto','?utm_source=instagram&utm_medium=profile&utm_campaign=perfil_ig_202611&utm_content=webs',origin);
 const u=new URL(dest,origin);
 assert.equal(u.searchParams.get('utm_source'),'instagram');assert.equal(u.searchParams.get('utm_content'),'webs');
});
