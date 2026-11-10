# FLUYNOVA Copilot · laboratorio de IA local (09/11/2026)

**Estado:** PROTOTIPO DE LABORATORIO, rama de trabajo aislada. No fusionado a `main`, no desplegado, no comercializado. Sin usuarios, base de datos, secretos, facturas reales ni integraciones con municipios.

## Qué aporta

- Extracción de campos **mediante un modelo de lenguaje real instalado localmente**: proveedor, número, orden de compra, neto, impuesto y total expresados en centavos.
- **Salida estructurada** de Ollama (`/api/chat` con esquema JSON); el sistema rechaza respuestas inesperadas o demasiado extensas.
- **Motor determinista independiente** para suma de importes, orden ausente, duplicados frente a **un registro inventado** y citas que no aparecen en el texto.
- **Nuevo control ARS:** los importes `Neto: $150.000,00`, `IVA: $31.500,00` y `Total: $181.500,00` se interpretan con un parser estricto de pesos argentinos y se convierten a centavos sin redondeo flotante. Se comparan con la propuesta del modelo y **se señala toda discrepancia**; nunca se modifica una factura real.
- Si falta una etiqueta monetaria, hay varias con valores contradictorios o el formato es inválido, el importe queda `null` y requiere revisión. El parser solo cubre **texto etiquetado**, no todos los comprobantes ni OCR/PDF.
- **Revisión humana obligatoria** sin ninguna ruta de aprobación automática ni escritura externa.
- API Node vinculada exclusivamente a `127.0.0.1`, con límite de entrada, rechazo de Host ajeno al equipo, comprobación de origen, CSP, timeout y fallo cerrado.
- HTML con carga de ejemplo, consulta real al modelo local y presentación con `textContent`, sin inyectar HTML del modelo.

La demo **NO lee imágenes/PDF**, no ejecuta OCR, no valida CAE/ARCA ni identidades de proveedores, no tiene usuario, roles, persistencia, backups, comprobación fiscal ni auditoría legal. Al faltar Ollama o el modelo, **NO inventa un resultado de IA**: informa error.

## Requisitos sin servicios pagos

