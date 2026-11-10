import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMoneyOnly} from './verify-money.mjs';
import {createApp} from './server.mjs';
import {CopilotError} from './analysis.mjs';

const valid=[
 'Factura inventada A-12345',
 'Neto: $150.000,00',
 'IVA: $31.500,00',
 'Total: $181.500,00'
].join('\n');

test('sin Ollama verifica importes desde texto etiquetado sin afirmar IA',()=>{
 const result=verifyMoneyOnly(valid);
 assert.equal(result.mode,'REGLAS_SIN_IA');
 assert.equal(result.model_called,false);
 assert.equal(result.model_used,null);
 assert.equal(result.verified_amounts,3);
 assert.equal(result.extracted.net_cents,15000000);
 assert.equal(result.extracted.tax_cents,3150000);
 assert.equal(result.extracted.total_cents,18150000);
 assert.equal(result.issues.length,0);
 assert.equal(result.amount_verification.total_cents.disagreement,null);
 assert.equal(result.amount_verification.total_cents.model_proposal_cents,null);
 assert.equal(result.can_auto_approve,false);
 assert.equal(result.decision,'REQUIERE_REVISION_HUMANA');
});
test('suma incompatible queda observada sin consultar IA',()=>{
 const result=verifyMoneyOnly(valid.replace('$181.500,00','$181.400,00'));
 assert.equal(result.verified_amounts,3);
 assert.ok(result.issues.some(x=>/Neto \+ impuestos no coincide/i.test(x)));
 assert.equal(result.can_auto_approve,false);
});
test('montos duplicados o sin formato válido nunca se inventan',()=>{
 const result=verifyMoneyOnly(valid.replace('Neto: $150.000,00',
  'Neto: $150.000,00\nNeto: $160.000,00'));
 assert.equal(result.verified_amounts,2);
 assert.equal(result.extracted.net_cents,null);
 assert.equal(result.amount_verification.net_cents.origin,'AMBIGUO_O_INVALIDO');
 assert.ok(result.issues.some(x=>/neto no se pudo corroborar/i.test(x)));
});
test('no usa cifras monetarias fuera del formato etiquetado',()=>{
 const text='Factura de laboratorio 1111\nImporte extraño: 181500\nIVA: sin dato\nTotal: 181500';
 const result=verifyMoneyOnly(text);
 assert.equal(result.verified_amounts,1);
 assert.equal(result.extracted.net_cents,null);
 assert.equal(result.extracted.tax_cents,null);
 assert.equal(result.extracted.total_cents,18150000);
 assert.equal(result.can_auto_approve,false);
});
test('valida límites antes de analizar',()=>{
 for(const text of [null,13,'corto','x'.repeat(7000)]){
   assert.throws(()=>verifyMoneyOnly(text),
      e=>e instanceof CopilotError && e.code==='INVALID_DOCUMENT_LENGTH');
 }
});
test('ruta HTTP funciona sin invocar jamás al LLM',async()=>{
 let llmCalls=0;
 const srv=createApp({analyzer:async()=>{llmCalls++;throw Error('No debe ejecutarse')}});
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+srv.address().port;
 try{
   const response=await fetch(base+'/api/verify-money',{
     method:'POST',headers:{origin:base,'content-type':'application/json'},
     body:JSON.stringify({document:valid})
   });
   assert.equal(response.status,200);
   const out=await response.json();
   assert.equal(out.verified_amounts,3);
   assert.equal(out.model_called,false);
   assert.equal(out.can_auto_approve,false);
   assert.equal(llmCalls,0);
   const rejected=await fetch(base+'/api/verify-money',{
     method:'POST',headers:{origin:'http://malicioso.invalid','content-type':'application/json'},
     body:JSON.stringify({document:valid})
   });
   assert.equal(rejected.status,403);
   assert.equal(llmCalls,0);
 }finally{srv.closeAllConnections();await new Promise(r=>srv.close(r))}
});
