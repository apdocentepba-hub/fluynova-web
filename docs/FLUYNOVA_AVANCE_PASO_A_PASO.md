# FLUYNOVA — hoja de ruta ejecutiva (formulario y diseño)
Actualizado: 2026-11-08 (Paso 04A local aprobado; 04B remoto pendiente). Registro de estado verificable. **Ningún check autoriza por sí solo publicar ni captar datos reales.**

## Objetivo de aceptación
Una persona envía una consulta desde la web de FLUYNOVA, el sistema valida consentimiento y antispam, registra el caso en D1 remoto, presenta un ID **solo si se confirmó la escritura**, permite lectura administrativa autenticada y notifica por email al correo comercial con entrega verificada por separado. Ante cualquier fallo muestra el contacto manual y no pierde datos silenciosamente. La web es clara, adaptable y visualmente profesional.

## Estado previo comprobado
- 30/10: FormSubmit había entregado dos mensajes de prueba a la casilla comercial; después se observaron errores FormSubmit / Cloudflare 522 y episodios 503/carga fría en Render. Eso **no** demuestra que el envío de clientes funcione ahora.
- PR #17: doble bloqueo de recepción y alternativa manual; pruebas locales, sin despliegue.
- PR #21 (esta rama): frontend estático aislado; formulario D1 cerrado, correo manual visible; 34 pruebas previas, con Chromium y backend simulado.
- PR #22: receptor D1 propio, validación de datos, consentimiento, Turnstile, límites HMAC, persistencia confirmada, y Worker privado de staging con Cloudflare Access. No es un endpoint público.
- PR #23: Worker público separado y cerrado. 33 pruebas distintas PASS, 3/3 jobs CI, incluyendo Workerd+D1 LOCAL y Chromium E2E; `workers_dev=false`, `preview_urls=false`, sin rutas ni D1 remota. Cloudflare Access del Worker privado responde con autenticación en consulta anónima.
- Sitio comercial Render `https://fluynova-web.onrender.com/` y correo alternativo `contacto.fluynova@gmail.com` deben preservarse. Las demos Cloudflare Pages tienen fallos de publicación separados.

## Pasos verificables (un hito por interacción, registrar evidencias y bloqueos)
- [x] **01. Gráficos del candidato y presentación profesional.** Mejorar diagramas de flujo, tarjetas y ejemplos de panel manteniendo texto honesto de simulación, sin afectar formulario ni producción. Cierre: cambios versionados en PR #21, QA Chromium escritorio y móvil sin POST, CI aprobada.
- [x] **02. Calidad visual integral.** Verificar accesibilidad (teclado, contraste, reducción de movimiento), móvil y escritorio; revisar enlaces duplicados y demostraciones en contexto real. Cierre: pruebas y capturas del artefacto aislado, informe de defectos corregidos. Ningún deploy.
- [x] **03. Auditoría remota de infraestructura, solo lectura.** Revisar el recurso exacto del Worker privado, configuración y alcance real de Access/WAF, D1 y estado de las dos demos, sin cambiar credenciales ni abrir ruta. Cierre: matriz de activos y bloqueos sustentada en evidencia, con límites claros.
- [ ] **04. Preparar recepción remota segura.** Definir dominio exclusivo, Turnstile real, secretos protegidos y binding D1 exclusivo. Requiere autorización antes de crear recursos, configurar credenciales, conectar endpoints o subir versiones; checklist de seguridad aprobado.
- [ ] **05. Prueba E2E remota aislada con consulta ficticia.** Desde navegador hasta D1 remota, rechazo de CAPTCHA, denegación al apagar recepción, deduplicación y reversión; inspección administrativa restringida y eliminación controlada. Requiere autorización específica; guardar evidencia y dejar tráfico real apagado.
- [ ] **06. Aviso por email con verificación independiente.** Diseñar y validar notificación de consulta almacenada a `contacto.fluynova@gmail.com`; registrar estados separados `stored` y `mail_delivered`, no prometer entrega con HTTP 201; sin enviar mensajes reales sin autorización.
- [ ] **07. Privacidad, recuperación y observabilidad.** Retención, eliminación de datos, respaldos D1, limpieza de rate limit, registro de errores sin PII, revisión de costos y procedimiento de rollback. Cierre: ensayos seguros y documentación.
- [ ] **08. Publicación y aceptación comercial.** Solo con autorización: publicar, comprobar en web real, verificar una recepción de extremo a extremo y preparar monitoreo. Cierre: evidencia completa y fallback a correo manual ante incidentes.

