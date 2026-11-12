# FLUYNOVA Copilot — transcripción humana no destructiva de importes OCR

**Fecha:** 12/11/2026 · **Rama:** `feature/fluynova-municipios-piloto-20261109` · **Estado:** laboratorio; no desplegado.

## Objetivo

Cuando OCR falla o genera importes plausibles pero distintos del original, permitir que un operador compare la imagen de un comprobante ficticio con el texto OCR e ingrese una **transcripción independiente** de tres importes (neto, IVA y total) en formato argentino.

La transcripción no sustituye las líneas OCR originales ni afirma que el sistema haya verificado visualmente la imagen. Un operador declara el cotejo; la aplicación comprueba exclusivamente sintaxis de cantidades y la suma.

## Código integrado

- `experimentos/fluynova-copilot/manual-review.mjs`: valida entrada manual completa, compara con importes OCR leídos estrictamente y devuelve diferencias, ausencias y consistencia aritmética. Siempre `verified_amounts=0`, `original_document_verified=false`, `can_auto_approve=false` y `model_called=false`.
- `server.mjs`: nuevo `POST /api/manual-review` exclusivamente en el servidor local, control de `Host`, `Origin`, `content-type`, esquema exacto de los cuatro campos de petición y revisión declarada. No llama a Ollama ni guarda documentos.
- `index.html`: aparecen tres casilleros vacíos únicamente en el bloque de revisión OCR. El usuario puede cotejar la imagen original, transcribir los tres importes y compararlos sin usar IA. Se borran las transcripciones al cambiar el documento y se invalida el resultado si cambia una cifra o la declaración de cotejo.
- `manual-review.test.mjs`: siete pruebas unitarias del motor.
- `manual-review.api.test.mjs`: tres pruebas de la API HTTP, incluidas peticiones inválidas y origen externo.
- `manual-review.browser.test.mjs`: prueba Chromium de valores contradictorios, cotejo, invalidación y selección de otro archivo.
- `ocr-manual.browser.test.mjs`: regresiones del editor anterior adaptadas para verificar revisión **no destructiva** y ambigüedad OCR; su módulo histórico `ocr-manual-review.mjs` y sus tests unitarios permanecen sin eliminar.

## Distinción de conceptos

- **OCR detectado**: cifras propuestas por Tesseract; pueden ser erróneas.
- **Transcrito por una persona**: cifras escritas voluntariamente por quien opera la demo; pueden ser equivocadas y no se certifican por software.
- **Suma matemática**: comprobación de `neto + impuesto = total` sobre los tres importes manuales. Aun con suma perfecta, los dígitos pueden no coincidir con la imagen.
- **Certificación fiscal/contable**: fuera del alcance.

## Limitaciones y controles futuros

No existe autenticación, auditoría persistente, aislación de sistema operativo en el procesador OCR, firma de revisión, respaldo de documentación de clientes ni soporte autorizado para información personal real. La versión debe permanecer en desarrollo hasta completar pruebas y controles de seguridad apropiados.

## Evidencia

El código está subido a la rama de desarrollo de `apdocentepba-hub/fluynova-web`. En la sesión de preparación se ejecutaron localmente siete pruebas del módulo. **GitHub Actions de esta versión:** https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43237487754 — verificar su conclusión antes de declarar finalizada la integración. Las ejecuciones intermedias canceladas no constituyen prueba de éxito.

**Sin merge a `main`, sin producción, sin uso de comprobantes reales ni intervención en la PC del usuario.**
