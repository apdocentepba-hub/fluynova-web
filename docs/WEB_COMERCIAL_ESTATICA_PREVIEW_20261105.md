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
