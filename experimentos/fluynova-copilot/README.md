# FLUYNOVA Copilot · laboratorio de IA local (09/11/2026)

**Estado:** PROTOTIPO DE LABORATORIO, rama de trabajo aislada. No fusionado a `main`, no desplegado, no comercializado. Sin usuarios, base de datos, secretos, facturas reales ni integraciones con municipios.

## Qué aporta

- Extracción de campos **mediante un modelo de lenguaje real instalado localmente**: proveedor, número, orden de compra, neto, impuesto y total expresados en centavos.
- **Salida estructurada** de Ollama (`/api/chat` con esquema JSON); el sistema rechaza respuestas inesperadas o demasiado extensas.
- **Motor determinista independiente** para suma de importes, orden ausente, duplicados frente a **un registro inventado** y citas que no aparecen en el texto.
- **Revisión humana obligatoria** sin ninguna ruta de aprobación automática ni escritura externa.
- API Node vinculada exclusivamente a `127.0.0.1`, con límite de entrada, comprobación de origen, CSP, timeout y fallo cerrado.
- HTML con carga de ejemplo, consulta real al modelo local y presentación con `textContent`, sin inyectar HTML del modelo.

La demo **NO lee imágenes/PDF**, no ejecuta OCR, no valida CAE/ARCA ni identidades de proveedores, no tiene usuario, roles, persistencia, backups, comprobación fiscal ni auditoría legal. Al faltar Ollama o el modelo, **NO inventa un resultado de IA**: informa error.

## Requisitos sin servicios pagos

- Windows/Linux/macOS con **Node.js 22 o superior**.
- [Ollama](https://ollama.com/download) instalado y activo **en la misma PC**.
- Modelo local de prueba `qwen3:1.7b` (descarga aproximada de 1,4 GB, no incluida):
  ```powershell
  ollama pull qwen3:1.7b
  ```
- En Windows, con Ollama iniciado y Node instalado, usar `INICIAR-COPILOT-WINDOWS.cmd`. Alternativamente, dentro de esta carpeta:
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

Se prepara además una prueba Chromium que recorre la interfaz y bloquea servicios externos. La aprobación de CI debe consultarse en el workflow `fluynova-copilot-offline.yml`.

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
