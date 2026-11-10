# FLUYNOVA Copilot — banco de prueba documental v1

**Fecha:** 10/11/2026 | **Proyecto:** FLUYNOVA (separado de APDocentePBA, VOLVÉ y El Último Gremio Online)

**Evidencia automatizada:** https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42800215493

## Estado comprobado

Se incorporó en `experimentos/fluynova-copilot/` un banco de **53 comprobantes ficticios**, redactados manualmente y con los importes esperados anotados independientemente del parser. Las pruebas corren únicamente con Node.js, **sin Ollama ni datos reales**.

- `corpus-sintetico.mjs`: 30 documentos válidos (V01–V30), 3 con errores de suma (E01–E03), 20 inválidos o ambiguos (I01–I20).
- `corpus.test.mjs`: 53 pruebas parametrizadas y una prueba de integridad del corpus.
- `BENCHMARK-CORPUS.mjs`: informe de exactitud, abstenciones y falsos positivos; devuelve error si detecta un fallo.
- `PROBAR-CORPUS-WINDOWS.cmd`: permite repetir la medición offline en Windows y genera `INFORME_CORPUS_SIN_IA.txt`.
- `.github/workflows/fluynova-copilot-offline.yml`: ejecuta pruebas unitarias, benchmark, diagnóstico con Ollama simulado y navegador Chromium; **no despliega**.

### Resultado reproducido en GitHub Actions

| Métrica | Resultado |
|---|---:|
| Documentos totalmente sintéticos | 53 |
| Campos de importe evaluados | 159 |
| Resultado exacto frente a las etiquetas manuales | **159/159** |
| Importes válidos correctamente extraídos | **137/137** |
| Rechazos/abstenciones seguras de montos ausentes o ambiguos | **22/22** |
| Aceptaciones de cifras inválidas | **0** |
| Valores numéricos incorrectos aceptados | **0** |
| Errores aritméticos deliberados detectados | **3/3** |
| Falsas alertas de suma | **0** |

También terminaron **79/79** pruebas unitarias/HTTP, **1/1** diagnóstico local con Ollama **simulado** y **3/3** pruebas Chromium con analizador simulado. Total: **83/83** pruebas automatizadas de ese workflow.

La métrica **159/159 no representa precisión en facturas reales ni precisión de Qwen**. El corpus está diseñado para evaluar las reglas que soportamos expresamente y la abstención frente a formatos desconocidos. No incluye PDF, fotografía, OCR, firmas, comprobación de CAE/ARCA, autenticación multiusuario ni integraciones con ERP.

## Criterio técnico adoptado

- **Valores monetarios:** parser ARS estricto, aritmética determinista y etiquetado de procedencia; el LLM no es fuente de verdad.
- **Datos incompletos o contradictorios:** abstención y revisión humana; no normalización silenciosa de formatos no soportados.
- **IA local:** opcional para clasificación, reconocimiento no determinista y explicación, siempre con evaluación separada de la exactitud del modelo.
- **Sin IA disponible:** `POST /api/verify-money` y el botón **Control sin IA** siguen funcionando y no intentan llamar a Ollama.
- **Nunca aprobación automática:** `decision=REQUIERE_REVISION_HUMANA`, `can_auto_approve=false`.

## Antecedentes de inferencia real del usuario

En tres ejecuciones locales previas del mismo Qwen3 1.7B sobre **dos documentos sintéticos**, la salida del modelo fue **6/12** campos acertados; el contraste monetario determinista corrigió los seis importes. Reforzar el prompt no mejoró la salida cruda. Esos números tampoco son representativos de otras facturas ni justifican una declaración de precisión comercial.

## Uso de desarrollo

En la carpeta `experimentos/fluynova-copilot/`:

```powershell
node --test corpus.test.mjs
node BENCHMARK-CORPUS.mjs
```

En Windows, también se puede ejecutar `PROBAR-CORPUS-WINDOWS.cmd` sin instalar un modelo nuevo, sin actualizar dependencias y sin publicar nada.

## Próximo criterio de aceptación, no implementado

Antes de comercializar: construir corpus sintético de documentos con diseño más realista (incluida variedad de comprobantes que el parser actual no reconoce), testear PDF/imagen con fuentes y OCR autorizados, medir exactitud por campo de la IA y evaluar casos adversos. Para un piloto real se necesitan consentimiento, cifrado, control de acceso, auditoría persistente, backups y pruebas de restauración.

**Estado:** investigación y prototipo en rama aislada `feature/fluynova-municipios-piloto-20261109`. No se fusionó `main`, no se publicaron demos, no se contactaron terceros y no hubo pruebas productivas.
