# FLUYNOVA — candidato a receptor público, SIN publicar

## Separación real de código — 04F (8 de noviembre de 2026)

**Hallazgo confirmado** al comparar la feature con `deploy/fluynova-contact-staging`: aunque el Worker de contacto público estaba configurado con su propio nombre, `index.mjs` importaba el handler desde `../fluynova-contact-worker/index.mjs`. Para habilitar idempotencia se habían agregado **63 líneas de código** al archivo del **Worker privado de staging**, ampliando el riesgo de que un merge alterara un servicio que debe permanecer protegido.

**Corrección aplicada en la feature aislada PR #23:**

- Se creó `infra/fluynova-public-intake-worker/contact-handler.mjs`, módulo autocontenido con validación del formulario, Siteverify, almacenamiento D1, rate limiting e idempotencia. El público `index.mjs` ahora importa `./contact-handler.mjs`, **nunca el módulo de staging**.
- Se restauró el archivo `infra/fluynova-contact-worker/index.mjs` al **mismo Git blob SHA-1** que la rama base: `d1811e9bf4a35bec0baecbe05ab3833d8360e536`. La comparación final entre feature y staging ya no debe contener este archivo como modificado. Restaurar el archivo **de la rama feature** no cambia un Worker remoto.
- `release-guard.mjs` ahora comprueba el hash de contenido del archivo privado, el import local del receptor público y la ausencia de imports desde staging en el handler autocontenido. GitHub Actions se ejecuta también ante cambios en `infra/fluynova-contact-worker/**` **dentro de esta rama feature** para evitar que pasen inadvertidos. Tres pruebas nuevas provocan modificaciones y dependencias cruzadas simuladas; se espera `SAFE_CLOSED=false` ante cualquiera de ellas.
- El comportamiento funcional se vuelve a ejecutar en **Workerd + D1 local + Chromium** con Turnstile simulado, sin nube ni datos personales reales. La verificación del archivo privado se basa en el snapshot de staging del momento; si la rama base cambia legítimamente, habrá que revisar el diff, no desactivar silenciosamente el guard.

**Limitación decisiva:** el PR #23 todavía tiene como rama de destino `deploy/fluynova-contact-staging`, la cual puede producir builds automáticos **si se fusiona**. Por eso **sigue en borrador y no debe fusionarse**. Esta corrección elimina del diff cambios al archivo privado, pero **no autoriza merges, cambios de ramas, CI remoto privilegiado ni despliegues**.

## Por qué es independiente
El Worker actual `fluynova-contact-staging-only` está protegido por Cloudflare Access para **todo el tráfico**. Según Cloudflare, Access intercepta solicitudes ANTES de que lleguen al código del Worker. No desactivar su protección para habilitar un formulario de clientes.

Este candidato usa un **nombre diferente**: `fluynova-public-intake-candidate`. No tiene dominios, rutas, bindings D1 ni `workers.dev` público, **no se conecta a GitHub Builds** y no existe ningún despliegue remoto de este componente. Vive solo en una rama feature. No hereda ni concede acceso a funciones privadas de otros Workers.

## Alcance de la desactivación de rutas

`workers_dev=false` y `preview_urls=false` cierran explícitamente la ruta tradicional `*.workers.dev` y las URLs de vista previa de Wrangler. Los flujos especiales de Preview y Deployment pueden tener configuración propia, por lo que **si algún día se desplegara**, hay que comprobar rutas y políticas Access reales antes de declarar ausencia de exposición. La configuración no debe interpretarse como protección de autenticación ni reemplazo del apagado del código. Este candidato **todavía no está desplegado** y exige ambas variables en `false` en su configuración versionada.

Cloudflare Access configurado para **todos los Workers de la cuenta** podría proteger automáticamente también a este nuevo Worker; una política aplicada al Worker privado no debe quitarse. Antes de cualquier lanzamiento, comprobar por nombre de Worker, dominio, ruta y política efectiva que el endpoint de contacto sea accesible sin inicio de sesión y que el administrativo continúe restringido. CORS es defensa del navegador, no autorización de un cliente HTTP.

