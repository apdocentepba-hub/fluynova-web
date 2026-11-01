# FLUYNOVA WEB — Control operativo para primeras ventas
Fecha: 2026-11-01. Estado: preparación comercial, sin contratación de nuevos clientes.
Este documento es genérico, apto para repositorio público. NO incorporar datos personales, documentos fiscales, credenciales, presupuestos nominales ni información de compradores.

## Realizado y verificado
- Landing de servicio web: https://fluynova-web.onrender.com/webs/ (publicado previamente, HTTP 200).
- Demos: https://fluynova-demo-pasteleria.pages.dev/ y https://fluynova-demo-distribuidora.pages.dev/.
- Actualización y reversión automáticas GitHub -> Cloudflare Pages en la demo de distribuidora, sin GitHub Actions para desplegar.
- Cotizador público: ensayo de JS **copiado del archivo main actual** en Chromium local, 7 escenarios * 2 resoluciones = **14 casos OK**: Esencial 290.000, Catálogo 450.000, Catálogo + 2 secciones 590.000, Profesional + 3 secciones 860.000, límites superior/inferior, vínculo mailto y consola. Estos son tests locales con DOM mínimo; **no** prueban que el formulario de correo del visitante funcione en todos los dispositivos.
- Generador local de plantillas: **12/12 pruebas Node OK** (escape HTML, validación de contacto, sanitización de colores, demo noindex, robots y sitemap; prevención de sitemap obsoleto). No se ha publicado desde un repositorio privado.
- Ensayo local de entrega con negocio ficticio: HTML + CSS + robots.txt + sitemap.xml, copia y restauración, **cuatro checksums SHA-256 idénticos**. No equivale a migración real entre proveedores.
- Precios de referencia públicos, sujetos a presupuesto final. Modelo de contrato redactado, todavía no aprobado jurídicamente.

## Pendientes bloqueantes antes de cobrar
1. **Crear repositorio PRIVADO de FLUYNOVA** para un primer sitio ficticio sin datos de clientes. El conector actual de GitHub no proporciona API de creación de repositorios nuevos. No reutilizar repositorios de otros proyectos.
2. Autorizar dicho repo en la integración de ChatGPT/GitHub si no aparece; conectar el mismo repo a un nuevo proyecto Cloudflare Pages (Git integration), sin GitHub Actions.
3. Migrar la plantilla generadora Node, datos ficticios, CSS y tests al repo privado; publicar. Verificar HTTPS, actualización, reversión, backups y exportación.
4. Acordar titular fiscal real, cuenta de cobro comercial y tipo de comprobantes. No recibir anticipos sin resolver.
5. Revisar legalmente los documentos: plazo, revisiones, titularidad y licencias, garantía, cancelación, confidencialidad, privacidad, dominios y salida.
6. Probar una entrega real simulada de otra plataforma y el procedimiento de importación DNS sin afectar el correo.
7. Solo entonces activar una campaña prudente con contactos empresariales específicos, sin spam.

## Una intervención puntual que puede necesitar el usuario
Abrir https://github.com/new usando la cuenta `apdocentepba-hub`:
- Owner: `apdocentepba-hub`
- Repository name: `fluynova-clientes-piloto`
- Visibility: **Private**
- Initialize with README: **Sí** (facilita primera edición desde el conector)
- No secrets, no dominio, no GitHub Actions.
La cuenta de GitHub de ChatGPT deberá poder ver este repositorio tras crearlo. De no aparecer, revisar permisos de la app GitHub para ese repo. 
No publicar todavía ni vincular datos de compradores: se usará como prueba de aislamiento.

## Costos y escala
- GitHub Free: repos privados ilimitados sujetos a términos y límites.
- Cloudflare Pages Free: usar integración Git directa, sin Actions. Su plan tiene límites (100 proyectos/500 compilaciones por cuenta/mes reportados al 2026-11-01). No comprometerse a hosting gratis permanente.
- En uso real cada cliente necesita controles de acceso/propiedad y backups; la creación automática de repos nuevos sigue siendo un bloqueo de automatización si el conector no ofrece dicha acción.
- No usar Work ni herramientas de browser pagas para evitar gastos.
- Mantenimiento y edición se cotizan aparte según alcance. No prometer conversiones, SEO o disponibilidad garantizados.

## Pruebas y distinciones
- JS de cotizador se ensayó con HTML DOM mínimo **en local**, no contra Chromium navegando la URL pública (el navegador local no tiene conectividad externa).
- Ensayo de backups = archivos estáticos, no migración al dominio de un cliente.
- El motor Node actualmente está en archivos locales del entorno de trabajo; la rama pública contiene una **vista estática** `templates/cliente-base/index.html`, pero todavía no todos los archivos fuente del generador. No confundirlo con un generador ya operable desde GitHub/Cloudflare.
- La web pública sigue siendo la que funciona sobre Render; dos demos sobre Cloudflare. Ningún cambio de este registro altera el despliegue.
