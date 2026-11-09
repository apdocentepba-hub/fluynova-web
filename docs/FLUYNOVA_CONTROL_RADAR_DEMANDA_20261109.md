# FLUYNOVA — Demanda real y prototipo Control (09/11/2026)

**Estado:** investigación y prototipo offline en rama aislada. No publicado, no contratado, sin datos de terceros.

## Pedidos públicos concretos

| Destinatario | Necesidad documentada | Plazo real | Ajuste a FLUYNOVA |
|---|---|---|---|
| Mercantil Andina + Cámara Insurtech Argentina | Validación/carga de facturas, proveedores, cobranzas, pagos, automatizaciones con IA y analítica | Convocatoria cerró 12/08/2026; Demo Day 08/09 | **Alineación funcional directa** para una futura venta consultiva; no participación vigente |
| Ministerio de Infraestructura PBA | Provisión e implementación de BPM / workflows | CP SNC 3/26 (BID), apertura 07/10/2026, **en evaluación**; presupuesto oficial ARS 89.292.485 | Solo un módulo estrecho, no reemplaza plataforma del pliego |
| Dirección General de Gobernanza de Datos CABA | Analítica avanzada de datos con agentes de IA | Licitación 2051-1611-LPU26, apertura 23/10/2026 | Tableros e historial; nuestro prototipo **no contiene IA** ni plataforma analítica |
| Empresas participantes de ATICMA | Demanda por gestión, costos, CRM, BI, automatización y reportes | Ronda B2B 13/11/2026, ATICMA aclara foco en proveedores de Mar del Plata | Posible segmento pyme; elegibilidad de FLUYNOVA no verificada |
| EU-LAC Digital Accelerator | Proyectos con IA, automatización y servicios públicos; asociación entre empresa y startup de regiones distintas | Cierre 30/11/2026 | Solo relevante con socio internacional elegible, **no venta inmediata** |

Fuentes:
- https://www.camarainsurtech.com.ar/eventos/convocatoria-abierta-or-linkup-mercantil-andina
- https://www.minfra.gba.gob.ar/licitacionesV2/bidding/show/1200/
- https://indicadores.ar/contrataciones/llamados/aviso/jefatura-de-gabinete-de-ministros-licitacion-publica-n-1611-dggda-26-cc8ae5
- https://www.aticma.org.ar/novedades/b2b-demandas-tecnologicas-2026-tu-empresa-tiene-un-desafio-nosot/
- https://www.aticma.org.ar/aticma-impulso-una-exitosa-ronda-b2b-de-demandas-tecnologicas-para-fortalecer-la-transformacion-digital-del-entramado-productivo-local/
- https://agro.uba.ar/internacionales/convocatorias/5908

## Decisión de producto (hipótesis a validar)

**FLUYNOVA Control — verificación y circuito humano de facturas / comprobantes.** Es una respuesta comercial acotada a un problema expresamente publicado por una empresa y transversal a otras administraciones. No afirmar que supera a sistemas existentes ni que cumple pliegos de Estado sin prueba de integración, seguridad y requisitos.

Archivos: `static/control/index.html` contiene un HTML autocontenido, con seis comprobantes **sintéticos**; no usa API ni almacenamiento ni IA. Funciones ya integradas: marcar número duplicado para mismo proveedor; comprobar neto+impuesto=total; alertar orden de compra ausente; impedir aprobación de documentos marcados; observación con motivo; aprobación humana de registros sin alertas; búsqueda, filtros, contadores, historial en memoria, exportación CSV ficticia y reinicio.

### Estado de verificaciones

- Motor puro de laboratorio: **8/8 pruebas unitarias local Node** (duplicado, importes, estados y CSV sin fórmulas), realizadas sobre la fuente modular del prototipo previo a empaquetar.
- HTML autocontenido: **prueba real Playwright + Chromium local aprobada** en anchos 320, 390, 768, 900 y 1280 con aprobación, observación, filtros, CSV, reinicio, sin solicitudes externas.
- CI propio: `.github/workflows/fluynova-control-demo-offline.yml` valida la fuente **en GitHub**; ver enlace al run de evidencia: https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42678140547 (**2/2 pruebas de navegador PASS**, sin despliegue).
- **No** se probó API real, OCR, IA, seguridad multiusuario, autenticación, datos remotos, backup o entrega de correos. Historial solo temporal; no es auditoría oficial.

## Secuencia comercial propuesta

1. Mostrar demo con datos ficticios solo a prospectos con necesidad confirmada y permiso de contacto.
2. Preguntar volumen mensual, origen de facturas, reglas de aprobación, ERP existente, responsable de compra, presupuesto y tratamiento de datos. No prometer automatización de la contabilidad legal.
3. Presupuestar primero un **piloto de alcance cerrado**: ingesta validada de un solo formato, tres verificaciones acordadas, revisión humana, registro persistente, exportación e informe de evaluación. La oferta y los precios dependen del diagnóstico y seguridad.
4. Antes de un uso real: autenticación, permisos, registro auditable persistente, protección de datos, pruebas de fallos/recuperación, integración autorizada y revisión fiscal/contractual.
5. **No contactar, publicar, fusionar o desplegar sin autorización.** Cero clientes pagos constatados y cero ventas atribuidas al prototipo.

**Criterio de oportunidad:** CABA y licitaciones provinciales demuestran demanda y presupuestos institucionales, pero no constituyen ventas actuales accesibles. Priorizar conversación comercial PyME antes que construir ERP o IA compleja sin contrato.
