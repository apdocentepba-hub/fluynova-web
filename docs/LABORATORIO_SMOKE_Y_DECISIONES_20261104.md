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
- Requiere coincidencia de HTML y texto esperado, verifica que no haya redirección a un dominio diferente, limita cada intento a diez segundos y reintenta errores transitorios (`408`, `425`, `429`, `5xx` seleccionados) hasta tres intentos.
- Emite PASS/FAIL y la secuencia de códigos, sin almacenar datos personales, sin abrir sesiones y sin registrar respuestas completas.
- **No se programa automáticamente y no forma parte de los tests que corren por defecto en CI**, porque un sitio externo puede fallar por causas fuera del repositorio.
- El indicador PASS muestra accesibilidad desde el origen de la prueba en ese momento; no garantiza disponibilidad mundial ni funcionamiento interactivo. Hay que recorrer el formulario real en navegador y comprobar su recepción con datos ficticios y autorización.

`node --test tests/laboratorio-smoke.test.js tests/laboratorio-casos.test.js`

- **11/11 PASS** sobre escenarios offline: URL segura, 503→200, error 404, redirección, HTML incorrecto, errores de red, agregación y pruebas existentes de la galería.

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
