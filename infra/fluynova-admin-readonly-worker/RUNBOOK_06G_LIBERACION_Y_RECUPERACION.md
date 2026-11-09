# FLUYNOVA — Paso 06G: liberación y recuperación del panel administrativo

**Estado al 09/11/2026: NO DESPLEGADO.** Candidato exclusivo de PR #23, base `review/fluynova-public-intake-no-deploy-20261109`. Sin TinyFish. Este documento NO autoriza operaciones ni implica que exista una conexión remota, dominio administrativo, base configurada o servicio de correo real.

## 1. Estado verificable (únicamente local)

- Worker independiente `fluynova-admin-readonly-candidate`: `workers_dev=false`, `preview_urls=false`, `ADMIN_READ_ENABLED="false"`; no tiene `routes`, `assets`, `d1_databases`, crons ni correo.
- API de lectura `GET /api/admin/mail-summary` y tres archivos de interfaz `/admin/dashboard.html`, `.css`, `.js`, todos detrás de la misma verificación JWT RS256 de Access con sujeto autorizado.
- Base de pruebas: D1 LOCAL con datos ficticios, Workerd real y JWKS interceptada. Sin consultas a clientes reales.
- Verificación de liberación: `node tools/release-preflight.mjs --write` y `--check` generan `ADMIN_RELEASE_READINESS.json`. `localSafe=true` comprueba compuertas del repositorio, **no** certifica infraestructura. Los campos `remoteVerified`, `deployAuthorized`, `deployReady` y `safeToDeploy` permanecen `false` sin excepción.
- Los artefactos `fluynova-admin-review-NO-PUBLICAR` y `fluynova-admin-release-readiness-BLOCKED` son materiales de auditoría de CI, nunca autorización ni un sitio web.

## 2. Prerrequisitos de liberación — TODOS PENDIENTES

1. **Recursos y aislamiento:** verificar cuenta Cloudflare, dominio, ruta y D1 exclusivos de FLUYNOVA, separados del resto de proyectos.
2. **Esquema D1:** inspeccionar backend y tablas, PK/índices/constraints y migración `lead_mail_outbox`; comprobar recuperación y existencia del dato remoto sin exponer información de clientes.
3. **Protección de datos:** verificar `version: production` para Time Travel o esquema de respaldos compatible, tomar bookmark efectivo antes de cualquier escritura y confirmar ventana del plan.
4. **Cloudflare Access exclusivo:** verificar aplicación y política por identidad, equipo, tag AUD, subject permitido, dominio y duración de sesión. Evitar accesos desde rutas alternativas.
5. **Protección de todos los recursos:** comprobar HTML, JS, CSS y JSON detrás de Access, y que no existan workers.dev/preview o Pages que eludan la política.
6. **Binding D1 autorizado:** comprobar que solo apunte a la D1 FLUYNOVA; el Worker ejecuta SQL de lectura agregada, pero no posee un rol SQL de solo lectura propio.
7. **Versión anterior y recuperación:** documentar código de última versión estable, política Access vigente, rutas efectivas, configuración y evidencia de recuperación de D1.
8. **Autorización humana en etapas:** solicitudes separadas para esquema, Access, dominio/rutas, despliegue y tráfico. Correos/cron requieren otro permiso.
9. **Pruebas remotas autorizadas:** 200 legítimo, 403 anónimo/otro sujeto, 404 rutas ajenas, 405 métodos de escritura, 503 D1 ausente; no-store/CSP, rotación RSA y ausencia de datos personales.

No usar los resultados del CI como sustituto de esta auditoría.

## 3. Secuencia de liberación CONTROLADA (propuesta; NO ejecutada)

**A — Inspección de solo lectura:** verificar recursos reales, permisos, versión y configuración previas, políticas Access, estado de D1, bookmark/backup compatible y recuperación. Si algo difiere del registro, detener.

**B — Preparación con permisos independientes:** configurar la aplicación Access antes de abrir rutas, comprobar las políticas, migrar únicamente SQL autorizado, verificar D1 y preparar versión candidata sin tráfico público. Un `wrangler deploy` normal puede activar una nueva versión al 100 % de sus rutas. No ejecutar comandos de despliegue desde este runbook.

**C — Habilitación final, bajo aprobación explícita:** aplicar rutas/bindings y cambiar flags solo después del aislamiento Access, ejecutar los smoke tests remotos con datos sintéticos y registrar la versión. Si alguna puerta falla, aislar inmediatamente el acceso por el mecanismo autorizado.

**D — Operación observada:** comprobar errores, disponibilidad, caducidad/rotación de JWT, bypass, políticas y auditoría sin PII. Registrar qué versión está activa. No declarar el servicio en producción sin pruebas de su dominio real.

## 4. Reversión: Worker y D1 son SISTEMAS DIFERENTES

### Worker, ruta y Access

- Primera contención: cerrar acceso por política Access, desasociar ruta o desactivar el servicio según las autorizaciones y controles disponibles. Verificar externamente que usuarios no autorizados no reciben datos.
- El rollback de Cloudflare Workers activa una versión anterior creando otro despliegue; puede llevar el 100 % del tráfico a la versión elegida, incluso desde una distribución gradual. Necesita comprobar versión objetivo y aprobación.
- Revertir código **NO** revierte datos D1. Una versión anterior podría fallar si el esquema cambió. Cloudflare también puede rechazar rollbacks cuando recursos vinculados ya no existen.

### D1 y datos

- Time Travel solo aplica al backend D1 `version: production`. Cloudflare documenta ventanas máximas de 7 días Workers Free y 30 días Workers Paid. Para `alpha` se usan mecanismos antiguos de respaldo; verificar el caso real.
- Un restore de D1 es **destructivo**: sobrescribe datos en la base y puede cancelar transacciones, perdiendo leads nuevos posteriores al bookmark. Requiere autorización específica, evaluación de datos posteriores y verificación de la recuperación.
- Antes de utilizar restauración para una migración fallida, detener tráfico, examinar esquema y datos afectados y comparar opciones. No ejecutar `DROP`, `DELETE` o restauración automáticamente.
- Nunca asumir que revertir una versión Worker justifica restaurar una base D1. Las decisiones deben auditarse de forma separada.

## 5. Criterio de aceptación

**06G local preparado:** CI con tests negativos de alteración de configuración y comandos, reporte `safeToDeploy=false`, módulo admin empaquetado, JWT RSA, HTML autenticado, Chromium con D1 LOCAL y Wrangler `--dry-run`; sin cambios a staging.

**Habilitación real NO terminada:** requiere Access y D1 remotos verificados, autorizaciones independientes, despliegue controlado y E2E remota. El proyecto general permanece en **3/8** pasos cerrados hasta verificar los bloqueos anteriores.

## 6. Documentación primaria

- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

**No publicar, migrar, restaurar, cambiar DNS, enviar correo ni conectar servicios externos sin autorización.**
