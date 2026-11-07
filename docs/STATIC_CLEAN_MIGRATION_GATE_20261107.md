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
