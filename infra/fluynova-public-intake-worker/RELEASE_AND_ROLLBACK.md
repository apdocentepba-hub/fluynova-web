# FLUYNOVA — despliegue y reversión bajo autorización (NO ejecutar aún)

**Alcance:** candidato `fluynova-public-intake-candidate`, PR #23, rama `feature/fluynova-public-intake-isolated-20261108`. NO corresponde a `fluynova-contact-staging-only` ni a APDocentePBA. Este documento no autoriza un despliegue ni habilita tráfico.

## 1. Preparación sin efectos remotos

El comando `node infra/fluynova-public-intake-worker/release-readiness.mjs` genera un informe local **READ_ONLY_NOT_DEPLOYED**. Requiere `safeClosed=true` y `configurationFailures=[]`; `canDeploy=false` y `canEnableTraffic=false` son correctos hasta contar con evidencia externa y aprobación. GitHub ejecuta la revisión automáticamente en CI y falla si el auditor de seguridad anterior detecta cambios inesperados.

Antes de iniciar operaciones remotas, verificar por separado la titularidad del dominio público, el posible alcance de Cloudflare Access a nivel de cuenta, las reglas WAF por nombre de Worker, permisos, costos y límites. **No crear un bypass de Access para toda la cuenta ni quitar el Access del Worker privado.** Cloudflare evalúa políticas de hostname/ruta, luego Worker, luego cuenta. Si es necesaria una excepción, debe ser individual y auditada para el Worker nuevo.

## 2. Checklist de integración futura (sin ejecutar)

1. Identificar dominio público de recepción exclusivamente FLUYNOVA, y mantenerlo sin ruta activa hasta aprobación.
2. Crear widget Turnstile separado para ese dominio. El `sitekey` es público; `TURNSTILE_SECRET_KEY` es secreto y **nunca** debe estar en Git, chat, frontend ni archivos `wrangler.jsonc`. Siteverify debe comprobar `success`, `action='contact'` y hostname permitido. Los tokens expiran tras 300 s y son de un solo uso.
3. Validar por ID y cuenta la D1 de FLUYNOVA; verificar esquema, permisos, límites y política de retención/borrado. El receptor público hoy deliberadamente carece de binding D1. Decidir explícitamente si corresponde vincularlo con una D1 FLUYNOVA ya existente o con una nueva; nunca presumir que compartir D1 con un Worker privado está autorizado.
4. Capturar referencia de versión segura, configuración, bindings D1 y reglas Access/WAF. Para D1 nueva en almacenamiento de producción, obtener un **bookmark de Time Travel** antes de cualquier migración/ensayo de escritura. Consultar primero si D1 admite Time Travel; no todas las bases antiguas son compatibles.
5. Revisar el efecto operacional de configurar secretos: `wrangler secret put` normalmente crea/despliega una nueva versión. Para preparar sin activar, evaluar herramientas de versiones y secret conforme a la documentación vigente y exigir aprobación antes de hacer cambios.
6. Recién cuando el entorno remoto y la privacidad estén verificados, diseñar prueba con **datos totalmente ficticios**, dos compuertas inicialmente cerradas y control de eliminación del registro de prueba. Aprobación específica antes de desplegar o habilitar.

## 2.A. Limpieza segura de huellas HMAC — preparación de código, no cron remoto

