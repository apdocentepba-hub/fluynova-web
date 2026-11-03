# FLUYNOVA — Control preventivo de Instagram (piloto 2026-11-03)

**Estado:** prototipo de solo lectura que **interpreta exportaciones JSON reales de Metricool**, pero no tiene una conexión automática con la API y no puede publicar. Rama de revisión. No fusionar a producción hasta completar los controles de integración.

## Objetivo
Evitar programaciones duplicadas y errores de marca/hora antes de enviar una publicación a Metricool. Mantener separados los proyectos FLUYNOVA, APDocente PBA, VOLVÉ y Técnica 6.

## Ejecución local
Requisitos: Python 3.10+ con zonas horarias IANA disponibles.

```bash
python -m unittest discover -s tests -p 'test_instagram_safe_plan.py' -v
python marketing/instagram_safe_plan.py --calendar calendar.json --published published.json --candidates candidates.json --out plan.json
```

Esquema mínimo de `calendar.json` (formato de `getScheduledPosts` de Metricool):

```json
{"brandId":"7583853","fetchedAt":"2026-11-03T07:35:00-03:00","from":"2026-11-03T00:00:00-03:00","to":"2026-11-30T23:59:59-03:00","data":[{"id":406052874,"publicationDate":{"dateTime":"2026-11-04T10:00:00","timezone":"America/Buenos_Aires"},"providers":[{"network":"instagram","status":"PENDING"}],"text":"Contenido de ejemplo"}]}
```

Esquema de `published.json` derivado de `getAnalyticsDataByMetrics` con la misma secuencia de métricas de la consulta (`IGPO01` fecha, `IGPO03` contenido, `IGPO06` URL). La envoltura `brandId/fetchedAt/from/to/fieldIds` documenta los parámetros reales de la consulta; **no la devuelve el API en la respuesta de filas**:

```json
{"brandId":"7583853","fetchedAt":"2026-11-03T07:35:00-03:00","from":"2026-10-01T00:00:00-03:00","to":"2026-11-03T23:59:59-03:00","fieldIds":["IGPO01","IGPO03","IGPO06"],"rows":[["20261027","Ejemplo pedagógico de contenido ya publicado","https://www.instagram.com/p/DfBCgNNAGOn/"]]}
```

`fetchedAt` debe ser del momento de consulta de los datos, como máximo 60 minutos antes de generar el plan. En el historial `from` debe cubrir los últimos 21 días; en el calendario debe incluir la fecha actual y el intervalo de publicación de cada propuesta. El programa falla si faltan historial, campos esperados, cobertura o identidad de marca. Los valores de fecha ilustrativos se deben reemplazar por una consulta nueva: **no reutilizar este ejemplo como si fuera una consulta vigente**.

Esquema mínimo de `candidates.json`:

```json
[{"id":"propuesta-1","brand":"fluynova","topic":"Control de vencimientos","date":"2026-11-10T10:00:00-03:00","caption":"Texto original de la propuesta","media":["https://raw.githubusercontent.com/apdocentepba-hub/fluynova-web/main/marketing/growth/fluynova-turnos-guia-20261109.jpg"]}]
```

`APTA_PARA_REVISION_MANUAL` **no** significa que la imagen sea adecuada, que el enlace sea accesible o que la propuesta esté autorizada para publicar. Es solamente el resultado de controles sintácticos y de proximidad textual. Nunca publicar automáticamente por este indicador.

## Observaciones del 03/11 (consulta real de Metricool)
- Marca de Metricool: 7583853.
- Publicaciones del 04/11 10:00 y 06/11 10:00, horario Buenos Aires: `PENDING` y `autoPublish=true`.
- El calendario obtenido mediante `getScheduledPosts` solo incluye publicaciones pendientes, por lo que **no alcanza para detectar repetición de un tema ya publicado**.
- Se recuperaron publicaciones previas mediante `getAnalyticsDataByMetrics`. Se identificó contenido sobre organización de turnos publicado el 27/10, similar a la pieza JPG existente `marketing/growth/fluynova-turnos-guia-20261109.jpg`; se evitó programarla en esta revisión. Una prueba con una propuesta de 09/11 originalmente no detectó la similitud: se ajustó el umbral a 0,44 y la regresión posterior la marca `REVISAR` (no publicada). El umbral sigue siendo heurístico y deberá reevaluarse para evitar falsos positivos.
- La cuenta @fluynova permanece conectada a Metricool, no a Buffer, según consultas realizadas.
- No se ejecutaron publicaciones ni cambios al calendario.

## Bloqueos para convertirlo en automatización real
1. **Adaptación realizada en el prototipo:** combina calendario pendiente e historial publicado por IGPO, con comprobación de campos, marca y frescura; sigue requiriendo que un operador genere los archivos JSON de entrada desde consultas reales. Falta el adaptador conectado que los capture y revalide antes de cada programación.
2. Confirmar la disponibilidad de imágenes/archivos mediante HEAD/GET real, tipo MIME y tamaño; validación del contenido visual y correspondencia con copy.
3. Aplicar una clave de idempotencia persistente por marca, contenido y fecha; reconsultar Metricool antes y después de cualquier escritura.
4. Definir límites por semana y prohibir respuestas, DMs, likes/follows automáticos o cuentas ajenas.
5. Probar una publicación **programada** mediante una cuenta autorizada con el recurso gráfico correcto, verificar el registro PENDING y, tras la hora prevista, confirmar PUBLISHED y URL pública. No inferir publicación desde una desaparición del calendario.

