# FLUYNOVA Copilot — validación nativa de Windows

**Fecha:** 12/11/2026. **Proyecto:** FLUYNOVA Copilot. **Rama:** `feature/fluynova-municipios-piloto-20261109`. **Sin merge ni despliegue.**

## Prueba real de plataforma

La nueva acción `.github/workflows/fluynova-copilot-windows-native.yml` se ejecutó en un **GitHub-hosted runner `windows-2022`**, Windows nativo de 64 bits con **Node.js v24.22.2**. No fue una máquina virtual Linux que simula comandos Windows; tampoco fue la PC personal del usuario.

**Ejecución aprobada:** [GitHub Actions #43241094407](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43241094407), commit `025220755f7aeed5a82e981e1b1df2af6be18821`, **`success`**.

| Conjunto de pruebas en Windows | Resultados |
|---|---:|
| Parser ARS, motor de control, PDF.js, OCR y API de revisión humana | **45/45** |
| OCR Tesseract español real + procesos descartables PDF/OCR + crash/timeout | **6/6** |
| Integración HTTP integral `windows-smoke.test.mjs`: PDF real, OCR real, transcripción humana, protección Host/Origin | **1/1** |
| Chromium nativo Windows: corrección humana, cotejo e invalidación al cambiar documento | **1/1** |
| **Total de tests automatizados Windows** | **53/53** |

Todos los pasos de CI completaron sin fallo. El modelo OCR español se descargó de la referencia oficial fijada y se verificó criptográficamente antes de usarse en ese runner. Ninguna factura real ni credencial se envió a terceros; todos los comprobantes del ensayo fueron inventados y generados en memoria. **No se instaló nada en la PC del usuario**.

## Cómo se implementó

- `experimentos/fluynova-copilot/windows-smoke.test.mjs`: arranca el servidor HTTP real en un puerto efímero y únicamente `127.0.0.1`, sirve la UI, verifica las rutas locales de PDF.js y procesa una factura textual, un PDF 1.4 de laboratorio y una imagen PNG creada con Canvas.
- La ruta PDF y el OCR utilizan los **subprocesos nativos de Windows** configurados por `isolated-processing.mjs`, con límites y sin LLM.
- Se realiza la revisión humana de tres campos, con cifras OCR deliberadamente equivocadas pero aritméticamente coherentes. Se confirma que el resultado diferencia lo transcrito y lo OCR, marca discrepancias y nunca certifica ni aprueba automáticamente.
- Se comprueba el rechazo de formato monetario extranjero, del `Origin` externo y de rutas de archivos arbitrarias.
- Se ejecuta una regresión Chromium Windows del formulario de revisión, incluido el rechazo de un formato incorrecto y la invalidación del resultado ante cambios de documento.

**Fallo detectado y corregido durante la implementación:** en la primera ejecución Windows, el smoke test esperaba `can_auto_approve:false` de una **respuesta de extracción PDF textual** que no incluye decisión de aprobación. Se corrigió la aserción: un extractor PDF no debe afirmar aprobación; el motor monetario, el OCR y la revisión humana sí deben devolver **`can_auto_approve:false` explícitamente**. La ejecución posterior quedó verde.

## Validación adicional del inicio de un clic (misma fecha)

En una segunda revisión se corrigió `INICIAR-COPILOT-WINDOWS.cmd`: se comprueba que Node sea al menos versión 22, se ejecuta el servidor local y **el navegador se solicita recién después del evento de escucha** de `127.0.0.1`. Antes el CMD intentaba abrirlo antes del servidor y podía mostrar un error transitorio.

`browser-launch-windows.mjs` usa `explorer.exe` (sin shell ni URL controlada por usuarios), condicionado a `FLUYNOVA_OPEN_BROWSER=1`, valor que establece el CMD. El servidor abierto directamente con `node server.mjs` no dispara navegador por defecto.

Se agregaron 5 tests que simulan las llamadas de Explorer y comprueban que no se invoca antes de `listen`, que el servidor sobrevive a un fallo de apertura y que no se invoca en Linux ni si no está habilitado.

**Evidencia:** [Windows nativo #43242145918](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43242145918), `success` con **58/58 tests** (50 unitarios/API, 6 OCR y procesos reales, 1 smoke integral, 1 Chromium Windows). [Linux #43242133871](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/43242133871), `success` con **175/175 tests**, incluidos los 5 nuevos de apertura controlada. Se trata de prueba del contrato de inicio y de un runner Windows; **no se abrió un navegador físico desde el CMD en la computadora del usuario**.

## Distinción entre validaciones

**COMPROBADO:** servidor y dependencias PDF/OCR reales funcionando en un runner Windows, controlador HTTP, revisión manual y Chromium. La prueba de caídas de subprocesos y la simulación Ollama pertenecen a pruebas de software; el motor de lenguaje Qwen no fue ejecutado en el runner.

**NO COMPROBADO:** instalación y funcionamiento del lanzador CMD en la PC personal del usuario, funcionamiento con su antivirus/permisos/puertos, inferencia real de Qwen en ese Windows, rendimiento en su GPU RX 5500 XT, exactitud en documentos comerciales verdaderos o seguridad para datos confidenciales.

## Próxima aceptación

1. Preparar un lanzador Windows de un clic que espere a que el servidor esté listo antes de abrir el navegador, con verificación de versión de Node, errores y cierre ordenado.
2. Probar el lanzador mediante un ensayo automatizado en el runner Windows, sin abrir ventanas ni instalar servicios.
3. Entregar un paquete de prueba para ejecutar cuando el usuario tenga acceso a su PC y autorice la prueba. Usar exclusivamente facturas ficticias.
4. Antes de habilitar un piloto real: autenticación, controles de autorización y privacidad, auditoría persistente, aislamiento de sistema operativo y un corpus autorizado de evaluación.

**No se publica, no se fusiona a `main`, no se contacta a terceros y no se utilizan datos reales.**
