# FLUYNOVA — Control preventivo de Instagram (piloto 2026-11-03)

**Estado:** prototipo de solo lectura, no conectado a Instagram ni a Metricool. Rama de revisión. No fusionar a producción hasta completar los controles de integración.

## Objetivo
Evitar programaciones duplicadas y errores de marca/hora antes de enviar una publicación a Metricool. Mantener separados los proyectos FLUYNOVA, APDocente PBA, VOLVÉ y Técnica 6.

## Ejecución local
Requisitos: Python 3.10+ con zonas horarias IANA disponibles.

```bash
python -m unittest discover -s tests -p 'test_instagram_safe_plan.py' -v
python marketing/instagram_safe_plan.py --calendar calendar.json --candidates candidates.json --out plan.json
```

Esquema mínimo de `calendar.json` (formato de `getScheduledPosts` de Metricool):

```json
{"data":[{"id":406052874,"publicationDate":{"dateTime":"2026-11-04T10:00:00","timezone":"America/Buenos_Aires"},"providers":[{"network":"instagram","status":"PENDING"}],"text":"Contenido de ejemplo"}]}
```

Esquema mínimo de `candidates.json`:

```json
[{"id":"propuesta-1","brand":"fluynova","topic":"Control de vencimientos","date":"2026-11-10T10:00:00-03:00","caption":"Texto original de la propuesta","media":["https://raw.githubusercontent.com/apdocentepba-hub/fluynova-web/main/marketing/growth/fluynova-turnos-guia-20261109.jpg"]}]
```

`APTA_PARA_REVISION_MANUAL` **no** significa que la imagen sea adecuada, que el enlace sea accesible o que la propuesta esté autorizada para publicar. Es solamente el resultado de controles sintácticos y de proximidad textual. Nunca publicar automáticamente por este indicador.

## Observaciones del 03/11 (consulta real de Metricool)
- Marca de Metricool: 7583853.
- Publicaciones del 04/11 10:00 y 06/11 10:00, horario Buenos Aires: `PENDING` y `autoPublish=true`.
- El calendario obtenido mediante `getScheduledPosts` solo incluye publicaciones pendientes, por lo que **no alcanza para detectar repetición de un tema ya publicado**.
- Se recuperaron publicaciones previas mediante `getAnalyticsDataByMetrics`. Se identificó contenido sobre organización de turnos publicado el 27/10, similar a la pieza JPG existente `marketing/growth/fluynova-turnos-guia-20261109.jpg`; se evitó programarla en esta revisión.
- La cuenta @fluynova permanece conectada a Metricool, no a Buffer, según consultas realizadas.
- No se ejecutaron publicaciones ni cambios al calendario.

## Bloqueos para convertirlo en automatización real
1. Agregar una capa de lectura que combine los resultados **pendientes y publicados**. El planificador todavía recibe un JSON de calendario de manera manual. Hasta que se integre la historia, no considerar que evita todos los duplicados.
2. Confirmar la disponibilidad de imágenes/archivos mediante HEAD/GET real, tipo MIME y tamaño; validación del contenido visual y correspondencia con copy.
3. Aplicar una clave de idempotencia persistente por marca, contenido y fecha; reconsultar Metricool antes y después de cualquier escritura.
4. Definir límites por semana y prohibir respuestas, DMs, likes/follows automáticos o cuentas ajenas.
5. Probar una publicación **programada** mediante una cuenta autorizada con el recurso gráfico correcto, verificar el registro PENDING y, tras la hora prevista, confirmar PUBLISHED y URL pública. No inferir publicación desde una desaparición del calendario.

## Verificación disponible
Pruebas locales: 10/10 con `unittest`, sin API externa. No está comprobada compatibilidad con la respuesta completa de Metricool ni ejecución continua. No requiere credenciales, secretos o servicios pagos.

## Política
- No modificar tareas activas de las demás marcas.
- No programar en horario pasado, duplicar temas ni ejecutar seguimientos no solicitados.
- No guardar correos, tokens ni datos personales en repositorios públicos.
- Ante incertidumbre o respuesta inconsistente: detener la programación y reportar el bloqueo.
