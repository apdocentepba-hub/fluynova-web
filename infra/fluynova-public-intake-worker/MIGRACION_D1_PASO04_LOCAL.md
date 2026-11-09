# FLUYNOVA · Paso 04D — ensayo de migración D1 con reversión de esquema LOCAL

**Fecha de corte:** 2026-11-08, Buenos Aires. **Estado:** ensayo aprobado en GitHub, **SIN ejecutar SQL remoto**. Este informe es un procedimiento de auditoría, no una autorización para operar Cloudflare.

## Realizado

- Se creó `schema-preflight.mjs`, un auditor **exclusivamente de solo lectura** que recibe un binding D1 y consulta `sqlite_master` y `PRAGMA table_info/index_info/index_list`. No consulta las filas `leads` ni `lead_rate_limit`, no recibe secretos y devuelve `remoteVerified:false` / `approvedToMigrate:false`.
- El auditor exige las **2 tablas antiguas**, sus **3 índices** con columnas correctas, y cuando existe `lead_idempotency`, sus **5 columnas obligatorias**, `request_id` como clave primaria, campos NOT NULL, `lead_id` UNIQUE y el índice `lead_idempotency_created_at` sobre `created_at`.
- `tests/fluynova-public-intake-schema-preflight.test.mjs` prepara D1 **LOCAL** con esquema anterior y consultas **ficticias** (`example.invalid`), aplica la migración adicional, comprueba la conservación de consultas/huellas anteriores, aplica el SQL por segunda vez y comprueba que es idempotente.
- El mismo ensayo rechaza `request_id` duplicado y `lead_id` repetido; elimina primero los registros ficticios nuevos y ensaya quitar **solo** el índice y tabla `lead_idempotency`, sin alterar la tabla `leads`, `lead_rate_limit` ni sus registros. En una segunda base local simula una tabla con columnas correctas pero sin PK, UNIQUE y NOT NULL: el preflight la rechaza sin proponer automáticamente otra migración.
- El workflow `.github/workflows/fluynova-public-intake-candidate.yml` ejecuta el preflight, el nuevo ensayo de D1 local y los demás tests de seguridad con **Wrangler `--dry-run` únicamente**.

## Resultados verificados