## Verificación disponible
Cobertura nueva: 23 pruebas unitarias sobre contratos JSON de Metricool, datos antiguos, múltiples marcas, URLs falsas, errores de columnas, colisión, repetición y fecha sin hora exacta. Verificación GitHub Actions agregada al PR: **consultar el estado del run antes de afirmar que pasaron**. Se usaron formas de datos y filas representativas de Metricool, no una conexión de producción en tiempo real.

## Política
- No modificar tareas activas de las demás marcas.
- No programar en horario pasado, duplicar temas ni ejecutar seguimientos no solicitados.
- No guardar correos, tokens ni datos personales en repositorios públicos.
- Ante incertidumbre o respuesta inconsistente: detener la programación y reportar el bloqueo.

## Avance del 03/11 — verificación HTTP e idempotencia (sin publicar)

Módulos nuevos en esta rama:
- `instagram_media_verify.py`: valida URLs en dominios restringidos, bytes descargados, MIME JPEG/PNG, dimensiones y proporción antes de que un recurso pueda pasar a revisión. Rechaza dominios falsificados, redirecciones, contenido malformado y videos sin verificador específico. La descarga limita tamaño y tiempo; no expone credenciales.
- `instagram_idempotency.py`: recibos SQLite con transacción `BEGIN IMMEDIATE`, clave SHA-256 por marca, fecha local, texto y orden de medios. Estados `RESERVED` → `PENDING` → `PUBLISHED`, con transiciones explícitas. No limpia reservas automáticamente si el proveedor responde con incertidumbre.
- `instagram_preflight.py`: combina decisiones de calendario + historial, auditoría de imágenes y estado de recibos. Sigue en modo `PREFLIGHT_READ_ONLY`, no programa y no reserva.

Los recibos SQLite fueron ensayados en CI y conservan el estado entre dos aperturas de una base en disco. **No equivalen a persistencia en Render gratuito**: antes de publicar se necesita volumen persistente o base remota durable, secreto en servidor y reconciliación de respuestas ambiguas. No alojar la base en el repositorio GitHub.

Comando de auditoría integral local (requiere snapshots recientes, registro SQLite ya creado en almacenamiento duradero y conexión HTTP saliente):

```bash
python marketing/instagram_preflight.py --calendar calendar.json --published published.json --candidates candidates.json --ledger /ruta/segura/receipts.sqlite --out preflight.json
```

Ningún `APTA_PARA_REVISION_MANUAL` autoriza programar automáticamente.

**Prueba HTTP real de CI:** el 03/11 GitHub Actions descargó y validó el JPEG público de Metricool programado el 04/11 (1080×1080, 85.662 bytes), y la gráfica propia `fluynova-turnos-guia-20261109.jpg` (1080×1350, 128.944 bytes). La gráfica propia no fue programada por su similitud con el contenido de turnos del 27/10. La validez HTTP es puntual, no garantiza disponibilidad futura.

**Límite oficial:** Metricool MCP funciona en Free, pero la API HTTP propia requiere los planes Advanced/Custom. Para evitar costos usamos el conector de Metricool ya autorizado en ChatGPT y NO activamos una integración HTTP propia de pago. Fuentes:
- https://help.metricool.com/es/limites-del-mcp-y-requisitos-del-plan-h72jg
- https://help.metricool.com/es/guia-basica-para-la-integracion-con-la-api-r97af

El MCP de Metricool no incluye comentarios o mensajes del Inbox; no prometer respuestas automáticas con esa conexión.

**Pendiente para operación continua:** capturar los JSON del conector en cada ejecución de la automatización, trasladar las garantías de idempotencia a almacenamiento realmente persistente, cerrar una transacción supervisada con reconciliación después de cualquier envío a Metricool y observar que se convierta de PENDING a PUBLISHED con URL.


## Resultado CI integral de la fase (03/11/2026)
- **52/52 pruebas unitarias aprobadas** en Python 3.11 (calendario e historial, URL spoofing/MIME/dimensiones, recibos transaccionales y preflight completo).
- Run oficial: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/41625789998
- Los dos JPEG programados para **04/11 y 06/11** se descargaron desde Metricool: ambos 1080×1080, MIME image/jpeg, con tamaños **85.662** y **70.270 bytes**, respectivamente. La gráfica propia del 09/11 también pasó verificación de bytes, pero su contenido se mantiene descartado por repetición editorial.
- La ejecución no programa, no envía mensajes y no modifica las colas de Metricool. Las pruebas de SQLite usan almacenamiento temporal de CI, no una base operativa persistente.
