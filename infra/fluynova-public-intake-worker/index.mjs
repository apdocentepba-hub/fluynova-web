/**
 * FLUYNOVA — candidato de ingesta pública SEPARADO del Worker privado.
 * Sin dominio, sin ruta ni publicación. No mezclar con APDocentePBA.
 * Ambos flags deben ser literalmente 'true'; siempre cerrados por defecto.
 */
import {createHandler,scheduled as purgeOldRateBuckets} from './contact-handler.mjs';

function fail(status,error) {
  return new Response(JSON.stringify({ok:false,error}),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer'
    }
  });
}

export function createPublicHandler({contactHandler=createHandler()}={}) {
  return async function publicIntake(request,env={}) {
    const pathname=new URL(request.url).pathname;
    // Nunca servir /health, /admin, /api/leads ni cualquier API de lectura.
    if(pathname!=='/api/contact')return fail(404,'NOT_FOUND');
    if(request.method!=='POST'&&request.method!=='OPTIONS')
      return fail(405,'METHOD_NOT_ALLOWED');
    // Compuerta adicional independiente del backend privado.
    if(env.ENABLE_PUBLIC_INTAKE!=='true' ||
       env.ENABLE_CONTACT_SUBMISSIONS!=='true')
      return fail(503,'CONTACT_UNAVAILABLE');
    return contactHandler(request,env);
  };
}

// Preparado para una eventual programación explícita y AUTORIZADA del cron.
 // No existe ningún Cron Trigger en este candidato; Wrangler no declara triggers.
 // Ejecutarlo manualmente en CI prueba el SQL y NO configura Cloudflare.
export async function scheduled(controller,env) {
 await purgeOldRateBuckets(controller,env);
 // Tabla adicional de idempotencia: retener 7 días desde la recepción.
 // Ejecutado sólo cuando exista un Cron Trigger aprobado (ahora NO existe).
 const cutoff=new Date(controller.scheduledTime-7*24*3_600_000).toISOString();
 const result=await env.DB.prepare(
   'DELETE FROM lead_idempotency WHERE created_at < ?'
 ).bind(cutoff).run();
 if(result?.success!==true)throw Error('Idempotency cleanup not confirmed');
}

export default {fetch:createPublicHandler(),scheduled};
