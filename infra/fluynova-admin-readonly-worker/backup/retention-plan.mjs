/**
 * FLUYNOVA — 07B: plan de retención de copias ya cifradas.
 * SOLO una propuesta determinista: NO lee disco, NO borra, NO abre red,
 * NO gestiona D1 ni declara una política aprobada de conservación.
 */
const MAX_ITEMS=10000;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{5,127}$/;
const fmt='FLUYNOVA_PAGED_ENCRYPTED_LAB_V1';
const validateTime=x=>typeof x==='string'&&ISO.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
function dayUtc(t){return t.slice(0,10)}
function weekUtc(t){
 const d=new Date(t);
 d.setUTCHours(0,0,0,0);
 d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
function monthUtc(t){return t.slice(0,7)}
/**
 * Nunca se elimina una copia automáticamente.
 * "candidateForManualDeletion" NO autoriza eliminarla.
 */
export function proposeEncryptedBackupRetention(entries,{
 asOf=new Date().toISOString(),minAgeDays=90
}={}){
 if(!validateTime(asOf)||!Number.isSafeInteger(minAgeDays)||
  minAgeDays<90||minAgeDays>3650||
  !Array.isArray(entries)||entries.length>MAX_ITEMS)
  throw Error('RETENTION_INPUT_INVALID');
 const seen=new Set();
 const records=[];
 for(const item of entries){
  if(!item||typeof item!=='object'||Array.isArray(item)||
   !ID.test(item.id||'')||seen.has(item.id))
   throw Error('RETENTION_INVALID_OR_DUPLICATE_ID');
  seen.add(item.id);
  // No confiar en entradas "verificadas" solo porque lo afirma el archivo.
  // checksumVerified es un dato suministrado por el operador, no prueba
  // criptográfica: por sí solo NUNCA habilita borrado automático.
  const structurallyValid=validateTime(item.createdAt)&&
   item.createdAt<=asOf&&item.scope==='FLUYNOVA'&&
   item.format===fmt&&item.encrypted===true&&
   item.checksumVerified===true&&
   item.storage==='APPROVED_PRIVATE'&&
   typeof item.legalHold==='boolean';
  records.push({...item,structurallyValid});
 }
 records.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||
  a.id.localeCompare(b.id));
 const verified=records.filter(x=>x.structurallyValid);
 const keep=new Set(verified.slice(0,3).map(x=>x.id));
 const now=Date.parse(asOf);
 const cutoff=now-minAgeDays*86400000;
 const daySet=new Set(),weekSet=new Set(),monthSet=new Set();
 for(const r of verified){
  if(r.legalHold){keep.add(r.id);continue}
  const at=Date.parse(r.createdAt);
  if(now-at<7*86400000){keep.add(r.id);continue}
  if(now-at<14*86400000){
   const k=dayUtc(r.createdAt);
   if(!daySet.has(k)){daySet.add(k);keep.add(r.id)}
  }
  if(now-at<90*86400000){
   const k=weekUtc(r.createdAt);
   if(!weekSet.has(k)&&weekSet.size<13){
    weekSet.add(k);keep.add(r.id)
   }
  }
  if(now-at<366*86400000){
   const k=monthUtc(r.createdAt);
   if(!monthSet.has(k)&&monthSet.size<12){
    monthSet.add(k);keep.add(r.id)
   }
  }
 }
 // Un "candidato" solo es apto para evaluación posterior; jamás se ejecuta
 // una operación de borrado ni se produce una orden destructiva.
 const decisions=records.map(r=>{
  let status='retain';
  let reason='RECENT_OR_PRESERVED';
  if(!r.structurallyValid){status='hold';reason='UNVERIFIED_OR_FOREIGN_METADATA'}
  else if(r.legalHold){status='hold';reason='LEGAL_OR_BUSINESS_HOLD'}
  else if(!keep.has(r.id)&&Date.parse(r.createdAt)<cutoff&&
    verified.length>=4){
   status='candidateForManualDeletion';
   reason='OLDER_THAN_MINIMUM_AGE_AND_REDUNDANT';
  }
  return Object.freeze({id:r.id,status,reason});
 });
 return Object.freeze({
  mode:'ADVISORY_ONLY_NO_DELETION',
  asOf,minAgeDays,
  total:decisions.length,
  kept:decisions.filter(d=>d.status==='retain').length,
  held:decisions.filter(d=>d.status==='hold').length,
  candidates:decisions.filter(d=>d.status==='candidateForManualDeletion').length,
  deletionAuthorized:false,filesDeleted:0,
  decisions:Object.freeze(decisions)
 });
}
