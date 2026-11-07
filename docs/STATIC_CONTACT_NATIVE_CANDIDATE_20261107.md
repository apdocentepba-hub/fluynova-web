# FLUYNOVA — candidato de recepción HTML estática (07/11/2026)

**Estado:** implementación y pruebas OFFLINE aprobadas; **NO PUBLICADO, NO ACTIVADO, SIN ENVÍOS A FORMSubmit**.

## Por qué esta variante

La web comercial actual usa Python FastAPI para entregar archivos y para `/api/config`. Como el plan gratuito de Render puede presentar arranques en frío (HTTP 503 observado), se preparó un archivo estático que no depende de ese servidor para mostrar las páginas.

Para recibir consultas sin montar otro backend, FormSubmit documenta `POST` HTML nativo, correo de activación y opciones `_subject`, `_replyto`, `_honey`, `_template` y reCAPTCHA. El resultado de un POST o de un GET de configuración no demuestra entrega a Gmail.

Fuentes: https://formsubmit.co/documentation y https://formsubmit.co/help.

## Dos artefactos aislados en la rama `feature/fluynova-static-clean-from-main-20261107`

### A. Vista bloqueada (predeterminada)

`node scripts/build-static-main-preview.mjs`

- Genera `dist-static-main-preview/`.
- Sin formulario automático: `fieldset disabled`, acción no remota y botón deshabilitado.
- Ofrece un enlace manual `mailto:` fuera del `fieldset`. GUARDIÁN es guiado local.
- Todas las páginas conservan `noindex` y se quita el sitemap. Sin despliegue.

### B. Candidato de formulario (SOLO DESARROLLO)

`node scripts/build-static-native-contact.mjs --offline-candidate`

- Genera `dist-static-native-contact-candidate/` en el equipo que ejecuta el comando.
- **No crea ni despliega un sitio.** Advertencia: si alguien sirve ese directorio y pulsa Enviar, se podrían transmitir datos reales a FormSubmit. No distribuirlo ni alojarlo antes de las autorizaciones.
- `<form method="POST" action="https://formsubmit.co/contacto.fluynova@gmail.com">` a través del HTML nativo, abriendo la respuesta del proveedor en otra pestaña. No usa `fetch`, AJAX ni API de FastAPI.
- `_subject` toma la categoría validada, `_replyto` el correo indicado. `_template=table`; `_honey` queda activo. No se desactiva el CAPTCHA predeterminado del proveedor.
- Nombre, correo, categoría, mensaje y consentimiento se validan en navegador; el formulario no se presenta como enviado antes de recibir confirmación. El enlace `mailto:` permanece disponible.
- Ambas variantes conservan el contenido de `static/` sin modificarlo. GUARDIÁN no transfiere conversaciones a proveedores de IA.
- El banner visible aclara que es un ambiente interno. Todas las páginas siguen `noindex,nofollow,noarchive`; el artefacto no publica sitemap.

## Evidencia automática verificada

- GitHub Actions: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42419539403
- Commit probado: `f10e1b1830b782fd75718a99468c6032814b79fd`.
- **19/19 pruebas Node PASS**, 0 FAIL. Ocho pruebas nuevas del formulario nativo: conservación de controles de consentimiento y honeypot, rechazo de campos inválidos, destino modificado y trampa de bot, conformación de asunto/Reply-To, construcción desde el árbol real del repositorio, verificación de rutas y detección de alteraciones.
- El workflow también compiló la variante bloqueada desde `main` y verificó **12 páginas**, **128 referencias internas válidas** y **0 referencias faltantes**.
- En las pruebas de envío **NO se hizo tráfico HTTP**: el evento submit se ejecutó en un entorno simulado de JavaScript y se comprobó si habría cancelado o permitido el POST.
- El build de la variante nativa fue ejecutado en carpeta temporal durante los tests y eliminado. NO existe una URL pública nueva.

## Hallazgo de correo a 07/11/2026

- La búsqueda de Gmail FLUYNOVA (`in:anywhere after:2026/11/01` con términos FormSubmit y `after:2026/11/05` para correos nuevos) no devolvió nuevos correos del proveedor ni consultas genuinas. Esto **NO prueba** desactivación ni entrega futura.
- La referencia histórica son dos envíos de prueba del 30/10/2026, ubicados previamente en papelera, y un email de activación de ese momento. No usar esas pruebas para declarar recepción actual ni del futuro dominio.

## Puertas obligatorias antes de publicar

1. Autorizar un único envío ficticio controlado en entorno separado, con identificador único no personal, y corroborarlo de extremo a extremo en Gmail (bandeja, spam, papelera).
2. Confirmar activación específica del formulario y hostname definitivo; sin ello no declarar recepción.
3. Revisar privacidad, retención de FormSubmit, tratamiento de datos y consentimiento (el proveedor declara retención de envíos durante 30 días).
4. Revisar navegador real, accesibilidad, móvil, confirmación visible, alternativa por email y límites de spam.
5. Elegir destino estático definitivo, canonical/sitemap/robots de producción y plan de reversión sin romper enlaces de Instagram.
6. **Aprobación expresa** para crear o actualizar servicios, desplegar, cambiar dominios o activar recepciones reales.

**Conclusión de ingeniería:** circuito de captación preparado en código y validado OFFLINE; **NO RECEPCIÓN REAL VERIFICADA**. Mantener PR #21 en borrador, sin merge ni deploy.
