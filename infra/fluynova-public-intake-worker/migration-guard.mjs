/**
 * FLUYNOVA — guard estático y conservador de SQL para PR #23.
 * SOLO valida texto local. No ejecuta SQL, no abre redes, no migra D1.
 * El permiso de migrar remotamente NO se deriva de un PASS.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const EXPECTED_MIGRATION=Object.freeze([
  'CREATE TABLE IF NOT EXISTS lead_idempotency ('+
   'request_id TEXT PRIMARY KEY NOT NULL,'+
   'payload_mac TEXT NOT NULL,'+
   'fingerprint TEXT NOT NULL,'+
   'lead_id TEXT NOT NULL UNIQUE,'+
   'created_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS lead_idempotency_created_at '+
    'ON lead_idempotency(created_at)'
]);
const normalize=sql=>sql.trim().replace(/\s+/g,' ').replace(/\s*([(),])\s*/g,'$1').toUpperCase();

export function auditMigrationSql(text) {
  const failures=[];
  if(typeof text!=='string'||text.length>8_000||text.length<50)
    return {safe:false,failures:['UNEXPECTED_MIGRATION_SIZE'],remoteApproval:false};
  // Rechazar bloques de comentario, unicode ambiguo y escapes de SQL.
  if(/\/\*|\*\/|[\u0000-\u001f\u007f]/.test(text.replace(/\r?\n/g,'')))
    failures.push('UNSUPPORTED_SQL_SYNTAX');
  const onlySql=text.split(/\r?\n/).filter(line=>!/^\s*--/.test(line)).join('\n');
  const statements=onlySql.split(';').map(x=>x.trim()).filter(Boolean);
  if(statements.length!==EXPECTED_MIGRATION.length)
    failures.push('MIGRATION_STATEMENT_COUNT_CHANGED');
  for(let i=0;i<EXPECTED_MIGRATION.length;i++){
    if(normalize(statements[i]||'')!==normalize(EXPECTED_MIGRATION[i]))
      failures.push('MIGRATION_STATEMENT_'+(i+1)+'_CHANGED');
  }
  return Object.freeze({
    safe:failures.length===0,
    status:failures.length===0?'LOCAL_SCHEMA_ADD_ONLY':'UNSAFE_MIGRATION',
    statements:statements.length,
    tablesAffected:['lead_idempotency'],
    failures,
    remoteApproval:false,
    remoteExecuted:false
  });
}
export function readMigrationSql() {
  return readFileSync(fileURLToPath(new URL('./idempotency.schema.sql',import.meta.url)),'utf8');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const result=auditMigrationSql(readMigrationSql());
  console.log(JSON.stringify(result,null,2));
  if(!result.safe)process.exitCode=1;
}
