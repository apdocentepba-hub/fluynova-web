# FLUYNOVA — Verificación comercial y puerta de calidad

Fecha: 04/11/2026. Estado: laboratorio, **sin despliegue**.

## Hallazgo contrastado

Al consultar cinco URLs de la galería desde una herramienta de navegación pública:

- Cuatro demostraciones respondieron y mostraron títulos/contenido correspondientes.
- `/diagnostico/` de `fluynova-web.onrender.com` respondió inicialmente HTTP **503**.
- En una segunda comprobación, la portada, `/diagnostico/` y `/soluciones-express/` fueron accesibles. Por tanto, el 503 es **transitorio en las observaciones**; no hay evidencia para atribuirlo al código ni asegurar alta disponibilidad.
- Render confirmó que el último despliegue principal, del 03/11/2026, está `live`; no se registraron eventos recientes que expliquen la respuesta 503 y el filtro de logs para `/diagnostico/` no devolvió registros. Los indicadores solicitados no tenían series disponibles.

## Herramienta nueva (manual)

`node tests/laboratorio-smoke.js --online`

- Consulta cinco URLs de negocio declaradas expresamente, todas HTTPS y sin credenciales.
- Requiere coincidencia de HTML y texto esperado, rechaza todas las redirecciones HTTP **antes de seguirlas**, limita cada intento a diez segundos y reintenta errores transitorios (`408`, `425`, `429`, `5xx` seleccionados) hasta tres intentos.
- Emite PASS/FAIL y la secuencia de códigos, sin almacenar datos personales, sin abrir sesiones y sin registrar respuestas completas.
- **No se programa automáticamente y no forma parte de los tests que corren por defecto en CI**, porque un sitio externo puede fallar por causas fuera del repositorio.
- El indicador PASS muestra accesibilidad desde el origen de la prueba en ese momento; no garantiza disponibilidad mundial ni funcionamiento interactivo. Hay que recorrer el formulario real en navegador y comprobar su recepción con datos ficticios y autorización.

`node --test tests/laboratorio-smoke.test.js tests/laboratorio-casos.test.js`

- **17/17 PASS** sobre escenarios offline: URL segura, 503→200, error 404, redirección, HTML incorrecto, errores de red, agregación y pruebas existentes de la galería.


## Endurecimiento verificado del verificador — revisión v2 (04/11/2026)

Se encontró un riesgo real en la herramienta de QA inicial (NO desplegada): con `redirect: follow` podía contactar un destino externo antes de verificar la URL final. Además, `response.text().slice(...)` limitaba el texto **después** de descargarlo y no impedía consumir memoria con respuestas excesivas. La validación por sufijo de dominio aceptaba subdominios arbitrarios bajo `onrender.com` y `pages.dev`.

**Correcciones en la rama comercial, sin despliegue:**

- Allowlist **exacta** de cinco destinos (protocolo, hostname y ruta), más etiqueta y texto esperado; se rechazan variantes con usuario/contraseña, query, puerto y destinos sustitutos.
- `redirect: manual`: rechaza HTTP 3xx y URLs finales alteradas **sin seguirlas**. No existe una ruta arbitraria para buscar recursos internos.
- Lectura acotada a **512 KiB** de HTML: corta el stream y cancela la descarga en cuanto supera el límite. También revisa `Content-Length` antes de leer, cuando está disponible. Se evita cargar todo en memoria previamente.
- Se valida `Content-Type` HTML, se exigen límites razonables de reintentos y timeout y se mantienen las respuestas PASS/FAIL con códigos sin escribir información privada.
- Pruebas offline adicionales: bloqueo de subdominios ajenos, modificación de objetivo, rechazo preventivo de redirecciones, HTML muy grande, lectura correcta por stream y parámetros fuera de rango.

**Evidencia:** `node --test tests/*.test.js` → **17/17 PASS, 0 FAIL, 0 SKIP**, Node local. `node --check` pasó para ambos scripts. Se conservan las 11 pruebas anteriores. Esto prueba lógica de Node, **no** accesibilidad de red; el verificador online sigue siendo opt-in y no se ejecuta automáticamente.

**Límites:** un resultado favorable únicamente prueba HTML y texto esperado. No comprueba envío ni recepción de formularios, autenticación, concurrencia, privacidad de datos en el destino ni disponibilidad global. El primer 503 no tuvo causa demostrada. Se requiere recorrido de navegador y una prueba controlada del formulario antes de campañas.

## Decisiones aprendidas

1. **Primero confiabilidad comercial:** no gastar esfuerzo en más módulos si el recorrido de demostración → diagnóstico → contacto puede fallar.
2. **No inventar desempeño:** contabilizar intentos y motivos de error, no vender uptime ni tasa de conversión sin datos verificables.
3. **Seguridad del producto:** OWASP API Security Top 10 identifica acceso a objetos de otra empresa y autenticación rota como riesgos principales; Supabase recomienda RLS probado por operación, índices para sus filtros y cuidado especial con credenciales privilegiadas. Esas comprobaciones aún requieren una base exclusiva.
4. **Piloto comercial:** medir visitas a demos y consultas reales sin seguimiento invasivo, contrastar la disponibilidad y validar tres ofertas concretas antes de producir otra docena de módulos.

## Fuentes primarias

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://api-security.owasp.org/editions/2023/en/0x11-t10/

## Restricciones

No se modificó `main`, no se ejecutó una automatización, no se desplegó el verificador ni se contactaron clientes. La galería `/laboratorio/` sigue en PR borrador #17 y **no se publica aún**.

## Atribución voluntaria de la demo que motivó una consulta — revisión v3 (04/11/2026)

