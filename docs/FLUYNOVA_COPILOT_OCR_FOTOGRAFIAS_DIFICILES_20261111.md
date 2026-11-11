# FLUYNOVA Copilot — validación OCR de composiciones visuales difíciles

**Fecha:** 11/11/2026. **Rama de desarrollo:** `feature/fluynova-municipios-piloto-20261109`. **Sin merge ni despliegue.**

## Objetivo y evidencia

Se amplió la evaluación del OCR español real de Tesseract con **8 comprobantes sintéticos**, generados en memoria con `@napi-rs/canvas`. No se utilizaron documentos, fotografías, CUIT o facturas reales.

**Ejecución final comprobada:** [GitHub Actions #43123276110](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43123276110), conclusión **success** sobre el commit `7255864602095c27773260ca1f914387e9bcff13`.

La ejecución aprobó **134/134 pruebas automatizadas**: 119 unitarias/HTTP, 1 reconocimiento de imagen con Tesseract real, 5 de aislamiento y recuperación, 1 diagnóstico con Ollama simulado, 7 pruebas Chromium y 1 prueba integral de PDF escaneado con Tesseract real. Además, los bancos de reglas monetarias y de OCR sintético finalizaron correctamente como scripts.

## Resultados del banco adversarial con OCR real

| Caso | Escenario | Correctos | Abstenciones | Importes erróneos legibles | Recomendación |
|---|---|---:|---:|---:|---|
| D01 | Tipografía regular | 3/3 | 0 | 0 | Cotejar visualmente |
| D02 | Sombra gradual | 3/3 | 0 | 0 | Cotejar visualmente |
| D03 | Reflejo blanco elíptico | 1/3 | 2 | 0 | Recaptura sugerida |
| D04 | Cizallamiento afín (aproximación de perspectiva) | 1/3 | 2 | 0 | Recaptura sugerida |
| D05 | Dos columnas | 1/3 | 2 | 0 | Recaptura sugerida |
| D06 | Sello superpuesto | 3/3 | 0 | 0 | Cotejar visualmente |
| D07 | Ruido de impresión y compresión JPEG | 3/3 | 0 | 0 | Cotejar visualmente |
| D08 | Recorte real de caracteres numéricos | 2/3 | 1 | 0 | Corregir o recapturar |
| **Total** | 8 imágenes 100 % ficticias | **17/24** | **7/24** | **0/24** | — |

Ninguno de los ensayos produjo un valor numérico equivocado aceptado por el parser, ni una aprobación automática. Se registraron **3 recomendaciones de recaptura** para los casos con dos importes faltantes, aun cuando la confianza global del OCR era de **92–95 %**.

La primera versión de D08 solo recortaba un margen y mostraba 3/3. Se corrigió el fixture para borrar efectivamente los caracteres finales de las cifras: el resultado bajó a 2/3 y una abstención. Ese empeoramiento es deliberado y hace la prueba más útil.

**Interpretación:** el OCR reconoce o se abstiene en este corpus pequeño y sesgado. No se ha demostrado que rechace siempre las cifras falsas plausibles. La confianza global no equivale a la probabilidad de acierto monetario; la composición afín no reproduce una fotografía con perspectiva proyectiva completa.

## Corrección de producto realizada

`ocr-readability.mjs` recomendaba recaptura solo si la confianza global estaba por debajo de 75 o no había ningún importe legible. Tres imágenes con reflejo, perspectiva afín y columnas demostraron que una confianza de 92–95 puede coexistir con **2/3 importes faltantes**.

La regla ahora recomienda **`RECAPTURAR_SUGERIDO` si 0 o 1 de 3 importes son legibles**, independientemente de la confianza. `CORREGIR_O_RECAPTURAR` se conserva cuando solo falta un importe o hay una suma inconsistente. El aviso de la UI explica que también se puede **transcribir manualmente cotejando el original**, ya que una nueva captura no necesariamente corrige una disposición en columnas.

Se agregaron pruebas que fuerzan la ausencia de dos importes con **95 % de confianza simulada en el test unitario**, y el benchmark con Tesseract real exige la recomendación de recaptura cuando faltan dos o más.

El umbral 75 y estas recomendaciones son **heurísticas no calibradas**. Son asistencia para priorizar revisión, nunca certificación ni aprobación automática. En el prototipo los valores de OCR conservan `verified_amounts=0`, `original_document_verified=false` y requieren cotejo visual declarado por una persona.

## Próximo criterio técnico

Probar verdaderas transformaciones de perspectiva (homografía), imágenes con múltiples tasas de IVA, facturas con tablas y fotos reales autorizadas/anonimizadas; recopilar una muestra suficientemente diversa con verdades verificadas para medir falsos aceptados, falsos rechazados y cobertura. Luego evaluar controles de proceso/OS, privacidad, permisos y auditoría antes de ofrecerlo comercialmente.

**No se instaló nada en la computadora del usuario, ni se publicó o fusionó el prototipo.**