- [GitHub Actions #42549694618](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42549694618): **3/3 jobs SUCCESS**; **43 pruebas distintas PASS**: 7 unitarias, 16 auditoría de seguridad, 8 readiness, 1 integración Workerd+D1 local del receptor, **2 nuevas de migración**, y 9 E2E Chromium.
- Logs: `FLUYNOVA_D1_MIGRATION_LOCAL_PASS` (registros anteriores conservados, migración repetida y reversión de tabla local); `FLUYNOVA_D1_PARTIAL_SCHEMA_FAIL_CLOSED_PASS` (esquema falso o incompleto rechazado), `PUBLIC_INTAKE_BROWSER_IDEMPOTENCY_RETRY_PASS` (un lead después de dos POST).
- Los tests incluyen aserción de que el auditor solo prepara instrucciones SQL de metadatos. El ensayo de reversión es **local** y elimina la tabla nueva únicamente una vez vacía.
- **No es un backup de Cloudflare ni un test de Time Travel**: no certifica permisos reales, bookmark, base remota, retención, límites, cron, secretos, DNS, notificaciones ni una restauración remota.

## Paso 04E — endurecimiento de integridad y revisión de SQL (verificado LOCAL)

- `schema-preflight.mjs` ahora inspecciona, además de nombres y columnas, las claves primarias y restricciones NOT NULL **de las tablas originales** `leads` y `lead_rate_limit`. En particular exige `leads.id` como PK y `lead_rate_limit(fingerprint,hour_bucket)` como PK compuesta en ese orden. Una base que conserva todas las columnas e índices secundarios pero perdió esas claves se declara `baseReady=false` y **no puede considerarse apta para migración**.
- Dos nuevas pruebas en `tests/fluynova-public-intake-schema-preflight.test.mjs` crean versiones defectuosas de ambas tablas en D1 **LOCAL** y confirman el rechazo; no tocan ninguna D1 remota.
- `migration-guard.mjs` establece una allowlist de **exactamente dos sentencias** para `idempotency.schema.sql`: `CREATE TABLE IF NOT EXISTS lead_idempotency (...)` con PK, UNIQUE y NOT NULL verificados, y `CREATE INDEX IF NOT EXISTS lead_idempotency_created_at ON lead_idempotency(created_at)`. Cambiar el índice de tabla, quitar restricciones, introducir columnas no auditadas o agregar `DROP`, `DELETE`, `UPDATE`, `ALTER` o `CREATE TRIGGER` rompe el control de liberación.
- `release-guard.mjs` ahora lee esa migración y exige `auditMigrationSql(...).safe=true`. Dos pruebas nuevas ejercitan cambios peligrosos y permiten comentarios sin modificar SQL. El control no reescribe, ejecuta, migra ni autoriza D1.
- [GitHub Actions #42551401701](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42551401701): 7 pruebas unitarias, 18 de seguridad, 8 de readiness, 1 integración Worker+D1 local, 4 de migración D1 local y 9 Chromium E2E = **47 pruebas distintas** cuando los tres jobs terminen `SUCCESS`. El ensayo de SQL y schema no sustituye inspección autenticada de la base real.
- Los fallos de las primeras pruebas de regresión se debieron al escape incorrecto de `\\b` en el código de pruebas; se corrigieron y se volvieron a ejecutar, sin modificar datos remotos.

## Procedimiento remoto propuesto — BLOQUEADO hasta nueva autorización

1. **Inspección autenticada de solo lectura**: confirmar cuenta y base exactamente `fluynova-leads-staging`, UUID de D1 `ce8ac477-dd77-4a1c-a42e-6096dcb78768`, subsistema `version: production` o `alpha`, que el Worker privado sigue bajo Access y el receptor público sin ruta ni flags activados. Si no coinciden identificadores, detener.
2. **Preflight real sin datos personales**: leer `sqlite_master` y `PRAGMA` para constatar dos tablas y tres índices correctos y ausencia de la tabla nueva. Si está parcialmente migrada o el esquema existente difiere, detener. Verificar con qué cuenta/autorización se haría la migración sin modificar nada.
3. **Protección previa**: comprobar qué mecanismo de recuperación ofrece esa base. Si es Time Travel compatible, **registrar el bookmark real inmediatamente antes de migrar**; comprobar la política efectiva de retención según plan y versión. Registrar tamaños/contadores si están disponibles sin exponer datos de contactos. Guardar la versión de Worker estable y un procedimiento operativo.
4. **Escritura separada, requiere aprobación explícita**: aplicar únicamente `idempotency.schema.sql` a la base verificada, con ambos flags de recepción todavía desactivados. No usar el SQL en otra D1, no tocar APDocentePBA y nunca desplegar Worker's routes como parte de esa acción.
5. **Verificación posterior de solo lectura**: el auditor debe constatar tres tablas y cuatro índices de negocio, PK/UNIQUE y NOT NULL; verificar que las tablas antiguas y sus índices siguen presentes; comprobar que las consultas históricas permanecen sin exponer su contenido.
6. **Fallos**: ante migración incompleta, detener recepción; no aplicar a ciegas `DROP`, `DELETE` o un restore. Reversión de versión Worker **no** revierte D1. Una reversión real de Time Travel **sobrescribe la base, puede cancelar operaciones y eliminar datos posteriores al bookmark**, por lo que exige autorización específica, evaluación de datos nuevos y posibilidad de recuperación.
7. **Sólo después**, y con autorizaciones independientes: verificar Access/WAF, dominio y Turnstile reales, secrets, D1 binding, Cron Triggers efectivos, privacidad y pruebas de consulta ficticia, correo y plan final de publicación.

## Restricciones explícitas

- `canApplyInIsolatedLab=true` significa **solo compatibilidad técnica del esquema**, jamás permiso de aplicar SQL remoto.
- Una migración con `CREATE TABLE IF NOT EXISTS` no corrige una tabla incorrecta preexistente: el preflight la rechaza en vez de declararla lista.
- No usar `wrangler d1 time-travel restore` para un ensayo de laboratorio: es una operación destructiva remota.
- Según la documentación vigente de Cloudflare, Time Travel solo funciona para D1 con `version: production`; en Workers Free la ventana histórica es **hasta 7 días**, y en Workers Paid es **hasta 30 días**. No se comprobó el plan ni `version` de la D1 remota de FLUYNOVA. Revalidar vigencia y bookmark real antes de cualquier operación. Fuente: https://developers.cloudflare.com/d1/reference/time-travel/ .
- Durante el ensayo local nunca se conectó a `api.cloudflare.com` ni se manejaron credenciales Cloudflare.

## Documentación técnica de referencia

- https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/get_bookmark/

**Estado de liberación: `SAFE_CLOSED` / `READ_ONLY_NOT_DEPLOYED`. Paso 04B remoto pendiente.**
