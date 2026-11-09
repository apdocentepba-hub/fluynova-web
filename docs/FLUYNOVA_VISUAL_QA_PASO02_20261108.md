# FLUYNOVA — Paso 02: revisión visual y accesibilidad del candidato

Fecha: 2026-11-08. PR #21, rama `feature/fluynova-static-clean-from-main-20261107`, **SIN MERGE / SIN DEPLOY**.

## Hallazgos comprobados y correcciones

1. **Menú duplicado.** El acceso `Páginas web` repetía `Páginas web para negocios`, ambos con destino `/webs/`. Se eliminó la duplicación.
2. **Tablet y teclado.** Entre 801 y 1100 px el menú de escritorio resultaba demasiado denso; se implementó menú responsive. Permite cerrar con Escape, clic externo, navegación a sección o cambio a pantalla grande; restaura foco al botón y sincroniza `aria-expanded`.
3. **Espaciado de escritorio.** El logo quedaba pegado a `Servicios`; se distribuyeron espacios y tamaños en header.
4. **Scroll horizontal de 320 y 768 px.** Chromium encontró ancho efectivo de documento de 570 px en ventana de 320; a 768 el brillo decorativo expandía hasta 1018. Se limitaron los elementos `ambient-one/ambient-two` al ancho del viewport y se controló el tamaño de titulares.
5. **Botón flotante Guardián sobre el formulario.** La captura móvil anterior mostró superposición con el área de mensaje. A <=500 px se oculta el launcher flotante, dejando el acceso `Guardián` por menú. La captura final muestra el textarea y las acciones libres.
6. **Enfoque visible y reducción de movimiento.** Se reforzó `:focus-visible` en navegación y controles; la prueba de Chromium verifica `prefers-reduced-motion` con scroll automático.

## Evidencia real de CI

- [GitHub Actions #42536178157](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42536178157): **SUCCESS, 2/2 jobs**.
- Código/offline: **29/29** pruebas Node; compilación segura de 12 páginas; 128 referencias internas del candidato D1; **0 enlaces rotos**.
- Navegador **Chromium real**: **8/8** pruebas, incluidas pantalla angosta y 6 breakpoints con los siguientes datos:

```json
[
 {"width":320,"scroll":320,"mobileMenu":true},
 {"width":390,"scroll":390,"mobileMenu":true},
 {"width":768,"scroll":768,"mobileMenu":true},
 {"width":900,"scroll":900,"mobileMenu":true},
 {"width":1024,"scroll":1024,"mobileMenu":true},
 {"width":1366,"scroll":1366,"mobileMenu":false}
]
```

- Contraste texto pequeño sobre tarjeta clara: **7,02:1** para la muestra ensayada (AA/AAA normal). No representa una auditoría WCAG completa.
- Menú teclado: abrir/cerrar, `Escape` y devolución del foco, PASS.
- Sin llamadas de formulario al backend real, sin POST inesperados, sin errores JavaScript, formulario de laboratorio deshabilitado, mail alternativo visible.
- Capturas generadas por Chromium con frontend de laboratorio: [artefacto fluynova-qa-visual-candidato](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42536178157/artifacts/13639049290). Incluye `desktop-1366.png`, `tablet-900.png`, `mobile-390.png`, `contacto-mobile.png` y `manifest.json`; almacenamiento temporal de GitHub Actions (7 días).
- Se descargaron y **revisaron visualmente** las capturas de escritorio y del formulario móvil: logo separado del primer enlace, diagrama legible, formulario sin botón superpuesto. Las capturas son del **candidato no publicado**, no de Render en producción.

## Límites y siguiente paso

La revisión visual es representativa, no certifica todas las páginas, dispositivos, navegadores ni los criterios WCAG completos. La publicación no está autorizada solo por la CI. El receptor D1 sigue cerrado.

**PASO 02 COMPLETADO. SIGUIENTE: PASO 03, auditoría de infraestructura Cloudflare y demos en modo solo lectura.** Requiere comparar GitHub/Cloudflare, configuración efectiva de Access/WAF, bindings, rutas y estado de builds. Si no hay conexión autenticada, registrar el límite y no inventar estados.
