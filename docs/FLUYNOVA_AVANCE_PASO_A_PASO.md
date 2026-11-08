# FLUYNOVA — hoja de ruta ejecutiva (formulario y diseño)
Actualizado: 2026-11-08. Registro de estado verificable. **Ningún check autoriza por sí solo publicar ni captar datos reales.**

## Objetivo de aceptación
Una persona envía una consulta desde la web de FLUYNOVA, el sistema valida consentimiento y antispam, registra el caso en D1 remoto, presenta un ID **solo si se confirmó la escritura**, permite lectura administrativa autenticada y notifica por email al correo comercial con entrega verificada por separado. Ante cualquier fallo muestra el contacto manual y no pierde datos silenciosamente. La web es clara, adaptable y visualmente profesional.

## Estado previo comprobado
- 30/10: FormSubmit había entregado dos mensajes de prueba a la casilla comercial; después se observaron errores FormSubmit / Cloudflare 522 y episodios 503/carga fría en Render. Eso **no** demuestra que el envío de clientes funcione ahora.
- PR #17: doble bloqueo de recepción y alternativa manual; pruebas locales, sin despliegue.
- PR #21 (esta rama): frontend estático aislado; formulario D1 cerrado, correo manual visible; 34 pruebas previas, con Chromium y backend simulado.
- PR #22: receptor D1 propio, validación de datos, consentimiento, Turnstile, límites HMAC, persistencia confirmada, y Worker privado de staging con Cloudflare Access. No es un endpoint público.
- PR #23: Worker público separado y cerrado. 33 pruebas distintas PASS, 3/3 jobs CI, incluyendo Workerd+D1 LOCAL y Chromium E2E; `workers_dev=false`, `preview_urls=false`, sin rutas ni D1 remota. Cloudflare Access del Worker privado responde con autenticación en consulta anónima.
- Sitio comercial Render `https://fluynova-web.onrender.com/` y correo alternativo `contacto.fluynova@gmail.com` deben preservarse. Las demos Cloudflare Pages tienen fallos de publicación separados.

## Pasos verificables (un hito por interacción, registrar evidencias y bloqueos)
- [x] **01. Gráficos del candidato y presentación profesional.** Mejorar diagramas de flujo, tarjetas y ejemplos de panel manteniendo texto honesto de simulación, sin afectar formulario ni producción. Cierre: cambios versionados en PR #21, QA Chromium escritorio y móvil sin POST, CI aprobada.
- [ ] **02. Calidad visual integral.** Verificar accesibilidad (teclado, contraste, reducción de movimiento), móvil y escritorio; revisar enlaces duplicados y demostraciones en contexto real. Cierre: pruebas y capturas del artefacto aislado, informe de defectos corregidos. Ningún deploy.
- [ ] **03. Auditoría remota de infraestructura, solo lectura.** Revisar el recurso exacto del Worker privado, configuración y alcance real de Access/WAF, D1 y estado de las dos demos, sin cambiar credenciales ni abrir ruta. Cierre: matriz de activos y bloqueos sustentada en evidencia, con límites claros.
- [ ] **04. Preparar recepción remota segura.** Definir dominio exclusivo, Turnstile real, secretos protegidos y binding D1 exclusivo. Requiere autorización antes de crear recursos, configurar credenciales, conectar endpoints o subir versiones; checklist de seguridad aprobado.
- [ ] **05. Prueba E2E remota aislada con consulta ficticia.** Desde navegador hasta D1 remota, rechazo de CAPTCHA, denegación al apagar recepción, deduplicación y reversión; inspección administrativa restringida y eliminación controlada. Requiere autorización específica; guardar evidencia y dejar tráfico real apagado.
- [ ] **06. Aviso por email con verificación independiente.** Diseñar y validar notificación de consulta almacenada a `contacto.fluynova@gmail.com`; registrar estados separados `stored` y `mail_delivered`, no prometer entrega con HTTP 201; sin enviar mensajes reales sin autorización.
- [ ] **07. Privacidad, recuperación y observabilidad.** Retención, eliminación de datos, respaldos D1, limpieza de rate limit, registro de errores sin PII, revisión de costos y procedimiento de rollback. Cierre: ensayos seguros y documentación.
- [ ] **08. Publicación y aceptación comercial.** Solo con autorización: publicar, comprobar en web real, verificar una recepción de extremo a extremo y preparar monitoreo. Cierre: evidencia completa y fallback a correo manual ante incidentes.

## Reglas de continuidad
- Cada «seguí»: recuperar este archivo y PRs asociados, identificar el primer paso abierto, completar una acción **real y reversible**, leer CI/logs y actualizar fecha, estado y enlace exacto. No reportar un paso como terminado con CI todavía en curso.
- Si un paso requiere permisos de Cloudflare, despliegue, gasto, envío a terceros o cambio de DNS, no ejecutarlo sin aprobación. Avanzar en pruebas/documentación sin publicar.
- No tocar APDocentePBA, VOLVÉ, sistemas escolares o producción Render al actualizar este plan.
- No reemplazar FormSubmit en producción a la fuerza; preservar la web y el correo directo hasta aceptación remota.
- «Gráficos» en este proyecto significa diagramas y presentación visual **de FLUYNOVA**, no el motor gráfico de otros proyectos.

## Paso actual
**PASO 01 — COMPLETADO el 08/11/2026.**
- CSS del candidato: proceso con jerarquía, grilla sutil, bordes mejor definidos, tarjetas y panel ilustrativos más claros, adaptable a pantallas chicas, reducción de movimiento y foco visible. Los dibujos son ejemplos ficticios, no indicadores reales de clientes.
- Commits: `0f50a0bb533ed8bc9d9a606b74a61292c4e1291a` (CSS) y `39a34d0ec021ca60e9f50e0604b12a8b41bbd189` (prueba Chromium).
- Evidencia [GitHub Actions #42532753231](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42532753231): **2/2 jobs SUCCESS**, 29/29 pruebas offline y **6/6 Chromium** (35 distintas); 12 páginas, 129 enlaces internos, 0 rotos. La nueva prueba comprueba estilos CSS en escritorio, tarjeta contenida a 390 px, cero POST inesperados y cero errores JS.
- El formulario continúa en modo cerrado sin configuración, el correo manual visible. **Ningún deploy, merge ni modificación en main.** No hay captura visual revisada por una persona, solo checks técnicos.

**SIGUIENTE PASO — 02.** Auditoría integral de diseño: capturas de escritorio y móvil, legibilidad y contraste, navegación por teclado, controles de formularios, enlaces redundantes y errores de las demostraciones, sin alterar producción.
