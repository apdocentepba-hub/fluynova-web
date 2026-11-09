# FLUYNOVA Copilot — estrategia IA y estado verificable

**Fecha:** 09/11/2026. **Objetivo:** construir un producto comercial reutilizable para resolver tareas administrativas de pymes y, más adelante, municipios con contratación válida.

## Decisión de producto

No competir con chatbots genéricos. El producto será un **copiloto documental con IA + reglas + supervisión humana**:

1. Detecta qué tipo de documento o consulta recibe.
2. Extrae campos y cita fragmentos exactos cuando puede.
3. Cruza cifras y reglas; marca duplicados, faltantes e incoherencias.
4. Propone una acción y explica por qué, señalando incertidumbre.
5. Una persona autoriza cada decisión con consecuencia administrativa.
6. En una versión comercial futura, registra en un historial persistente las correcciones y permite medir tiempos y calidad del proceso.

**Diferenciación propuesta, todavía no demostrada en mercado:** trabajo sobre procesos reales, trazabilidad, datos locales siempre que sea posible, integraciones autorizadas y modelos intercambiables.

## Primer segmento de venta

Empresas que procesen muchos comprobantes o solicitudes: distribuidoras, estudios administrativos, empresas de servicios, cooperativas o instituciones. Un contacto con comprador debe confirmar qué tarea lleva horas, qué archivos utiliza, qué errores ocurren y qué sistema tiene hoy.

Los pliegos provinciales de BPM y la convocatoria anterior de Mercantil Andina demuestran que el problema existe; no prueban que esas organizaciones estén comprando FLUYNOVA hoy. Precios y ROI se acuerdan mediante relevamiento, sin confundir presupuestos de grandes licitaciones con precio de nuestro piloto.

## Implementación efectiva hasta el 09/11

Repositorio: `apdocentepba-hub/fluynova-web`, rama `feature/fluynova-municipios-piloto-20261109`.

- Demo Control anterior: revisión, subsanación ficticia y exportación, **sin IA**; pruebas Chromium verificadas.
- **Nuevo experimento IA:** `experimentos/fluynova-copilot/`.
- Backend Node 22 escucha solo `127.0.0.1:8767`.
- La única salida de red permitida por el motor de análisis está fijada a Ollama local `http://127.0.0.1:11434/api/chat`, solicitando salida JSON con esquema.
- Procesamiento de texto, no OCR/PDF; respuesta estructurada, verificación aritmética y comparación con registro inventado.
- La interfaz no simula respuestas positivas si el modelo está ausente.
- Sin autenticación, datos persistentes, acceso de clientes, integración tributaria, exportación de resultados, métricas productivas ni publicación remota.
- Controles de API: límite de entrada, origen local, rechazo de formato inválido, timeout y revisión humana obligatoria.

**Pruebas CI de software — comprobadas:** 8/8 en Node HTTP/payload + **2/2 Chromium** con analizador sustituido, incluyendo no XSS y no falso éxito ante modelo caído. Run de evidencia: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42708416345

**Aún NO comprobado:** inferencia contra un modelo Ollama instalado, precisión de extracción en facturas reales, tiempos en hardware Windows RX 5500 XT, comportamiento de OCR, resultados para usuarios y retorno económico. La RX 5500 XT no figura en la tabla AMD ROCm de Windows de Ollama; probar Vulkan/CPU con datos inventados antes de asumir rendimiento.

## Criterios de aceptación de un piloto pago posterior

- Dataset **autorizado** y etiquetado; medir exactitud campo por campo, errores críticos, tasa de abstención y latencia; sin prometer un porcentaje hasta medirlo.
- Comparativa contra flujo manual, con tiempos y correcciones reales.
- Revisión humana y posibilidad de rechazar la sugerencia de IA, con razones y auditoría.
- Autenticación, permisos, aislamiento de clientes, cifrado, retención, backups verificables, rollback y respuesta a incidentes.
- Sin salida no autorizada de datos personales; privacidad conforme a Ley 25.326 y orientación AAIP; revisar con profesionales cuando correspondan datos sensibles y regulación sectorial.
- No entrenar un modelo con documentos del cliente por defecto.
- Contrato y presupuesto por alcance definido; sin cambios en producción ni mensajes a terceros sin autorización.

## Evolución por valor comercial

1. **Prueba de inferencia local real** con tres facturas ficticias y medición de tiempo/precisión.
2. **Carga de PDF/imagen** con extracción local cuando corresponda y pruebas de tamaño/tipo, texto sospechoso y control de calidad.
3. **Piloto de un proceso** con ingesta de un formato, edición humana, exportación y registro persistente; consulta a un comprador antes de desarrollarlo.
4. Integraciones autorizadas (correo, ERP, WhatsApp Business), panel de trabajo y seguimiento, solo después de acordar requisitos, seguridad y costos.
5. Sistema de mejoras a partir de correcciones humanas **solo con base legal/consentimiento** y evaluaciones que muestren aumento real de desempeño.

## Fuentes primarias

- API de Ollama: https://docs.ollama.com/api
- Salidas estructuradas: https://ollama.com/blog/structured-outputs
- Modelo local: https://ollama.com/library/qwen3:1.7b
- Hardware: https://docs.ollama.com/gpu
- AAIP: https://www.argentina.gob.ar/noticias/guia-de-la-aaip-para-usar-la-inteligencia-artificial-de-manera-responsable

**No fusionar ni desplegar sin una aprobación específica.**
