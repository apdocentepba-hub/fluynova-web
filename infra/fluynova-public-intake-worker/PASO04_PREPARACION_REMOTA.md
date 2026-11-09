# FLUYNOVA · Paso 04 — preparación remota, sin desplegar

Estado del hito: **04A preparación de código y pruebas locales** (implementada en el PR #23); **04B conexiones remotas y habilitación** (BLOQUEADA hasta evidencia y autorización).

## Lo que se implementó en el candidato
- El nuevo Worker público `fluynova-public-intake-candidate` sigue cerrado: `workers_dev=false`, `preview_urls=false`, **sin rutas ni binding D1 ni triggers**; `ENABLE_PUBLIC_INTAKE=false` y `ENABLE_CONTACT_SUBMISSIONS=false`. No está conectado a la web comercial.
- Se agregó export `scheduled()` que utiliza la limpieza parametrizada `DELETE FROM lead_rate_limit WHERE hour_bucket < ?`, no accede a `leads` y falla si no hay DB o no se confirmó SQL. No registra IP claro ni envia datos. **Solo código preparado: no creó cron remoto.**
- Pruebas unitarias: validación del SQL, límite temporal, rechazo de D1 ausente/resultado fallido; Workerd con D1 local para borrado de huellas viejas, conservación de actuales y de lead ya guardado. Siteverify sigue interceptado durante las pruebas.
- El release readiness añade la verificación de **Cron Triggers efectivos** como bloqueo. Ausencia de `triggers` en Git no prueba ausencia del cron remoto al desplegar sobre un Worker existente: Cloudflare mantiene los cron anteriores cuando se omiten `triggers`/`crons`.

## Evidencia que falta para cerrar 04B (Cloudflare autenticado, solo lectura al comenzar)
| Elemento | Evidencia necesaria | Condición |
| --- | --- | --- |
| Identidad/ámbito | Confirmar cuenta/Worker exacto `fluynova-public-intake-candidate`, separado de `fluynova-contact-staging-only` y de APD; permisos del token; cuenta y versiones | No crear ni modificar Workers hasta autorización |
| DNS/dominio | Dominio/hostname exclusivo bajo control; ruta prevista `/api/contact`; comprobar previews, Worker routes/custom domains y políticas Access globales/por Worker/hostname | No abrir bypass global ni exponer Worker privado |
| Turnstile | Widget separado de FLUYNOVA, hostname permitido y acción `contact`; evidencia de existencia de sitekey **pública**, comprobación de que el secret está **almacenado en Cloudflare** sin mostrarlo | Siteverify obligatorio en backend; secretos fuera de repo, chat y frontend |
| D1 | Base `fluynova-leads-staging`, UUID `ce8ac477-dd77-4a1c-a42e-6096dcb78768` conocida por evidencia histórica; verificar con lectura autenticada identidad, permisos, tablas e índices | En la activación pública, binding `DB` aislado exclusivamente a FLUYNOVA, sin bases ajenas |
| Esquema SQL | Consulta **SELECT solo lectura**: `SELECT type,name,tbl_name FROM sqlite_master WHERE name IN ('leads','lead_rate_limit','leads_received_at','leads_status','lead_rate_limit_hour') ORDER BY type,name;` | Esperado: 2 tablas + 3 índices; no borrar ni migrar sin autorización |
| Limpieza | Inspeccionar **Settings → Triggers → Cron Triggers** de todos los Workers FLUYNOVA que podrían usar esta D1, y el ownership del mantenimiento | No inferir estado efectivo del archivo Wrangler; cron requiere permiso y build aislado |
| Recuperación | Identificar la versión real y el plan de datos; consultar compatibilidad Time Travel vía `wrangler d1 info` **solo lectura** si hay acceso autorizado | Antes de modificar: bookmark e inventario; restauración D1 es destructiva y no equivale a rollback Worker |
| Privacidad/operación | Acceso administrativo protegido, política de retención de datos y eliminación, respuesta a fallos, observabilidad sin PII, límite de costos | No permitir datos personales hasta cumplir |
| Aprobaciones | Autorización específica para **cada** creación de recurso, cambio de secreto/binding/ruta/cron, despliegue y test con POST ficticio | Los tests y este documento NO son aprobación |

## Política de mantenimiento y retención
Cloudflare ejecuta Cron Triggers en UTC. Para el SQL actual, un cron **cada hora** `0 * * * *` podría dejar fingerprints ~48–49 horas; uno **diario** `0 4 * * *` podría dejarlos ~48–73 horas. Son estimaciones teóricas; hay que comprobar ejecuciones reales, propagación de configuración y retención deseada. No añadir el cron a `wrangler.jsonc` hasta que se confirme el Worker y los permisos: en Cloudflare hubo un fallo previo al intentar publicar un cron en staging, cuya causa no se certificó.

## Estado de permisos
No hay sesión autenticada de Cloudflare en el conector de navegador de esta conversación. No es posible verificar aquí las reglas Access/WAF, secretos, bindings remotos ni los cron efectivos. Para continuar 04B se requiere conectar una sesión de Cloudflare de modo seguro (nunca solicitar contraseña en el chat) o una integración equivalente autorizada.

## Fuentes y alcance
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/d1/reference/time-travel/
- `infra/fluynova-public-intake-worker/RELEASE_AND_ROLLBACK.md`

**NO MERGE — NO DEPLOY — SIN CONFIGURAR CRON — SIN POST REMOTO — SIN MODIFICAR RENDER.**
