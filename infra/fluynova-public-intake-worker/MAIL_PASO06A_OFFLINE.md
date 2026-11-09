# FLUYNOVA — Paso 06A: avisos por correo preparados, sin envío externo

**Fecha:** 09/11/2026. **Estado:** circuito de avisos probado con D1 LOCAL y proveedor FICTICIO. NO desplegado, NO conectado a Cloudflare Email Service y SIN correo real enviado.

## Problema resuelto en el laboratorio

Antes, el receptor confirmaba almacenamiento D1 y no existía una bandeja de salida. Si en el futuro un envío por correo falla o pierde la respuesta, no debe duplicar correos ni afirmar que la consulta se entregó.

Se agregaron dos archivos de código separados:

- `mail-outbox.schema.sql`: nueva tabla `lead_mail_outbox` con `lead_id` único referenciado a `leads`, `state`, intentos, marca temporal e ID del proveedor. No duplica el nombre, correo ni mensaje personal del lead. Índice de consulta por estado y fecha.
- `mail-notification.mjs`: prepara un correo de texto simple dirigido **únicamente** a `contacto.fluynova@gmail.com`, desde un remitente que habrá que verificar. El despachador sólo funciona si recibe explícitamente `enabled:true`, un binding de correo y una base D1. Los errores ambiguos quedan en `uncertain`, sin reenvío automático.

El handler público agrega la operación de encolar **dentro del mismo `D1.batch` transaccional** que reserva el UUID y guarda el lead, pero **solamente si `ENABLE_MAIL_OUTBOX==='true'`**. La configuración real en `wrangler.jsonc` NO declara ese flag ni un binding de email; así, el circuito de mail está **apagado por defecto** y los envíos públicos actuales no necesitan la tabla nueva.

El módulo `mail-notification.mjs` **no está importado ni invocado** por `index.mjs` ni por el Cron del Worker. En el laboratorio se lo llama exclusivamente desde una prueba; no hay webhook de HTTP ni rutas de administración.

## Estados con evidencia separada

| Estado | Prueba necesaria | Qué NO significa |
| --- | --- | --- |
| `stored:true` y `delivery:'database'` | Commit confirmado del lead en D1 | No significa que se envió ni entregó un correo |
| `pending` | Existe una fila `lead_mail_outbox` asociada al lead | No se efectuó ningún envío |
| `accepted` | `EMAIL.send()` devolvió `messageId` y D1 guardó esa aceptación | No significa que el correo llegó al servidor de Gmail |
| `delivered` | Evento `cf.email.sending.message.delivered` **proveniente de Queue autenticada**, mismo `messageId` y destinatario correcto | Confirma recepción SMTP por el servidor destinatario, no lectura ni llegada a Bandeja de entrada |
| `uncertain` | Error del proveedor o de persistencia posterior a un posible envío | No se reintenta automáticamente: exige revisión humana para prevenir duplicados |

## Ensayos de CI — únicamente datos ficticios

- D1 **LOCAL** con la tabla de mail omitida: el lead y su reserva se revierten, HTTP 503, sin confirmación falsa.
- D1 **LOCAL** con tabla habilitada por flag de prueba: POST HTTP 201 guarda lead y encola un aviso; reintento del mismo UUID retorna HTTP 200 y **no genera otra fila** en la cola.
- `enabled:false` en el despachador: cero llamadas al proveedor simulado.
- `enabled:true`: el mock de `EMAIL.send` devuelve un ID sintético; D1 marca `accepted`, no `delivered`. Reejecutar no produce otro envío.
- Evento ficticio de entrega con mensaje/destinatario coincidente: D1 puede marcar `delivered`; destinatario incorrecto y evento repetido no cambian el resultado.
- Error ambiguo simulado después de un posible envío: estado `uncertain`, cero reintentos automáticos, el lead original permanece conservado.

**Evidencia:** [GitHub Actions del candidato](https://github.com/apdocentepba-hub/fluynova-web/actions/workflows/fluynova-public-intake-candidate.yml); los tests corren en la rama `feature/fluynova-public-intake-isolated-20261108`. En una ejecución exitosa, buscar `FLUYNOVA_MAIL_OUTBOX_LOCAL_PASS` y los resultados de Workerd/D1.

## Condiciones obligatorias para servicio real (NO AUTORIZADAS)

1. Completar sesión autenticada Cloudflare y verificar cuenta, D1 correcta, los recursos de la web y los permisos.
2. Revisar el estado/binding D1, Time Travel y recuperación; solicitar autorización independiente para crear `lead_mail_outbox` en la base **exclusiva de FLUYNOVA**.
3. Confirmar que Cloudflare Email Service esté disponible en la cuenta, su plan/precios, y que existe un dominio **propio y verificado** autorizado como remitente. No inventar dirección de salida, no asumir que se puede enviar desde `gmail.com`.
4. Verificar que `contacto.fluynova@gmail.com` sea un **destino habilitado**; restringir `send_email` con `destination_address` a esta dirección y restringir el remitente verificado. Es una modificación de Wrangler/Cloudflare que exige autorización explícita.
5. Habilitar `ENABLE_MAIL_OUTBOX` y el despacho solamente bajo permisos separados; integrar la llamada al despachador desde Cron/Queue **después de revisar protección de concurrencia, recuperación de `sending` y operativa de errores ambiguos**. La cola no sale sola por estar creada.
6. Para el estado `delivered`, configurar una **suscripción de eventos de Email Sending** en Cloudflare Queues, con consumidor autenticado. `recordVerifiedDeliveryEvent` es un adaptador de datos, NO autentica una carga JSON por sí sola; **jamás** conectar esa función a HTTP público sin control adicional.
7. Ejecutar una consulta ficticia remota y un correo real **solo después de autorización específica** y sin afirmar éxito hasta ver el mensaje en Gmail y los eventos independientes. Definir retención y limpieza del outbox y el proceso de atención comercial.

## Fuentes primarias

- Cloudflare Email Service Workers API, `send_email`, `EMAIL.send` y `messageId`: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
- Restricciones de destinatario y remitente por binding: https://developers.cloudflare.com/email-service/configuration/send-bindings/
- Eventos `message.delivered`/`message.bounced` desde Queues: https://developers.cloudflare.com/email-service/reference/event-subscriptions/
- Atomicidad de D1 `batch()`: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch

**No se envió ningún correo real, no se activó Email Service, no se modificó Cloudflare, Render, DNS ni D1 remota.** Esta preparación no cierra el Paso 06 completo ni el bloqueo previo del Paso 04B.
