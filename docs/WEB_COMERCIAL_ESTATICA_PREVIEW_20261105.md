# FLUYNOVA — Vista previa comercial estática (05/11/2026)

**Alcance:** vista de revisión separada. **NO es el dominio comercial oficial ni recibe envíos automáticos.** No modifica el servicio Python de producción, `main`, DNS, FormSubmit, Gmail, precios ni bases de datos.

## Evidencia real

- Rama: `feature/web-comercial-estatica-preview-20261105`, originada del commit `90e461d907e9e1563bc0111ace3e490d48cad70c` (desarrollo del PR #17).
- Generador reproducible: `node scripts/build-static-commercial-preview.mjs`.
- Destino: `dist-commercial-static-preview/` (se genera en tiempo de compilación; no es la carpeta `static/` original).
- Render, sitio **estático independiente**, autoDeploy desactivado: `srv-dbm655ec6qcc7383npng`.
- URL: https://fluynova-comercial-estatica-preview.onrender.com/
- Deploy inicial `dep-dbm655mc6qcc7383nr00`, commit `1a621005fcd4c3ebf1bb9b19199718627a107aca`, estado `live` el 05/11/2026. Log del build confirma `pages:14`, `externalSubmissions:false` y `backendRequired:false`.
- Una lectura real de rutas mediante navegador/extractor verificó contenido de /, /webs/, /laboratorio/, /guardian/ y /privacidad.html. El meta robots de las páginas consultadas indica `noindex,nofollow,noarchive`.
- **10/10 pruebas locales** con Node 22.16.0 en fixtures que ejercitan transformaciones, fail-closed, copia de assets y conservación del origen. SHA de GitHub para código y tests coincidentes con los archivos locales: generador `773048e69dd275d46ad3d0ce5a31ae6476a4994f`; pruebas `c507b04aabf4ca68e82375e9473fcfa97a9e590c`.

## Salvaguardas de la vista

- No consulta `/api/config` ni la API del Guardián; el asistente queda en modo de respuestas guiadas locales.
- La acción HTML del formulario principal ya no dirige a FormSubmit y el botón de envío inicial queda `disabled`.
- El JavaScript compilado elimina el envío AJAX a FormSubmit y el envío de respaldo que omitía eventos de submit.
- El usuario puede **preparar un correo** localmente y elegir abrir su aplicación de correo. Esta acción requiere una intervención explícita; **no demuestra entrega**.
- Enlaces `/privacidad` pasan a `/privacidad.html` en la copia, porque no existe el enrutador FastAPI.
- Las páginas se marcan `noindex`, `robots.txt` prohíbe indexación y se excluye el sitemap de la vista. El sitio publicado conserva su SEO y sus rutas.
- El constructor aborta si ya no coincide un punto crítico del HTML/JS: falla antes de habilitar un envío involuntario.
- Nunca ejecutar el build apuntando a carpetas de trabajo o producción distintas de la ruta de salida prevista; el builder reemplaza el directorio `dist-commercial-static-preview` después de comprobar que no sea el origen ni uno de sus ancestros/descendientes.

## Pendientes de aceptación

1. Navegador interactivo real (escritorio + móvil): verificar diseño, menú, botones, cálculo y Guardián local.
2. Probar manualmente botón **Preparar consulta por correo** y navegación a política de privacidad, **sin enviar el correo**.
3. Comprobar todas las páginas, demos externas y recursos estáticos con un smoke test HTTP reproducible.
4. Confirmar activación del proveedor y recibir correo ficticio de prueba autorizado en Gmail antes de habilitar envío automático comercial.
5. Definir estrategia definitiva de alojamiento, SEO, dominio/canonicals y reversión, con autorización antes de migrar producción.
6. Vigilar uso compartido de minutos de build y ancho de banda del sitio de pruebas; la gratuidad base no elimina posibles cargos por excedentes.

**NO MERGE / NO CAMBIO PRODUCCIÓN / NO ENVÍOS / NO COBROS.**

## QA de continuidad — 05/11/2026, segunda revisión

- Se comprobaron **14 rutas** públicas de la vista previa mediante lecturas HTTP externas: `/`, `/webs/`, `/laboratorio/`, `/guardian/`, `/cotizador-gestion/`, `/diagnostico/`, `/soluciones-express/`, `/privacidad.html`, `/instagram/`, `/guia-automatizacion/`, `/productos/`, `/software-a-medida/`, `/automatizacion-de-planillas/` y `/automatizar-consultas-y-presupuestos/`. Todas devolvieron contenido y la directiva `noindex,nofollow,noarchive`. Esto acredita respuestas puntuales, **no disponibilidad continua**.
- Los cuatro enlaces externos de demostración devolvieron contenido esperado: `fluynova-demo-pasteleria.pages.dev`, `fluynova-demo-distribuidora.pages.dev`, `fluynova-ops-lab-preview-20261104.onrender.com/demo.html` y `fluynova-cotizador-lab-20261104.onrender.com/cotizador-gestion/`. Son demos con datos ficticios.
- El generador se reforzó: **todas las páginas incluyen un aviso de VISTA PREVIA**, enlazan a la web oficial y aclaran que el envío automático está desactivado. `verifyOutput` examina los archivos producidos antes de finalizar la compilación y aborta si faltan controles fundamentales.
- Suite local Node 22.16.0: **12/12 PASS**. Cubre aviso, privacidad, ausencia de POST a FormSubmit, bloqueo de API del Guardián, fuente intacta, y detección de alteraciones deliberadas. SHA de objeto Git de los archivos probados cotejados con GitHub: generador `621e3dcc313523479e68ce0ccf7684188e4fbba6`; tests `35338c53eec5744c730508c73a5075f78fe8ac51`.
- Render: despliegue de vista previa `dep-dbm6bf5g1s2s73c8ihmg` del commit `3706094f09361648274f86b86ff88e37c2134df0` marcado `live`, con log explícito `pages:14` y `verifiedPages:14`.
- **Límite actual:** las comprobaciones externas extraen contenido/metadata, pero no ejecutan toda la experiencia interactiva en Chromium de un usuario real. El extractor omite algunos elementos fuera de `main`, por lo que no permite certificar visualmente el aviso; esto sí quedó verificado en el generador y su compilación en Render. No se enviaron formularios reales ni correos.
- La automatización de navegador con créditos de un servicio externo **no se ejecutó**; su saldo actual es insuficiente. No cargar saldo ni generar cargos sin autorización.
- Render sigue configurado con **autoDeploy: no** en esta vista; el servicio Python oficial mantiene el commit de producción `8549828b53f4c2890888ca7db9777a04fefc5ae7`.

**Pendiente:** navegador real desktop/móvil, validar preparación de mailto sin envío, accesibilidad con teclado, activación y recepción actual de FormSubmit y aprobación de migración. Ninguna de esas acciones se infiere del 12/12 PASS.


## Corrección posterior — 05/11/2026: formulario real en vista previa

**Esta sección reemplaza la descripción anterior de "envío automático bloqueado" para la vista estática.** Tras una prueba visual del usuario que mostró el botón deshabilitado, se restauraron las rutas originales de FormSubmit **solamente en la vista previa aislada**.

- En el HTML, `action="https://formsubmit.co/contacto.fluynova@gmail.com"` y `method="POST"` quedan disponibles. El botón ya no tiene atributo `disabled`; consentimiento obligatorio, validación y honeypot permanecen.
- En el JavaScript, la disponibilidad de la vista previa ya no consulta `/api/config` de FastAPI. `contactEnabled` se habilita para que el visitante pueda enviar una consulta voluntaria mediante `fetch('https://formsubmit.co/ajax/...')`, con alternativa de POST tradicional y opción de preparar el correo si algo falla.
- Se agregó un aviso visible a todas las páginas: **la vista previa puede generar envíos reales**, no ingresar datos escolares ni sensibles.
- La compilación comprueba destinatario exacto, consentimiento, JavaScript de envío, Guardián sin conexión API, 14 páginas noindex, sin sitemap.
- Pruebas de construcción en Node 22.16.0: **12/12 PASS**, sin red ni mensajes enviados. SHA GitHub del generador `9ea9c3b20ed63713dee54ed5343f8c7429858446`; SHA de tests `7f4407297feb63f74e52b68d8b9b173b3e843b92`.
- Despliegue manual de Render en este servicio de vista previa: `dep-dbm6ghp5efls73cl00cg` (estado `live`, **14 páginas verificadas**). Registro de Render: `externalSubmissions:true` y `deliveryVerified:false`.
- Comprobación HTTP de selector del formulario en la URL publicada: botón habilitado «Enviar mi consulta», `action` correcto, consentimiento requerido y respaldo manual presente. No se envió ninguna consulta con este control.
- Gmail FLUYNOVA confirma recepción **histórica** de mensajes del 30/10/2026 de la web oficial y correo de activación de FormSubmit. **No hay aún comprobación de que el nuevo dominio esté activado ni que su correo llegue al buzón**.
- FormSubmit podría requerir activación específica del origen de vista previa. La prueba de recepción autorizada con datos ficticios propios debe hacerse antes de afirmar «formulario operativo».

**No fusionar en main / no cambios en web oficial.**

## Control automático reproducible de rutas — 07/11/2026

**Avance ejecutado solamente en la rama estática; sin fusión, despliegue de Render ni envíos.**

- Se agregó `scripts/verify-static-routes.mjs`, que lee la salida estática, resuelve referencias locales `href`, `src` y `action`, acepta rutas relativas, parámetros y fragmentos y falla ante destinos internos inexistentes o esquemas de URL inseguros. No hace pedidos de red ni prueba correos.
- `scripts/build-static-commercial-preview.mjs` llama ahora obligatoriamente a `verifyStaticRoutes(dest)` antes de concluir. Si falta un recurso interno, el proceso de compilación finaliza con error. No altera el directorio fuente.
- Se agregaron cuatro pruebas de regresión en `tests/verify-static-routes.test.mjs` y el workflow de GitHub Actions `.github/workflows/fluynova-static-preview-qa.yml`: solo tests, build estático y validación offline.
- **Evidencia de GitHub Actions:** [run 42367074975](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42367074975), commit `8994c0df8e1e1f501d04b13d9d7b9e4b819d3efb`, **SUCCESS**. Etapa de tests: **16/16 PASS** (12 del compilador + 4 nuevas); etapa de build reejecutó **12/12 PASS**. La compilación reportó **14 páginas**, y el verificador en la salida produjo **262 referencias inspeccionadas**, **145 internas**, **73 externas**, **44 omitidas por ser anclas/esquemas no navegables**, y **0 referencias internas inválidas**.
- Los checks de **Cloudflare Pages** para compilaciones de la rama en `fluynova-demo-pasteleria` y `fluynova-demo-distribuidora` marcaron `failure` en ese commit; las causas no están acreditadas por los datos disponibles. **Los dos sitios públicos existentes respondieron HTTP 200** después del fallo, con sus contenidos ficticios esperados. No interpretar un check fallido como caída comprobada del sitio actual ni como una compilación exitosa.
- Comparación GitHub: la rama de vista previa está **65 commits por delante de `main`** e incluye cambios experimentales de laboratorio. **NO fusionarla directamente a producción**: antes hay que aislar únicamente los archivos necesarios para la arquitectura aprobada, comparar contra `main` y verificar todas las dependencias.

**Límites críticos:** no se ejecutó envío controlado de FormSubmit ni recepción actual en Gmail. La prueba no valida páginas externas, accesibilidad móvil completa, rendimiento, disponibilidad sostenida o legalidad del tratamiento de datos. El build de vista previa conserva `noindex`, aviso de laboratorio y dirección canónica de la web oficial; **no es un artefacto listo para sustituir producción**.

**Próxima puerta de aceptación:** recepción end-to-end de un mensaje ficticio autorizado, auditoría visual/teclado en navegador real, decisiones de dominio y SEO, reversión y autorización específica antes de publicar.


## Incidente real de formulario — 07/11/2026, captura del visitante

- Al pulsar **Enviar mi consulta** desde la vista `https://fluynova-comercial-estatica-preview.onrender.com/`, el proveedor abrió una pestaña `https://formsubmit.co/contacto.fluynova@gmail.com` y respondió **“Unable to submit form — Make sure you open this page through a web server”**. No hubo confirmación de recepción.
- El HTML publicado tenía `<form ... target="_blank" rel="noopener noreferrer">` y carecía de un campo `_url`. Esto elimina la referencia de origen y está alineado con la causa documentada oficialmente por FormSubmit: https://formsubmit.co/help, sección “Why am I always getting an error Unable to submit form?” La FAQ recomienda `<input type="hidden" name="_url" value="https://...">`.
- **Corrección implementada en rama de desarrollo, NO en la URL pública**: conservar `rel="noopener"` sin `noreferrer`, incorporar `_url` con valor por defecto de la URL HTTPS exacta de esta vista y actualizarla con `window.location.origin + window.location.pathname` en el evento de envío, sin parámetros UTM ni fragmentos. Se verifica el protocolo HTTPS y la existencia del campo antes de permitir el `POST`.
- Nuevas pruebas de regresión: control de presencia de campo, no supresión de la cabecera Referer en el formulario y simulación real del manejador `submit`, incluyendo rechazo por honeypot, datos inválidos, destino alterado, HTTP y ausencia de `_url`.
- GitHub Actions: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42420542283 — **SUCCESS**, **19/19 tests PASS**, 14 páginas compiladas y 145 referencias internas válidas. No se envió correo ni formulario para ejecutar esa prueba.
- La búsqueda posterior en Gmail FLUYNOVA de mensajes FormSubmit recientes del 07/11 devolvió **0 coincidencias**. Esto no demuestra que no haya mensajes en cualquier momento, pero es consistente con el rechazo mostrado.
- La URL pública **continúa sirviendo el formulario viejo** hasta que se autorice y ejecute un despliegue manual de esa vista de Render, que tiene `autoDeploy=no`. **NO afirmar que el formulario público quedó reparado**, ni enviar enlaces de reintento como si hubiera cambiado.
- Antes de considerar el incidente resuelto: aprobar despliegue **solo del sitio de prueba**, verificar el HTML servido y realizar una única consulta ficticia voluntaria para comprobar FormSubmit y recepción en Gmail. No fusionar `main` ni cambiar la web pública oficial.
