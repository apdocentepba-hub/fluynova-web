# FLUYNOVA — Paso 06D: autenticación del administrador (candidato aislado)

**Fecha:** 09/11/2026. **Estado:** código local probado, DESACTIVADO y NO desplegado.

## Implementación

- Worker independiente en `infra/fluynova-admin-readonly-worker`. No toca los Workers público/privado y solo contempla `GET /api/admin/mail-summary`. Todas las demás rutas devuelven 404, y POST/PUT/PATCH/DELETE devuelven 405.
- `wrangler.jsonc` contiene solo `ADMIN_READ_ENABLED=false`; no declara rutas, workers.dev, previews, D1, equipo de Access, audiencia ni administrador. La lectura permanece cerrada.
- Verificación criptográfica de `Cf-Access-Jwt-Assertion` con `jose` y RS256. Descarga JWKS de `https://EQUIPO.cloudflareaccess.com/cdn-cgi/access/certs`; exige firma, issuer, audience, expiración, token de tipo `app` e identidad `sub` igual a `ADMIN_ALLOWED_SUBJECT`. Cookie sin header nunca autoriza.
- El control de identidad es **adicional** a la política Cloudflare Access que deberá existir y auditarse antes de cualquier despliegue real. No se incluye identidad ni contraseña en Git.
- La única consulta D1 es el agregado de seis estados ya probado en Paso 06C. No recupera nombre, email, mensaje o ID de leads. Las respuestas contienen `Cache-Control: private, no-store`, CSP, nosniff, no permiten CORS ni registran JWTs.

## Verificado con pruebas reales LOCALES

