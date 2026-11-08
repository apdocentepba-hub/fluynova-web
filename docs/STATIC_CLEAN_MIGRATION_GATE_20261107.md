# FLUYNOVA — candidato de migración estática aislado de main

**Fecha:** 07/11/2026. **Rama:** `feature/fluynova-static-clean-from-main-20261107`.

## Alcance, procedencia y autorización

- Rama creada exactamente desde el commit de producción `8549828b53f4c2890888ca7db9777a04fefc5ae7`, sin incorporar los 65 commits del laboratorio anterior.
- Solo agrega el constructor `scripts/build-static-main-preview.mjs`, verificador de rutas ya auditado `scripts/verify-static-routes.mjs`, pruebas y workflow de CI. La carpeta `static/` del proyecto, `main`, el backend FastAPI, Render y la configuración de FormSubmit quedan intactos.
- El resultado se genera en `dist-static-main-preview/` **solo en el entorno del ejecutor**; no se publica ni se copia al repositorio.
- Se prohíbe tratar esta rama como apta para producción o para tráfico comercial sin el resto de las puertas de aceptación.

## Diseño de seguridad provisional

1. Se copian las páginas de `static/` y se aplica aviso visible de **vista previa** + `noindex,nofollow,noarchive` y `robots.txt` excluyente. Se quita el sitemap del artefacto.
2. El formulario principal queda aislado: `fieldset disabled`, botón deshabilitado, acción local sin POST a FormSubmit, interceptor de `submit` con `preventDefault`. La alternativa manual mediante enlace `mailto:` permanece visible fuera del campo deshabilitado.
3. El JavaScript compilado elimina `fetch('/api/config')` y los envíos AJAX y POST de respaldo. GUARDIÁN funciona con su guía local y sin accesos a `/api/guardian/*` o IA remota.
4. La ruta `/privacidad` se adapta a `/privacidad.html` dentro del artefacto para no depender de FastAPI.
5. La verificación falla si faltan protecciones, si hay recursos o rutas locales rotas, si quedan llamadas `fetch` en los dos módulos centrales o si el destino de compilación invade el origen.

**No es la solución definitiva de recepción.** Deshabilitar el formulario es una protección provisional para no atribuir entregas a una infraestructura aún no probada. En una versión comercial habrá que implementar un flujo de recepción apto para alojamiento estático, con protección antispam, consentimiento y comprobación real en Gmail.

## Evidencia ejecutada

- GitHub Actions: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42372324603
- Commit del workflow verificado: `8c846d9ebfe14407c2706b21dfde938cc06f0015`.
- Resultado: **11/11 tests Node PASS**; sintaxis de ambos scripts PASS; compilación real desde `static/` PASS.
- Salida de build: **12 páginas HTML**, **128 enlaces internos válidos**, **54 referencias externas**, **0 errores internos**; modo de contacto `manual-only; automatic disabled`; GUARDIÁN `offline guided`.
- Comprobación final: el artefacto no contiene `sitemap.xml`, las páginas están noindex, y no hay `fetch(` en `main.js` ni `guardian.js` compilados.
- Estas pruebas son offline y de CI: **no** equivalen a navegación de usuario, disponibilidad 24/7, recepción de correo ni garantía de SEO.

## Bloqueos para una migración real

1. Probar un mensaje ficticio autorizado desde el formulario de la web vigente y comprobar recepción real en `contacto.fluynova@gmail.com`, sin afirmar éxito por `/api/config`.
2. Decidir y ensayar método estático confiable de recepción sin degradar el circuito de ventas ni exponer datos; conservar fallback de correo si falla.
3. Ejecutar inspección visual responsive, navegación con teclado y formularios en navegadores reales.
4. Definir URL pública final, reescrituras de rutas, canonical/sitemap/robots de producción, medición y mantenimiento.
5. Separar la vista definitiva del modo ensayo `noindex`; validar links desde Instagram; preparar reversión y aprobación específica antes de tocar DNS, enlaces públicos o servicios.

## Plan de reversión

- La rama es aislada y no está fusionada ni desplegada: la reversión actual consiste en **no fusionarla**.
- Si en el futuro se autoriza una publicación, mantener registrada la URL anterior y el commit/tag de producción para poder volver a servir la web existente. No borrar el servicio anterior hasta haber verificado el recorrido comercial completo.
- No crear ni activar servicios pagos sin aprobación.

**Decisión actual: APTO PARA REVISIÓN TÉCNICA OFFLINE; NO APTO PARA PRODUCCIÓN.**


## Actualización de migración — 07/11/2026