## Superficie HTTP
- `POST /api/contact` y `OPTIONS /api/contact` **únicamente**.
- Cualquier otro endpoint (`/health`, `/admin`, `/api/leads`, `/metrics`) responde **404** sin consultar D1.
- Otros métodos sobre `/api/contact` responden **405**.
- Se necesitan **dos flags independientes** con valor literal `"true"`: `ENABLE_PUBLIC_INTAKE` y `ENABLE_CONTACT_SUBMISSIONS`. Por defecto, ambos están en `"false"`; se responde **503** sin leer ni almacenar el cuerpo.
- Al habilitarse en una prueba local aislada, delega al receptor existente: validación de origen exacto, límite de 16 KiB, consentimiento, honeypot, Turnstile Siteverify (`action=contact` y hostname permitido), límite por IP anonimizada y confirmación solo después de D1.
- No incluye endpoints HTTP de administración, listado, borrado ni consulta de leads. Incluye un **handler programable `scheduled()`** para limpiar únicamente fingerprints HMAC antiguos en D1, **sin trigger configurado**: no ejecuta limpieza remota, no despliega nada y no abre HTTP. Requiere auditar el cron real y su intervalo antes de habilitar recepción.

## Protección idempotente contra reintentos — solo código aislado

El formulario de la rama candidata (PR #21) genera un `request_id` aleatorio UUIDv4 en el navegador. Conserva esa clave si una solicitud termina con respuesta fallida y los **datos del borrador no cambiaron**, y crea otra clave cuando el usuario edita el borrador o recibe confirmación. Los tokens de Turnstile se renuevan en cada intento; no se reutilizan.

En el receptor **exclusivamente público**, `ENABLE_PUBLIC_INTAKE==='true'` exige un UUIDv4 válido. Tras consentimiento, validación de datos, origen, CAPTCHA y HMAC de IP, consulta la tabla `lead_idempotency` y:
- Si ya existe la misma clave con la misma huella HMAC de datos normalizados y la misma huella de origen, devuelve **HTTP 200, `duplicate:true` y el mismo ID comprobado con un JOIN a `leads`**. No agrega una fila ni consume otro cupo de rate limit para este reintento confirmado.
- Si la clave existe con contenido u origen diferentes, responde **HTTP 409 `IDEMPOTENCY_CONFLICT`**, sin confirmar ni crear datos.
- Si es nueva, usa **`D1.batch` transaccional**: reserva la clave por PRIMARY KEY, inserta la consulta sólo si el identificador de reserva coincide y consulta el resultado unido a `leads`. Sólo responde **HTTP 201** cuando la fila se persistió; si otra solicitud simultánea ganó con la misma clave devuelve 200 con su ID. Si falla cualquier statement, no informa éxito.
- Si la tabla no existe en D1, se obtiene **HTTP 503 `PERSISTENCE_UNAVAILABLE`** y no se registra ninguna consulta. Nunca se crea ni migra un esquema desde HTTP.

El esquema adicional se prepara en `infra/fluynova-public-intake-worker/idempotency.schema.sql`: `lead_idempotency`, índice por fecha y sin correo/IP en claro; la huella del contenido es un **HMAC-SHA256** con `RATE_HASH_SECRET`, no un hash simple. La rutina `scheduled()` elimina claves anteriores a 7 días y fingerprints según el intervalo ya documentado. Como **no hay cron remoto configurado**, esto **NO garantiza actualmente retención de siete días** en la nube.

**Bloqueante remoto obligatorio:** la D1 `fluynova-leads-staging` solo tenía verificadas anteriormente las dos tablas básicas; `lead_idempotency` e índice no están comprobados remotamente. La migración requiere auditoría de D1, bookmark/recuperación y autorización explícita de escritura, antes de preparar cualquier tráfico. Nunca ejecutar el SQL por el simple hecho de que la CI pase.

Las pruebas usan Siteverify falso interceptado y D1 **LOCAL** con Workerd real: dos POST simultáneos → una fila, duplicado con mismo ID, conflicto para clave reutilizada con otros datos, nueva intención legítima → nueva fila, rechazo cuando falta migración, limpieza sin borrar leads. Chromium reproduce una **respuesta perdida después de confirmar SQL** y recupera el mismo ID con un CAPTCHA nuevo.

**Límites:** una clave válida se reutiliza sólo mientras la sesión/borrador persiste; recargar el navegador crea otra. Tras vencimiento de la tabla (si se configura limpieza), un reintento tardío puede generar otra consulta. Una rotación de `RATE_HASH_SECRET` cambia las huellas y requiere una estrategia de transición. Esto no es una garantía general de eliminación de duplicados por contenido, ni entrega de email.

Referencia oficial de transacciones D1: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

## Auditoría de liberación cerrada

El guardián `node infra/fluynova-public-intake-worker/release-guard.mjs` se ejecuta sin red y su resultado **SAFE_CLOSED** solo significa que el candidato sigue sin publicar. **Nunca** representa `readyForPublicTraffic=true`. En cada cambio, GitHub ejecuta las pruebas negativas: activación prematura, D1/rutas, dominios no revisados, secretos en configuración, acceso al Worker privado y comandos de despliegue sin dry-run deben fallar. Esta auditoría no puede sustituir una revisión de políticas reales de Cloudflare ni confirmar secretos privados.

## Configuración cerrada sin excepciones

El auditor aplica una **allowlist estricta** de campos de `wrangler.jsonc`. Rechaza cualquier clave nueva no revisada, incluidos `env`, bindings de servicios, colas, KV, R2, `unsafe` o rutas anidadas. También fija la fecha de compatibilidad y exige observabilidad desactivada. Esto impide que una configuración alternativa con `wrangler --env` evite silenciosamente las dos compuertas apagadas. Un cambio legítimo de configuración requiere modificar el auditor, agregar una prueba de regresión y revisar el PR; **ningún PASS de CI autoriza desplegar**.

## Endurecimiento del workflow candidato — revisión 08/11/2026

El release guard de esta rama ahora exige que `package.json` tenga únicamente los scripts locales auditados `check` y `dryrun`. También rechaza, en el **workflow de este PR**, comandos que pueden modificar Cloudflare incluso sin un `wrangler deploy` directo:

- `wrangler versions upload/deploy/secret`, `wrangler secret`, `wrangler triggers`, `wrangler d1 execute`, `wrangler pages deploy`, `wrangler rollback` y `wrangler deploy --temporary`.
- Scripts indirectos como `npm run publish`, referencias de tokens Cloudflare o llamadas a la API oficial, y acciones `cloudflare/wrangler-action` o `cloudflare/pages-action`.
- Cambios no revisados en los orígenes `.invalid` o rutas del **Worker privado**, además de nombre, D1 y flag que ya estaban protegidos.

El control detecta patrones conocidos **estáticamente**: no demuestra que otras automatizaciones del repositorio, Cloudflare Builds o un script deliberadamente ofuscado sean seguros. La revisión de cambios, permisos y configuraciones remotas reales es obligatoria antes de cualquier ejecución externa. `SAFE_CLOSED` significa únicamente que las configuraciones y pruebas admitidas siguen cerradas, nunca autorización de publicar.

Cloudflare confirma que `wrangler secret put` despliega una versión inmediatamente, mientras que `wrangler versions upload` guarda una versión sin publicarla; **ambas son mutaciones remotas**, por eso quedan prohibidas en este CI. Referencia: https://developers.cloudflare.com/workers/wrangler/commands/workers/

## Condiciones obligatorias ANTES de una eventual publicación (requieren autorización)
1. **No desplegar este candidato** hasta crear una estrategia de publicación pública segregada y revisar costos/permisos. No conectarlo al Worker protegido ni desactivar Access del Worker privado. Ante Access global, revisar una excepción específica SOLO para el nuevo Worker, nunca una excepción de cuenta.
2. Elegir y verificar un dominio/ruta pública exclusiva (preferible Custom Domain de Cloudflare) y confirmar que se controla realmente. Evitar conectar la web oficial en Render durante esta etapa.
3. Crear Turnstile para el dominio real con `action=contact`. Registrar **sitekey público** en el cliente; almacenar **secret key exclusivamente como secreto de Worker**, fuera de GitHub y de cualquier chat. Validar el hostname real y la acción. Wrangler declara desde ahora los **nombres requeridos** en `secrets.required`: `TURNSTILE_SECRET_KEY` y `RATE_HASH_SECRET`, **sin valores**. Cloudflare debe rechazarlos como faltantes si se intenta un despliegue sin prepararlos. Archivos locales `.dev.vars*` y `.env.*.local` quedan ignorados por Git.
4. Crear/configurar un binding D1 **exclusivo de FLUYNOVA** y guardar un secreto HMAC `RATE_HASH_SECRET` individual del servicio. Acordar política de privacidad y conservación de consultas, procedimiento de lectura administrativa y eliminación.
5. Mantener `ENABLE_PUBLIC_INTAKE=false` y `ENABLE_CONTACT_SUBMISSIONS=false` hasta aprobar prueba de conectividad con D1 remota, sin usar datos reales. Recién después evaluar habilitación controlada.
6. Verificar Cloudflare Access/WAF, CORS exacto y política de abuso en la ruta pública. CORS NO reemplaza la validación del CAPTCHA, el rate-limit ni la seguridad del backend.

## Pruebas
Workflow exclusivo de esta rama: pruebas de método/rutas/flags, compilación Wrangler `--dry-run`, y llamada con navegador HTTP simulado a workerd y D1 LOCAL real. Sin credenciales, email, datos reales, ni despliegue. El Worker privado y `main` no se modifican.

## Documentación oficial revisada
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/turnstile/get-started/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/changelog/post/2025-09-17-update-preview-url-setting/
