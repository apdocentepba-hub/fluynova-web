/**
 * FLUYNOVA — candidato de ingesta pública SEPARADO del Worker privado.
 * Sin dominio, sin ruta ni publicación. No mezclar con APDocentePBA.
 * Ambos flags deben ser literalmente 'true'; siempre cerrados por defecto.
 */
import {createHandler} from '../fluynova-contact-worker/index.mjs';

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

export default {fetch:createPublicHandler()};
