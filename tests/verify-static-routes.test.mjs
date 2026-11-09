import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scanStaticRoutes,verifyStaticRoutes} from '../scripts/verify-static-routes.mjs';

async function fixture(run) {
  const dir=await mkdtemp(join(tmpdir(),'fluynova-rutas-'));
  try{
    await mkdir(join(dir,'webs'));
    await writeFile(join(dir,'index.html'),'<html><body><a href="/webs/?utm_source=instagram#ver">Web</a><a href="/privacidad.html">Privacidad</a><a href="mailto:ejemplo@example.invalid">Email</a><a href="https://formsubmit.co/">Externo</a><script src="/main.js"></script></body></html>');
    await writeFile(join(dir,'webs','index.html'),'<html><body><a href="../#contacto">Volver</a><script src="./webs.js"></script></body></html>');
    await writeFile(join(dir,'privacidad.html'),'<html><body>Privacidad</body></html>');
    await writeFile(join(dir,'main.js'),'');
    await writeFile(join(dir,'webs','webs.js'),'');
    return await run(dir);
  }finally{await rm(dir,{recursive:true,force:true});}
}
test('valida navegación absoluta y relativa, recursos, query y fragmento sin red',async()=>{
  await fixture(async dir=>{
    const r=await verifyStaticRoutes(dir);
    assert.equal(r.pages,3);
    assert.equal(r.failures.length,0);
    assert.equal(r.internal,5);
    assert.equal(r.external,1);
    assert.equal(r.skipped,1);
  });
});
test('detecta un CTA roto sin seguir enlaces remotos',async()=>{
  await fixture(async dir=>{
    await writeFile(join(dir,'webs','index.html'),'<html><body><a href="/inexistente/">Cotizar</a></body></html>');
    const r=await scanStaticRoutes(dir);
    assert.deepEqual(r.failures.map(x=>x.reason),['DESTINO_INEXISTENTE']);
    await assert.rejects(verifyStaticRoutes(dir),/Enlace estático inválido/);
  });
});
test('detecta recurso javascript faltante y un esquema peligroso',async()=>{
  await fixture(async dir=>{
    await writeFile(join(dir,'webs','index.html'),'<html><body><script src="/faltante.js"></script><a href="javascript:alert(1)">mal</a></body></html>');
    const r=await scanStaticRoutes(dir);
    assert.deepEqual(r.failures.map(x=>x.reason),['DESTINO_INEXISTENTE','ESQUEMA_NO_PERMITIDO']);
  });
});
test('rechaza directorios vacíos e inputs inválidos',async()=>{
  await assert.rejects(scanStaticRoutes(''),TypeError);
  const dir=await mkdtemp(join(tmpdir(),'fluynova-sin-html-'));
  try{await assert.rejects(verifyStaticRoutes(dir),/No se encontraron páginas/)}
  finally{await rm(dir,{recursive:true,force:true})}
});
