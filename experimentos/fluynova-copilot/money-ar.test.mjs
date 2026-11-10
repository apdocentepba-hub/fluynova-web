import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArgentineAmount,extractLiteralAmounts,reconcileArgentineMoney} from './money-ar.mjs';

test('parseo seguro de pesos argentinos en centavos, sin float',()=>{
  assert.equal(parseArgentineAmount('$150.000,00'),15000000);
  assert.equal(parseArgentineAmount('$ 31.500,00'),3150000);
  assert.equal(parseArgentineAmount('ARS 181.500,00'),18150000);
  assert.equal(parseArgentineAmount('1.234,56'),123456);
  assert.equal(parseArgentineAmount('$0,00'),0);
  assert.equal(parseArgentineAmount('123,45'),12345);
  assert.equal(parseArgentineAmount('1.000'),100000);
  assert.equal(parseArgentineAmount('ARS 200.000 pesos'),20000000);
});
test('no adivina cifras inválidas, negativas o separadores incompatibles',()=>{
  for(const value of ['1,000.00','1.000.00','12.34,56','1,2','1.000,000',
    '$ -500,00','1e9','100x','9.999.99','100,00 IVA','',null,
    '999999999999999999999999999999,99']){
    assert.equal(parseArgentineAmount(value),null,JSON.stringify(value));
  }
});
test('lee únicamente las etiquetas monetarias inequívocas',()=>{
  const rows=extractLiteralAmounts(
    'Factura A-001\nNeto: $150.000,00\nIVA 21%: $31.500,00\nTotal a pagar: ARS 181.500,00\nOrden: OC-12');
  assert.equal(rows.net_cents.length,1);
  assert.equal(rows.net_cents[0].value,15000000);
  assert.equal(rows.tax_cents[0].value,3150000);
  assert.equal(rows.total_cents[0].value,18150000);
});
test('corrige salida del modelo que interpreta pesos como centavos, dejando trazabilidad',()=>{
  const source='Neto: $150.000,00\nIVA: $31.500,00\nTotal: $181.500,00';
  const proposed={net_cents:150000,tax_cents:31500,total_cents:181500};
  const r=reconcileArgentineMoney(source,proposed);
  assert.equal(r.extracted.net_cents,15000000);
  assert.equal(r.extracted.tax_cents,3150000);
  assert.equal(r.extracted.total_cents,18150000);
  assert.equal(r.verification.net_cents.model_proposal_cents,150000);
  assert.equal(r.verification.net_cents.origin,'LECTURA_LITERAL_ETIQUETADA');
  assert.equal(r.issues.length,3);
});
test('si modelo coincide con el texto no inventa discrepancias',()=>{
  const r=reconcileArgentineMoney('Neto: $100,00\nIVA: $21,00\nTotal: $121,00',
    {net_cents:10000,tax_cents:2100,total_cents:12100});
  assert.equal(r.issues.length,0);
  assert.equal(r.verification.tax_cents.disagreement,false);
});
test('no confía en una cifra generada cuando falta el monto en la fuente',()=>{
  const r=reconcileArgentineMoney('Factura ficticia ABC\nProveedor: Demo',
    {net_cents:5000,tax_cents:1050,total_cents:6050});
  assert.equal(r.extracted.net_cents,null);
  assert.equal(r.verification.net_cents.origin,'NO_ENCONTRADO');
  assert.equal(r.issues.length,3);
});
test('doble etiqueta potencialmente maliciosa no tiene corrección silenciosa',()=>{
  const r=reconcileArgentineMoney('Neto: $100,00\nNeto: $200,00\nIVA: $21,00\nTotal: $121,00',
    {net_cents:10000,tax_cents:2100,total_cents:12100});
  assert.equal(r.extracted.net_cents,null);
  assert.equal(r.verification.net_cents.origin,'AMBIGUO_O_INVALIDO');
  assert.equal(r.verification.net_cents.model_proposal_cents,10000);
  assert.ok(r.issues.some(x=>x.includes('neto')));
});
test('IVA sin cifra válida se marca para revisión',()=>{
  const r=reconcileArgentineMoney('Neto: $100,00\nIVA: no identificado\nTotal: $121,00',
    {net_cents:10000,tax_cents:2100,total_cents:12100});
  assert.equal(r.extracted.tax_cents,null);
  assert.equal(r.verification.tax_cents.origin,'AMBIGUO_O_INVALIDO');
});
