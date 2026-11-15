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

## Decisión registrada
**GO para conservar el artefacto de prueba y ofrecerlo a revisión interna. NO-GO para deploy, merge, reconfiguración o comunicación a terceros sin autorización.**
