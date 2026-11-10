# FLUYNOVA — receptor propio (CANDIDATO NO DESPLEGADO)

Estado: código probado offline; SIN base D1 creada, SIN Turnstile configurado y SIN URL pública. La web oficial mantiene el contacto visible contacto.fluynova@gmail.com.

## Propósito
Recibir formularios de clientes con persistencia propia antes de confirmar éxito. FormSubmit mostró éxito en pantalla, pero su correo no fue comprobado en Gmail. Nunca afirmar entrega por la aceptación de un tercero.

## Aislamiento
Prohibido reutilizar bases de APDocentePBA, alerta-amba u otros proyectos. Se necesita Cloudflare D1 exclusiva de FLUYNOVA. El archivo schema.sql es solo la propuesta de esquema; no se aplicó a ningún recurso.

## Contrato de la API
- POST /api/contact exclusivamente para los orígenes HTTPS permitidos; OPTIONS con CORS restringido.
- Campos nombre, email, categoría (incluye página web / catálogo), mensaje y consentimiento obligatorio; opcionales y atribución acotada.
- Máximo 16 KiB, honeypot, límites de longitud, categoría cerrada; errores sin persistencia.
- Turnstile validado del lado servidor con Siteverify: token, action=contact y hostname correcto. Sin secreto o fallo: se rechaza.
- Límite 5 intentos/hora por fingerprint HMAC de IP; nunca se guarda IP en claro.
- D1 guarda primero; solo tras confirmación de escritura se devuelve HTTP 201, ok:true, stored:true e id.
- Sin endpoint de consulta pública, sin email automático ni acceso administrativo público.
- Pruebas Node de D1 y Turnstile son simuladas; no equivalen a una inserción real.

## Habilitación pendiente (requiere aprobación específica)
1. Confirmar cuotas, límites y costos; crear D1 staging exclusiva de FLUYNOVA.
2. Crear migración con Wrangler oficial, revisando schema.sql y aplicando primero local. Jamás sobre otra base.
3. Crear Worker de staging con binding DB, ALLOWED_ORIGINS y TURNSTILE_HOSTNAMES exactos.
4. Guardar TURNSTILE_SECRET_KEY y RATE_HASH_SECRET como secretos del Worker; no incluirlos en Git.
5. Configurar Turnstile del hostname de staging; verificar token real, rechazo de bots, 5/h e indisponibilidad D1.
6. Implementar panel con autenticación, política de retención y borrado; limpiar huellas de rate-limit periódicamente.
7. Revisar política de privacidad y consentimiento; entonces conectar la web estática al Worker.
8. Comprobar desde navegador que un formulario ficticio reaparece en D1 antes de declarar éxito.

## Fuentes oficiales
- Cloudflare D1: https://developers.cloudflare.com/d1/get-started/
- Migraciones D1: https://developers.cloudflare.com/d1/reference/migrations/
- Turnstile: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Pages: https://developers.cloudflare.com/pages/configuration/git-integration/

## Reversión
Esta rama no se fusionó ni desplegó. No afecta al formulario y web oficiales, ni a otras bases de datos. El correo directo seguirá publicado durante toda la migración.


## Evidencia de integración local real (07/11/2026)

