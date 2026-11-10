# FLUYNOVA Copilot — aislamiento de procesamiento y cotejo OCR

**Fecha:** 10/11/2026. **Entorno:** rama `feature/fluynova-municipios-piloto-20261109`, no publicada.

## Riesgo original

PDF.js y librerías de imagen pueden encontrar archivos corruptos, consumir CPU/memoria o sufrir fallos nativos. Un intento previo de rasterizar PDF dentro del servidor produjo un `segmentation fault` reproducible. También es posible que un OCR produzca **cifras numéricamente plausibles pero incorrectas**, que pasarían un control aritmético.

## Cambios implementados

### 1. Procesamiento en procesos separados

- El servidor `server.mjs` utiliza por defecto `isolatedPdf` e `isolatedOcr` de `isolated-processing.mjs`.
- Un proceso Node descartable `processor-child.mjs` recibe los bytes por `stdin` y responde exclusivamente JSON acotado por `stdout`.
- Se limitan los bytes de entrada (PDF 4 MiB, imagen 3 MiB), salida de resultado (64 KiB) y los tiempos de ejecución (PDF 30 s, OCR 115 s). Se pide a V8 un límite de heap de 384/512 MiB, **que no es un límite de memoria física del sistema operativo**.
- Crash, proceso colgado, salida inválida o falta de motor devuelven un error controlado sin aceptar documentos, aprobar importes ni exponer trazas de archivos internos.
- El OCR sigue limitado a un proceso simultáneo por servidor.
- `createApp` conserva inyección de procesadores para tests controlados; los defaults reales usan el aislamiento.

**Comprobado con CI:** [ejecución #42818967222](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42818967222), 5/5 pruebas del módulo: PDF y OCR reales, falla abrupta provocada, bloqueo con timeout y rechazo previo de datos inválidos. El servidor siguió respondiendo a `GET /api/status` después del fallo simulado.

### 2. Confirmación visual después del OCR

- La UI `index.html` identifica cuando el texto se obtuvo de PNG/JPEG o PDF escaneado mediante OCR.
- Ante OCR muestra una confirmación de cotejo **manual** de importes y separadores contra el original; ambos botones de análisis y control se bloquean si no está marcada.
- Al editar el texto OCR, la marca se invalida y debe repetirse el cotejo.
- El resultado aclara que el usuario **declaró** el cotejo; no afirma que el software haya comprobado visualmente la factura, ni que sea auténtica.
- El control monetario sigue usando reglas deterministas; el OCR nunca aprueba una factura por sí solo.

**Prueba pendiente de cierre en este registro:** Chromium del último commit `e358229c8c3e0791a471d5f0294def108160d77a`, ejecución https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42819202088 . Se verificará que el recorrido con OCR real respete la restricción.

## Límites que permanecen

No es un aislamiento de sistema operativo: subprocesos Node comparten permisos de usuario y pueden acceder al sistema de archivos/red según esos permisos. Tampoco existe autenticación, aislamiento entre clientes, almacenamiento cifrado, retención segura, validación fiscal, firma digital ni recuperación de datos. Un checkbox no demuestra que el cotejo humano sea correcto. Por eso **no debe recibir documentos comerciales reales, sensibles ni quedar expuesto públicamente**.

## Criterios antes de piloto real

1. Aislamiento de sistema operativo con permisos mínimos, límites de memoria/CPU impuestos por el sistema, restricción de red y políticas de archivos.
2. Corpus de imágenes reales autorizado y medido: detectar valores OCR plausibles pero incorrectos, y calibrar abstenciones por calidad de campo, no solo confianza media.
3. Evidencia de autentificación/autorización, auditoría persistente, respaldo y recuperación, evaluación de privacidad y consentimiento del cliente.
4. Pruebas en Windows real, sin prometer compatibilidad ni rendimiento sobre GPU.

**Control de publicación:** no mergear a `main`, no desplegar, no comprar recursos ni contactar terceros sin permiso.