## Reglas de continuidad
- Cada «seguí»: recuperar este archivo y PRs asociados, identificar el primer paso abierto, completar una acción **real y reversible**, leer CI/logs y actualizar fecha, estado y enlace exacto. No reportar un paso como terminado con CI todavía en curso.
- Si un paso requiere permisos de Cloudflare, despliegue, gasto, envío a terceros o cambio de DNS, no ejecutarlo sin aprobación. Avanzar en pruebas/documentación sin publicar.
- No tocar APDocentePBA, VOLVÉ, sistemas escolares o producción Render al actualizar este plan.
- No reemplazar FormSubmit en producción a la fuerza; preservar la web y el correo directo hasta aceptación remota.
- «Gráficos» en este proyecto significa diagramas y presentación visual **de FLUYNOVA**, no el motor gráfico de otros proyectos.

## Paso actual

**PASO 01 — COMPLETADO el 08/11/2026.**
- CSS del diagrama y tarjetas del candidato: prueba Chromium 6/6 y código 29/29, [CI #42532753231](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42532753231). No publicado.

**PASO 02 — COMPLETADO el 08/11/2026.**
- Se corrigió el menú duplicado; breakpoint responsive tablet; foco, Escape y ARIA; cabecera de escritorio; desbordes 320/768 por brillos decorativos; botón de Guardián que tapaba el formulario móvil.
- [CI #42536178157](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42536178157): 2/2 jobs SUCCESS, **29/29 Node + 8/8 Chromium = 37 pruebas distintas**; seis anchos sin scroll horizontal, captura de contacto sin superposición, contraste de muestra **7,02:1**, 12 páginas y 128 enlaces internos sin errores.
- Informe detallado y capturas [FLUYNOVA_VISUAL_QA_PASO02_20261108.md](./FLUYNOVA_VISUAL_QA_PASO02_20261108.md). Sin merge, sin despliegue, sin POST real.
- Límites: no auditoría WCAG total ni pruebas del formulario remoto/Cloudflare.

**PASO 03 — AUDITORÍA DE LECTURA COMPLETADA el 08/11/2026, SIN CERTIFICAR CONFIGURACIONES PRIVADAS.**
- Se cotejó el HEAD de `deploy/fluynova-contact-staging` con GitHub Checks/Cloudflare Workers Builds: [CI #42516720804](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42516720804) SUCCESS (35 pruebas locales), build Cloudflare del Worker privado SUCCESS (versión identificada por check).
- Render conectado: `fluynova-web` último deploy LIVE, rama `main`; GET inicial `/` y `/api/health` devolvió 503, tras reintento dieron contenido y `{"ok":true}`. Ninguna prueba de recepción por email.
- Dos demos Cloudflare Pages responden con contenido público; **ambos builds Pages del último commit staging figuran FAILURE**, por lo cual no se certifican nuevas versiones. También existen las dos demos Render en estado LIVE.
- Worker privado: `workers_dev:true`, `ENABLE_CONTACT_SUBMISSIONS:false`, origen y Turnstile de `.invalid`, D1 configurada; consulta pública `/health` pide login mediante Access. Reglas internas Access/WAF, secretos, índices D1 remotos y permisos **no verificables sin sesión Cloudflare autenticada**.
- **Hallazgo operativo:** el handler `scheduled()` para borrar fingerprints anteriores a ~48–49 h existe, pero no hay `triggers.crons` en staging; recepción debe seguir deshabilitada.
- [Informe y matriz de evidencias](./FLUYNOVA_INFRA_READONLY_PASO03_20261108.md). **Paso 03 cierra el diagnóstico, no una certificación de seguridad**. Se mantienen bloqueantes que impiden la activación.

**PASO 04A — COMPLETADO EN CÓDIGO Y D1 LOCAL el 08/11/2026. PASO 04B REMOTO SIGUE PENDIENTE.**
- PR [#23](https://github.com/apdocentepba-hub/fluynova-web/pull/23): receptor público aislado agregó handler `scheduled()` para limpiar fingerprints HMAC sin borrar la tabla `leads`, conservando `triggers` AUSENTE, flags false, sin dominio ni binding D1 remoto ni nuevos secretos.
- [CI #42538495371](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42538495371): **3/3 jobs SUCCESS**; 7 unitarias, 12 de auditoría, 8 de preparación/reversión, 1 Workerd + D1 LOCAL (incluye cron simulado con SQL real) y 7 Chromium = **35 pruebas distintas PASS**. Wrangler dry-run, sin publicación.
- **Corrección del informe anterior:** la omisión de `triggers` en el `wrangler.jsonc` NO permite deducir si existe un cron efectivo en el Worker remoto: Cloudflare preserva cron existentes al omitirlos. La limpieza aún debe comprobarse autenticadamente en Settings → Triggers. Un cron diario puede dar ~48–73 h de retención, no una cota de ~48–49 h.
- [Plan de conexión remota y bloqueos](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-public-intake-isolated-20261108/infra/fluynova-public-intake-worker/PASO04_PREPARACION_REMOTA.md): Access/WAF, widget Turnstile, D1 y tres índices, dominio, cron real, versionado y Time Travel. No hay sesión Cloudflare autenticada conectada al navegador del asistente.
- **NO cerrar el Paso 04 como terminado:** falta comprobar y, con permiso, configurar los recursos remotos; los flujos siguen cerrados.

**04B — AVANCE: E2E CON DISEÑO ACTUALIZADO — 08/11/2026 (todavía sin Cloudflare autenticado).**
- Detectado y corregido fixture obsoleto: PR #23 (`fluynova-public-intake-candidate`) verificaba el frontend viejo `06af3d1`, no los cambios visuales del PR #21. Ahora fija el commit real `570a6ac` del candidato auditado.
- Se agregó escenario Chromium con visual y contacto cerrado: 320/390/900/1366 px sin scroll lateral, menú con Escape, un acceso `/webs/`, sin solapamiento de Guardián, alternativa por correo y 0 POST remoto.
- [CI #42541540967](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42541540967): **SUCCESS 3/3 jobs**. **36 pruebas distintas** (7 unitarias + 12 auditoría + 8 readiness + 1 Workerd/D1 LOCAL + 8 Chromium), Wrangler `--dry-run`. No prueba D1 remota ni email.
- Se habilitó enlace de inicio de sesión seguro Cloudflare mediante conector de navegador, sin sesión confirmada ni acceso todavía. Las políticas remotas y los secretos permanecen **no verificados**. No se ejecutó ninguna modificación Cloudflare, Render, D1 ni dominio.
- **PASO 04 sigue abierto** hasta que pueda auditarse/configurarse el servicio remoto con aprobación específica.

**04B — SEGURO CONTRA MUTACIONES REMOTAS — 08/11/2026 (validado en CI, remoto pendiente).**
- Se revisó `release-guard.mjs` de PR #23: el auditor anterior rechazaba `wrangler deploy`, pero dejaba fuera otras operaciones como `wrangler versions upload/deploy`, `secret put`, `triggers deploy`, `d1 execute --remote` y despliegues Pages.
- Se incorporó una prohibición de comandos conocidos de mutación, acciones Cloudflare, credenciales/API en el **workflow de esta rama** y scripts `package.json` fuera de los dos permitidos. Se añadieron controles de estabilidad para los orígenes y rutas del Worker privado.
- **[GitHub Actions #42546544055](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42546544055): SUCCESS 3/3 jobs**. 7 unitarias + 16 auditoría de seguridad (4 nuevas) + 8 readiness + 1 Workerd con D1 **LOCAL** + 8 E2E Chromium = **40 pruebas distintas aprobadas**, y Wrangler `--dry-run` en dos jobs. No se tocó Cloudflare remoto.
- La documentación oficial confirma que `wrangler secret put` muta y despliega inmediatamente, mientras `versions upload` sube versiones sin publicarlas; ninguno corresponde a un workflow de PR de solo pruebas.
- Se comprobó el perfil del navegador: **Cloudflare todavía NO figura como sesión autenticada guardada**, por lo que no es posible confirmar Access/WAF, D1 remota, Trigger efectivo, Turnstile ni permisos. Se habilitó previamente un acceso de configuración de perfil para que el usuario inicie sesión sin compartir credenciales en el chat.
- Paso 04B **abierto**: se redujo el riesgo de cambios accidentales desde GitHub, pero no se activó recepción ni se completó el trabajo remoto.

**04C — IDEMPOTENCIA TRANSACCIONAL — 08/11/2026 (implementada y verificada LOCALMENTE, remoto pendiente).**
- El frontend del PR #21 envía un UUIDv4 `request_id` estable ante una respuesta perdida, sin reutilizar el token de Turnstile; al cambiar el borrador crea una intención nueva. Solo acepta HTTP 201 confirmado o HTTP 200 con `duplicate:true`, ID válido y `stored:true`.
- El Worker público del PR #23 valida ese UUID y añade una capa idempotente **solo cuando `ENABLE_PUBLIC_INTAKE=true`**. La reserva por clave y el registro `leads` se realizan dentro de `D1.batch` transaccional. Dos solicitudes simultáneas iguales generan **un único lead**; reintento devuelve el mismo ID, cambio de datos con misma clave devuelve HTTP 409. Faltando tabla D1, falla cerrado con HTTP 503.
- Esquema adicional separado `infra/fluynova-public-intake-worker/idempotency.schema.sql` **solo en repo/CI**; no migrado a D1 remota. Limpiador de claves preparado para siete días; sin cron remoto certificado. Este paso **no altera** el Worker privado desplegado.
- [CI frontend #42547960794](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42547960794): SUCCESS 29 unitarias + **10 Chromium**. [CI receptor #42547985836](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42547985836): **3/3 jobs SUCCESS**, 7 unitarias, 16 auditoría, 8 readiness, 1 integración D1 **LOCAL**, **9 Chromium** = 41 pruebas distintas. Un E2E reproduce 503 al navegador **después** de SQL exitoso y demuestra segundo POST con mismo UUID, CAPTCHA nuevo y la misma fila. No usar estos PASS como evidencia de Turnstile o D1 remotos.
- Se detectó un error de sintaxis del cliente durante CI y se corrigió. La suite final del frontend pasó después; no declarar exitosos los intentos intermedios fallidos. Ambos PR siguen en DRAFT.
- **04B REMOTO AÚN BLOQUEADO:** falta sesión Cloudflare autenticada, dominio, Turnstile real, inspección de D1, migración y cron con aprobación. Progreso global continúa **3/8** hasta cerrar efectivamente el Paso 04.

**04D — MIGRACIÓN D1 LOCAL Y REVERSIÓN — 08/11/2026 (ensayo aprobado; operación remota pendiente).**
- Nuevo [auditor de esquema D1 de lectura](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-public-intake-isolated-20261108/infra/fluynova-public-intake-worker/schema-preflight.mjs) en PR #23. Comprueba tablas, columnas, índices, PK, NOT NULL y UNIQUE sin leer ni registrar contactos. Una migración existente pero incompleta se rechaza en lugar de suponer que `IF NOT EXISTS` la corrige.
- Se creó [ensayo de migración/reversión](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-public-intake-isolated-20261108/tests/fluynova-public-intake-schema-preflight.test.mjs) en D1 **LOCAL**: inserta lead ficticio antiguo, aplica migración, repite aplicación, verifica constraints, vacía sólo la tabla nueva y ensaya quitarla sin perder el lead anterior; un esquema parcial/incorrecto no pasa preflight. **No** equivale a Time Travel ni backup de Cloudflare.
- [CI PR #23 #42549694618](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42549694618) **SUCCESS 3/3 jobs, 43 pruebas distintas**, incluidos 2 nuevos ensayos D1 local (7 unitarias, 16 auditoría, 8 readiness, 1 integración Workerd/D1 local, 2 migración D1 local y 9 Chromium). Wrangler dry-run; ningún cambio remoto.
- [Informe y procedimiento de migración](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-public-intake-isolated-20261108/infra/fluynova-public-intake-worker/MIGRACION_D1_PASO04_LOCAL.md) identifica preflight autenticado, bookmark de Time Travel si compatible y autorizado, postchecks y diferencias entre rollback Worker/restauración D1.
- **PASO 04B REMOTO AÚN BLOQUEADO**: sesión Cloudflare no conectada, esquema remoto/backup Access/WAF/Turnstile/cron no auditados. Antes de aplicar migración se necesita autorización específica. Progreso general continúa **3/8 pasos**.

**04E — INTEGRIDAD DEL ESQUEMA BASE Y ALLOWLIST SQL — 08/11/2026 (LOCAL APROBADO).**
- El auditor de esquema de PR #23 verificaba columnas e índices, pero no las PK/NOT NULL de las dos tablas originales. Se corrigió: debe constar `leads.id` como PK y `lead_rate_limit(fingerprint,hour_bucket)` como PK compuesta, además de NOT NULL en columnas esenciales. Dos nuevos ensayos en D1 **LOCAL** simulan bases deformadas y confirman que se bloquean aun con columnas e índices presentes.
- Nuevo `migration-guard.mjs`, conectado con `release-guard.mjs`: **solo acepta dos instrucciones aditivas exactas** de `idempotency.schema.sql` (crear la nueva tabla y su índice), y rechaza eliminar/modificar restricciones, alterar tabla destino o añadir `DROP/DELETE/UPDATE/ALTER/CREATE TRIGGER`. Dos nuevas pruebas negativas cubren modificaciones peligrosas.
- [GitHub Actions #42551401701](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42551401701): **SUCCESS 3/3 jobs, 47 pruebas distintas** (7 unitarias + 18 seguridad + 8 readiness + 1 integración D1 local + 4 migración D1 local + 9 Chromium), Wrangler `--dry-run`; datos totalmente ficticios, sin red Cloudflare real.
- [Informe de migración y reversión actualizado](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-public-intake-isolated-20261108/infra/fluynova-public-intake-worker/MIGRACION_D1_PASO04_LOCAL.md). El guard no autoriza aplicaciones ni prueba el estado remoto. Falta sesión Cloudflare autenticada, verificación de la D1 real y recuperación efectiva.
- **Paso 04B sigue BLOQUEADO** por falta de acceso Cloudflare; avance global **3/8 pasos completados**, pendiente habilitación segura remota.

**04F — DESACOPLE DEL WORKER PRIVADO — 08/11/2026 (implementado y probado localmente).**
- Se detectó que el PR #23 importaba el manejador desde `infra/fluynova-contact-worker/index.mjs` (Worker privado) y que, para implementar la deduplicación, se habían agregado **63 líneas a ese archivo** en la feature. Aunque sin despliegue, era un acoplamiento peligroso para una rama cuya base es `deploy/fluynova-contact-staging`.
- Se creó el módulo independiente `infra/fluynova-public-intake-worker/contact-handler.mjs` y el `index.mjs` público ahora importa de ese archivo **dentro de su propia carpeta**, sin tocar el código privado. El archivo `infra/fluynova-contact-worker/index.mjs` se restauró byte a byte a la versión staging (Git blob `d1811e9bf4a35bec0baecbe05ab3833d8360e536`). La comparación GitHub entre ramas confirma **0 archivos privados modificados**.
- El guard de CI verifica hash del archivo privado, import local y ausencia de imports privados en el nuevo handler. Se agregaron **3 pruebas negativas** y la CI escucha también cambios en la carpeta del Worker privado de la feature.
- [GitHub Actions #42552344333](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42552344333): **SUCCESS 3/3 jobs, 50 pruebas distintas** (7 unitarias, 21 auditoría, 8 readiness, 1 Workerd+D1 local, 4 migración local, 9 Chromium). Wrangler `--dry-run`, sin modificar Cloudflare real.
- [Detalle técnico y advertencia de merge](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-public-intake-isolated-20261108/infra/fluynova-public-intake-worker/SECURITY_AND_RELEASE.md): el PR #23 continúa dirigido a una rama que dispara despliegues y sigue **DRAFT / NO MERGE**. Desacoplar código no elimina ese riesgo de fusión.
- El acceso Cloudflare sigue sin sesión autenticada; **Paso 04B remoto permanece pendiente** y el progreso general es **3/8**. No se desplegó ni probó D1 remota, Access/WAF, Turnstile ni correo.

**SIGUIENTE ACCIÓN — 04B.** Verificar configuraciones reales de Cloudflare mediante sesión autorizada; separar claramente Access privado del receptor público, y preparar vinculación a D1 con recuperación verificada antes de cualquier POST remoto.
