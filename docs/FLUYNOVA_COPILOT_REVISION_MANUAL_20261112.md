# FLUYNOVA Copilot — revisión manual asistida de importes ambiguos

**Fecha:** 12/11/2026. **Entorno:** laboratorio en rama de desarrollo feature/fluynova-municipios-piloto-20261109, sin publicación ni merge.

## Problema

Una cifra OCR puede ser aparentemente válida pero no coincidir con la imagen. Dos pasadas OCR incluso pueden discrepar para Neto, IVA o Total. Ninguna suma aritmética ni la confianza media pueden certificar cuál es la correcta.

## Implementación

- Módulo nuevo: experimentos/fluynova-copilot/ocr-manual-review.mjs. Describe cada campo como LEGIBLE, AUSENTE o AMBIGUO_O_INVALIDO, sin elegir valores ambiguos.
- Permite corregir **solo los campos seleccionados expresamente** por el operador, después de declarar un cotejo visual del documento original. Usa el parser ARS estricto preexistente.
- Elimina exclusivamente las líneas etiquetadas anteriores del campo corregido, incluidas las duplicadas, conserva otros campos y agrega el marcador CORRECCION HUMANA DECLARADA - NO VERIFICADA POR EL SISTEMA.
- Rechaza montos extranjeros, negativos, inválidos, campos desconocidos y operaciones sin cotejo declarado. Impone límite de caracteres.
- El editor aparece junto a la imagen original en la UI. Al aplicar una corrección, la declaración anterior queda invalidada y se requiere **un segundo cotejo del texto final** antes de ejecutar controles.
- El servidor sirve solo dos rutas de módulo JavaScript permitidas expresamente, sin publicar directorios ni habilitar acceso externo.
- La API sigue recibiendo procedencia OCR. Los resultados mantienen verified_amounts=0, original_document_verified=false y can_auto_approve=false. La intervención manual no equivale a certificación.

## Evidencia automatizada

[GitHub Actions #43230925513](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43230925513) — **success**, commit 846fed83203ae3b5307039d988131ddd7a20e51e.

- 141 pruebas unitarias y HTTP, incluidas seis nuevas pruebas del corrector.
- 1 prueba de imagen con OCR Tesseract real.
- 5 pruebas de aislamiento y recuperación de fallos.
- 1 diagnóstico de Ollama simulado.
- 7 pruebas Chromium del flujo anterior.
- 3 pruebas Chromium nuevas para edición manual, rechazo de formato inválido y reinicio al cambiar el archivo.
- 1 prueba integral de PDF escaneado con Tesseract real.
- **159/159 pruebas aprobadas**, además de benchmarks sintéticos independientes completados correctamente.

### Caso adversarial

| Campo | OCR primario | OCR secundario | Corrección declarada |
|---|---:|---:|---:|
| Neto | $150.000,00 | $150.800,00 | $150.000,00 |
| IVA | $31.500,00 | Sin alternativa | Sin modificar |
| Total | $181.500,00 | $182.300,00 | $181.500,00 |

La prueba Chromium exige cotejo declarado, verifica que se sustituyan solo Neto y Total y después comprueba que el resultado no se certifique ni apruebe. También comprueba ausencia de conexiones externas, errores JavaScript y desbordamiento horizontal en 320, 390 y 1024 píxeles.

## Límites

No se verifica si el operador leyó correctamente el original ni se autentica al usuario. No existe todavía auditoría persistente, firma, cifrado de almacenamiento, aislamiento a nivel sistema operativo, validación fiscal ni autorización para documentos comerciales reales. **No se probó esta versión en Windows del usuario.**

## Próxima prioridad

Diseñar una revisión asistida más clara de las discrepancias y un registro local de los cambios que no almacene datos sensibles innecesarios, antes de analizar autenticación, respaldo, privacidad y un piloto real con consentimiento.

**Sin cambios en main, sin despliegue, sin gasto y sin contacto con terceros.**
