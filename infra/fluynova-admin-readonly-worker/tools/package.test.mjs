import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildReviewPackage} from './build-review-package.mjs';
import {expectedModule} from './generate-admin-assets.mjs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const digest=data=>createHash('sha256').update(data).digest('hex');

test('Los tres assets empaquetados están sincronizados byte a byte con código real',async()=>{
 const generated=await readFile(new URL('../admin-assets.generated.mjs',import.meta.url),'utf8');
 assert.equal(generated,await expectedModule());
 assert.equal(generated.includes('ADMIN_ASSETS'),true);
 assert.equal(generated.includes('Cf-Access-Jwt-Assertion'),false);
});

test('Paquete de revisión determinista: 5 archivos, sha256 y sin credenciales',async()=>{
 const {destination,manifest}=await buildReviewPackage();
 assert.equal(manifest.releaseStatus,'NEVER_DEPLOY_FROM_THIS_ZIP');
 assert.equal(manifest.authenticatedHostingIncluded,false);
 assert.equal(manifest.realData,false);
 assert.equal(manifest.networkServicesConfigured,false);
 assert.deepEqual((await readdir(destination)).sort(),[
  'LEER_ANTES_DE_ABRIR.txt','dashboard.css','dashboard.html','dashboard.js','manifest.json'
 ]);
 for(const [name,hash] of Object.entries(manifest.files)){
  const buffer=await readFile(new URL('../review-dist/'+name,import.meta.url));
  assert.equal(digest(buffer),hash);
  assert.match(hash,/^[0-9a-f]{64}$/);
 }
 const instructions=await readFile(new URL('../review-dist/LEER_ANTES_DE_ABRIR.txt',import.meta.url),'utf8');
 assert.match(instructions,/NO PUBLICAR/);
 assert.match(instructions,/Cloudflare Access RS256/);
 const html=await readFile(new URL('../review-dist/dashboard.html',import.meta.url),'utf8');
 assert.match(html,/src="\.\/dashboard\.js"/);
 assert.match(html,/href="\.\/dashboard\.css"/);
 assert.doesNotMatch(html,/(?:https?:\/\/|cloudflareaccess\.com|[A-Za-z0-9_-]{64})/);
 const manifestJson=JSON.parse(await readFile(new URL('../review-dist/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifestJson,manifest);
 console.log('FLUYNOVA_ADMIN_PACKAGE_PASS: files=5, sha256=3, release=false, no_real_data=true');
});
