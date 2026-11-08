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


## Conexión Cloudflare verificada — 08/11/2026

Se confirmó **en la pestaña autenticada de Cloudflare** la integración entre el Worker **fluynova-contact-staging-only** y GitHub:
- Repositorio exacto: `apdocentepba-hub/fluynova-web`.
- Rama de producción del Worker: `deploy/fluynova-contact-staging`.
- Root directory: `infra/fluynova-contact-worker`.
- Deploy command: `npx wrangler deploy`.
- Token de Build: `FLUYNOVA Staging Builds`, independiente de APDocentePBA.
- Cloudflare indicó: "You can now push a commit to your Git repository to start your first build".

**Este commit de documentación dentro del directorio del Worker es el primer disparador controlado de Cloudflare Builds.** No se modificó `index.mjs` ni `wrangler.jsonc`. La configuración sigue `ENABLE_CONTACT_SUBMISSIONS=false`, origen permitido ficticio `.invalid`, D1 exclusiva y `workers_dev=true`. Este build **no** debe recibir consultas reales ni cambiar la web comercial.

Verificaciones pendientes tras el commit: revisar en el panel la ejecución de Builds y Deployments, confirmar salida `/health` y comprobar que `accepting` permanece `false`. El preflight local de GitHub no certifica por sí solo que Cloudflare desplegó.


## Turnstile: timeout y fallos cerrados — 08/11/2026

El Worker implementa un timeout de **5 segundos** para Siteverify, y trata respuestas HTTP no exitosas, timeouts y excepciones como **\`CAPTCHA_TEMPORARILY_UNAVAILABLE\` (503)**. Solo un resultado \`success:true\` acompañado por \`action:'contact'\` y hostname permitido permite persistir una consulta. Las pruebas agregadas cubren el \`AbortSignal\`, HTTP 503, interrupción de la llamada y ausencia de metadatos en respuestas dummy. Las claves de prueba que Cloudflare publica **no certifican** la validación de host/action: los dummy test secrets devuelven una respuesta genérica. No poner claves de prueba en Cloudflare y no activar \`ENABLE_CONTACT_SUBMISSIONS\` todavía.

Conexión de producción de la web **sin cambios**. La rama de staging conserva D1 exclusiva, Cloudflare Access y recepción \`false\`. El cron permanece diferido hasta resolver sus permisos de publicación.
