# FLUYNOVA — Contacto manual como respaldo comercial

**Fecha de desarrollo:** 04/11/2026. **Estado: LABORATORIO / PR #17 / NO DEPLOY.**

## Problema resuelto

La web depende de `GET /api/config` y de FormSubmit para permitir el envío automático. Si el endpoint falla, la configuración no habilita el proveedor o el navegador no puede comunicarse con FormSubmit, el botón principal permanece deshabilitado y solo se ofrece un vínculo de correo genérico. Las pruebas anteriores no demostraron activación ni entrega de FormSubmit. Esta rama incorpora un respaldo comercial que no requiere la API ni un proveedor externo para **preparar** una consulta válida.

## Cambios implementados

- En `static/index.html`: nueva sección bajo el formulario `Preparar consulta por correo`, disponible independientemente del botón automático. Incluye un texto editable solo mediante el formulario original, botón de copia y vínculo `mailto:`. Explica que no se produce ningún envío en forma automática.
- El texto de consentimiento diferencia la transmisión mediante FormSubmit del correo iniciado por el visitante. Conserva la Política de privacidad y los campos obligatorios existentes.
- En `static/main.js`: función pura `draftTextForEmail(v)` que compone nombre, correo, categoría, descripción, campos opcionales y origen comercial UTM ya validado. El resultado se coloca en `textarea.value`, no en `innerHTML`.
- La función reutiliza `leadValidationError` (nombre, correo, categoría, mensaje y consentimiento). No puede crear borradores con datos incorrectos. El campo honeypot también bloquea preparación.
- El vínculo `mailto:` se construye **solo después del clic de preparación**. Para cuerpos codificados mayores de 1700 caracteres, no precarga el cuerpo para evitar truncamientos por aplicaciones externas y se indica copiarlo manualmente.
- Al editar o reiniciar el formulario se destruye el borrador previo; no se usa `localStorage`, cookies ni `sendBeacon`.
- Si el portapapeles falla, el texto se selecciona y se muestra cómo copiarlo con teclado. La aplicación de correo (si existe) requiere confirmación explícita del usuario para enviar.

## Evidencia local

- `node --test tests/*.test.js`: **144/144 PASS**, incluyendo 8 tests nuevos de contenido, seguridad, validación y no envío.
- `python tests/manual-email-browser.py`: **15/15 PASS** con Chromium real, sin tráfico externo, dos escenarios (proveedor deshabilitado y endpoint con error), comprobación móvil 390 px y escritorio. Solo `GET /api/config` simulado. Sin mensajes enviados.
- `python tests/contacto-browser.py`: regresión de campañas y formulario sin solicitudes externas (resultado debe consultarse en log del cierre de QA).
- `python -m pytest -q tests/test_contact_api_local.py`: regresión de API local con datos ficticios, SQLite temporal, correo interceptado.

## Riesgos abiertos y condiciones de publicación

1. No reemplaza FormSubmit ni confirma la llegada de emails al buzón. Un usuario debe abrir su aplicación de correo, revisar el contenido y enviarlo.
2. En sistemas sin aplicación de correo, debe utilizar copiar y pegar. El navegador puede bloquear el acceso directo al portapapeles; se ofrece selección manual.
3. Los borradores largos no se adjuntan al vínculo `mailto` por compatibilidad. No se envían automáticamente.
4. No garantiza capacidad de respuesta, disponibilidad de la cuenta de Gmail ni configuración de correo de un visitante.
5. Aún falta una prueba consentida de envío y recepción con el proveedor real y evaluación visual final antes de fusionar PR #17 y desplegar. Hasta entonces, la función **no existe en producción**.

**No se contactaron terceros, no se modificaron secretos ni variables Render, no se crearon costos.**
