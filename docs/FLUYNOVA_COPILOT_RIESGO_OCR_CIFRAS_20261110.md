# FLUYNOVA Copilot — cifras OCR plausibles pero equivocadas

**Fecha:** 10/11/2026  
**Proyecto:** FLUYNOVA Copilot (rama aislada `feature/fluynova-municipios-piloto-20261109`)  
**Estado:** cambios de laboratorio; sin despliegue ni datos reales.

## Riesgo constatado por análisis adversarial

Las reglas `neto + impuestos = total` detectan inconsistencias, pero **no pueden comprobar la identidad con una imagen** cuando el OCR modifica cifras compensadas. Ejemplo sintético:

| Dato | Imagen original ficticia | Texto OCR deliberadamente equivocado |
|---|---:|---:|
| Neto | $150.000,00 | $150.800,00 |
| IVA | $31.500,00 | $31.500,00 |
| Total | $181.500,00 | $182.300,00 |

Ambas columnas cumplen la suma exacta. Si solo se dispone del texto equivocado, ningún cálculo aritmético puede descubrir la discrepancia. Además, que el LLM coincida con el OCR tampoco constituye una corroboración independiente: ambos interpretan el mismo texto de origen.

**Importante:** los importes erróneos del cuadro son una mutación adversarial programada; no se afirma que Tesseract haya cometido exactamente ese error en las pruebas previas.

## Controles incorporados al código

1. `verify-money.mjs`: acepta la procedencia `inputOrigin:'OCR'` únicamente con `visualReviewDeclared:true`; mantiene el cálculo textual, pero distingue `parsed_amounts` de `verified_amounts`. En OCR, **`verified_amounts=0`**, `original_document_verified=false`, advertencia de discrepancia posible aun con suma correcta y origen `OCR_COTEJO_VISUAL_DECLARADO_NO_VERIFICADO`.
2. `server.mjs`: permite declarar `input_origin:'OCR'` y `visual_review_declared:true` tanto para control sin IA como para análisis con IA. Sin la declaración rechaza la operación; con ella sigue marcando los importes como no confirmados de manera independiente.
3. `index.html`: muestra la imagen original PNG/JPEG o las páginas del PDF escaneado junto al texto reconocido. Las imágenes se mantienen como objetos `blob:` del navegador y se revocan al seleccionar otro documento. La política CSP permite únicamente ese tipo de imagen local, no cargas de imágenes remotas.
4. La interfaz exige la declaración de cotejo visual y la invalida si se edita el texto OCR o se selecciona otro archivo. Un resultado previo desaparece al cambiar el texto.
5. `ocr-provenance.test.mjs`: introduce la mutación compensada, prueba la procedencia y el rechazo por API, y comprueba que ni la suma correcta ni el acuerdo con la IA se confundan con verificación.
6. `copilot.browser.test.mjs`: prueba previsualización local en Chromium, bloqueo previo a cotejo, edición que invalida la confirmación y caso adversarial con cifras cambiadas.

## Lo que este avance NO hace

- **No identifica automáticamente** un dígito incorrecto cuando el OCR produjo cifras plausibles. Solo evita que el sistema presente esos importes como certificados y obliga al cotejo humano explícito.
- El checkbox representa una **declaración del operador**, no evidencia de que el cotejo se realizó correctamente. No hay identidad autenticada, firma ni registro persistente de acciones.
- La API local no distingue documentos humanos de documentos OCR si un cliente manipulado miente acerca de la procedencia. No está diseñada para exposición pública.
- No incluye aislamiento de sistema operativo, datos comerciales sensibles, conexión a ARCA/CAE, ni verificaciones contables reglamentarias.

## Evidencia de pruebas

La última ejecución que comprende todos estos cambios se verifica en el workflow `.github/workflows/fluynova-copilot-offline.yml` de la rama. No considerar una ejecución cancelada como aprobada.

## Próximos criterios de aceptación

Medir con imágenes adversariales **procesadas por OCR real**: sustitución de dígitos, sombreado, desenfoque y facturas con varias columnas; separar valores correctos, rechazados y peligrosamente mal aceptados. Después, evaluar contraste multivista y sus falsos positivos; no prometer detección infalible. Para uso comercial real harán falta autenticación, trazabilidad persistente y política de privacidad con una base de documentos autorizados.

**Sin merge a `main`, sin publicación y sin uso de datos de clientes.**
