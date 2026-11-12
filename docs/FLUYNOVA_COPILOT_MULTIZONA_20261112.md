# FLUYNOVA Copilot — OCR multizona sin aceptar cifras aisladas

**Fecha:** 12/11/2026  
**Proyecto:** FLUYNOVA Copilot, rama privada de trabajo `feature/fluynova-municipios-piloto-20261109`  
**Alcance:** laboratorio sintético sin uso de datos de clientes, publicación ni gastos.

## Problema observado

El OCR por región derecha resolvió 3/3 campos en los ejemplos sintéticos de dos columnas y tabla ya ensayados. Sin embargo, otras disposiciones pueden poner los importes a la izquierda o al centro. Recortar arbitrariamente es riesgoso: en zonas equivocadas, el motor OCR real obtuvo importes **numéricamente válidos pero falsos**, incluso con confianza global alta.

## Experimento previo — lectura manual de regiones

Script `OCR-MULTIZONA-EXPERIMENTO.mjs`, imágenes compartidas en `ocr-multizona-fixtures.mjs`. Se probó texto en tres posiciones dentro de una factura ficticia de 1440×850 píxeles:

| Posición del bloque | Imagen completa | Recorte derecho | Recorte central | Recorte izquierdo |
|---|---:|---:|---:|---:|
| Izquierda | 2/3 | 0/3 | 0/3 | 2/3 |
| Centro | 2/3 | 0/3 | 2/3 | 0/3, más 1 cifra incorrecta legible |
| Derecha | 2/3 | 3/3 | 0/3, más 2 cifras incorrectas legibles | 0/3 |

La combinación libre de esas lecturas sería **insegura**. Todas provienen de la misma imagen y no representan fuentes independientes.

**CI:** [GitHub Actions #43207864804](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43207864804), `success`.

## Implementación conservadora

Se modificaron `ocr-layout.mjs` y `ocr-image.mjs`:

1. Buscar primero importes literales en la imagen completa.
2. Solo ante campos faltantes, ensayar hasta **tres zonas** en orden derecha, centro, izquierda.
3. Rechazar como evidencia cualquier recorte que produzca **una sola etiqueta monetaria válida** o etiquetas duplicadas/inválidas. Es una regla exploratoria, no una garantía.
4. Con al menos dos campos etiquetados válidos, comparar con el texto existente. Recuperar únicamente campos ausentes (nunca reemplazar importes primarios ambiguos) y anexarlos como OCR regional no verificado.
5. Si aparecen dos cifras incompatibles para el mismo campo, conservar ambas etiquetas en texto de modo que el parser estricto devuelva `null`. Nunca elegir automáticamente según la confianza global.
6. Dejar de buscar cuando el texto ya tiene todos los campos etiquetados únicos, para no abrir más superficies de falso reconocimiento.
7. Mantener tiempo máximo de OCR, límites de caracteres, prueba de revisión humana, `verified_amounts=0` y `can_auto_approve=false`.
8. Exponer metadatos de zonas examinadas, campos propuestos y motivos de descarte, sin registrar los documentos completos en logs.

Se agregaron tests unitarios y de integración para cobertura del plan multizona, rechazo de singleton de confianza alta, candidatos duplicados y conflictos entre regiones, más prueba de OCR real integrado.

## Resultado del motor real integrado

**CI completa:** [GitHub Actions #43209081014](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43209081014), `success` (commit `723f05bc83de611b4156ee3ac43a3092de7e3ae1`).

- **150/150 tests** aprobados: 135 unitarias/HTTP, 1 OCR de imagen real, 5 de aislamiento, 1 Ollama simulado, 7 Chromium, 1 PDF escaneado con OCR real.
- Caso izquierda: **2/3** importes correctos, uno sin corroborar.
- Caso centro: **2/3**, uno sin corroborar.
- Caso derecha: **2/3**, uno sin corroborar. Aunque el recorte manual derecho obtenía 3/3, la lectura general había creado ambigüedad; la conciliación conservadora no la sobreescribió.
- **Total 6/9**, tres abstenciones, **0 importes erróneos legibles incorporados**, **0 aprobaciones automáticas**.
- El banco adversarial anterior D01–D08 conserva **19/24** correctos, cinco abstenciones y cero importes falsos legibles extraídos.
- El banco original de PDF ficticio con Tesseract real sigue dando 3/3 en ese documento sintético.

**Interpretación:** la búsqueda multizona no aumentó por sí sola la cobertura de los nuevos tres diseños; sí evitó la mezcla peligrosa de candidatos de recortes incorrectos. La cifra “3/3 de un recorte elegido manualmente” **no debe** presentarse como precisión automática del motor.

## Límites técnicos y siguiente criterio

- Para mejorar recuperación real hace falta **revisión asistida de campos ambiguos**: mostrar claramente cuál es el campo dudoso, resaltar texto y permitir corrección manual cotejando la imagen original. La confirmación del operador no equivale a validación fiscal.
- Investigar reconocimiento OCR por líneas y celdas con organización espacial, incluyendo diferentes modos de segmentación de página, solo si mejora un corpus nuevo y no introduce importes falsos.
- Agregar documentos de geometría diversa y, cuando exista consentimiento y seguridad adecuada, un corpus real autorizado y anonimizado. Medir falsos aceptados, omisiones y carga de revisión.
- Mantener la prohibición de procesar datos comerciales sensibles y de desplegar sin controles de acceso, aislamiento de sistema operativo y medidas de privacidad.

**Sin modificación de `main`, sin publicación ni contacto con terceros.**
