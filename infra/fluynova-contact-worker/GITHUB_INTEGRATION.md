# FLUYNOVA — despliegue automático de staging desde GitHub

**Estado 08/11/2026:** Worker `fluynova-contact-staging-only` existe en Cloudflare y ya sirve `/health` desde código instalado manualmente. D1 remota `fluynova-leads-staging` y binding `DB` comprobados. La respuesta observada por el usuario fue `{"databaseReady":true,"accepting":false}`. La web comercial sigue en Render.

**Esta rama es EXCLUSIVA del Worker de pruebas, no de APDocentePBA.** No activar contacto automático ni tocar la web comercial por ahora.

## Conexión de GitHub una única vez (sin copiar ni pegar código)

En Cloudflare, abrir el Worker ya existente **fluynova-contact-staging-only** y entrar en **Settings → Builds → Connect**. Elegir GitHub, aprobar exclusivamente el acceso al repositorio `apdocentepba-hub/fluynova-web` si Cloudflare lo solicita, y configurar:

| Campo | Valor exacto |
|---|---|
| GitHub repository | `apdocentepba-hub/fluynova-web` |
| Production branch | `deploy/fluynova-contact-staging` (**no main**) |
| Root directory | `infra/fluynova-contact-worker` |
| Build command | `npm run check` (si aparece; opcional) |
| Deploy command | `npx wrangler deploy` (predeterminado) |
| Wrangler config | `infra/fluynova-contact-worker/wrangler.jsonc` dentro del repo; en raíz de Build se ve como `wrangler.jsonc` |

Cloudflare verifica que el campo `name` de Wrangler corresponda al Worker existente, y el que dejamos coincide. El paquete fija Wrangler en 4.136.3. **No conectar el repo a un Worker de APDocentePBA, no seleccionar `main`, no reemplazar `ALLOWED_ORIGINS` con un origen público y no desactivar Cloudflare Access.**

Tras guardar la integración, Cloudflare desplegará al recibir cambios en esa rama. Si hace falta iniciar el primer build, se realiza un commit inocuo en esta misma rama desde GitHub conectado.

## Controles de seguridad de esta rama

- `wrangler.jsonc`: `ENABLE_CONTACT_SUBMISSIONS = "false"`, dominios autorizados `.invalid`, binding exclusivo D1 verificado, ningún dominio propio/ruta de APD.
- El Worker rechaza los POST si el flag no vale literalmente `true`, incluso si más adelante existen secretos y CAPTCHA.
- `GET /health` solo lee `sqlite_master`; debe responder `{"databaseReady":true,"accepting":false}` sin leer consultas reales.
- Cloudflare Access permanece configurado por el usuario como **All traffic**. No afirmar protección verificada desde sesión anónima antes de probarla.
- No hay claves API de Cloudflare ni secretos de Turnstile en GitHub; no solicitar ni pegar secretos en chats.
- El cron `0 4 * * *` limpia únicamente fingerprints antispam viejos, no la tabla `leads`.
- Todas las pruebas reales de esta rama siguen en [GitHub Actions](https://github.com/apdocentepba-hub/fluynova-web/actions/workflows/fluynova-staging-preflight.yml): unitarias y compilación **Wrangler --dry-run**, sin token ni despliegue.

## Siguiente aceptación

Después de integrar Git, comprobar en el panel de Cloudflare que el último despliegue corresponde a la rama de staging y abrir `/health`. **No** habilitar recepción sin Turnstile auténtico, política de privacidad y prueba de inserción/relectura ficticia desde la nube.

Referencia oficial: https://developers.cloudflare.com/workers/ci-cd/builds/ y https://developers.cloudflare.com/workers/ci-cd/builds/configuration/.