- Se incorporó a esta rama la versión exacta del `static/index.html` de `main` correspondiente al commit `1504e396a2e490b52d15932f9ad1a5fc389dc53b`. **El contacto directo `contacto.fluynova@gmail.com` queda visible también en la versión estática candidata.**
- El compilador de ensayo no modifica el formulario en producción. En el artefacto generado el envío automático queda deshabilitado y el enlace `mailto:` queda disponible. Todas las páginas siguen **noindex**, sin sitemap.
- Se generan archivos propios de Cloudflare Pages: `_redirects` con compatibilidad `/privacidad` → `/privacidad.html` y `_headers` con exclusión de indexación, nosniff, Referrer-Policy y restricciones de permisos. Estos ficheros **no afectan a Render** mientras no se publique esta rama.
- GitHub Actions [run 42427433316](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42427433316): **SUCCESS**; el build validó 12 HTML y 128 enlaces internos sin referencias rotas.
- El control de formulario del repositorio [run 42427425020](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42427425020) también volvió a **SUCCESS** tras separar por completo el backend: no modificar backend/infra dentro del PR web.
- El receptor persistente Cloudflare Worker+D1 está aislado en el **[PR #22](https://github.com/apdocentepba-hub/fluynova-web/pull/22)**, con pruebas offline. Ninguna D1 propia fue creada, ningún Turnstile real configurado ni endpoint publicado.
- Las rutas dinámicas del servidor original `/api/config`, `/api/contact`, `/api/health`, `/admin` y `/api/guardian/*` **no quedan automáticamente migradas por un exportador HTML**. El administrador y los mensajes deben tener backend privado y almacenamiento propio antes de retirar FastAPI.

**Decisión:** apto para seguir las pruebas de migración estática; no apto para redirigir tráfico o desactivar el servicio actual. Prioridad: GUARDIÁN guiado, contacto visible y receptor D1 independiente con persistencia real comprobada.


## Puente estático D1: laboratorio protegido

**Fecha:** 7/11/2026, prueba ejecutada en CI (UTC 8/11).

La web estática candidata del PR #21 dispone ahora de un **cliente D1+Turnstile** que coincide con el contrato `POST /api/contact` del [PR #22](https://github.com/apdocentepba-hub/fluynova-web/pull/22). No reemplaza aún el formulario público.

- Código de laboratorio: `scripts/contact-d1-staging-client.js`; compilador `scripts/build-static-d1-contact-candidate.mjs`. Para producirlo localmente: `node scripts/build-static-d1-contact-candidate.mjs --offline-candidate`.
- El sitio generado se aloja **solo como archivos locales**. En el cliente `endpoint:''`, `siteKey:''`; el HTML mantiene `<fieldset disabled>`, botón inhabilitado y `action="/#contacto"`. **No hay POST posible por defecto**.
- Si en otra etapa se configura y se publica, el cliente exige endpoint HTTPS de Cloudflare, Turnstile con acción `contact`, consentimiento, honeypot vacío, validación nativa y `POST` con límite de 12 s. Para confirmar recepción exige HTTP **201** y JSON `ok:true`, `stored:true`, `delivery:"database"`, identificador UUID. Nunca presenta HTTP 200 con `success:true` como éxito.
- El correo directo `contacto.fluynova@gmail.com` sigue visible como alternativa. Ningún email se envía automáticamente en esta versión.
- La política `privacidad.html` se adapta **solo dentro del artefacto D1 de laboratorio**; elimina referencias a FormSubmit y declara explícitamente que el formulario está deshabilitado, además de informar sobre Cloudflare D1 y Turnstile. No modificar la política de producción hasta concluir la revisión legal.
- No se reutiliza ni comparte ningún dato o base de APDocentePBA.
- Las demás páginas comerciales (12 HTML) y GUARDIÁN guiado mantienen las conversiones estáticas; 129 referencias internas correctas, 0 fallas.
- [GitHub Actions #42431955548](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42431955548): **29/29 tests PASS**, incluye cliente HTTP simulado, CAPTCHA ausente, respuesta falsa 200, protección del build, verificación de política y reconstrucción de 12 páginas.
- **Limitaciones:** sin test desde navegador real del candidato D1, sin endpoint remoto, sin secreto de Turnstile, sin D1 Cloudflare remota, sin almacenamiento real de consultas del público y sin panel privado autenticado. Todo esto debe quedar cerrado antes de activar envíos.

**Puerta de aceptación:** nunca fusionar/publicar el PR #21 ni retirar Render mientras el receptor de PR #22 no esté autorizado, configurado, probado con base remota propia y auditado en privacidad y seguridad.
