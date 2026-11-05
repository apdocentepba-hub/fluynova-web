# FLUYNOVA — Puerta de calidad del formulario (04/11/2026)

**Estado: laboratorio, NO despliegue. No hubo envíos a FormSubmit ni a terceros.**

## Qué comprobamos

1. El servicio `fluynova-web` de Render continúa configurado para `main`, plan gratuito, última implementación consultada del 03/11/2026 marcada `live`; eso NO garantiza disponibilidad del servidor ni de cada ruta.
2. La API pública `/api/config` y `/api/health` devolvió HTTP 503 en la verificación externa de esta sesión. No se identificó causa con suficiente evidencia; puede ser una indisponibilidad transitoria.
3. En el Gmail **FLUYNOVA** conectado no aparecieron coincidencias al buscar `FormSubmit`, `formsubmit.co` o `Activate Form`, ni mensajes de «Nueva consulta» recibidos en la cuenta. **Una búsqueda sin resultados no prueba ausencia de activación, entregas ni mensajes retenidos en la plataforma.**
4. La documentación oficial `https://formsubmit.co/` y `https://formsubmit.co/help` dice que el primer envío requiere un correo con enlace de activación. El proveedor puede guardar envíos previos durante un período limitado. El estado de activación de ESTE formulario está **no verificado**.
5. `app.py` tiene dos rutas distintas: la web usa FormSubmit (habilitada condicionalmente por `FORMSUBMIT_ACTIVE`), mientras `/api/contact` puede escribir a una base SQLite sólo con `CONTACT_STORAGE_READY=1`. No mezclar la confirmación del proveedor con el guardado local; SQLite del servicio Render gratuito no constituye respaldo duradero salvo configuración y prueba explícitas.

## Nuevas pruebas no intrusivas

### Puerta de infraestructura — GET únicamente

`node tests/contact-readiness.js --online`

- Accede **únicamente** a `GET https://fluynova-web.onrender.com/api/health` y `GET .../api/config`.
- No envía formularios, no accede a Gmail, no modifica archivos y no registra datos personales.
- Prohíbe redirecciones y respuestas no JSON o mayores de 4 KiB; usa timeout de 8 segundos por ruta.
- Resultados: `NO_CONFIABLE`, `FORMULARIO_DESHABILITADO` o `CONFIG_HABILITADA_SIN_RECEPCION_PROBADA`.
- **Ningún resultado se interpreta como prueba de recepción de correos**. Se requiere activación confirmada y mensaje propio de prueba recibido antes de usar la web para captación comercial.
- Sólo se ejecuta en forma explícita y es optativo; no se agregó monitoreo recurrente, GitHub Actions ni servicio externo.

### Suite de API real en memoria / disco temporal

Preparación en entorno aislado, sin secretos de producción:

```
python -m pip install -r requirements.txt -r tests/requirements-contact-qa.txt
python -m pytest -q tests/test_contact_api_local.py
node --test tests/*.test.js
```

- Las 12 pruebas Python usan `fastapi.testclient.TestClient` real y **SQLite en directorio temporal por test**. Se parchea `guardian_ai.router` a un router vacío y se intercepta `optional_notification`; ningún SMTP sale del proceso.
- Se probaron `CONTACT_STORAGE_READY` cerrado por defecto, creación/lectura SQLite con datos ficticios en el laboratorio, consentimiento, correo/categoría/mensaje/nombre inválidos, honeypot, tamaño máximo, JSON corrupto, límite de cinco contactos/hora por IP, ruta administrativa deshabilitada y salud.
- La ruta GET `/api/contact` devuelve 404 en esta aplicación por el montaje estático, no 405; en ambos casos no crea contactos. La primera expectativa de prueba suponía 405, se corrigió tras observar la respuesta real.
- **12/12 Python y 44/44 Node PASS** en el laboratorio de esta sesión. Node probó el helper de disponibilidad con **10 casos nuevos** (503, redirección, HTML, esquema inválido, cuerpos grandes, conexión fallida y configuración habilitada sin inferir recepción).

## Puerta antes de campañas o despliegue

- Confirmar que Render responde de forma estable, y verificar `contact_enabled` y `contact_method` con GET (no basta para demostrar recepción).
- Comprobar activación de FormSubmit desde la cuenta FLUYNOVA, incluyendo correo no deseado; no hacer envíos de prueba sin autorización.
- Ejecutar **una** prueba controlada desde una página real, con datos ficticios y consentimiento, y confirmar que llegó al buzón de FLUYNOVA. Esta acción NO se ejecutó.
- Validar todos los enlaces del laboratorio; al recibir la consulta, conservar UTM de origen/demostración, con una explicación clara de privacidad.
- Ejecutar suite íntegra sobre `git checkout` exacto / CI, especialmente FastAPI real con módulo `guardian_ai` real, y revisar persistencia y respaldos antes de considerar el backend de almacenamiento para producción.
- Sólo después, revisar PR #17, aprobar cambios visuales y decidir despliegue. `main` permanece sin cambios.

**Prohibido interpretar `FORMSUBMIT_ACTIVE=1` como prueba de entrega: es solamente una opción de configuración.**
