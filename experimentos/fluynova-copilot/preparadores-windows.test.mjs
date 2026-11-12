// Regresión Windows: evita que un directorio terminado en barra escape
// la comilla de --prefix "%~dp0" y convierta flags npm en nombre de carpeta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const scriptPaths=['PREPARAR-OCR-WINDOWS.cmd','PREPARAR-PDF-WINDOWS.cmd'];
const correct='call npm install --ignore-scripts --no-audit --no-fund';
test('ambos preparadores invocan npm desde su carpeta sin --prefix con slash final',async()=>{
 for(const name of scriptPaths){
  const content=await readFile(new URL('./'+name,import.meta.url),'utf8');
  assert.match(content,/^cd \/d "%~dp0"$/m,name);
  assert.ok(content.includes(correct),name);
  assert.doesNotMatch(content,/npm install --prefix "%~dp0"/i,name);
  assert.equal((content.match(/call npm install /g)||[]).length,1,name);
 }
});
test('en Windows la invocacion exacta conserva flags y cwd en ruta con espacios',
 {skip:process.platform!=='win32'},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'FLUYNOVA carpeta con espacios '));
 const bin=join(temp,'herramientas falsas');
 const working=join(temp,'copilot archivo local');
 await Promise.all([mkdir(bin),mkdir(working)]);
 try {
  const fakeNpm=join(bin,'npm.cmd');
  await writeFile(fakeNpm,'@echo off\r\nnode -e "console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(1)}))" %*\r\n','utf8');
  const run=spawnSync('cmd.exe',['/d','/s','/c',correct],{
   cwd:working,encoding:'utf8',timeout:12000,
   env:{...process.env,PATH:bin+';'+process.env.PATH}
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  const output=run.stdout.trim().split(/\r?\n/).at(-1);
  const parsed=JSON.parse(output);
  assert.equal(parsed.cwd.toLowerCase(),working.toLowerCase());
  assert.deepEqual(parsed.args,['install','--ignore-scripts','--no-audit','--no-fund']);
 }finally{await rm(temp,{recursive:true,force:true})}
});