- El receptor público incorpora un manejador `scheduled()` que reutiliza la limpieza SQL del Worker privado, limitada a `DELETE FROM lead_rate_limit WHERE hour_bucket < ?`. **No consulta ni elimina la tabla `leads`**. Solo puede trabajar si se vincula D1 y el Scheduler lo invoca.
- El candidato actual mantiene `wrangler.jsonc` **sin `triggers`** y el auditor los sigue rechazando: no crea un cron ni modifica Cloudflare. Los tests ejercitan solo el handler sin conectar D1 remota.
- Precisión importante: la documentación de Cloudflare indica que, si se **omiten** `triggers`/`crons` en un despliegue, pueden **conservarse** los disparadores remotos existentes. Por eso, **la falta de `triggers` en Git no demuestra cron desactivado en un Worker que ya existe**; tampoco debe inferirse que hay cron. Revisar el apartado **Settings → Triggers → Cron Triggers** y el Worker exacto autenticadamente antes de cualquier cambio. Nunca publicar `triggers:{crons:[]}` sobre un Worker existente sin autorización, porque eso elimina sus cron.
- La condición SQL purga buckets de hora que tienen más de 48 horas completas, pero **su permanencia real depende del intervalo entre ejecuciones**. Si se ejecuta una vez por día (por ejemplo `0 4 * * *` UTC), un registro puede durar aprox. 48–73 horas; si se ejecuta una vez por hora (`0 * * * *`), aprox. 48–49 horas. Definir retención y verificar el cron efectivo antes de anunciar un máximo garantizado.
- Propuesta para revisión cuando se autorice el recurso público: evaluar un disparador **horario** exclusivamente en el Worker público y en la D1 que se apruebe. Si el Worker privado comparte la misma base, **verificar quién es dueño del mantenimiento** para evitar dos programaciones distintas. El alta/configuración del trigger es un cambio remoto y podría necesitar permisos/build separados; el despliegue con cron falló previamente y no hay error íntegro verificado.
- Antes de habilitar la ingesta: comprobar cron efectivo real (versión y hora), métricas de ejecuciones, permiso y binding D1, y que una prueba local con buckets antiguos borre solo fingerprints. No borrar ni restaurar la base remota por este trabajo preparatorio.

Fuentes oficiales: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/). Time Travel no sustituye copias independientes ni restaura datos automáticamente al revertir un Worker.

## 3. Contención / reversión si alguna vez se aprueba el servicio

**Orden ante incidente**:

1. Identificar exactamente el Worker nuevo, la versión activa y las rutas; distinguirlo del Worker privado. Detener la aceptación de solicitudes mediante las dos compuertas de recepción o desasociar la ruta, **según el mecanismo más seguro para el estado remoto real**. Toda modificación remota exige autorización salvo respuesta a incidente previamente autorizada.
2. Comprobar desde fuera que el Worker público devuelve estado no aceptado y que no persiste ninguna fila nueva. Registrar evidencia y fecha.
3. Solo si se dispone de un **ID de versión previamente certificado**, con ambas compuertas apagadas, binding D1 compatible y políticas Access revisadas, considerar rollback del Worker. `wrangler rollback <VERSION_ID>` despliega esa versión inmediatamente al tráfico; NO ejecutar sin revisar esos datos y consentimiento. Usar `reviewRollback(...)` (solo memoria, sin efectos) para identificar riesgos.
4. **No restaurar D1 automáticamente** por revertir código. El rollback del Worker no revierte D1; una restauración D1 Time Travel reemplaza datos en el lugar y puede perder consultas legítimas posteriores al punto elegido. Requiere decisión y aprobación separadas con evaluación de pérdida de datos y bookmark reversible.
5. Revalidar políticas Access, flags, CORS, rate limit, Turnstile, estado remoto y web comercial; dejar registro de qué se hizo y qué datos quedaron afectados.

## 4. Límites del estado actual

El PR #23 continúa en borrador y sin integración en la rama de despliegue Cloudflare. El Worker independiente **no existe en Cloudflare**, no tiene URL pública, dominio, secreto ni binding remoto. Las pruebas certifican únicamente el código y D1 **LOCAL**. **No podemos registrar todavía un ID real de versión previa del nuevo Worker**, ni un bookmark de una D1 vinculada a ese Worker. No se debe inventar ninguno.

## Fuentes oficiales contrastadas (noviembre de 2026)

- Cloudflare Workers Access: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Cloudflare Workers rollback: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Cloudflare Workers versions and deployments: https://developers.cloudflare.com/workers/versions-and-deployments/
- Cloudflare secrets y comandos: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Cloudflare Turnstile Siteverify: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
