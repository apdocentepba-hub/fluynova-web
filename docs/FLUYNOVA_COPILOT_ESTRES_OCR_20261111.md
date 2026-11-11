# FLUYNOVA Copilot — ensayo adversarial de OCR real (11/11/2026)

## Objetivo

Pasar de ensayos con imágenes nítidas a un banco reproducible de imágenes ficticias degradadas, sin confundir un importe *leído* con uno *verificado*.

## Cambios guardados

- `experimentos/fluynova-copilot/OCR-ESTRES-REAL.mjs`: crea **8 facturas sintéticas** con diferentes textos, tamaños, baja iluminación simulada por contraste, desenfoque por reducción/ampliación, una raya sobre el total, JPG e inclinación.
- `experimentos/fluynova-copilot/ocr-score.mjs`: compara tres campos monetarios contra las verdades esperadas, escritas de antemano e independientes del OCR.
- `experimentos/fluynova-copilot/ocr-score.test.mjs`: cinco pruebas de clasificación: importe exacto, abstención, error monetario legible, suma coherente de valores alterados y rechazo de verdades no numéricas.
- El workflow `.github/workflows/fluynova-copilot-offline.yml` incorpora ambas pruebas. El nuevo benchmark ejecuta Tesseract español **real**; no emplea respuestas simuladas.

## Clasificación y métricas

El informe separa: **correctos**, **abstenciones**, **cifras erróneas legibles** y **errores con suma aritmética coherente**. El último caso representa una posible trampa para los métodos que confían únicamente en `neto + impuestos = total`.

El código de producción/prototipo `verify-money.mjs` conserva el indicador `verified_amounts=0` para procedencia OCR y exige una declaración de cotejo visual. La evaluación contra etiquetas esperadas **solo está disponible en el banco sintético**, no verifica documentos comerciales reales.

## Estado

- Código de pruebas nuevo y agregado al CI en el commit `4af931e2b866afcf56a6e2ee1a0ea7162a94cd35`.
- Ejecución de GitHub Actions del banco nuevo: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43106859347
- No declarar métricas de ese ensayo mientras su ejecución no haya terminado en **success**; si falla, revisar logs y corregir.

## Limitaciones

Las ocho imágenes son sintetizadas por código. Un resultado alto no prueba precisión comercial, robustez ante fotografías reales, verificación fiscal ni aptitud para capturar información sensible. Las modificaciones gráficas tampoco cubren todos los escáneres, dispositivos móviles, sombras ni documentos complejos.

**Sin cambios en producción, sin instalación en el equipo del usuario ni contacto con clientes.**
