# AION × GUARDIÁN — control de calidad del piloto
Fecha de trabajo: 2026-11-05

## Alcance y aislamiento
- Repositorio: `apdocentepba-hub/fluynova-web`
- Rama exclusiva: `feature/aion-guardian-chat-piloto-20261105`
- Servicio de vista previa previsto: `fluynova-aion-guardian-lab-20261105`
- Producción `main` comprobada en la última comparación: `8549828b53f4c2890888ca7db9777a04fefc5ae7`.
- No mergear a `main`, activar proveedor de IA externo, habilitar costos ni conectar WhatsApp sin autorización independiente.

## Qué se implementó
1. Diagnóstico adaptativo: distingue tarea, frecuencia, objetivo, disparador y destinatarios. Si el objetivo es «avisos», pregunta por el evento y sus receptores.
2. Respuesta final con fuente, frecuencia declarada o desconocida, evento, destinatarios y simulación con datos ficticios. No afirma que WhatsApp esté integrado.
3. IA generativa **opcional, todavía sin habilitar**. Requiere `GUARDIAN_EXTERNAL_AI_ALLOWED=1`, además de `GUARDIAN_AI_KEY`, `GUARDIAN_AI_MODEL` y consentimiento individual.
4. El laboratorio fuerza modo guiado y no muestra el consentimiento a IA externa aunque la API anuncie capacidad. El formulario comercial se abre por enlace explícito y sin parámetros derivados del chat.
5. Detección preventiva de referencias a DNI, CUIL, CUIT, contraseñas, tokens, emails y secuencias largas tipo tarjeta antes de enviar texto a proveedor externo. No sustituye DLP profesional.
6. Controles locales «Copiar diagnóstico» y «Borrar chat». No se crea base de conversaciones.

## Evidencias y alcance de las pruebas — actualización 05/11/2026
- Render laboratorio: servicio `srv-dbm8p5l6e07s73bgaivg`, rama `feature/aion-guardian-chat-piloto-20261105`, autoDeploy apagado.
- Despliegue `dep-dbmd62gae00c73ambkng` en estado `live` el 05/11/2026 a las 19:04:06 UTC, commit `fbac7ff0022c563c238248542ea4e333a287d345`.
- **75/75 subpruebas reales de Node.js aprobadas; 0 fallidas**, comprobadas en los logs del build de Render. Incluyen reglas de diagnóstico, interfaz con DOM simulado y prueba Python invocada mediante `unittest`.
- La prueba Python usa credenciales ficticias: no activa ni llama a ningún modelo externo.
- El laboratorio estático ya **no hace GET a /api/guardian/capabilities**: evita la consulta a una API inexistente. Regresión incluida en `tests/guardian-preview.test.js`.
- Producción Render `fluynova-web` permanece `live` en `8549828b53f4c2890888ca7db9777a04fefc5ae7` y `main` coincide con ese commit.
- Los logs de compilación prueban que se ejecutaron las suites. **No equivalen** a una prueba de navegación sobre el URL público ni verifican un modelo generativo real.
- La lectura directa del URL publicado y el navegador conectado siguen sin poder ejecutarse en este entorno; no se afirma HTTP 200 ni funcionamiento visual confirmado.

## Comandos para pruebas completas (desde la raíz del repositorio)
```sh
node --test tests/guardian-aion.test.js tests/guardian-preview.test.js
python -m unittest discover -s tests -p 'test_guardian_ai_security.py'
```

## Matriz de aceptación funcional
- A: Analizar mi proceso → Respondo consultas por WhatsApp → Todos los días → Avisos automáticos → Cuando llega una consulta → Mi equipo. Debe producir diagnóstico con frecuencia «diario», objetivo «avisos automáticos», disparador «nueva consulta» y destinatario «equipo interno».
- B: Analizar mi proceso → Respondo consultas por WhatsApp → Quiero avisos automáticos. No debe convertir avisos en frecuencia; debe pedir disparador, y mantener la frecuencia como «por determinar».
- C: El usuario puede copiar el diagnóstico sin enviarlo a ninguna API; «Borrar chat» descarta la conversación de la pestaña y permite empezar de nuevo.
- D: El laboratorio no envía a proveedores externos. Las credenciales aisladas no activan el proveedor; la API rechaza datos sensibles reconocibles.
- E: Una prueba real HTTP y visual de Render debe verificar que el servicio corre el mismo SHA que GitHub, y que la web principal sigue en su SHA previo.

## Criterio de certificación
**REALIZADO:** pruebas Node y Python dentro del build de Render; verificación de despliegue `live`, commit y aislamiento de producción.

**PENDIENTE:** validar carga de HTML/CSS/JS por HTTP en el URL público, prueba real de interacción en Chrome/Firefox y revisión de errores en consola/red; verificación de privacidad en navegador real. No activar IA generativa externa sin autorización y revisión de costos/permisos. Hasta entonces **no está certificado para fusión en producción**.

**Nota de versionado:** cambios solo documentales posteriores al último build no exigen desplegar nuevamente; verificar SHA del último build antes de anunciarlo como publicado.
