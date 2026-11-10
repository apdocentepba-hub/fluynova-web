// Diagnóstico sin datos reales ni dependencias externas: llama ÚNICAMENTE a Ollama local.
// Informe deliberadamente no contiene el texto ni la respuesta completa del modelo.
import {analyzeDocument,CopilotError} from './analysis.mjs';
const MODEL='qwen3:1.7b';
const FIXTURES=[
  {
    name:'Caso A - factura duplicada',
    text:'Factura A-0001-00000121\nProveedor: Proveedor Demo Norte\nOrden de compra: OC-1001\nNeto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00',
    expected:{supplier:'Proveedor Demo Norte',number:'A-0001-00000121',order:'OC-1001',
      net_cents:15000000,tax_cents:3150000,total_cents:18150000},
    issue:'duplicado'
  },
  {
    name:'Caso B - orden de compra ausente',
    text:'Comprobante B-0004-00000105\nProveedor: Proveedor Demo Centro\nNeto: $200.000,00\nIVA: $42.000,00\nTotal: $242.000,00\nLa orden de compra no figura en este comprobante.',
    expected:{supplier:'Proveedor Demo Centro',number:'B-0004-00000105',order:null,
      net_cents:20000000,tax_cents:4200000,total_cents:24200000},
    issue:'orden de compra'
  }
];
const fmt=t=>Math.round(t/1000)+' segundos';
async function main(){
  console.log('FLUYNOVA COPILOT - PRUEBA LOCAL DE INFERENCIA REAL');
  console.log('Fecha:',new Date().toISOString());
  console.log('Runtime:',process.version,'| Modelo configurado:',MODEL);
  console.log('Datos: SOLAMENTE COMPROBANTES INVENTADOS; NO se imprimen ni guardan textos ni respuestas.');
  console.log('Destino de red usado por este diagnóstico: 127.0.0.1:11434.');
  if(Number(process.versions.node.split('.')[0])<22){
    console.log('ERROR: se necesita Node 22 o superior.');process.exitCode=3;return;
  }
  try{
    const response=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw Error('Servicio local respondió HTTP '+response.status);
    const models=(await response.json()).models||[];
    const has=models.some(m=>[m.name,m.model].includes(MODEL));
    if(!has) {
      console.log('ERROR: Ollama funciona pero falta el modelo '+MODEL);
      console.log('ACCIÓN: ejecutá ollama pull '+MODEL+' en PowerShell.');
      process.exitCode=3;return;
    }
    console.log('Ollama: accesible; modelo descargado: SÍ.');
  }catch(err){
    console.log('ERROR: Ollama no responde en 127.0.0.1:11434.');
    console.log('ACCIÓN: instalá/abrí Ollama. Código:',err.name==='TimeoutError'?'TIMEOUT':'SIN_SERVICIO');
    process.exitCode=3;return;
  }
  let successes=0,modelCorrect=0,verifiedCorrect=0,total=0;
  for(const fixture of FIXTURES){
    console.log('\n'+fixture.name);
    const started=Date.now();
    try{
      // Primer arranque puede requerir cargar pesos en CPU; no se simula si tarda demasiado.
      const output=await analyzeDocument(fixture.text,{model:MODEL,timeoutMs:120000});
      successes++;
      const elapsed=Date.now()-started;
      console.log('Inferencia real: RECIBIDA en',fmt(elapsed));
      let hits=0,rawHits=0;
      for(const [field,expected] of Object.entries(fixture.expected)){
        const amount=field.endsWith('_cents');
        const sourceInfo=amount?output.amount_verification[field]:null;
        const fromModel=amount?sourceInfo.model_proposal_cents:output.extracted[field];
        const modelHit=fromModel===expected;
        const verifiedHit=output.extracted[field]===expected;
        hits+=Number(verifiedHit);rawHits+=Number(modelHit);
        modelCorrect+=Number(modelHit);verifiedCorrect+=Number(verifiedHit);total++;
        console.log('Campo '+field+
          ': MODELO '+(modelHit?'OK':'REVISAR')+
          (amount?', TEXTO '+(verifiedHit?'OK':'REVISAR')+
            ', ORIGEN '+sourceInfo.origin:''));
      }
      const found=output.issues.some(x=>x.toLocaleLowerCase('es-AR').includes(fixture.issue));
      console.log('Alerta esperada: '+(found?'DETECTADA':'NO DETECTADA'));
      console.log('Citas literales:',output.extracted.evidence.length,
        '| Citas rechazadas:',output.extracted.evidence_rejected);
      console.log('Decisión automática:',output.can_auto_approve?'ERROR INSEGURO':'BLOQUEADA');
      console.log('Campos correctos según modelo:',rawHits+'/'+Object.keys(fixture.expected).length);
      console.log('Campos correctos tras contraste textual:',hits+'/'+Object.keys(fixture.expected).length);
      if(!found||output.can_auto_approve)process.exitCode=2;
    }catch(err){
      console.log('Inferencia real: ERROR',err instanceof CopilotError?err.code:'INTERNAL_ERROR',
        'tras',fmt(Date.now()-started));
      process.exitCode=2;
    }
  }
  console.log('\nRESUMEN');
  console.log('Respuestas obtenidas:',successes+'/'+FIXTURES.length);
  console.log('Extracción propuesta por IA:',modelCorrect+'/'+total);
  console.log('Extracción tras reglas de texto:',verifiedCorrect+'/'+total,
    '(solo casos sintéticos, no extrapolar precisión).');
  console.log('NOTA: un acierto por reglas de texto NO significa que la IA interpretó correctamente el importe.');
  console.log('Publicación: NINGUNA. No hay aprobación ni escrituras externas.');
  if(successes!==FIXTURES.length||verifiedCorrect!==total)process.exitCode=2;
  if(!process.exitCode)console.log('RESULTADO: CONTRASTE TEXTUAL APROBADO PARA ESTOS DOS EJEMPLOS; modelo evaluado por separado. No es validación comercial.');
  else console.log('RESULTADO: HAY INCONSISTENCIAS; revisar modelo o extracción antes de usar el prototipo.');
}
await main();
