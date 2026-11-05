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
