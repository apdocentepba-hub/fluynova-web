# FLUYNOVA — cierre de QA y protocolo de publicación segura
**Fecha de corte:** 15/11/2026 (America/Argentina/Buenos_Aires)
**Estado:** IMPLEMENTADO Y PROBADO EN RAMA. **NO publicado**. Sin autorización para fusionar a `main`, desplegar, contactar clientes ni contratar servicios.

## Producto exacto
El PR [#26](https://github.com/apdocentepba-hub/fluynova-web/pull/26) incorpora una **galería de tres demostraciones ficticias** y un generador de **micrositio comercial estático** (`node scripts/build-portfolio-static.mjs` → `dist-portfolio-static/`), con la portada, `contacto/index.html` y `contacto/contacto.js`.
No pretende sustituir el sitio completo, su backend FastAPI, el formulario FormSubmit ni Guardián. **No procesa compras ni envía consultas automáticamente**. El visitante describe su necesidad, genera un borrador, lo revisa y decide si lo envía. El formulario no guarda datos ni hace peticiones de red, y mantiene `noindex,nofollow,noarchive`.

## Pruebas ejecutadas y sus límites
| Control | Resultado / evidencia | Qué NO demuestra |
|---|---|---|
| Suite Node + integración | [Actions 43744488443](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43744488443): éxito | No es prueba de recepción de emails |
| Navegador Chrome real, HTML construido | [Actions 43744488427](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43744488427): éxito, 320×780, 390×844, 1440×900; sin desborde | No verifica navegadores Windows/iOS o experiencia de red móvil |
| Capturas completas y reporte | [Artefacto 14173578710](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43744488427/artifacts/14173578710), conservación 7 días | No es una publicación pública |
| URLs externas de las 3 demos | CRM, pastelería y distribuidora respondieron HTTP 200 en comprobación del 15/11 | No garantiza disponibilidad futura |
| Sitio principal Render Free | Registros: arranque, respuesta 200, apagado por inactividad y reactivación; en consultas externas se observó 503 | No se comprobó estabilidad continua |
| Recepción de FormSubmit | Gmail comercial tenía tres notificaciones **históricas de prueba** | No garantiza que hoy se envíen o reciban consultas reales |

## Mejora de captación autónoma — 15/11/2026
- [GitHub Actions visual 43772461227](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43772461227): **SUCCESS** en Chrome 320, 390 y 1440 px. Se recorrió la pantalla de consulta, se introdujo un problema ficticio y se verificó generación de un enlace de correo sin navegar ni enviar mensajes.
- [Regresiones 43772461107](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43772461107): **SUCCESS** con nueve pruebas del generador estático integradas a CI, más ocho pruebas de galería.
- Se comprobó que las cinco CTA preservan sus UTM, llevan a `contacto/index.html` y no pasan por Render para preparar el borrador. El servicio se preselecciona según `utm_content=crm/pasteleria/distribuidora`.
- Se detectó y corrigió un defecto del ZIP de Actions que omitía el formulario. [Artefacto corregido 14185390290](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43772461227/artifacts/14185390290): **13 entradas, CRC PASS**, incluyendo portada, contacto, JavaScript, capturas e informe.
- SHA-256 portada generada: `7200a9e579abaa6acae95a9c0ac3abd61541a8db9ab326680c377cafb9d5e845`; contacto: `5cbf6accacb95e304c1fda606e3bea405d5c90c092ee7bd12a4b1ee69b6adcb4`; JavaScript: `595296cf94ae2bb7de9bd6afa2c4f0fd7b4dc1a0869f8488eb064918f849fb51`.
- **No equivale a envío ni recepción real**: abrir el cliente de correo y pulsar Enviar es una decisión del visitante. Sin JavaScript, el botón de preparación queda deshabilitado y hay un enlace manual.

## Puertas de aceptación — antes de hacer públicos los enlaces
1. Confirmar presupuesto **$0 autorizado** y límites del alojamiento estático. No contratar un servicio ni seleccionar un plan pago por omisión.
2. Crear **una vista previa aislada**, sin tocar `fluynova-web.onrender.com`, `main`, DNS o los servicios existentes. Desactivar autodespliegue mientras se evalúa. Esta acción **requiere autorización específica**.
3. Comprobar por HTTPS `HTTP 200` de la página nueva, sus tres demos, móvil/escritorio y ausencia de errores en navegación; no prometer que el backend del sitio principal estará siempre disponible.
4. Probar con consentimiento un recorrido comercial de punta a punta: desde la CTA de diagnóstico hasta el Gmail comercial, identificando un mensaje sintético; **esta prueba envía correo y necesita autorización**.
5. Leer aviso de privacidad, comprobar que la vista es rotulada como demostraciones propias ficticias y sin datos reales. Revisar indexación; en staging mantener `noindex`. La autorización para aparecer en buscadores es una decisión posterior.
6. Solo después de los cinco controles: decidir publicar un vínculo hacia la galería en canales de FLUYNOVA. Esto **requiere autorización separada** porque afecta comunicaciones públicas.

## Recuperación
- Conservar una copia del artefacto probado, versión/revisión Git y SHA-256 del HTML antes de publicar.
- **No sustituir la web principal**. Ante falla del hosting de portfolio, revertir **el enlace** en la biografía/medios donde se haya publicado, a su destino previo, y dejar la web original sin cambios.
- Si se toca un servicio estático de prueba, revertir a su despliegue anterior solo con autorización; no cambiar DNS ni variables de entorno.
- Registrar hora, URLs probadas, capturas, resultados y responsable de cada verificación.

## Dependencias que bloquean el cierre comercial
- **PR #25:** contacto alternativo probado en Chrome 320/390/1440 y CI; la recepción vigente de FormSubmit todavía no fue probada en condiciones reales.
- **Hosting:** las cinco CTA comerciales del portfolio llevan ahora a una página de consulta **local al propio sitio estático**. La navegación secundaria hacia la web oficial todavía puede experimentar 503 por arranque en frío.
- **Ventas:** no hay aceptación de presupuesto ni cobro confirmado; mostrar demostraciones no equivale a cerrar una venta.

## Publicación aislada autorizada y resultado en staging — 15/11/2026
- **Autorización:** usuario autorizó continuar con la publicación de prueba aislada y comprobación de recepción de un mensaje; NO autorizó cambios en `main`, dominio de producción, Instagram ni envíos comerciales.
- **Render:** nuevo Static Site gratuito `fluynova-portfolio-staging-20261115`, ID `srv-dbt3oulckfvc73cmep40`, branch `feature/laboratorio-aislado-main-20261115`, `autoDeploy=no`, build `node scripts/build-portfolio-static.mjs`, publish `dist-portfolio-static`, sin dominio propio ni plan pago. Despliegue inicial `dep-dbt3outckfvc73cmeplg` commit `10d6d8c0bd909ff11982f886c69ef19376d839e0`, estado **live**.
- **Sitio de prueba:** https://fluynova-portfolio-staging-20261115.onrender.com/ — HTTP **200**, las **3 demos** y **5 CTA internas** a `/contacto/index.html` están presentes y conservan UTM; `noindex` activo. Formulario https://fluynova-portfolio-staging-20261115.onrender.com/contacto/index.html — HTTP **200** con consulta de ejemplo; navegador de verificación ejecutó el JS (botón inicialmente deshabilitado quedó habilitado), sin envío automático ni FormSubmit.
- **Límite de costos:** Render documenta que los Static Sites son gratuitos, pero contabilizan tráfico saliente y minutos de compilación contra la cuota mensual compartida; no se pueden garantizar gastos futuros de $0 si se exceden cuotas con una forma de pago activa. Revisar en la página de facturación antes de lanzar campañas.
- **Prueba de entrega Gmail (cuentas propias):** un único envío sintético autorizado desde la cuenta personal del usuario a `contacto.fluynova@gmail.com`, asunto/código `FLUYNOVA-QA-20261115-STAGING-01`: Gmail confirmó ID de envío `1a1e17eaccaa6b40` y se encontró mensaje recibido ID `1a1e17eb0f3d956c` en INBOX. Esto certifica esa ruta Gmail→Gmail, NO un clic real del `mailto` de un visitante.
- **Prueba FormSubmit (proveedor actual de web principal):** un solo POST JSON sintético sin clientes desde GitHub Actions [43774104769](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43774104769) devolvió **HTTP 403**. NO se consideró enviado/entregado. Un 403 desde GitHub Actions puede corresponder a controles antibots; no se deduce que el proveedor falle para visitantes humanos. Se suspendieron reintentos automáticos; verificar en navegador humano si hace falta certificar FormSubmit.
- **Web principal:** `/api/config` y `/api/health` mostraron HTTP 503 en consulta externa durante el corte; sin modificaciones ni nuevo despliegue de `fluynova-web` desde `main`.
- **Decisión:** GO para revisión del staging aislado y prueba controlada de correo que llegó al buzón. **NO-GO para afirmar recepción por FormSubmit o anunciar la web principal como estable**, y aún no se modifican Instagram ni DNS.

## Privacidad local y navegación sin backend — 15/11/2026
- **Problema corregido:** la portada enlazaba a `https://fluynova-web.onrender.com/privacidad`, dependiente del backend que puede dar 503. Ahora el builder transforma ese enlace en `privacidad/index.html` local y la consulta incluye enlace `../privacidad/index.html`.
- **Archivo añadido:** `static/laboratorio/privacidad/index.html`, disponible en `dist-portfolio-static/privacidad/index.html`. Explica preparación local del borrador, envío opcional por el proveedor de correo del visitante, posibles registros técnicos del alojamiento, UTM y datos compartidos voluntariamente. No contiene scripts ni formularios y mantiene `noindex`.
- **Pruebas de código:** [GitHub Actions 43782263909](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43782263909) SUCCESS; sub-suite de portfolio ahora exige 12 pruebas.
- **Pruebas Chrome:** [GitHub Actions 43782263934](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43782263934) SUCCESS, navegación y capturas de privacidad a 320, 390 y 1440 px, sin desbordes horizontales; vínculo de retorno a consulta y `noindex` verificados.
- **Staging actualizado:** Render deploy `dep-dbt54p9srm7s73a8ned0`, commit `14a97220275ba51b467e9b3b0dbeb6742b462336`, estado **live**; `autoDeploy=no`. Verificación HTTPS real con URLs sin caché: portada, privacidad y contacto devuelven HTTP 200 y conservan sus enlaces locales.
- **Lo pendiente:** ni estas pruebas ni la publicación de staging demuestran que un visitante haya enviado un correo o pagado un servicio. FormSubmit de producción sigue sin certificarse; no se modificaron `main`, DNS ni Instagram.

## Decisión registrada
**GO para conservar el artefacto de prueba y ofrecerlo a revisión interna. NO-GO para deploy, merge, reconfiguración o comunicación a terceros sin autorización.**
