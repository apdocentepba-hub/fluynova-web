# FLUYNOVA Copilot — validación real OCR de extremo a extremo

**Fecha:** 10/11/2026
**Proyecto:** FLUYNOVA Copilot (laboratorio aislado)
**Rama:** `feature/fluynova-municipios-piloto-20261109`
**Prohibiciones vigentes:** no publicar/mergear, usar documentos sensibles, enviar comunicaciones comerciales ni incurrir en gastos sin autorización.

## Evidencia reproducible

1. [CI de PDF escaneado con Tesseract real](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42815984538) — commit `d95b8d492602ea833fe70f5c19d0be95e960f7f8`.
2. [CI de evaluación de cuatro imágenes sintéticas](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42816888723) — commit `6687b7848a0b2bdd0f401cd19b5bc9203c88bb4f`.

La última ejecución completa pasó **111/111 pruebas** (102 pruebas unitarias/HTTP, 1 OCR real PNG, 1 integración con Ollama SIMULADO, 6 Chromium y 1 integración PDF escaneado → Tesseract REAL en Chromium). Los scripts del corpus de 53 comprobantes y el banco OCR son verificaciones adicionales cuyos resultados figuran abajo.

### 1. PDF escaneado: prueba completamente real

- Se genera un PDF binario **ficticio, con imagen raster sin capa de texto**.
- Chromium lee el PDF con PDF.js servido localmente y lo rasteriza en Canvas **del navegador**, sin enviarlo al servidor como PDF.
- Envía por `localhost` una imagen PNG al endpoint `POST /api/ocr/image`.
- Tesseract.js con el modelo español local genuino extrae el texto. **No se sustituyó por un mock**.
- El parser determinista compara `net_cents`, `tax_cents` y `total_cents` frente a importes fijados previamente: **3/3 correctos** en ese documento.
- Confianza OCR orientativa informada: **92,0%**. No representa probabilidad de exactitud ni validación de cada campo.
- **Cero llamadas a Qwen**, sin solicitudes externas desde Chromium y **sin aprobación automática**.

El archivo de prueba reproducible es `experimentos/fluynova-copilot/pdf-scan-ocr-real.browser.test.mjs`.

### 2. Banco OCR con variaciones visuales — OCR real

`OCR-BENCHMARK-REAL.mjs` genera cuatro imágenes ficticias de memoria, con las verdades monetarias definidas manualmente. Cada imagen se procesa con **Tesseract español real**, sin LLM.

| Imagen | Característica | Campos correctos | Confianza OCR orientativa | Tiempo medido* |
|---|---|---:|---:|---:|
| B01 | PNG nítida | 3/3 | 87% | 576 ms |
| B02 | Fondo marfil, contraste diferente | 3/3 | 92% | 528 ms |
| B03 | JPEG y menor tamaño | 3/3 | 92% | 417 ms |
| B04 | Leve inclinación | 3/3 | 92% | 561 ms |
| **Total** | **4 documentos totalmente ficticios** | **12/12** | — | — |

*Tiempo de `recognizeImage` medido en runner GitHub Actions Linux. No garantiza rendimiento idéntico en Windows.

**Resultado exploratorio:** 12/12 valores correctos, 0/12 abstenciones, 0/12 valores incorrectos extraídos, **0 aprobaciones automáticas**. Estos resultados solo se refieren a los cuatro gráficos definidos por el test.

### 3. Control de riesgo y arquitectura

- Se eliminó el rasterizador nativo PDF.js + canvas en Node, que producía `segmentation fault` en Linux; el endpoint `POST /api/pdf/ocr` continúa deshabilitado.
- El renderizado de PDF escaneado corre en el navegador. El servidor procesa solo las imágenes PNG/JPEG previamente limitadas por firma, tamaño y resolución.
- Modelo de español `tessdata_fast` fijado y verificado; se descarga únicamente durante la preparación explícitamente autorizada, nunca durante el OCR de una factura.
- Node 24 requerido para OCR; el motor anterior falló con Node 22 y se codificó un bloqueo explícito.
- Lecturas resultantes se muestran para cotejo manual. No certifican autenticidad ni cumplimiento fiscal, y ningún OCR debe aprobar un comprobante.

### 4. Pendientes antes de venta o piloto con documentos reales

- Corpus suficientemente diverso con fotografías reales **autorizadas o irreversiblemente anonimizadas**, sin información identificatoria.
- Escenarios de sombras, reflejos, perspectiva, compresión fuerte, desenfoque, sellos, tablas, columnas, múltiples tasas de IVA y comprobantes en distintos formatos.
- Medición cuantitativa por campo: exactitud, falsos aceptados, omisiones, cobertura y control de incertidumbre. Definir límites de calidad antes de automatizar cualquier tarea.
- Seguridad: aislamiento del proceso OCR frente a archivos no confiables, límites de tiempo y memoria, autenticación, trazabilidad, almacenamiento seguro si se requiriera, restauración y controles de privacidad.
- Prueba de esta versión sobre la instalación Windows del usuario. **No se ejecutó todavía en su equipo.**

## Reproducción del laboratorio

Dentro de `experimentos/fluynova-copilot` con Node 24 y dependencias/modelo español preparados:

```sh
node OCR-BENCHMARK-REAL.mjs
node --test pdf-scan-ocr-real.browser.test.mjs
```

La segunda prueba necesita Chromium/Playwright disponible. El workflow `.github/workflows/fluynova-copilot-offline.yml` es la fuente autorizada de la ejecución CI.

**Estado final de esta revisión:** código verificado en GitHub Actions, **sin merge ni despliegue** y sin contacto con terceros. No confundir una prueba sintética de 15 importes correctos con precisión de producción.
