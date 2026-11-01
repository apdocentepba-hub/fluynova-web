# FLUYNOVA — Fábrica de webs comerciales (propuesta v0.1)
Fecha: 2026-11-01. Estado: DISEÑO / NO IMPLEMENTADO / NO PUBLICADO.
Objetivo: vender páginas simples, rentables y portables, sin trabajo técnico para el cliente y sin costos iniciales para FLUYNOVA. **No mezclar con VOLVÉ, APDocentePBA ni instituciones educativas.**

## Decisión de arquitectura
1. Producto estándar: **sitio estático a medida** (HTML/CSS/JS sin backend, o Astro compilado a estático si se justifica). Prohibido depender de bases de datos o servidores 24/7 para una vidriera.
2. **Repositorio privado independiente por cliente**, bajo gestión de FLUYNOVA; no almacenar imágenes o datos privados de clientes en el repositorio público de este documento. Plantilla genérica sin marcas/copias de otros clientes. Backups ZIP de fuente y compilado por cada versión entregada.
3. Hosting preferido: **Cloudflare Pages Free** con HTTPS y dominio propio; requiere vincular una cuenta autorizada la primera vez. La integración por Git permite actualización al publicar cambios. Cloudflare Pages Free: 100 proyectos por cuenta, 500 builds/mes por cuenta, 20.000 archivos/proyecto, tamaño máximo 25 MiB/archivo; recursos estáticos sin cobro por solicitudes. El plan no promete SLA ni gratuidad perpetua. Fuentes: https://developers.cloudflare.com/pages/platform/limits/ y https://developers.cloudflare.com/pages/functions/pricing/.
4. Opción secundaria **Firebase Hosting Spark** si se conecta el plugin Firebase y se validan permisos: permite dominios propios y SSL, 10 GB de almacenamiento y **360 MB/día** de transferencia gratuita. No usar como hosting central de muchas webs sin medir. https://firebase.google.com/pricing
5. **No Render Hobby como hosting estándar para muchas webs**: 5 GB de ancho de banda incluidos y 2 dominios custom por workspace en 2026, excedentes de USD 0,15/GB y USD 0,25/dominio/mes. Render STATIC útil como prueba con integración ChatGPT ya activa. https://render.com/pricing
6. **No Github Pages** para hospedaje del negocio comercial: términos limitan ese uso. https://docs.github.com/es/pages/getting-started-with-github-pages/github-pages-limits
7. **No Vercel Hobby** para negocios (no comercial), ni Wix/WordPress.com Free si exige dominio propio (dominio exige upgrade).
8. Formularios: priorizar enlace WhatsApp/llamada, evitando almacenar datos. Cuando el cliente requiera formularios, Tally Free ofrece formularios/respuestas ilimitados bajo uso justo, webhooks y avisos al propietario; contrato de tratamiento, destinatario y prueba real obligatorios. https://tally.so/pricing/. El formulario tiene titular y acceso propio del negocio siempre que sea viable; no concentrar datos de contacto de distintos negocios en el Gmail personal de FLUYNOVA.
9. Estadísticas: Cloudflare Web Analytics, gratuito, sin cookies de seguimiento según documentación; medir por dominio y reportar sin prometer conversiones. https://developers.cloudflare.com/web-analytics/about/
10. SEO: metadatos, sitemap, indexabilidad, imágenes optimizadas, accesibilidad básica y ficha Google Business Profile si cliente autorizó. No prometer rankings.

## Modalidades para el comprador (precios experimentales, ARS, sin publicar)
- WEB ESENCIAL: $290.000 pago único. Hasta 1 página larga + contacto, mapa, 8 bloques, 12 imágenes; 2 rondas de cambios antes de aprobación.
- WEB CATÁLOGO: $450.000 pago único. Hasta 5 secciones/páginas, hasta 30 productos SIN stock ni carrito y contacto/cotización por WhatsApp; 2 rondas.
- WEB PROFESIONAL: desde $650.000 pago único. Hasta 5 páginas, formulario sencillo y secciones particulares; funciones dinámicas se presupuestan aparte.
- Precios finales según alcance; cotización 7 días de vigencia, materiales entregados por cliente, estimación de plazo específica. Entrega 50% anticipo y 50% tras aceptación/verificación, antes de entregar los accesos y publicar dominio definitivo, según términos acordados. Comprobante fiscal correspondiente.

