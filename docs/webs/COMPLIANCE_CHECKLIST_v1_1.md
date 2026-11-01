# FLUYNOVA Webs | Puerta de salida comercial, auditoría y riesgos (01/11/2026)

## Parte A — Técnicamente logrado
[x] Dos demos públicas independientes en Cloudflare Pages.
[x] Piloto de cliente con repositorio GitHub **privado** y web en Cloudflare Pages.
[x] Actualización por Git directo y reversión comprobadas; sin consumo de GitHub Actions de despliegue en piloto.
[x] Migración técnica Cloudflare Pages -> Render Static Site sobre el **mismo repositorio privado**, dos URLs públicas HTTP 200, branding y `noindex`; `robots.txt` en Render comprobado.
[ ] Backup archivado **fuera** del repositorio productivo y restaurado desde dicho backup, con verificación de checksums.
[ ] Simulación de dominio propio, DNS y prueba de correo empresarial, sin tocar dominios ajenos.

## Parte B — Antes del primer anticipo
[ ] Identificación del prestador, CUIT y encuadre fiscal real; confirmar posibilidad de facturar servicios.
[ ] Canal de cobro a nombre verificado, conciliación y comprobantes fiscales.
[ ] Revisión legal de modelo de contrato y presupuesto; condiciones de salida.
[ ] Confirmar regímenes de consumo y de ventas B2B (no asumir que todos los clientes tienen la misma protección ni que quedan excluidos automáticamente).
[ ] Implementar flujo de solicitud/confirmación de revocación y baja, cuando corresponde, y revisar visibilidad y horarios de soporte; **no lanzar checkout web antes de definirlo**.
[ ] Información de privacidad, contacto y domicilio comercial requeridos conforme corresponda; revisión del prestador de formularios si se tratan datos.
[ ] Límites exactos de alcance, 2 rondas de cambios y plazos sujetos a materiales.
[ ] 12 meses de administración técnica de hosting incluidos desde la publicación, claramente separados de soporte editorial; no renovar ni debitar sin aprobación.
[ ] Condiciones de uso de portafolio/imagen de cliente con autorización expresa.

## Parte C — Fuentes normativas verificadas
- **Disposición 954/2025** (vigente en 2026), derogó la vieja Resolución 424/2020; regula botón de arrepentimiento y baja y establece plazos de registro de petición.
- **Disposición 3/2026**: aclaración para verificación razonable de identidad del solicitante.
- **Ley 24.240** y **Código Civil y Comercial**, arts. 1105–1116: derechos del consumidor y contratación a distancia. Pueden existir excepciones por contenido personalizado, pero requieren evaluación jurídica: no redactar una exclusión automática.
- **ARCA**: monotributistas que facturan operaciones internas emiten comprobante electrónico C; tipo E para exportaciones según norma. No afirmar encuadre del prestador sin verificarlo.

Referencias:
https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto
https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-3-2026-423007/texto
https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion
https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion
https://www.arca.gob.ar/monotributo/ayuda/facturacion.asp
https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion

## Parte D — Qué NO se ha hecho
- No se registró dominio de cliente ni se gastó dinero.
- No se verificó situación fiscal, CUIT, cuenta bancaria ni régimen tributario.
- No se vendió web, envió presupuesto a tercero, recibió pagos ni se habilitó checkout.
- No se conectó CRM propio persistente a consultas reales.
- No se certificó cumplimiento jurídico; documentación es de preparación interna.

**Criterio de aprobación para venta:** toda Parte B crítica debe estar resuelta con evidencia, fecha y responsable. No fijar porcentaje de completitud inventado.
