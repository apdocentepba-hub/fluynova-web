# FLUYNOVA Copilot — OCR regional para columnas y tablas

**Fecha:** 11/11/2026. **Proyecto:** FLUYNOVA Copilot; separado de APDocentePBA, VOLVÉ y proyectos escolares.  
**Estado:** laboratorio en la rama `feature/fluynova-municipios-piloto-20261109`. Sin merge a `main` ni publicación.

## Problema medido

En el banco de ocho imágenes sintéticas difíciles, el comprobante de dos columnas D05 devolvía **1/3 importes** pese a que el OCR global marcaba confianza **95 %**. Dos etiquetas monetarias quedaban fuera de líneas que reconocía el parser ARS estricto.

El reconocimiento global de caracteres no basta para documentos con estructura espacial: Tesseract puede intercalar información de columnas o separar etiquetas de cifras.

## Experimento previo con modelo verdadero

Se creó `OCR-COLUMNAS-EXPERIMENTO.mjs`, que utiliza `Tesseract.js worker.recognize(image,{rectangle})` con el mismo idioma español local que el prototipo. No usa Qwen ni respuestas simuladas.

[GitHub Actions #43130904577](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43130904577), **success**:

| Imagen sintética | OCR de imagen completa | Región derecha x=605 | Región derecha x=655 |
|---|---:|---:|---:|
| Dos columnas | 1/3 | **3/3** | **3/3** |
| Tabla | 1/3 | **3/3** | **3/3** |

El experimento mostró un aumento de cobertura **sin valores numéricos equivocados en esos dos ejemplos**. No constituye prueba comercial ni autoriza mezclar importes incongruentes.

Referencia técnica: https://github.com/naptha/tesseract.js/blob/master/docs/api.md (opción `rectangle` de `worker.recognize`).

## Implementación incorporada

Se agregó `ocr-layout.mjs` y se modificó `ocr-image.mjs`:

1. Ejecutar una **primera pasada** sobre toda la imagen.
2. Inspeccionar importes etiquetados; si faltan y la imagen es suficientemente grande, realizar **una segunda pasada OCR** con un rectángulo acotado a la región derecha, por el mismo Tesseract local.
3. Si la primera lectura no tiene etiqueta y la segunda aporta una etiqueta válida y única, anexar ese dato en el texto con un marcador explícito: `LECTURA OCR REGIONAL — SIN VERIFICACION INDEPENDIENTE`.
4. Si la primera y la segunda lectura contienen **valores diferentes para el mismo importe**, anexar ambas etiquetas, forzando al parser estricto a considerarlas **ambiguas** y devolver `null` en vez de elegir arbitrariamente.
5. Si una región contiene montos duplicados/inválidos, no recuperar el campo. La información permanece sujeta a cotejo.
6. Mantener límites de caracteres, tiempo restante disponible, una sola pasada regional adicional, marcador de procedencia, `original_document_verified=false` y `can_auto_approve=false`.
7. Mostrar en la interfaz avisos diferenciados para **campos recuperados** o **conflictos entre pasadas**, junto a la imagen original que debe revisarse.

Esto es una heurística específica para **bloques derechos de comprobantes sintéticos**, no una solución general de análisis de tablas ni de fotografías perspectivas.

## Resultados posteriores: motor real ya integrado

[GitHub Actions #43131545013](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43131545013), **success**:

- **145/145** tests automatizados (130 unitarios y HTTP, 1 OCR imagen real, 5 de aislamiento, 1 integración Ollama simulado, 7 de Chromium, 1 PDF escaneado con OCR real).
- El banco adversarial D01–D08 subió de **17/24 a 19/24 importes correctos**.
- D05 dos columnas mejoró de **1/3 a 3/3** con la segunda pasada habilitada.
- **5 abstenciones**, **0 importes numéricos equivocados legibles** en esas ocho imágenes y **0 aprobaciones automáticas**.
- El reflejo D03 y la distorsión afín D04 continúan con **1/3 y recaptura sugerida**; el recorte D08 conserva **2/3**, evitando inventar el valor cortado.
- El corpus de importes ARS y las regresiones de seguridad siguen aprobados.
- Las pruebas `ocr-layout.test.mjs` y `ocr-layout.integration.test.mjs` incluyen casos de lectura regional completa, lectura regional de baja confianza, duplicados, valores incompatibles y abstención segura.

**Interpretación:** el avance aumenta cobertura para el caso de dos columnas observado, sin regresiones numéricas detectadas en este pequeño conjunto. Una segunda lectura del **mismo documento** no es una verificación independiente y puede equivocarse igual que la primera. Por eso se mantiene la revisión visual humana.

## Pendientes antes de ofrecer a clientes

- Diseño de tablas reales con celdas, columnas variables y múltiples tasas de IVA; pruebas con homografía/perspectiva proyectiva y fotografía física.
- Corpus autorizado y de diversidad suficiente para medir por campo falsos aceptados, omisiones, falsos rechazos, tiempos y costo de revisión humana.
- Endurecimiento de procesos bajo permisos mínimos del sistema operativo, políticas de red y datos, autenticación, auditoría persistente y recuperación.
- Ensayo en Windows real; no se hizo en la PC del usuario de esta versión.
- No publicar ni enviar comprobantes comerciales reales, ni contactar clientes sin permiso.

**Conclusión:** avance experimental verificado en CI, no producto de gestión contable listo para producción.
