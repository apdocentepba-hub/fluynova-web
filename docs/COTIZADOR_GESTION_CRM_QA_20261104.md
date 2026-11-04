# FLUYNOVA — Cotizador comercial de software (QA 04/11/2026)
Estado: **rama aislada, sin merge ni despliegue**. Código experimental: NO hay compras, facturación, base de clientes ni altas automáticas.

## Qué quedó implementado
- Ruta futura `/cotizador-gestion/`, página propia con tres paquetes comerciales y estilos responsive, sin datos personales ni llamadas a APIs.
- Navegación y bloque de presentación integrados **solo en la rama**, sin modificar `main`.
- Núcleo `cotizador.js`: plan Presencia Web (ARS 290.000, mantenimiento opcional); Presupuestos + Clientes (ARS 290.000 instalación / ARS 39.000 por mes, sujeto a SaaS alojado); Gestión + Automatizaciones (desde ARS 390.000 / desde ARS 59.000 mensuales).
- Para cantidad de usuarios superior a 5, integración externa o hosting propio en CRM, la estimación no calcula una mensualidad definitiva y exige evaluación humana.
- Cálculo anual de referencia = instalación + 12 cuotas, solo si está determinado el valor mensual.
- CTA hacia el diagnóstico ya existente, con UTM orientativa. No crea consultas por sí mismo.

## Pruebas realizadas en sesión
- `node --test tests/cotizador-gestion.test.js`: **6/6 PASS** con Node v22.16.0, código exacto recuperado desde GitHub.
- Chromium real: **19/19 PASS** en escritorio 1366px y móvil 390px, con DOM renderizado y scripts reales cargados por `set_content`.
- Cobertura: cálculos de 3 planes, mensualidad/primer año, variantes con usuarios/integraciones/hosting, estructura sin formulario de datos, ausencia de errores JS, capacidad responsive y navegación del CTA (sin navegarla).
- Se inspeccionaron visualmente capturas de escritorio y celular: sin desborde horizontal.

## Limitaciones y restricciones
- Chromium del entorno bloquea navegación local: el QA usó `set_content` y carga de scripts por contenido, NO una URL HTTP servida ni navegación real en Render.
- Los montos de CRM y Gestión son hipótesis comerciales, NO precios aprobados; esos productos todavía NO están listos para clientes.
- Contratos, impuestos, facturación, disponibilidad, RLS, backends y soporte deben definirse antes de vender.
- No publicar esta ruta en producción ni enlazarla desde el sitio público sin autorización.
- No ejecutar GitHub Actions ni crear costos por este avance.

## Diferenciación respecto de lo que ya existe
La web `/webs/` ya ofrece **cotizador de páginas web**. Este nuevo estimador aborda **software de gestión y CRM**; no reemplaza ni duplica ese cotizador. La demostración funcional de Presupuestos + CRM reside en el repositorio privado de pilotos y NO se incorpora al repositorio público.

## Próximo criterio de aceptación
1. QA servido por HTTP en vista previa aislada y aprobado visualmente por el propietario.
2. Validar los tres paquetes, límites y costos reales mediante pilotos voluntarios.
3. Integrar contacto a flujo persistente y seguro solo cuando Supabase/Auth/RLS estén probados en infraestructura exclusiva de FLUYNOVA.
4. Implementar presupuestos multiítem, trazabilidad y automatizaciones antes de usar datos de clientes.
