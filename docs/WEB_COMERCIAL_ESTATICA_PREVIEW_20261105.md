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