- Integración Cloudflare **Miniflare 4.20260730.0** fijada para CI: el Worker se ejecuta en `workerd`, con D1 LOCAL real, sin Cloudflare login.
- [GitHub Actions #42428907226](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42428907226): **16 pruebas aprobadas (15 unitarias + 1 integración local), 0 fallos**. Confirmado en logs un POST ficticio que devolvió `201` tras persistir en D1 y lectura SQL por ID con categoría y correo `example.invalid`.
- La prueba confirma que orígenes no permitidos y consentimientos faltantes no crean filas, que el HMAC no guarda IP en claro, y que `/admin` no permite lectura pública.
- Se implementó `scheduled()` para borrar huellas HMAC antiguas de `lead_rate_limit`: ventana de más de 48 horas. Comprobado en D1 local: huella de 72 horas borrada y huella reciente conservada.
- **Límite de evidencia:** la validación de Turnstile fue interceptada por un mock que bloquea la red; no hubo verificación CAPTCHA contra el proveedor, ni creación de D1 remota, ni prueba desde navegador público, ni correo enviado.
- La primera ejecución integrada falló por el parser de comentarios en `D1.exec()`. Se corrigió aplicando instrucciones SQL individualmente; la ejecución final quedó verde.
- El `schema.sql` no se aplicó a Supabase ni bases reales. Las pruebas locales son efímeras y usan un ID de base exclusiva de CI.

### Tareas de puesta en marcha verificable

Para la siguiente etapa faltan credenciales/permisos de la cuenta Cloudflare adecuada. No hay integración Cloudflare directa conectada en esta conversación, y el navegador de pruebas disponible no tiene sesión registrada en Cloudflare. Por lo tanto se deja **el despliegue remoto bloqueado**, en vez de inventar un ID D1 o activar recursos en una cuenta ajena.

Al configurar D1 remota, documentar ID/entorno en el repositorio **sin secretos**; fijar reglas de privacidad y habilitar el cron `0 4 * * *` (UTC). Verificar primero lectura/escritura con datos ficticios en entorno separado y comprobar el borrado del rate-limit. El correo directo publicado permanece disponible en producción.


## Integración completa en laboratorio — Chromium + workerd + D1

Se ejecutó una prueba única que conecta el **frontend compilado del PR #21** (commit fijado `19b0e474e3ace0330b824be3d00ef530e66c124b`) con el **Worker real ejecutado localmente en workerd** y una **base D1 local real**. El navegador usado es Chromium/Playwright 1.65.0. Se bloqueó toda salida externa; únicamente la API de Cloudflare Turnstile fue interceptada con una respuesta sintética del lado servidor. **No se publicó un Worker ni se crearon bases D1 remotas.**

- [GitHub Actions run 42433514764](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42433514764): ambos jobs `lead-ingress-offline` y `browser-worker-d1-local` terminaron **SUCCESS**; **4/4 pruebas de navegación integradas PASS**.
- El camino normal completó una consulta ficticia, envió HTTP POST con CORS, validó el CAPTCHA simulado del lado servidor, escribió una fila real en D1 local y mostró en el navegador **exactamente el ID** de la fila recuperada con SQL. Log: `E2E_FULL_LOCAL_PASS: chromium=true, workerd=true, d1_persisted=true, mail_sent=false`.
- Fallo cerrado probado: formulario sin configuración no genera POST; CAPTCHA rechazado no genera filas; D1 sin tabla de consultas devuelve 503 y la interfaz no declara éxito ni pierde los datos ingresados.
- Los datos usan el dominio reservado `example.invalid`, nunca direcciones de terceros. No hay conexión con APDocentePBA ni con servicios de email.

### Preparación de puesta en marcha sin publicar

Se agregó `wrangler.staging.example.jsonc`, **solo plantilla** (Wrangler no la reconoce automáticamente como configuración activa).

- `workers_dev:false`, sin rutas públicas ni ID real de D1.
- `database_name:fluynova-leads-staging`, binding `DB` y marcador `REPLACE_WITH_D1_DATABASE_UUID`, para garantizar aislamiento.
- `ALLOWED_ORIGINS` y `TURNSTILE_HOSTNAMES` apuntan a un dominio `.invalid` que debe reemplazarse al habilitar pruebas.
- `TURNSTILE_SECRET_KEY` y `RATE_HASH_SECRET` **no aparecen**: deben guardarse con comandos de secretos, nunca en el repositorio ni en variables públicas.
- Cron `0 4 * * *` (UTC) preparado para invocar la limpieza de huellas HMAC de más de 48 horas.
- Se incorpora una prueba automática para bloquear archivos de configuración con rutas abiertas o secretos accidentalmente incluidos.

**Todavía no se puede activar el circuito público:** falta una cuenta Cloudflare conectada/autorizada, un D1 exclusivo remoto, un widget Turnstile real, definición de retención y panel autenticado, y una prueba de lectura desde almacenamiento remoto. La plantilla no debe renombrarse ni desplegarse sin esas puertas superadas.

Fuentes oficiales: https://developers.cloudflare.com/workers/wrangler/configuration/ y https://developers.cloudflare.com/turnstile/get-started/server-side-validation/.


## Cloudflare remoto — base D1 creada (07/11/2026, Buenos Aires)

- El usuario creó desde el panel de Cloudflare **la base exclusiva de FLUYNOVA**: `fluynova-leads-staging` (`ce8ac477-dd77-4a1c-a42e-6096dcb78768`), verificada por lectura del panel autenticado. La cuenta aloja también otros proyectos que **no se modifican**.
- Al comprobar la pestaña Métricas de la base recién creada, informó **0 tablas y 0 consultas**. La creación del esquema SQL está **pendiente de ejecutar y verificar**; no declarar la base inicializada.
- El archivo `wrangler.staging.example.jsonc` ya incluye el UUID real D1 bajo binding `DB`. Sigue siendo una **plantilla inerte**: `workers_dev:false`, sin rutas públicas, origen `.invalid` y sin secretos. No está desplegada.
- **No crear otra D1**, no compartirla con APDocentePBA y no activar el Worker sin comprobar las tablas, Turnstile real, privacidad y prueba end-to-end de staging.
- Para inicializar manualmente en el Console D1 se debe ejecutar **el esquema exacto** de `infra/fluynova-contact-worker/schema.sql` (dos tablas `leads`, `lead_rate_limit` y tres índices). D1 permite instrucciones SQL múltiples separadas por punto y coma. Verificar luego: `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('leads','lead_rate_limit') ORDER BY name;`.
- Los campos de usuario solo se guardarán al activar explícitamente el Worker, actualmente desconectado.


## D1 remota inicializada: verificación por consola

- En Cloudflare D1 `fluynova-leads-staging` (UUID `ce8ac477-dd77-4a1c-a42e-6096dcb78768`) el usuario ejecutó el SQL de `schema.sql`. La consola respondió **This query successfully executed**.
- Comprobación SQL observada desde la pestaña autenticada: `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('leads','lead_rate_limit') ORDER BY name;` devolvió **`lead_rate_limit` y `leads`**. Se verificaron las tablas remotamente; no se ha confirmado el resultado de cada índice por separado ni se realizaron inserciones remotas.
- El Worker todavía NO está desplegado y el formulario de producción sigue independiente con correo alternativo visible. Se debe verificar esquema e índices sin escritura, luego configurar Turnstile de un dominio de staging, vincular binding `DB` exclusivo y secretos de Worker en Cloudflare (nunca por chat/repositorio).
- Consulta de auditoría segura, solo lectura: `SELECT type, name, tbl_name FROM sqlite_master WHERE name IN ('leads','lead_rate_limit','leads_received_at','leads_status','lead_rate_limit_hour') ORDER BY type,name;` Debe mostrar dos tablas y tres índices propios. No crear tablas duplicadas ni ejecutar el esquema otra vez.
- No usar base ni Worker de APDocentePBA; no crear rutas, workers.dev públicos ni habilitar el formulario hasta la prueba integrada remota autorizada.


## Worker de ensayo creado en Cloudflare (07/11/2026)

- El usuario creó por la interfaz Cloudflare el Worker **fluynova-contact-staging-only**. Dashboard confirmó despliegue inicial **Ready**, código temporal **Hello World**, URL asignada `https://fluynova-contact-staging-only.apdocentepba.workers.dev/`.
- Se configuró Cloudflare Access en modalidad **All traffic**, regla `Cloudflare account — Allow` y sesión 24 horas. No se ha realizado una prueba de acceso no autenticado, por lo que no se declara cierre externo demostrado.
- Lectura verificada de la pestaña de Cloudflare: **Bindings: 0**. No hay conexión D1 ni secreto de Turnstile configurado todavía; la web oficial sigue en Render y no llama a este Worker.
- **Próximo cambio manual mínimo:** panel del Worker > `Add a binding` > `D1 database` > `Variable name: DB` > elegir `fluynova-leads-staging` (UUID `ce8ac477-dd77-4a1c-a42e-6096dcb78768`) > guardar. No seleccionar bases de APDocentePBA ni publicar código de recepción todavía.
- **Limitación importante:** un Worker con Cloudflare Access en `All traffic` no podrá recibir POST del formulario de visitantes sin que éstos superen Access. Es correcto durante las pruebas privadas. Antes de pasar a producción se requiere definir cómo publicar solo el endpoint de recepción protegido por Turnstile y rate-limit sin exponer el administrador; nunca quitar Access indiscriminadamente durante esta etapa.


## Publicación controlada del receptor en el Worker YA creado

- En Cloudflare, el Worker **fluynova-contact-staging-only** ya dispone del binding `DB` apuntando a `fluynova-leads-staging`, UUID `ce8ac477-dd77-4a1c-a42e-6096dcb78768`. Esta conexión se verificó leyendo el apartado Settings > Bindings autenticado. No repetir el alta de la base.
- Estado actual verificado antes de sustituir código: despliegue manual de **Hello World**, Cloudflare Access configurado en **All traffic**, ninguna variable/secreto runtime cargados y sin cron.
- El receptor de `index.mjs` incluye una **puerta de activación `ENABLE_CONTACT_SUBMISSIONS` que solo acepta el valor literal `true`**. Si no existe o vale `false`, la API devuelve 503 sin leer el cuerpo ni verificar Turnstile ni escribir en D1. El código queda preparado para copiar en el editor de Cloudflare; **no necesita imports ni dependencias externas en producción**.
- La ruta `GET /health` hace exclusivamente `SELECT COUNT(*)` sobre `sqlite_master`, sin leer clientes; informa `databaseReady` y `accepting`. El resultado esperado con D1 y esquema correctos y sin secretos/flag es **`{"databaseReady":true,"accepting":false}`**, protegido por Cloudflare Access.
- Proceso asistido de despliegue **solo de staging**: abrir [código fuente](https://github.com/apdocentepba-hub/fluynova-web/blob/feature/fluynova-contact-d1-isolated-20261107/infra/fluynova-contact-worker/index.mjs), usar «Copy raw file», abrir [Edit code](https://dash.cloudflare.com/f446c729ea2148db5f90126e61e5abcd/workers/services/edit/fluynova-contact-staging-only/production), reemplazar Hello World en `worker.js` y revisar sintaxis. Desplegar solo manteniendo Access All traffic activo, sin rutas personalizadas y sin variables de activación.
- Confirmar después desde el navegador autenticado `https://fluynova-contact-staging-only.apdocentepba.workers.dev/health` y cotejar los dos booleanos. Un acceso sin autenticar debe exigir Access; no se verificó todavía.
- NO configurar todavía `ENABLE_CONTACT_SUBMISSIONS=true`, no conectar la web oficial a esta API, no eliminar Cloudflare Access y no poner valores secretos en código ni GitHub.
- El cron de limpieza de HMAC `0 4 * * *` queda **pendiente** de crear y probar, no se crea por pegar un archivo JavaScript.
