/**
 * FLUYNOVA — reporte administrativo OFFLINE, solo estados y cantidades.
 * Sin route HTTP, autenticación falsa ni acceso al Worker público.
 * El invocador debe suministrar D1 mediante un proceso local autorizado.
 */
const STATES=Object.freeze([
 {key:'pending',label:'Pendiente',detail:'En cola, sin envío confirmado'},
 {key:'sending',label:'En proceso',detail:'Intento reclamado, resultado sin confirmar'},
 {key:'accepted',label:'Aceptado por proveedor',detail:'No acredita entrega SMTP'},
 {key:'delivered',label:'Entregado por SMTP',detail:'No acredita entrada a Bandeja de entrada ni lectura'},
 {key:'bounced',label:'Rechazado',detail:'El servidor destinatario rechazó el correo'},
 {key:'uncertain',label:'Revisión necesaria',detail:'Resultado ambiguo: no reenviar automáticamente'}
]);
const KEYS=new Set(STATES.map(s=>s.key));
const QUERY='SELECT state, COUNT(*) AS total FROM lead_mail_outbox GROUP BY state ORDER BY state';
function isIso(value) {
 return typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&
   Number.isFinite(Date.parse(value));
}
function goodNumber(value) {
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}
function validCounts(counts) {
 if(!counts||typeof counts!=='object'||Array.isArray(counts)||
    Object.keys(counts).length!==STATES.length||
    Object.keys(counts).some(k=>!KEYS.has(k))||
    STATES.some(s=>!goodNumber(counts[s.key])))
   throw Error('INVALID_MAIL_ADMIN_COUNTS');
 const total=STATES.reduce((n,s)=>n+counts[s.key],0);
 if(!Number.isSafeInteger(total))throw Error('MAIL_ADMIN_COUNT_OVERFLOW');
 return total;
}
export async function readMailAdminSnapshot(db,{now=()=>new Date().toISOString()}={}) {
 if(!db||typeof db.prepare!=='function')throw Error('ADMIN_D1_NOT_CONFIGURED');
 // La única consulta SQL selecciona estados y contadores, NO lee PII.
 const result=await db.prepare(QUERY).all();
 if(result?.success!==true||!Array.isArray(result.results))
   throw Error('ADMIN_AGGREGATE_NOT_CONFIRMED');
 const counts=Object.fromEntries(STATES.map(s=>[s.key,0]));
 const seen=new Set();
 for(const row of result.results) {
  if(!row||typeof row.state!=='string'||!KEYS.has(row.state)||
     seen.has(row.state)||!goodNumber(row.total))
    throw Error('ADMIN_UNEXPECTED_STATUS_OR_COUNT');
  seen.add(row.state);counts[row.state]=row.total;
 }
 const total=validCounts(counts);
 const generatedAt=now();
 if(!isIso(generatedAt))throw Error('ADMIN_TIME_INVALID');
 return Object.freeze({
  source:'D1_AGGREGATE_OFFLINE_ONLY',generatedAt,
  counts:Object.freeze(counts),total,
  needsReview:counts.uncertain+counts.bounced,
  remoteVerified:false,isLiveDashboard:false
 });
}
export function renderOfflineMailAdminHtml(snapshot) {
 if(!snapshot||snapshot.source!=='D1_AGGREGATE_OFFLINE_ONLY'||
    snapshot.remoteVerified!==false||snapshot.isLiveDashboard!==false||
    !isIso(snapshot.generatedAt))
   throw Error('ADMIN_SNAPSHOT_NOT_TRUSTED');
 const total=validCounts(snapshot.counts);
 if(total!==snapshot.total||
    snapshot.needsReview!==snapshot.counts.uncertain+snapshot.counts.bounced)
   throw Error('ADMIN_SNAPSHOT_INCONSISTENT');
 // Solo se interpolan números verificados y timestamp ISO estricto.
 // Etiquetas y texto son constantes; NO se interpolan filas D1.
 const rows=STATES.map(s=>{
  const count=snapshot.counts[s.key];
  const pct=total?Math.round(100*count/total):0;
  return '<tr><th scope="row">'+s.label+'</th><td class="num">'+count+
    '</td><td><div class="track"><span style="width:'+pct+'%"></span></div></td>'+
    '<td class="detail">'+s.detail+'</td></tr>';
 }).join('\n');
 const start="<!doctype html><html lang='es-AR'><head><meta charset='utf-8'>"+
  "<meta name='viewport' content='width=device-width,initial-scale=1'>"+
  "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">"+
  "<meta name='referrer' content='no-referrer'>"+
  "<title>FLUYNOVA | Avisos de contacto (reporte sin conexión)</title>";
 const css="<style>:root{color-scheme:light;--ink:#17253c;--muted:#4d5d74;--line:#dbe4ef}"+
  "*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:var(--ink);font:16px system-ui,sans-serif}"+
  "main{max-width:1060px;margin:auto;padding:clamp(16px,4vw,48px)}"+
  "h1{font-size:clamp(1.6rem,4vw,2.3rem);margin:8px 0}p{line-height:1.5}"+
  ".subtle{color:var(--muted)}.eyebrow{font-weight:700;color:#164886;text-transform:uppercase;font-size:.8rem;letter-spacing:.07em}"+
  ".grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:24px 0}"+
  ".card{background:white;border:1px solid var(--line);border-radius:14px;padding:20px;min-width:0}"+
  ".value{font-size:2rem;font-weight:750;font-variant-numeric:tabular-nums;margin:5px 0}"+
  ".tablewrap{overflow-x:auto;background:white;border:1px solid var(--line);border-radius:14px}"+
  "table{border-collapse:collapse;width:100%;min-width:650px}th,td{text-align:left;padding:14px 16px;border-bottom:1px solid var(--line);vertical-align:middle}"+
  "thead{background:#e9f0fa}tbody tr:last-child>*{border-bottom:0}.num{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}"+
  ".track{height:8px;min-width:85px;background:#e5edf6;border-radius:10px;overflow:hidden}.track>span{display:block;background:#245b9b;height:100%}"+
  ".detail{color:var(--muted);font-size:.9rem}.footer{margin-top:22px;border-top:1px solid var(--line);padding-top:12px}"+
  "@media(max-width:650px){.grid{grid-template-columns:1fr}.card{padding:16px}}</style>";
 const body="</head><body><main><p class='eyebrow'>FLUYNOVA · Administración local</p>"+
  "<h1>Estado de avisos de contacto</h1>"+
  "<p class='subtle'>Instantánea de lectura, generada: <time datetime='"+snapshot.generatedAt+"'>"+snapshot.generatedAt+"</time>. No es un panel en vivo ni verifica Cloudflare remoto.</p>"+
  "<section class='grid' aria-label='Resumen de correo'>"+
  "<div class='card'><div>Total de avisos</div><div class='value'>"+total+"</div><div class='subtle'>Consultas con registro en cola</div></div>"+
  "<div class='card'><div>Requieren revisión</div><div class='value'>"+snapshot.needsReview+"</div><div class='subtle'>Ambiguos y rechazados</div></div>"+
  "<div class='card'><div>Entregados por SMTP</div><div class='value'>"+snapshot.counts.delivered+"</div><div class='subtle'>No implica lectura ni llegada a Bandeja de entrada</div></div></section>"+
  "<h2>Distribución por estado</h2><div class='tablewrap'><table><thead><tr>"+
  "<th scope='col'>Estado</th><th scope='col'>Cantidad</th><th scope='col'>Proporción</th><th scope='col'>Significado</th>"+
  "</tr></thead><tbody>"+rows+"</tbody></table></div>"+
  "<p class='footer subtle'><strong>Privacidad:</strong> solo cantidades por estado. "+
  "Sin nombres, correos, teléfonos, mensajes, IDs de consultas ni funciones de envío. "+
  "Este archivo no está publicado ni autenticado: conservarlo localmente.</p></main></body></html>";
 return start+css+body;
}
