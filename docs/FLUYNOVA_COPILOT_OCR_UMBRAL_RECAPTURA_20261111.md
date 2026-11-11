# FLUYNOVA Copilot — indicador de recaptura ante OCR degradado

**Fecha:** 11/11/2026 · **Rama:** `feature/fluynova-municipios-piloto-20261109` · **Alcance:** laboratorio sintético; sin deploy.

## Evidencia que motivó el cambio

La ejecución [GitHub Actions #43106859347](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43106859347) finalizó con `success`. Tesseract real procesó ocho imágenes inventadas:

- **21/24** importes exactamente correctos.
- **3/24** importes no identificados, todos del caso `S06` de desenfoque severo.
- **0/24** importes numéricos equivocados pero legibles, **0** aprobaciones automáticas.
- `S06`: confianza global aproximada **63/100**, no reconoció ninguna de las tres etiquetas monetarias. Los otros siete casos tenían confianza aproximada de **89–92/100**.

**Advertencia:** son solo ocho imágenes sintéticas; esos números no permiten estimar tasas reales de error ni garantizar que una cifra equivocada será rechazada. La confianza global de Tesseract no es probabilidad de exactitud de cada campo.

## Cambio incorporado

`ocr-readability.mjs` clasifica la **legibilidad del texto**, no la autenticidad de la factura:

- `RECAPTURAR_SUGERIDO`: si la confianza global es inferior a **75** o ninguno de los tres importes tiene una línea etiquetada única y válida.
- `CORREGIR_O_RECAPTURAR`: si falta algún importe o la suma resulta inconsistente, pero no se cumple la condición anterior.
- `COTEJAR_VISUALMENTE`: si los tres importes son legibles y la suma cierra, siempre se exige cotejo con el documento visual original.

El umbral **75** es una **heurística experimental conservadora elegida a partir de este pequeño ensayo** y no una política comercial validada ni un valor oficial de Tesseract. Puede generar falsos avisos o no detectar documentos defectuosos. No reemplaza el cotejo humano.

`ocr-image.mjs` devuelve `reading_quality` con recomendación, número de campos legibles, alertas y los campos `original_document_verified:false` y `can_auto_approve:false`. La interfaz muestra la recomendación tras leer una imagen y marca páginas de PDF escaneado que merecen recaptura, sin enviarlas a servicios externos.

## Pruebas

- `ocr-readability.test.mjs`: legibilidad completa, confianza baja con importes legibles, desenfoque sin montos, un campo inválido, suma inconsistente, mutaciones monetarias compensadas y errores de parámetros.
- `OCR-ESTRES-REAL.mjs`: verifica con Tesseract **real** que el caso de desenfoque severo recomiende recaptura y que nunca se afirme haber certificado el original.
- El workflow de GitHub ejecuta las pruebas unitarias y el banco OCR real.

**Ejecución CI verificada:** [GitHub Actions #43120473901](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43120473901), finalizó en **success**. 118/118 pruebas unitarias y de API, 1/1 OCR Tesseract real, 5/5 pruebas de aislamiento de procesos, 1/1 diagnóstico Ollama simulado, 7/7 pruebas Chromium y 1/1 PDF escaneado con Tesseract real: **133/133 pruebas**. Los bancos de documentos sintéticos también se ejecutaron correctamente como scripts independientes. En el caso S06 de desenfoque severo, la clasificación real fue **RECAPTURAR_SUGERIDO**, con confianza global 63, 0/3 importes correctos, 3 abstenciones y 0 importes numéricos mal aceptados. En los ocho casos del banco: 21/24 correctos, 3 abstenciones, 0 errores numéricos legibles y 0 aprobaciones automáticas. El umbral de 75 sigue siendo experimental y no calibrado sobre datos reales.

## Límites pendientes

1. Ampliar el banco con fotografías de perspectiva, sombras, reflejos, baja resolución y textos en columnas.
2. Medir **errores monetarios plausibles** que un parser acepta como número aunque la imagen muestre otro valor, incluidos los que conservan la igualdad de suma.
3. Calibrar recomendaciones con un corpus independiente y autorizado, midiendo falsas alarmas y falsos aceptados antes de permitir uso comercial.
4. Aplicar límites de seguridad del sistema operativo al procesamiento y verificar en Windows real.

**Estado del producto:** prototipo privado de desarrollo, sin publicación, sin datos de terceros ni aprobación automática de facturas.
