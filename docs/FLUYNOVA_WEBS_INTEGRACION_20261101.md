# FLUYNOVA Webs — Incorporación comercial al sitio principal
Fecha: 2026-11-01.

## Archivos que se publican
- `static/webs/index.html`: página pública de servicios web, 2 demostraciones y cotizador de estimación (no recoge datos).
- `static/index.html`: enlace de navegación, sección de proyectos web ficticios y acceso directo al cotizador.
- `static/sitemap.xml`: entrada de `/webs/`.

## QA de la rama antes de integrar
- Sitio de vista previa estática publicado en Render: `https://fluynova-webs-vista-previa.onrender.com/`.
- `GET /` y `GET /webs/`: HTTP 200; títulos y contenidos correspondientes.
- Portada: comprobado enlace `/webs/`, enlace a ambas demos Cloudflare Pages y sección `id="webs-negocios"`.
- Página de servicios: enlaces a demos `*.pages.dev`, paquete Esencial ARS 290.000, Catálogo ARS 450.000, Profesional desde ARS 650.000.
- Cotizador público: presentación inicial de ARS 290.000; anticipo ARS 145.000, saldo ARS 145.000; enlace `mailto:` a `contacto.fluynova@gmail.com`. La interacción por selección de extras requiere una prueba completa de navegador adicional antes de darla como comprobada.
- No se incorporaron datos de clientes, credenciales, procesador de pagos ni endpoint nuevo.
- No se modificó `app.py` ni la integración FormSubmit existente.

## Alcance y límites
- Los importes son precios **orientativos**; el presupuesto contractual final puede variar según alcance e impuestos.
- Las demostraciones tienen marcas ficticias y no realizan ventas ni envían pedidos.
- El cotizador interno con uso administrativo no está publicado y permanece como archivo separado.
- No se enviaron campañas ni nuevas ofertas; publicar una página de servicios no equivale a validar facturación ni aceptar contratos.
- El repo sigue siendo público y no debe alojar datos de futuros clientes.

## Requisitos pendientes
1. Alta y prueba de un repositorio privado separado por cliente y vinculación a Cloudflare Pages.
2. Validación fiscal: titular de facturación y medio de cobro.
3. Revisión de presupuesto, contrato y privacidad.
4. Prueba de entrega, migración y respaldo independiente de una web de cliente.
5. Prueba interactiva completa de la calculadora en navegador tras publicación.

Para no activar un workflow de IndexNow al publicar este cambio, el commit de promoción contiene `[skip ci]`, sin alterar ni deshabilitar los workflows preexistentes. Es una decisión puntual; futuras actualizaciones siguen sus reglas normales.