- Clave RSA y JWT real firmados por `jose`. Workerd + D1 LOCAL con datos sintéticos y endpoint JWKS interceptado: **cero llamadas a red externa**.
- 11 pruebas: compuerta cerrada en Wrangler, rutas restringidas, cookie sola/ausencia de JWT, autorización criptográfica válida, errores de issuer/audience/sub/type/exp/nbf, firma manipulada, rotación entre dos claves RSA JWKS, algoritmo HS256 no permitido, JWT sin expiración, tabla D1 ausente, configuración incompleta y cabeceras de seguridad.
- [CI de GitHub #42605843533](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42606154367): **SUCCESS 1/1 job, 11/11 tests, Wrangler `--dry-run`**.
- La API autorizada responde solamente totales por estado y casos para revisión. Nunca expone PII ni confirma Cloudflare real.

## Paso 06E — interfaz visual conectada a API de solo lectura (sin publicar)

- Se crearon `dashboard.html`, `dashboard.css` y `dashboard.js` **en la carpeta del Worker administrativo, pero sin agregarlos a las rutas del Worker ni a Wrangler**. Son recursos para el laboratorio de Chromium y un futuro host administrativo detrás de Cloudflare Access, no archivos accesibles desde una URL real.
- La interfaz consulta solamente `GET /api/admin/mail-summary` **en el mismo origen**. No tiene campo de contraseña, no recibe, almacena ni introduce JWT, ni usa localStorage. En el entorno real, el proxy de Cloudflare Access deberá validar sesión e inyectar `Cf-Access-Jwt-Assertion`; el Worker sigue verificando criptográficamente ese JWT y el `sub` autorizado. Una cookie sin proxy no autoriza.
- Cuatro estados funcionales: carga inicial, respuesta válida con las seis categorías y tres tarjetas, rechazo 401/403, y error 503/red/respuesta inválida. Siempre oculta y vacía las estadísticas antes de volver a solicitar: **no conserva datos anteriores cuando hay error**. Rechaza totales inconsistentes, estados desconocidos, contadores no enteros y datos que no son JSON. Los números se insertan únicamente mediante `textContent` y `createElement`, no mediante HTML interpolado.
- Responsive 320/390/768/1366 px, etiquetas semánticas y `aria-live`, sin enlaces de envío o acciones que modifiquen D1. CSP de misma procedencia, sin acceso CDN/terceros ni formulario. Los datos en pruebas son ficticios; no se consultaron los de FLUYNOVA.
- `dashboard.browser.test.mjs` levanta **Chromium real + Workerd real + D1 LOCAL**, genera JWT RS256 firmado con clave de laboratorio, sirve los 3 recursos localmente e intercepta todas las peticiones de navegador. Un puente de prueba reenvía el JWT al Worker, simulando la acción del proxy Access. **Esto no autentica ningún navegador en Cloudflare real**.
- Ensayos: identidad correcta (200 y estados), visitante anónimo (403), otra identidad (403), respuesta falsificada (sin HTML malicioso), pérdida de la tabla D1 después de ver métricas (503 y limpieza de todos los datos de pantalla). Cero accesos a red externa. Las pruebas se suman a las once ya existentes de autenticación RSA, expiración, algoritmo y rotación de JWKS.
- El workflow de esta rama instala Chromium en GitHub Actions y ejecuta esos E2E más `wrangler deploy --dry-run`, sin credenciales ni despliegue.

**Límite histórico del Paso 06E:** en ese momento el Worker no servía `dashboard.html`. El Paso 06F agrega las tres rutas estáticas **detrás de verificación JWT**; sigue sin existir ninguna ruta o hostname publicado en Cloudflare. Ver la sección 06F más abajo.

## Paso 06F — archivos del panel autenticados y paquete de revisión (sin publicar)

**Hallazgo:** en el Paso 06E el navegador obtenía HTML/CSS/JS desde un servidor simulado sin autenticación; solo la API consultada después exigía JWT. Eso no representaba una protección suficiente de los recursos visuales.

**Cambio aplicado en el candidato:** `index.mjs` contiene un allowlist estricto de rutas `GET /admin/dashboard.html`, `GET /admin/dashboard.css` y `GET /admin/dashboard.js`. Las tres pasan por las **mismas puertas de configuración, JWKS RS256, issuer, audience y subject** que la ruta JSON `GET /api/admin/mail-summary`. Rechaza solicitudes anónimas y otros usuarios con 403; config incompleta, sin D1, con 503; métodos de escritura o HEAD con 405; rutas y consultas inesperadas con 404. Todos los recursos tienen `Cache-Control: private, no-store`, CSP restrictiva, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex` y `Cross-Origin-Resource-Policy: same-origin`.

Los archivos se compilan en `admin-assets.generated.mjs` con `tools/generate-admin-assets.mjs` y se embeben **dentro del propio Worker autenticado**. El generador acepta `--check` (CI comprueba equivalencia exacta de fuentes) o `--write` (regeneración local sin deploy). No hay `assets` binding separado ni Pages públicas que salten la protección del Worker.

**Paquete de revisión local:** `tools/build-review-package.mjs` valida que Wrangler sigue desactivado y produce tres archivos visuales + `manifest.json` con hashes SHA-256 + `LEER_ANTES_DE_ABRIR.txt`, sin secretos, D1, identidad real ni datos personales. La CI construye un ZIP reproducible denominado `fluynova-admin-review-NO-PUBLICAR`, disponible **como artefacto de la ejecución**, no como sitio web. Caducidad de descarga: 7 días. **No alojar ese ZIP como sitio público**: los archivos sueltos no llevan autenticación, esta reside en el Worker.

**Verificación local completada — [GitHub Actions #42609509941](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42609509941):**
- 13 pruebas de JWT/Worker, incluyendo protección de los 3 assets y cierre si no existe D1.
- 5 pruebas Chromium: acceso legítimo con D1 local, HTML privado denegado para anónimo y otra identidad, API revocada con pantalla sin estadísticas, JSON falsificado rechazado y caída posterior de D1 que borra los conteos mostrados.
- 2 pruebas de sincronización y empaquetado SHA-256.
- **20/20 pruebas aprobadas, Wrangler `--dry-run` y artefacto ZIP confirmado por GitHub**, sin despliegues, rutas, migración o envío. El Worker privado de FLUYNOVA no fue modificado.

**Restricción:** la autenticación observada es una simulación local del encabezado inyectado por Cloudflare Access, con JWT reales firmados por una clave RSA de laboratorio. No acredita que un dominio, política Access, subject, binding D1 o panel remoto hayan sido habilitados. Para uso real se necesita una autorización explícita y E2E remota independiente.

## Para activación futura — NO AUTORIZADA

1. Auditar Cloudflare real por una vía autorizada **sin TinyFish**. No depende de esta conexión para avanzar offline.
2. Aprobar una aplicación **Access exclusiva del admin** y sus políticas de usuarios/grupos, duración de sesiones y dominio.
3. Verificar la audiencia `AUD`, el team domain real y el `sub` de un usuario autorizado desde el propio panel Access. No inventar ID ni abrir a cualquier usuario con sesión Access.
4. Auditar D1 y el esquema `lead_mail_outbox`, recuperar backup y crear un binding o proxy administrativo limitado. Este diseño aplica SQL de solo lectura, pero no es un rol de DB read-only a nivel de motor.
5. Autorizar por separado variables `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_ALLOWED_SUBJECT`, flag `ADMIN_READ_ENABLED=true`, rutas/Access/D1 y finalmente despliegue. Ninguno de estos cambios se ejecutó.
6. Repetir E2E en la infraestructura real con usuario autorizado, usuario rechazado, claves rotadas, JWKS no disponible, falta de tabla, cache y CORS. La autenticación y la recuperación remota siguen pendientes.

**Prohibido fusionar/publicar por este trabajo.** Ni la existencia de este código ni las pruebas locales justifican declarar que hay un panel remoto accesible.

Fuentes oficiales:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
