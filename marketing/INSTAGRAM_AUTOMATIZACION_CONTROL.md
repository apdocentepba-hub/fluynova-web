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
{"brandId":"7583853","fetchedAt":"2026-11-03T07:35:00-03:00","data":[{"id":406052874,"publicationDate":{"dateTime":"2026-11-04T10:00:00","timezone":"America/Buenos_Aires"},"providers":[{"network":"instagram","status":"PENDING"}],"text":"Contenido de ejemplo"}]}
```

Esquema de `published.json` derivado de `getAnalyticsDataByMetrics` con la misma secuencia de métricas de la consulta (`IGPO01` fecha, `IGPO03` contenido, `IGPO06` URL). La envoltura `brandId/fetchedAt/from/to/fieldIds` documenta los parámetros reales de la consulta; **no la devuelve el API en la respuesta de filas**:

```json
{"brandId":"7583853","fetchedAt":"2026-11-03T07:35:00-03:00","from":"2026-10-01T00:00:00-03:00","to":"2026-11-03T23:59:59-03:00","fieldIds":["IGPO01","IGPO03","IGPO06"],"rows":[["20261027","Ejemplo pedagógico de contenido ya publicado","https://www.instagram.com/p/DfBCgNNAGOn/"]]}
```

`fetchedAt` debe ser del momento de consulta de los datos, como máximo 60 minutos antes de generar el plan, y `from` debe cubrir los últimos 21 días. El programa falla si faltan historial, campos esperados, cobertura o identidad de marca. Los valores de fecha ilustrativos se deben reemplazar por una consulta nueva: **no reutilizar este ejemplo como si fuera una consulta vigente**.

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
Cobertura nueva: 21 pruebas unitarias sobre contratos JSON de Metricool, datos antiguos, múltiples marcas, URLs falsas, errores de columnas, colisión, repetición y fecha sin hora exacta. Verificación GitHub Actions agregada al PR: **consultar el estado del run antes de afirmar que pasaron**. Se usaron formas de datos y filas representativas de Metricool, no una conexión de producción en tiempo real.

## Política
- No modificar tareas activas de las demás marcas.
- No programar en horario pasado, duplicar temas ni ejecutar seguimientos no solicitados.
- No guardar correos, tokens ni datos personales en repositorios públicos.
- Ante incertidumbre o respuesta inconsistente: detener la programación y reportar el bloqueo.
