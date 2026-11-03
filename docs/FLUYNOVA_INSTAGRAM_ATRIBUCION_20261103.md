# FLUYNOVA — atribución de campañas Instagram al formulario

Fecha: 03/11/2026 · Rama de revisión, no desplegada.

## Problema confirmado en código
La landing `/diagnostico/` contiene dos botones que conducen a la portada `/#contacto` con parámetros fijos:
`utm_source=diagnostico&utm_medium=landing&utm_campaign=primera_evaluacion`.
Por ello, aunque el visitante llegase con los parámetros de una campaña de Instagram, los perdía antes de enviar la consulta. La portada sí sabe tomar `utm_source`, `utm_medium`, `utm_campaign` y `utm_content` y copiarlos a campos ocultos del formulario **solo cuando el visitante da su consentimiento y lo envía**.

## Corrección propuesta
- `static/diagnostico/attribution.js`: copia de forma limitada y validada solamente los cuatro campos UTM; caracteres admitidos `[A-Za-z0-9_.-]`, máximo 90 caracteres por campo, exactamente los aceptados por `static/main.js`.
- Dos CTA de la landing llevan `data-diagnostic-cta` y el script los transforma a `/?utm_...#contacto`, conservando el origen de Instagram hasta el formulario.
- Sin UTMs de entrada, conserva los valores tradicionales de diagnóstico. Sin JavaScript, los enlaces HTML originales siguen funcionando.
- No se agregan cookies, píxeles, lectura de visitantes, envíos automáticos, almacenamiento, redirecciones a dominios externos ni datos personales.

## Enlace de campaña para el carrusel programado el 10/11/2026
La forma recomendada para medir el origen de un contacto **después de integrar esta mejora** es:

https://fluynova-web.onrender.com/diagnostico/?utm_source=instagram&utm_medium=organic-social&utm_campaign=fluynova_tiempo_20261110&utm_content=carrusel_3p

Al pulsar cualquiera de los dos CTA, la dirección final debe ser:

`/?utm_source=instagram&utm_medium=organic-social&utm_campaign=fluynova_tiempo_20261110&utm_content=carrusel_3p#contacto`.

**Advertencia:** esto no cuenta visitas ni clics. Solo permite recibir el origen cuando alguien envía voluntariamente el formulario. Instagram no convierte automáticamente en clicables las URLs escritas en los pies de foto; el enlace debe estar disponible en un lugar accesible (p. ej., biografía o página de enlaces). Verificar la configuración real de la biografía antes de afirmar que existe.

## Verificación
- 11 pruebas de Node.js (UTM completo, parcial, origen tradicional, sanitización, límites, eliminación de parámetros ajenos, dos CTA, campos del formulario y ejecución en DOM simulado).
- GitHub Actions del PR para comprobarlas, sin servicios externos.
- Consulta pública sin envío de formulario el 03/11: la landing `/diagnostico/` responde y `/api/config` reporta `contact_enabled: true`, `contact_method: formsubmit`. Primer intento devolvió HTTP 503 mientras Render arrancaba; la comprobación posterior respondió. **Esto no es prueba de recepción real de correos.**
- No se envió ninguna consulta ficticia. Tampoco se modificó el sitio principal (`main`) ni el enlace de la biografía.

## Pendientes de aceptación
1. Revisión del PR, incorporación a `main` y comprobación directa en la web desplegada (requiere autorización para cambio de producción).
2. Verificar que la biografía de @fluynova apunte a una URL etiquetada de campaña, o implementar una página propia de enlace de campañas, sin interceptar información personal.
3. Prueba consentida extremo a extremo del formulario con correo de control y lectura del mensaje recibido (contiene los 4 campos), sin datos reales de clientes.
4. Medir consultas genuinas por campaña; no confundir consultas atribuidas con ventas.

## Alcance
Este PR solo mejora atribución en FLUYNOVA. No modifica APDocente PBA, VOLVÉ, Técnica 6 ni el contenido programado para los días 04, 06 y 10/11/2026.
