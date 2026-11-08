# FLUYNOVA — candidato a receptor público, SIN publicar

## Por qué es independiente
El Worker actual `fluynova-contact-staging-only` está protegido por Cloudflare Access para **todo el tráfico**. Según Cloudflare, Access intercepta solicitudes ANTES de que lleguen al código del Worker. No desactivar su protección para habilitar un formulario de clientes.

Este candidato usa un **nombre diferente**: `fluynova-public-intake-candidate`. No tiene dominios, rutas, bindings D1 ni `workers.dev` público, **no se conecta a GitHub Builds** y no existe ningún despliegue remoto de este componente. Vive solo en una rama feature. No hereda ni concede acceso a funciones privadas de otros Workers.

## Superficie HTTP
- `POST /api/contact` y `OPTIONS /api/contact` **únicamente**.
- Cualquier otro endpoint (`/health`, `/admin`, `/api/leads`, `/metrics`) responde **404** sin consultar D1.
- Otros métodos sobre `/api/contact` responden **405**.
- Se necesitan **dos flags independientes** con valor literal `"true"`: `ENABLE_PUBLIC_INTAKE` y `ENABLE_CONTACT_SUBMISSIONS`. Por defecto, ambos están en `"false"`; se responde **503** sin leer ni almacenar el cuerpo.
- Al habilitarse en una prueba local aislada, delega al receptor existente: validación de origen exacto, límite de 16 KiB, consentimiento, honeypot, Turnstile Siteverify (`action=contact` y hostname permitido), límite por IP anonimizada y confirmación solo después de D1.
- No incluye endpoints de administración, listado, borrado, consulta de leads ni registro de mensajes; no incluye cron.

## Condiciones obligatorias ANTES de una eventual publicación (requieren autorización)
1. **No desplegar este candidato** hasta crear una estrategia de publicación pública segregada y revisar costos/permisos. No conectarlo al Worker protegido ni desactivar Access del Worker privado. Ante Access global, revisar una excepción específica SOLO para el nuevo Worker, nunca una excepción de cuenta.
2. Elegir y verificar un dominio/ruta pública exclusiva (preferible Custom Domain de Cloudflare) y confirmar que se controla realmente. Evitar conectar la web oficial en Render durante esta etapa.
3. Crear Turnstile para el dominio real con `action=contact`. Registrar **sitekey público** en el cliente; almacenar **secret key exclusivamente como secreto de Worker**, fuera de GitHub y de cualquier chat. Validar el hostname real y la acción.
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
