# FLUYNOVA Copilot — OCR local (laboratorio, 10/11/2026)

## Estado ejecutivo

**Alcance de I+D:** lectura de imágenes PNG/JPEG mediante Tesseract.js, con modelo de español fijado, datos sintéticos y supervisión humana. PDF con texto sigue mediante PDF.js. PDF escaneado se rasteriza en el **navegador**, no en Node, y luego se usa el endpoint local OCR de imágenes.

**NO es producción.** Rama aislada `feature/fluynova-municipios-piloto-20261109` del repositorio `apdocentepba-hub/fluynova-web`. No fusionar a `main` ni subir documentos de terceros.

## Componentes implementados

- `image-input.mjs`: firma PNG/JPEG y dimensiones; 3 MiB y 6 millones de píxeles máximos. Otros formatos se rechazan.
- `ocr-model.mjs`: modelo español `tessdata_fast/spa.traineddata` descargable solo durante preparación autorizada, fijado al commit `87416418657359cb625c412a48b6e1d6d41c29bd`, verificado con la identidad Git blob `72e901f13ca52cfe34cf239a368b9ed3c0ddaf26`. La inferencia requiere el archivo local.
- `ocr-image.mjs`: Tesseract.js local bajo Node 24, salida de texto, confianza orientativa y revisión humana; rechaza calidad insuficiente o error. No consulta Qwen, no genera aprobaciones ni persiste imágenes.
- `server.mjs`: `POST /api/ocr/image` para PNG/JPEG solo en `127.0.0.1`, validación de origen, control de tamaño, límite de concurrencia OCR de un trabajo. Se sirven dos assets concretos de PDF.js desde el directorio local de npm.
- `index.html`: permite cargar imágenes ficticias y usar OCR local. El texto se presenta en `textarea` para corrección humana; la extracción OCR **no ejecuta automáticamente el control de importes**.
- PDF escaneado: el navegador importa PDF.js desde el mismo servidor local, limita a dos páginas, rasteriza con Canvas del navegador y envía cada PNG al endpoint OCR local. No se acepta un PDF remoto.
- `PREPARAR-OCR-WINDOWS.cmd`: solicita permiso explícito antes de instalar dependencias npm y descargar el modelo; no toca producción.

## Prueba real y compatibilidad

La prueba `ocr-real.test.mjs` pasó con Tesseract verdadero sobre una imagen sintética en GitHub Actions con **Node 24**. La misma familia de motor fallaba bajo Node 22 con un error de sintaxis del núcleo WebAssembly, por lo que OCR requiere Node 24 en esta rama.

- Evidencia OCR real dentro de CI (aunque la ejecución global contenía una aserción antigua de UI): https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42811883689
- Fuente OCR oficial: https://github.com/naptha/tesseract.js
- Fuente de modelo español: https://github.com/tesseract-ocr/tessdata_fast

## Incidente de seguridad detectado y contenido

Un prototipo de rasterizador PDF ejecutado en Node con PDF.js + canvas nativo provocó **segmentation fault (exit 139)** al renderizar un PDF escaneado sintético. Se reprodujo con dos versiones de canvas:

- https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42812626346
- https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42812803926

**Acción correctiva aplicada:** eliminar el endpoint nativo `/api/pdf/ocr` y el módulo inseguro, evitando que un PDF pueda derribar el servidor. La rasterización pasa a hacerse en el navegador, con PDF.js oficial servido localmente; la primera validación final de ese recorrido tiene que comprobarse en Chromium.

## Límites y condiciones antes de usar documentos reales

No basta con leer texto: el OCR puede omitir, insertar o confundir importes. La cifra de confianza no es una garantía. Se requiere comparación visual, evaluación con un corpus representativo autorizado, pruebas adversariales, aislamiento de procesos, autenticación/roles, auditoría persistente, protección de datos y backups con restauración antes de ofrecer una solución operativa.

No usar fotos de personas, DNI, CUIT, facturas fiscales reales ni documentación sensible durante estas pruebas. Las imágenes y PDFs sintéticos utilizados se crean mediante código, sin copiar documentos de clientes.

## Estado validado al cerrar la revisión de OCR

**CI verde:** [GitHub Actions #42814109338](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42814109338), Node 24 sobre runner de Linux.

- 102/102 pruebas unitarias y HTTP con casos ficticios y fallos forzados.
- 1/1 OCR real Tesseract con imagen PNG sintética y modelo oficial de español descargado solo en preparación de CI.
- 1/1 diagnóstico de integración con **Ollama simulado**, no inferencia de Qwen real.
- 6/6 pruebas reales Chromium sin conexiones externas. Incluye PDF sin capa de texto → Canvas **del navegador** → imagen PNG → endpoint OCR local **simulado** → revisión de texto → verificación monetaria sin IA.
- El corpus anterior de 53 facturas ficticias sigue pasando; no implica exactitud en comprobantes reales.

**Separación estricta de las evidencias:** sí se probó OCR verdadero sobre una imagen independiente; aún **no** se probó el recorrido de PDF escaneado con Tesseract real y reconocimiento de montos de extremo a extremo. No mezclar esas métricas.

**Decisión de seguridad:** la ruta del servidor `POST /api/pdf/ocr` quedó eliminada; solo `POST /api/ocr/image` acepta PNG/JPEG controlados. Los archivos `pdf-image-ocr.mjs` y sus pruebas de renderizado Node fueron eliminados por el crash nativo reproducible. Se agregaron checks del endpoint inexistente y lista blanca de activos de PDF.js.

**Limitaciones:** el navegador puede tener errores de renderizado con PDF desconocidos; la segmentación de texto y el OCR pueden equivocar importes. Actualmente **no hay sandbox de proceso ni mecanismos multiusuario** y no se hizo prueba en Windows de esta versión. No aceptar datos sensibles ni venderlo como producto terminado.

**Próximos criterios:** prueba completa con OCR real para PDF escaneado (no mock) y evaluación de tasas de error sobre más imágenes sintéticas con tipografías y resoluciones diversas; después aislamiento del OCR/seguridad, autorización de datos, backups y piloto acotado. No instalar ni publicar sin autorización.
