# FLUYNOVA — Diagnóstico de disponibilidad y arranque en frío (05/11/2026)

**Estado:** documentado en la rama `feature/laboratorio-conversion-referencias-20261104`. Sin merge, despliegue, modificación de variables, formularios enviados ni gastos.

## Hallazgos observados (Render, servicio fluynova-web)

- Servicio `srv-dbcemlom7kps73ddvi0g`, tipo web service Python, plan `free`, rama de producción `main` con autodespliegue. Último deploy activo consultado: commit `8549828b53f4c2890888ca7db9777a04fefc5ae7`, finalizado el **03/11/2026 14:14 UTC**.
- El log de aplicación exhibe ciclos de actividad y apagado: inicio `04/11 19:49:31 UTC` y cierre `20:04:10 UTC`; inicio `05/11 00:18:29 UTC` y cierre `00:33:49 UTC`; inicio `05/11 01:06:52 UTC` y cierre `01:22:02 UTC`; inicio `05/11 09:31:54 UTC` y cierre `09:46:37 UTC`. Todos duran aproximadamente 15 minutos.
- Cuando la aplicación estuvo iniciada se registraron respuestas `GET /` y `GET /api/config` con **HTTP 200** (por ejemplo, `05/11 02:17:29 UTC` para la configuración).
- El cliente de navegación externa no logró abrir los endpoints en esta sesión; **no prueba por sí solo que estén caídos para todos los usuarios**. Los indicadores temporales de métricas consultados no devolvieron puntos.
- Los ciclos son compatibles con suspensión por inactividad del plan gratuito. La evidencia **no permite adjudicar con certeza cada HTTP 503 a arranque en frío**; faltan mediciones del proxy en el instante de los errores.

## Nuevo diagnóstico de solo lectura

Ejecutar explícitamente desde el repositorio de desarrollo:

```bash
node tests/hosting-cold-start.js --online
```

- Reutiliza `tests/contact-readiness.js` para hacer exclusivamente `GET /api/health` y `GET /api/config` del host fijo `https://fluynova-web.onrender.com`.
- Hasta **3 muestras** con espera de **5 segundos**; reintenta solamente ante HTTP 502, 503, 504 o error de red/timeout; no redirige, no envía formularios, no lee Gmail.
- Distingue `RESPONDIO_EN_PRIMER_INTENTO`, `RECUPERADO_EN_REINTENTO`, `FALLO_TRANSITORIO_REPETIDO` y `RESPUESTA_INVALIDA_O_ERROR_NO_TRANSITORIO`. Son descripciones de *muestras*, no garantías de disponibilidad.
- El resultado contiene `canClaimReception:false` y `canProveColdStartCause:false`. Incluso si `contact_enabled` aparece habilitado no se puede declarar que llega correo.
- Pruebas con mocks locales: **9/9 PASS** mediante `node --test tests/hosting-cold-start.test.js` y `node --check tests/hosting-cold-start.js`, Node 22.16.0. No se ejecutó el modo `--online` en esta validación ni la suite completa.

## Decisión recomendada (no aplicada)

Para que un usuario pueda **abrir el catálogo y preparar la consulta incluso cuando el backend duerme**, separar el front comercial en hosting estático de alto nivel de disponibilidad y mantener la API opcional aislada:

1. Construir en rama una copia estática del contenido comercial con rutas/recursos verificados y alternativa de correo sin API; no mover el sitio publicado todavía.
2. Ajustar dependencias de `/api/config` y Guardián para que fallen de forma segura; no habilitar FormSubmit sin activación y confirmación de recepción real.
3. Probar en URL de vista previa, desktop/móvil, formularios y enlaces. Considerar Cloudflare Pages o un sitio estático Render ya disponible, evitando servicios y cuotas nuevas sin consentimiento.
4. Solo con revisión visual y aprobación explícita: migrar el front comercial. Mantener documentación de SEO, origen, certificados, DNS y reversión.

**Bloqueos independientes:** verificar realmente recepción de FormSubmit en `contacto.fluynova@gmail.com`, revisar activación del proveedor y obtener autorización para una consulta ficticia de prueba. El README histórico menciona pruebas del 21/10/2026, pero no son validación actual.

**No atribuir ventas ni estabilidad garantizada a esta prueba.**
