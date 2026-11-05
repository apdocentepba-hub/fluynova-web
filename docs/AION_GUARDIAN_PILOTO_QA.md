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

## Evidencias y alcance de las pruebas
- 19 casos de reglas guiadas comprobados en motor V8 con API de test de Node emulada.
- 9 casos de lógica de interfaz comprobados en V8 con DOM emulado.
- 4 casos del archivo `tests/guardian-preview.test.js` ejecutados en V8 con módulos Node emulados: 4/4.
- 10 casos de un *fragmento equivalente* de los controles de seguridad Python ejecutados con Python local: 10/10.
- **No se afirma** que esos resultados prueben el entorno Node íntegro, FastAPI completo, Render ni un navegador real.
- No se verificó el estado del nuevo despliegue en Render: el conector solicitó seleccionar el espacio de trabajo.

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
**PENDIENTE:** ejecutar Node y Python completos sobre el checkout real; comprobar último deploy/commit de Render; realizar prueba real HTTP y de navegación; verificar logs sin contenidos privados y estabilidad del laboratorio. Hasta entonces **no está certificado ni listo para producción**.
