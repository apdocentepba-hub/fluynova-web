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

## Cierre de regresión sobre el código real y seguridad API — 04/11/2026

Se recuperaron de GitHub los scripts y páginas referenciados por **todos los archivos `tests/*.test.js`** de la rama de desarrollo. Se contrastaron los SHA de objeto Git en los archivos transferidos; `app.py` se recuperó aparte en su representación base64 exacta, evitando que una exportación de Google Docs añadiera líneas vacías. Las primeras dos ejecuciones fallaron por **páginas faltantes en la copia local** (`soluciones-express/` y `automatizacion-de-planillas/`), no por una regresión real. Tras recuperar esas páginas se obtuvo la suite global **136/136 Node PASS**.

Se identificaron dos riesgos latentes en la API alternativa `POST /api/contact` de FastAPI (normalmente deshabilitada):
- `await request.body()` almacenaba todo el cuerpo antes de comprobar su tamaño. Se reemplazó por `contact_body_limited`, que inspecciona `Content-Length` cuando existe y **lee el stream con tope 16 KiB**, rechazando longitud malformada (400) y exceso (413).
- Con `TRUST_PROXY=1`, la aplicación utilizaba directamente el primer valor de `X-Forwarded-For`, que podía ser falsificado por un visitante para evadir el límite de consultas. Ahora la clave se obtiene solo de `request.client.host` proporcionado por ASGI; cualquier interpretación de cabeceras de proxy debe configurarse y auditarse en la entrada confiable de Uvicorn/Render. El límite sigue siendo **en memoria**: no equivale a un rate limiter global entre procesos ni persiste tras reinicios.

**Nueva evidencia:** `node --test tests/*.test.js` → **136/136 PASS** y `python -m pytest -q tests/test_contact_api_local.py` → **15/15 PASS** sobre el árbol local de fuentes de la rama, con FastAPI real, SQLite temporal, sin SMTP externo y sin datos de clientes. Se agregaron tres tests Python para transferencia sin longitud declarada, longitud inválida e IP simulada cambiante con `TRUST_PROXY=1`. `python -m py_compile app.py` también aprobó. Los blob SHA exactos subidos a GitHub y comprobados son `app.py` = `3a612825ea2bf536cb2367899246ec59e2229c6a`, test Python = `67f6314d9767f0e45f74e3cd895e60e22db562fa`.

**Límites:** no se efectuó `git clone` por falta de red directa en el contenedor; se reconstruyeron y cotejaron los archivos necesarios para la suite, no todos los archivos binarios y comerciales del repositorio. No se lanzó GitHub Actions, no se publicó, no se modificó `main`, no se probó FormSubmit en vivo y no se envió ninguna consulta. La persistencia duradera y la recepción de mensajes **continúan pendientes**.
