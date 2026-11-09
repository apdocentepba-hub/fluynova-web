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
