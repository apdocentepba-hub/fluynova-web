# FLUYNOVA | Campaña de mensajes medibles (24/10/2026)

## Hipótesis y límites
La comunicación específica basada en una tarea repetitiva concreta puede generar consultas más pertinentes que una descripción genérica de servicios. Se evaluará con datos reales: nada de testimonios falsos, escasez inventada, ansiedad o promesas de ahorro garantizado.

**Implementado en esta rama:** la portada menciona problemas concretos y el formulario transmite `utm_content` bajo el campo `origen_mensaje`, junto a fuente/canal/campaña existentes, **solo cuando el usuario envía voluntariamente el formulario con consentimiento**. No se añaden cookies, píxeles ni seguimiento de navegación.

**Importante:** con el formulario se pueden contar consultas por mensaje; para calcular una tasa de conversión de visitas a consultas hace falta un denominador verificado (visitas o clics con analítica compatible con la política de privacidad). No afirmar causalidad con publicaciones en fechas/horarios distintos.

## Dos mensajes a contrastar

### Mensaje A — tiempo / fricción
¿Cada semana volvés a copiar los mismos datos, ordenar archivos y preparar el mismo reporte? En FLUYNOVA analizamos si se puede automatizar ese trabajo, qué controles necesitan seguir siendo humanos y cuánto costaría implementarlo. Primera evaluación orientativa sin cargo.

URL: https://fluynova-web.onrender.com/?utm_source=linkedin&utm_medium=organic-social&utm_campaign=problemas_reales_202610&utm_content=tiempo#contacto

### Mensaje B — orden / trazabilidad
¿Las solicitudes de clientes terminan repartidas entre WhatsApp, correos y planillas? En FLUYNOVA diseñamos sistemas para registrarlas y consultar su estado, con una solución ajustada a tu operación. Contanos cómo trabajás ahora; evaluamos una mejora posible.

URL: https://fluynova-web.onrender.com/?utm_source=linkedin&utm_medium=organic-social&utm_campaign=problemas_reales_202610&utm_content=orden#contacto

Ambos enlaces contienen el mismo `utm_source`, `utm_medium` y `utm_campaign`, pero un `utm_content` distinto para identificar el mensaje de origen **si finalmente se envía el formulario**.

## Procedimiento recomendado
1. Publicar solo en un canal propio o en comunidades que permitan la promoción. No automatizar publicaciones repetidas ni envíos masivos.
2. Si hay suficiente audiencia, asignar las variantes aleatoriamente en un canal y período comparable. De lo contrario, tratar la comparación como **exploratoria**, no como un ensayo causal.
3. Recopilar solo información que el prospecto compartió voluntariamente. Revisar solicitudes reales por fuente, campaña, mensaje y necesidad.
4. Responder con diagnóstico de alcance y precio antes de prometer desarrollo. No anunciar descuentos o plazos que no existen.
5. Registrar en forma agregada cantidad de consultas válidas, consultas con necesidad específica, presupuestos enviados y cierres. Si se obtiene un denominador fiable, calcular conversión por variante.

## Hoja de seguimiento manual
| Variante | Clics verificados | Consultas válidas | Presupuestos enviados | Clientes | Observación |
|---|---:|---:|---:|---:|---|
| tiempo | pendiente | pendiente | pendiente | pendiente | No inferir resultados |
| orden | pendiente | pendiente | pendiente | pendiente | No inferir resultados |

## Control de calidad técnico
- Formulario sigue apuntando al proveedor FormSubmit existente.
- `origen_mensaje` acepta como máximo 90 caracteres alfanuméricos, guión, guión bajo, punto; cualquier valor no válido queda vacío.
- Si falla AJAX, el formulario tradicional envía el mismo campo oculto.
- No se cambiaron credenciales, destinatario de correo ni lógica del backend.
- Verificar después de incorporar la rama en el sitio: enlace UTM de prueba -> formulario -> envío real consentido -> correo que contenga `origen_mensaje`. Un envío no probado no constituye confirmación de recepción.
