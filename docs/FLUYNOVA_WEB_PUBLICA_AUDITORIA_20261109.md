# FLUYNOVA — auditoría de la página pública (09/11/2026)

**Objetivo:** distinguir lo que un visitante puede abrir de lo que está preparado en ramas de laboratorio. **Solo lectura:** no se enviaron consultas, no se activó Cloudflare/D1, no hubo despliegue ni contacto a terceros.

## Dirección actual y plataforma

- Web pública: https://fluynova-web.onrender.com/
- Servicio Render conectado: `fluynova-web` (`srv-dbcemlom7kps73ddvi0g`), web service **Python / FastAPI con Uvicorn**, plan **free**, repositorio `apdocentepba-hub/fluynova-web`, rama `main`, autoDeploy=commit.
- Render confirmó como **último deploy live** `dep-dbnra4a9lscs73ccnjh0`, Git commit `1504e396a2e490b52d15932f9ad1a5fc389dc53b` del **07/11/2026 23:33 UTC**. Render confirmó build y deploy exitosos. No atribuir a producción commits de PR #21/#23, que siguen en DRAFT.
- Primera comprobación pública: **HTTP 503 / “Render - Application loading”**. En una nueva comprobación de la misma URL: **HTTP 200**, título **“FLUYNOVA — Hacemos que las cosas funcionen solas”**. Evidencia compatible con arranque frío de instancia Render Free, pero no prueba disponibilidad permanente ni un SLA.

## Contenido público confirmado mediante lectura de la página

La web muestra el titular **«Menos tareas repetidas. Más tiempo para lo que importa»**, servicios de automatización, software a medida, datos/integraciones e IA aplicada, demostraciones comerciales, cotizador de páginas web, diagnóstico gratuito, guía de tareas repetitivas, calculadora de esfuerzo, proyectos propios y formulario/contacto directo.

Rutas de navegación ofrecidas por el inicio:

- https://fluynova-web.onrender.com/diagnostico/ — evaluación inicial.
- https://fluynova-web.onrender.com/soluciones-express/ — soluciones y precios orientativos.
- https://fluynova-web.onrender.com/webs/ — páginas web y cotizador.
- https://fluynova-web.onrender.com/#contacto — contacto.
- https://fluynova-demo-pasteleria.pages.dev/ — demostración Alba & Miga (sitio ficticio, enlace de la web).
- https://fluynova-demo-distribuidora.pages.dev/ — demostración Nórdica Pro (sitio ficticio, enlace de la web).

**Las demos son ejemplos y no clientes reales**. No se afirma disponibilidad de los enlaces externos sin una comprobación separada.

## Recepción de consultas: estado REAL, no confundir flags con correos

- `GET https://fluynova-web.onrender.com/api/config` devolvió HTTP **200** con `{"contact_enabled":true,"contact_method":"formsubmit"}`.
- El HTML publicado incluye formulario `action="https://formsubmit.co/contacto.fluynova@gmail.com"`; JavaScript intenta primero la API AJAX de FormSubmit y tiene alternativa de envío tradicional si falla.
- El correo directo `contacto.fluynova@gmail.com` está mostrado de forma destacada para que alguien pueda escribir aunque la validación automática esté pendiente.
- **NO se envió un formulario de prueba en esta auditoría** (para evitar contactar a terceros o enviar datos sin permiso), por lo que `contact_enabled=true` **no certifica entrega real a Gmail**. Tampoco confirma persistencia en Cloudflare D1: el receptor D1 nuevo está solo en rama de revisión y cerrado.
- Se observaron dos imprecisiones del HTML que está efectivamente en producción: menú con dos entradas equivalentes para `/webs/` y descripción de «FLUYNOVA Web» afirmando «formulario conectado al correo», que no está certificado extremo a extremo.

## Cambios seguros aplicados SOLO en PR #21

En `feature/fluynova-static-clean-from-main-20261107`, **sin tocar main**, se conserva una sola entrada `/webs/`, se organiza la navegación y se reemplaza el claim por el texto verificable:

> Web adaptable a celulares, ejemplos navegables y contacto directo por correo. El formulario automático sigue en verificación.

Se agregó la prueba de regresión `web comercial: menú único y comunicación honesta de disponibilidad` a `tests/static-clean-main.test.mjs`. La CI de la rama verifica el candidato; no hace merge ni lo publica.

## Auditoría visual de desbordamiento horizontal — 09/11/2026

- Inspección con navegador sobre la web **pública**: a `window.innerWidth=1920`, el documento reportó `document.documentElement.scrollWidth=2155`, excediendo el viewport en **235 px** (frente al ancho efectivo de contenido, 1905 px, el exceso es 250 px). No se envió ningún formulario.
- El único elemento cuyo rectángulo excedía el borde derecho fue `div.ambient.ambient-one`, resplandor decorativo de **490 px** con `right:-250px`. Ese desplazamiento explica el exceso reportado; no es contenido esencial.
- Cambio de contención **solo en PR #21**: `static/styles.css` aplica `overflow-x:clip` a `html`, preservando el diseño y evitando que el resplandor decorativo amplíe el desplazamiento horizontal. No se cambió el sitio en producción.
- La prueba Chromium de PR #21 ahora recorre **320, 390, 768, 900, 1024, 1366 y 1920 px**. Observación relevante: el candidato aislado **ya había aprobado 1920 px antes del ajuste**, por lo que esa prueba no reproduce el comportamiento de Render. El cambio es una defensa basada en la regla CSS inspeccionada; su eficacia en producción queda **pendiente de validación posterior a una publicación autorizada**.
- Antes de considerar cerrado el defecto hay que comparar en un mismo navegador la web previa y una publicación aprobada (métricas `innerWidth`, `clientWidth`, `scrollWidth`, capturas escritorio/móvil). No publicar para hacer esta prueba sin autorización.

## Pendientes reales

1. Probar envío FormSubmit → Gmail **solo con autorización explícita**, usando datos ficticios y verificando recepción real. Hasta entonces no declarar que el contacto está resuelto.
2. Conservar la web pública accesible y evaluar la latencia por arranque frío del plan Free con métricas reales de Render antes de prometer disponibilidad estable.
3. Revisar visualmente móviles y navegación de páginas interiores, y comprobar enlaces externos de demos/cotizador sin formularios ni datos.
4. No fusionar PR #21/#23 ni desplegar Workers nuevos sin la aprobación y auditoría remota correspondientes.

**Conclusión:** el sitio comercial está publicado y respondió HTTP 200 tras una pantalla de carga inicial. La recepción por FormSubmit figura habilitada, pero su entrega final sigue sin comprobarse. Los desarrollos D1/Access/backup no forman parte de esa versión pública.
