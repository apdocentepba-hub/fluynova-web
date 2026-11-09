/**
 * FLUYNOVA — Vista administrativa desconectada. Sin datos personales
 * ni HTTP público. Pruebas de formato, lectura mínima y rechazo de entradas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readMailAdminSnapshot,renderOfflineMailAdminHtml}
 from '../infra/fluynova-public-intake-worker/mail-admin-report.mjs';

const AT='2026-11-09T12:00:00.000Z';
function stub(rows,{success=true}={}) {
 const queries=[];
 return {
  queries,
  prepare(sql) {
   queries.push(sql);
   return {all:async()=>({success,results:rows})};
  }
 };
}
test('admin offline: SELECT agregado exclusivamente, seis estados y sin PII',async()=>{
 const db=stub([
  {state:'pending',total:3,email:'SECRETO@example.invalid',message:'MENSAJE_PRIVADO_X'},
  {state:'uncertain',total:2,lead_id:'UUID_PRIVADO_Y'},
  {state:'delivered',total:1},
  {state:'bounced',total:1}
 ]);
 const snapshot=await readMailAdminSnapshot(db,{now:()=>AT});
 assert.equal(snapshot.total,7);
 assert.equal(snapshot.needsReview,3);
 assert.deepEqual(snapshot.counts,{
  pending:3,sending:0,accepted:0,delivered:1,bounced:1,uncertain:2
 });
 assert.equal(snapshot.remoteVerified,false);
 assert.equal(snapshot.isLiveDashboard,false);
 assert.equal(snapshot.source,'D1_AGGREGATE_OFFLINE_ONLY');
 assert.deepEqual(db.queries,[
  'SELECT state, COUNT(*) AS total FROM lead_mail_outbox GROUP BY state ORDER BY state'
 ]);
 const html=renderOfflineMailAdminHtml(snapshot);
 assert.match(html,/Estado de avisos de contacto/);
 assert.match(html,/Requieren revisión/);
 assert.match(html,/Entregados por SMTP/);
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/No es un panel en vivo/);
 assert.equal((html.match(/<tbody>/g)||[]).length,1);
 assert.equal((html.match(/<tr>/g)||[]).length,7); // 1 cabecera + 6 estados
 for(const forbidden of ['SECRETO@example.invalid','MENSAJE_PRIVADO_X','UUID_PRIVADO_Y',
  '<script','<form','<iframe','/api/leads','/api/contact'])
   assert.equal(html.includes(forbidden),false,'No exponer '+forbidden);
 assert.deepEqual(Object.keys(snapshot),
  ['source','generatedAt','counts','total','needsReview','remoteVerified','isLiveDashboard']);
 assert.equal(Object.isFrozen(snapshot),true);
 assert.equal(Object.isFrozen(snapshot.counts),true);
});
test('admin offline: sin registros, vista utilizable sin estados falsos',async()=>{
 const db=stub([]);
 const x=await readMailAdminSnapshot(db,{now:()=>AT});
 assert.equal(x.total,0);
 assert.equal(x.needsReview,0);
 const html=renderOfflineMailAdminHtml(x);
 assert.match(html,/Estado de avisos/);
 assert.doesNotMatch(html,/NaN|Infinity|undefined/);
 assert.match(html,/0<\/div>/);
});
test('admin offline: fallos de D1, estados no reconocidos y totales adulterados',async()=>{
 for(const rows of [
  [{state:'<img src=x onerror=alert(1)>',total:99}],
  [{state:'pending',total:-1}],
  [{state:'pending',total:3.5}],
  [{state:'pending',total:'3'}],
  [{state:'pending',total:Number.MAX_SAFE_INTEGER},{state:'delivered',total:1}],
  [{state:'pending',total:1},{state:'pending',total:2}],
  [null]
 ])await assert.rejects(readMailAdminSnapshot(stub(rows),{now:()=>AT}),
   /ADMIN_UNEXPECTED_STATUS_OR_COUNT|COUNT_OVERFLOW/);
 await assert.rejects(readMailAdminSnapshot(stub([],{success:false}),{now:()=>AT}),
  /ADMIN_AGGREGATE_NOT_CONFIRMED/);
 await assert.rejects(readMailAdminSnapshot(null),/ADMIN_D1_NOT_CONFIGURED/);
 await assert.rejects(readMailAdminSnapshot(stub([]),{now:()=>'<script>'}),
  /ADMIN_TIME_INVALID/);
 const valid=await readMailAdminSnapshot(stub([{state:'pending',total:4}]),{now:()=>AT});
 assert.throws(()=>renderOfflineMailAdminHtml({...valid,total:8}),/INCONSISTENT/);
 assert.throws(()=>renderOfflineMailAdminHtml({...valid,remoteVerified:true}),/NOT_TRUSTED/);
 assert.throws(()=>renderOfflineMailAdminHtml({...valid,isLiveDashboard:true}),/NOT_TRUSTED/);
 assert.throws(()=>renderOfflineMailAdminHtml({...valid,
  counts:{...valid.counts,evil:'<script>'}}),/INVALID_MAIL_ADMIN_COUNTS/);
 assert.throws(()=>renderOfflineMailAdminHtml({...valid,generatedAt:'<img src=x>'}),/NOT_TRUSTED/);
});