- Windows/Linux/macOS con **Node.js 22 o superior**.
- [Ollama](https://ollama.com/download) instalado y activo **en la misma PC**.
- Modelo local de prueba `qwen3:1.7b` (descarga aproximada de 1,4 GB, no incluida):
  ```powershell
  ollama pull qwen3:1.7b
  ```
- **Primer paso en Windows:** con Ollama iniciado y el modelo descargado, ejecutá `PROBAR-IA-REAL-WINDOWS.cmd`. Crea `INFORME_FLUYNOVA_IA_LOCAL.txt` usando únicamente **dos facturas ficticias** y sin mostrar respuestas completas ni datos personales.
- **Segundo paso:** si Ollama responde, abrí `INICIAR-COPILOT-WINDOWS.cmd` para usar la interfaz en el navegador. Alternativamente, dentro de esta carpeta:
  ```powershell
  node server.mjs
  ```
- Abrir `http://127.0.0.1:8767/` en la **misma computadora**. El servidor no se expone a Internet.
- El botón **Cargar ejemplo** coloca un comprobante totalmente ficticio. **Analizar con IA local** recién allí invoca el modelo.
- Cerrar la ventana del servidor cuando finalices.

**GPU:** la RX 5500 XT no figura en el listado oficial de AMD ROCm para Windows de Ollama; puede utilizar CPU o una vía alternativa de Vulkan según instalación. No se promete aceleración ni velocidad. Consulta [hardware oficial](https://docs.ollama.com/gpu).

## Pruebas

```powershell
node --test copilot.test.mjs
```

Estas pruebas son ejecutables sin Ollama, mediante un **modelo de respuesta falsa para validar contratos de software**. No constituyen una prueba de inferencia real ni de exactitud de extracción. Validan casos con éxito, error, timeout, rechazo de orígenes, mensajes mal formados, límites y revisión humana.

**Histórico de CI:** 9/9 pruebas Node del motor/API, 1/1 de extremo a extremo del diagnóstico con un **Ollama simulado** y 2/2 pruebas Chromium con analizador simulado y solicitudes externas bloqueadas. Evidencia: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42714077911 . **No hubo inferencia de un LLM real en CI**, porque no tiene el modelo instalado. El diagnóstico `PROBAR-IA-REAL-WINDOWS.cmd` es la primera prueba con modelo real que debe ejecutarse localmente.

## Diagnóstico local en Windows: qué hace y qué no

La prueba llama al modelo descargado en `127.0.0.1:11434`, toma dos documentos **totalmente sintéticos** y compara 12 campos conocidos. El informe muestra **dos métricas distintas**: aciertos de la salida original de la IA y aciertos después de contrastar los montos con texto etiquetado. Un 12/12 tras aplicar reglas **no significa que la IA haya acertado 12/12**. También verifica que la aprobación automática esté prohibida. Informa cuánto tardó y si extrajo campos correctos en **esos dos ejemplos**. No mide velocidad o precisión general ni demuestra soporte de GPU; tampoco instala software ni modelos ni envía mensajes externos. Guardá el informe y compartilo para ajustar el motor.

## Próximo desarrollo basado en una venta real

1. Validar con prospectos un problema medible: formato/documentos, volumen mensual, costo de errores y responsable de aprobación.
2. Crear con permiso un corpus sintético + conjunto de evaluación con campos reales anonimizados cuando sea legalmente posible; medir exactitud por campo, falsos positivos, tiempos y costo.
3. Agregar conectores PDF/OCR e imágenes solo después de pruebas de privacidad y autorización. Preferir modelo local multimodal cuando el hardware lo permita; no subir documentos a proveedores externos sin contrato y consentimiento apropiado.
4. Construir autenticación, roles, auditoría persistente, respaldo, recuperación y política de retención antes de comercializar un piloto real.
5. Mantener controles programáticos como fuente de verdad: la IA propone, el humano decide.

## Fuentes técnicas

- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs
- Ollama API: https://docs.ollama.com/api
- Modelo qwen3:1.7b: https://ollama.com/library/qwen3:1.7b
- Guía de IA responsable AAIP: https://www.argentina.gob.ar/noticias/guia-de-la-aaip-para-usar-la-inteligencia-artificial-de-manera-responsable

**Ninguna oferta o contacto a terceros sin autorización previa.**

## Limitaciones del control monetario (noviembre de 2026)

El diagnóstico anterior reveló una discrepancia sistemática en los campos monetarios. La causa exacta de la respuesta original de Ollama es desconocida porque el informe no conserva ni revela las cifras generadas. Se agregó reconciliación explicable: solo se consideran cifras corroboradas por líneas inequívocas del texto provisto, y cualquier diferencia con la IA queda indicada. Esto **no certifica la factura original** ni mejora por sí mismo el modelo. La interfaz distingue origen de montos y discrepancias.


## Diagnóstico actualizado: 10/11/2026, tres ejecuciones en Windows

Los informes locales entregados por el usuario probaron inferencia Qwen3 1.7B real con Ollama:
- Ensayo inicial: **6/12 campos correctos** (los 6 errores fueron importes).
- Ensayo tras reconciliación monetaria: **IA 6/12, sistema combinado 12/12** en dos facturas sintéticas, sin aprobación automática.
- Ensayo con instrucciones de centavos reforzadas: **IA 6/12, sistema combinado 12/12**. Cuatro desvíos monetarios compatibles con diferencia de escala 100; dos netos sin causa identificada. No se obtuvo evidencia de mejora del modelo.

El laboratorio decidió **no perseguir prompts más largos** para valores contables. Implementó una ruta separada de cálculo auditable y sin inferencia, manteniendo la IA opcional y supervisada.

## Nuevo control totalmente independiente del LLM

- `verify-money.mjs`: lectura estricta de tres valores monetarios etiquetados, suma, rechazo de etiquetas duplicadas, ausentes o inválidas, y **revisión humana obligatoria**.
- `POST /api/verify-money`: valida sin comunicar nada con Ollama, no usa modelo simulado. La respuesta deja `model_called:false`, `mode:REGLAS_SIN_IA` y `model_used:null`; no extrapola proveedor, número ni orden de compra.
- La interfaz incluye **Control sin IA** y **Analizar con IA local**, con etiquetas inequívocas de origen. La prueba sin IA sigue funcionando aunque Ollama esté apagado.
- No equiparar el 12/12 de dos facturas ficticias a precisión real, ni la validación textual a autenticidad del comprobante. No integra PDF/OCR, CAE/ARCA ni registros fiscales.

**Siguiente prueba útil:** emplear un corpus sintético diverso, incluyendo formatos inválidos, importes ambiguos y discrepancias contables. Para avanzar a un cliente, obtener formatos autorizados y definir pruebas de calidad; no corresponde repetir indefinidamente los mismos dos comprobantes.

Evidencia de CI: consultar el workflow `fluynova-copilot-offline.yml` de la rama; la prueba del modelo real en Windows **ya se realizó**, pero la ruta nueva sin IA todavía requiere su propia validación en el equipo del usuario.


## Lector local PDF textual (10/11/2026)

Se agregó un **lector PDF acotado basado en Mozilla PDF.js**, separado de Ollama y sin almacenamiento de documentos. La biblioteca de análisis está fijada a `pdfjs-dist@5.4.624`, disponible desde npm. Se carga solo cuando se consulta el endpoint de PDF.

**Características efectivas:**
- `POST /api/pdf/extract`: recibe bytes con `Content-Type: application/pdf`, verifica firma `%PDF-`, límite de **4 MiB**, máximo **6 páginas**, máximo **6000 caracteres**, y devuelve texto extraído más cantidad de páginas. Funciona solo en `127.0.0.1`.
- No acepta URLs, datos multipart, OCR, imágenes escaneadas, ni PDF protegido por contraseña; rechaza archivos sin texto en cualquier página. No guarda ni imprime el contenido del documento.
- La interfaz permite seleccionar **PDF ficticios**, revisar el texto extraído y decidir después si aplica **Control sin IA** o **Analizar con IA local**. Subir un archivo no activa la IA ni aprueba operaciones.
- Las pruebas incluyen un **PDF binario genuino construido en memoria**, extracción sobre dos páginas, rechazo de siete páginas, archivos corruptos y sin texto, y pruebas de API local. Chromium comprueba la secuencia PDF → texto → controles ARS con un modelo apagado.
- El modo manual y los controles siguen disponibles si no está instalado PDF.js.

**Para usar la lectura PDF en Windows, cuando quieras:** ejecutá `PREPARAR-PDF-WINDOWS.cmd`. Te **pide autorización antes de descargar** PDF.js desde npm. Después iniciá `INICIAR-COPILOT-WINDOWS.cmd`; Ollama no es necesario para leer PDF textual o revisar importes con reglas.

**Límites importantes:** la extracción de texto PDF no garantiza la lectura en orden correcto de diseños complejos, tablas o columnas; no autentica el documento. El proceso aún no está aislado en un sandbox ni endurecido para procesar archivos no confiables de clientes. Por eso sigue siendo un laboratorio para PDF sintéticos y no debe exponerse públicamente ni utilizar documentación real/sensible.

**Documentación técnica de referencia:** https://mozilla.github.io/pdf.js/examples/ y https://www.npmjs.com/package/pdfjs-dist