**Problema comercial:** la galería tenía varias vías de consulta sin una referencia que permitiera distinguir si la persona había elegido CRM, pastelería, distribuidora o cotizador. No conviene recopilar perfiles individuales ni instalar píxeles para solucionarlo.

**Implementación solo en rama de desarrollo:**

- Se identificaron seis CTA relevantes con parámetros `utm_source=laboratorio`, `utm_medium=portfolio`, `utm_campaign=demostraciones_202611` y un `utm_content` específico para `hero`, `crm`, `pasteleria`, `distribuidora`, `cotizador` y `cierre`. Los enlaces externos de las demos no cambiaron.
- Los CTA de servicios web siguen pasando primero por `/webs/`, donde el script de atribución que ya existía (`/instagram/referral.js`) ahora admite también `laboratorio`, pero **solo** la campaña explícita `demostraciones_202611`. Así, al pasar después al formulario de contacto, se conserva qué demo originó el interés.
- Los demás CTA pasan por `/diagnostico/`, cuyo script existente ya conserva los UTM explícitos y válidos al llevar a `/#contacto`.
- No se crean cookies, sesiones, almacenamiento de navegación, píxeles, solicitudes remotas ni envíos automáticos. Los valores de campaña se transmiten **solo al enviar voluntariamente el formulario existente**, que mantiene el consentimiento previo.
- No se personaliza de forma oculta el contenido ni se afirma haber medido conversiones: la herramienta solo habilita una atribución básica de fuente a futuras consultas reales.

**Pruebas:** `node --test tests/*.test.js` desde el laboratorio local completo: **22/22 PASS, 0 FAIL**. De las pruebas, cinco son nuevas de atribución y conservan la compatibilidad del flujo de Instagram existente. `static/diagnostico/attribution.js` no se modifica; en el ensayo se usó una copia equivalente de su implementación, por lo que sigue pendiente una regresión sobre el árbol completo actualizado en un checkout del repositorio antes de merge.

**No publicar todavía:** validar navegación real por páginas web, diagnóstico y formulario, revisar mensajes legales/privacidad, aprobar diseño comercial y enlaces. No se ha ejecutado ningún envío de prueba a un buzón real ni se ha modificado producción.

## Seguimiento 07/11/2026 — 503 recurrente y comparación de alternativas estáticas

**Auditoría de solo lectura; no se cambió producción ni se enviaron formularios.**

### Evidencia de acceso público

- El 07/11/2026, dos consultas externas independientes a la portada y a `/diagnostico/` devolvieron **HTTP 503 — Render Application loading**.
- En una nueva comprobación, `/diagnostico/` devolvió HTTP **200** con el contenido comercial esperado; después, la portada, `/instagram/` y `/api/config` devolvieron **HTTP 200**.
- `/api/config` declaró `{"contact_enabled":true,"contact_method":"formsubmit"}`. Esto verifica la bandera de configuración expuesta por el backend, **NO** que una consulta llegue al correo.
- El servicio principal `fluynova-web` es de tipo `web_service`, plan `free`, región `virginia`; Render lo marca `not_suspended`, con último despliegue principal `live` del 03/11/2026 (`8549828b53f4c2890888ca7db9777a04fefc5ae7`). Los registros leídos no mostraron un despliegue nuevo ese día.
- Las vistas públicas `https://fluynova-comercial-estatica-preview.onrender.com/` y `https://fluynova-contacto-sin-formsubmit-preview.onrender.com/` devolvieron **HTTP 200**. Ambas son vistas previas y **no sustituyen** la web oficial ni constituyen validación del envío comercial.

### Explicación contrastada y riesgo

Render documenta que un servicio web gratuito puede suspenderse después de **15 minutos de inactividad**, y que reactivarlo puede tardar cerca de **un minuto**. Su documentación reconoce expresamente que una respuesta **503** puede deberse al arranque en frío. La secuencia observada es **consistente con ese comportamiento**; sin trazas específicas no se atribuye cada 503 de manera concluyente a una única causa.

Fuentes oficiales consultadas:
- https://render.com/docs/free
- https://render.com/docs/troubleshooting-deploys
- https://render.com/docs/faq

**Riesgo comercial:** el primer acceso a la web puede encontrar una página de carga en vez del formulario. Programar consultas artificiales para mantener el servicio despierto no elimina la limitación arquitectónica, consume recursos y no representa una solución robusta.

### Evidencia de recepción y límites

La cuenta comercial recibió el 30/10/2026 dos envíos de prueba vía FormSubmit; esto demuestra recepción histórica, no entrega en fecha 07/11. No se detectó una nueva consulta genuina en la revisión de entrada y no se generó una nueva consulta ficticia. Evitar exponer en archivos públicos información personal de correos o potenciales clientes.

### Criterios exigidos antes de una eventual migración a sitio estático

1. Comparar portada, `/diagnostico/`, `/instagram/`, `/webs/` y demos con la web actual (incluyendo enlaces, accesibilidad móvil y SEO).
2. Mantener un solo flujo claro de contacto y preservar la aceptación informada del usuario; la vista previa sin FormSubmit requiere envío **manual** desde el cliente de correo, por lo que no es equivalente.
3. Ejecutar una prueba end-to-end de formulario con datos ficticios **solo con aprobación expresa**, y comprobar recepción en Gmail, no solo una respuesta HTTP.
4. Definir reversión, enlaces de campaña y ruta de transición sin cambios sorpresivos a la biografía de Instagram; contrastar el contenido del PR con `main` inmediatamente antes de cualquier merge.
5. Obtener autorización antes de cambiar producción, contratar servicios o publicar novedades. Este informe por sí solo **NO AUTORIZA** una migración.

**Decisión actual:** mantener el entorno real intacto y utilizar los dos laboratorios estáticos únicamente para evaluar una salida sin arranque en frío. No declarar uptime ni conversiones por estos chequeos.