## Hosting, dominio y mantenimiento
- Hosting cloud del sitio estático: **$0 mientras cumpla Free, sin compromiso de permanencia del proveedor**. Primeros 12 meses de administración básica del hosting incluidos en el precio de desarrollo; no incluye cambios de contenido.
- Dominio .com.ar: registro/renovación directa por cliente a NIC, arancel informado de $8.500/año al 2026-11-01, sujeto a cambio; titular **siempre el cliente**; FLUYNOVA puede actuar por delegación formal, pero no recibir ni almacenar contraseñas. https://www.punto.gob.ar/es/dominios/dominios_y_aranceles.
- Año 2+: administración de hosting por FLUYNOVA opcional: tarifa piloto $72.000/año, avisar al menos 45 y 15 días antes del vencimiento; **no cobrar automáticamente**, renovar solo tras aceptación y pago.
- Si no renueva FLUYNOVA, entregar gratuitamente ZIP con código, archivos compilados, recursos licenciados y guía de migración, y mantener el sitio hasta el fin del período pactado; ofrecer migración asistida por cotización. No retener backups, dominios ni contenido por falta de mantenimiento. Plazos de retirada/baja y tratamiento de datos pactados por escrito; no prometer hosting eterno gratis.
- Cambio puntual: $15.000 hasta 20 minutos de modificación simple; $35.000 hasta 60 minutos; nueva sección o funciones especiales desde $70.000. Cotizar y aprobar antes. Los cambios fuera de alcance no consumen garantía.
- Plan soporte opcional $39.000/mes incluye hasta 45 minutos de cambios + comprobación; $79.000/mes hasta 3 horas; soporte no acumulable, SLA solo si documentado; hosting admin anual incluido mientras abonado el plan mensual.
- **Garantía**: defectos de implementación reproducibles se corrigen sin cargo durante 30 días de entrega como mínimo, sin restringir derechos legales. Contenido nuevo o cambio de opinión no es defecto. Revisar legislación local y contrato con profesional antes de ampliar.

## Proceso comercial y de entrega (sin trabajo técnico del usuario)
1. Buscar negocios con datos de contacto comerciales públicos y una necesidad específica; verificar el sitio existente antes de ofrecerles uno. No enviar correos masivos ni afirmar que no tienen web sin comprobarlo.
2. Enviar una sola propuesta personalizada y, si corresponde, un seguimiento respetuoso. Registrar contacto, consentimiento/oposición, fecha, respuesta y próxima acción. No enviar a quien se opuso.
3. Si hay interés: recopilar nombre comercial, logo/fotos con licencia, textos, horarios, whatsapp, contacto responsable, alcance; verificar identidad y aceptación formal del presupuesto. Los materiales y la decisión comercial deben venir del cliente.
4. Antes del anticipo: contrato breve de alcance, revisiones, titularidad, factura, período de alojamiento, garantía, cambios, protección de datos, backups, procedimiento de baja.
5. Crear proyecto privado por cliente; diseño responsivo desde plantilla; revisión humana de contenido; pruebas móviles, accesibilidad, HTTPS, enlaces, QR, contacto; entregar preview con datos de ejemplo o reales autorizados.
6. Una vez aprobado y cobrado: publicar dominio; configurar DNS por delegación aprobada, HTTPS, analytics, respaldo y acta de entrega. No hay despliegue real de clientes sin consentimiento.
7. Cambios posteriores por petición: registrar pedido, cotizar si fuera del plan, editar en Git, desplegar, verificar producción y comunicar resultado.
8. Baja: entrega de fuente/estático y documentos; plan de exportación de datos de formularios del cliente; supresión de copias según contrato y requisitos legales.

## Reglas financieras y operativas
- No adquirir planes pagos, dominios, APIs ni infraestructura sin presupuesto validado y autorización explícita.
- Nunca prometer disponibilidad 100%, visitantes, rankings ni incremento de ventas; freeware puede modificar condiciones.
- Evitar acoplamiento: cada cliente tiene dominio, repo, deployment, secretos y registros de acceso separados. No acceso de un cliente a datos de otro.
- Documentar versión, fecha, requisitos, pruebas, resultados y costos por cliente.
- Objetivo hipotético: 3 webs catálogo × $450.000 = $1.350.000 **brutos**; utilidad depende de impuestos, horas, comisiones y soporte; ventas aún no realizadas.
- Capacidad inicial recomendada: 1-3 sitios por mes hasta verificar tasa real de conversión, QA y costo de soporte. No ofrecer tiempos sin auditar el trabajo.

## Estado de conectores al 2026-11-01
- Conectados: GitHub (lectura/escritura archivos en repos existentes, pero NO presenta acción crear repositorio), Render (crear sitio estático), Gmail FLUYNOVA, Canva, Lovable, Supabase.
- No conectado: Cloudflare Pages (no hay plugin en búsqueda). El paso de conexión inicial requiere acceso autorizado; no afirmar que se realizó. Alternativa Firebase: plugin disponible para instalar, no instalado al auditar.
- **Bloqueadores reales de automatización completa**: creación de repos privados nuevos desde ChatGPT, vinculación inicial de Cloudflare a Git, registro/renovación de dominios ajenos, cobros, contratos, materiales de clientes. Resolver por acceso autorizado/flujo delegado, no con credenciales pegadas en chats ni gastos no autorizados.
- No tocar producción del repositorio fluynova-web antes de aprobar arquitectura y pasar pruebas. Documento se aloja en rama de planificación solamente.

## Criterios de aceptación para primer piloto
[ ] Plantilla genérica sin datos de clientes reales
[ ] Pruebas local de mobile/desktop, formulario o WhatsApp, enlace y HTTPS de preview
[ ] Despliegue real al proveedor seleccionado verificado
[ ] Dominio de prueba bajo control FLUYNOVA, sin coste ni bloqueo de titularidad de clientes
[ ] Procedimiento de backup/rollback probado
[ ] Revisión de facturación y contrato base
[ ] Escenario de migración a otro proveedor ejecutado al menos una vez
[ ] Costos mensuales observados durante piloto, no supuestos
