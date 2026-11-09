/**
 * FLUYNOVA / D1: inventario de esquema estrictamente de SOLO LECTURA.
 * No accede a filas de clientes, secretos, bookmarks ni APIs remotas.
 * Sólo recibe un binding D1 ya suministrado por el invocador.
 * NO ejecuta migraciones. CanApplyMigration NO ES autorización.
 */
const OBJECTS=Object.freeze({
  tables:Object.freeze(['leads','lead_rate_limit']),
  indexes:Object.freeze(['leads_received_at','leads_status','lead_rate_limit_hour']),
  ledgerTable:'lead_idempotency',
  ledgerIndex:'lead_idempotency_created_at'
});
const REQUIRED_COLUMNS=Object.freeze({
  leads:['id','received_at','name','email','organization','category','message',
    'deadline','stage','budget','source','medium','campaign','creative',
    'consent_at','status'],
  lead_rate_limit:['fingerprint','hour_bucket','hits'],
  lead_idempotency:['request_id','payload_mac','fingerprint','lead_id','created_at']
});
const INDEX_COLUMNS=Object.freeze({
  leads_received_at:['received_at'],
  leads_status:['status','received_at'],
  lead_rate_limit_hour:['hour_bucket'],
  lead_idempotency_created_at:['created_at']
});
async function rows(db,sql) {
  const result=await db.prepare(sql).all();
  if(!result?.success||!Array.isArray(result.results))throw Error('D1_READ_NOT_CONFIRMED');
  return result.results;
}
async function columns(db,table) {
  return (await rows(db,`PRAGMA table_info('${table}')`)).map(x=>String(x.name));
}
async function indexColumns(db,name) {
  return (await rows(db,`PRAGMA index_info('${name}')`)).map(x=>String(x.name));
}
function equalList(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
export async function inspectD1Schema(db) {
  if(!db||typeof db.prepare!=='function')throw Error('D1_READ_BINDING_MISSING');
  const found=await rows(db,"SELECT type,name,tbl_name FROM sqlite_master WHERE type IN ('table','index')");
  const has=(type,name,table)=>found.some(x=>x.type===type&&x.name===name&&
    (table===undefined||x.tbl_name===table));
  const missing=[];
  for(const name of OBJECTS.tables)
    if(!has('table',name))missing.push('MISSING_TABLE_'+name);
  for(const name of OBJECTS.indexes)
    if(!has('index',name,name.startsWith('leads_')?'leads':'lead_rate_limit'))
      missing.push('MISSING_INDEX_'+name);
  for(const name of OBJECTS.tables)if(has('table',name)){
    const actual=await columns(db,name);
    for(const col of REQUIRED_COLUMNS[name])
      if(!actual.includes(col))missing.push('MISSING_COLUMN_'+name+'.'+col);
  }
  for(const name of OBJECTS.indexes)if(has('index',name)){
    if(!equalList(await indexColumns(db,name),INDEX_COLUMNS[name]))
      missing.push('INDEX_COLUMNS_MISMATCH_'+name);
  }
  const ledgerTable=has('table',OBJECTS.ledgerTable);
  const ledgerIndex=has('index',OBJECTS.ledgerIndex,OBJECTS.ledgerTable);
  if(ledgerTable) {
    const info=await rows(db,"PRAGMA table_info('lead_idempotency')");
    const actual=info.map(x=>String(x.name));
    for(const col of REQUIRED_COLUMNS.lead_idempotency)
      if(!actual.includes(col))missing.push('LEDGER_COLUMN_MISSING_'+col);
    const requestId=info.find(x=>x.name==='request_id');
    if(Number(requestId?.pk)!==1)missing.push('LEDGER_REQUEST_ID_NOT_PRIMARY_KEY');
    for(const col of REQUIRED_COLUMNS.lead_idempotency) {
      const item=info.find(x=>x.name===col);
      if(item&&Number(item.notnull)!==1)
        missing.push('LEDGER_COLUMN_NULLABLE_'+col);
    }
    // Verificar UNIQUE sobre lead_id: no alcanza con la existencia de la columna.
    const list=await rows(db,"PRAGMA index_list('lead_idempotency')");
    let uniqueLeadId=false;
    for(const item of list.filter(x=>Number(x.unique)===1)) {
      const name=String(item.name||'');
      if(!/^[A-Za-z0-9_]+$/.test(name))throw Error('UNEXPECTED_SQLITE_INDEX_NAME');
      if(equalList(await indexColumns(db,name),['lead_id']))uniqueLeadId=true;
    }
    if(!uniqueLeadId)missing.push('LEDGER_LEAD_ID_NOT_UNIQUE');
  }
  if(ledgerIndex && !equalList(await indexColumns(db,OBJECTS.ledgerIndex),
      INDEX_COLUMNS.lead_idempotency_created_at))
    missing.push('LEDGER_INDEX_COLUMNS_MISMATCH');
  if(ledgerTable!==ledgerIndex)missing.push('PARTIAL_LEDGER_SCHEMA');
  const baseReady=missing.filter(s=>!s.startsWith('LEDGER_')&&s!=='PARTIAL_LEDGER_SCHEMA').length===0;
  const ledgerReady=ledgerTable&&ledgerIndex&&missing.length===0;
  const canApplyInIsolatedLab=baseReady&&!ledgerTable&&!ledgerIndex;
  return Object.freeze({
    mode:'SQLITE_MASTER_READ_ONLY',
    baseReady,
    ledgerReady,
    canApplyInIsolatedLab,
    migrationNeeded:canApplyInIsolatedLab,
    missing,
    expected:{baseTables:2,baseNamedIndexes:3,ledgerTables:1,ledgerNamedIndexes:1},
    // Ningún SELECT de leads, ni conteos que pudieran filtrar estadísticas.
    remoteVerified:false,
    approvedToMigrate:false
  });
}
