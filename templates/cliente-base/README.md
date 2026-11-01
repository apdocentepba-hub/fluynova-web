# FLUYNOVA — Plantilla base pública para evaluación

Estado: **prototipo técnico sin clientes reales** · 2026-11-01.

[Ver HTML base](./index.html)

## Uso
- `index.html` es una página autocontenida con CSS inline. Abrirla no requiere ZIP, bibliotecas ni instaladores.
- El contenido es **ficticio**; no recibe contactos y está marcado `noindex,nofollow`.
- La plantilla debe copiarse a un **repositorio privado independiente de cada cliente real** y personalizarse allí, reemplazando datos/branding con contenidos autorizados.
- Prototipo generado localmente a partir de `site.json` y `build.mjs` con Node.js, sin dependencias npm; se completaron 8 pruebas unitarias del generador y 4 pruebas de navegador (cotizador y plantilla, escritorio y móvil).
- Esta rama **no modifica `main` ni la producción de FLUYNOVA**. Los despliegues existentes de la pastelería y distribuidora funcionan en la rama `plan/fabrica-webs-comerciales-20261101`.

## Pendiente antes de utilizar con un cliente
1. Crear un repositorio **privado** nuevo; el conector de GitHub disponible en ChatGPT actualmente puede editar repos existentes, pero no crear nuevos. No reutilizar repositorios privados de proyectos ajenos.
2. Validar en ese repositorio privado el vínculo nativo GitHub–Cloudflare Pages con una publicación y reversión.
3. Revisar presupuesto, aceptación contractual, derechos de consumidores, estado fiscal/facturación y cuenta de cobro verificable.
4. Configurar nombre, logo, canales reales de contacto, consentimiento de privacidad si hay formularios, DNS y dominio del comprador.
5. Hacer QA de accesibilidad, móvil, enlaces, SEO y seguridad; entregar respaldo y verificar reversibilidad.

## Cuotas y aislamiento
El modelo de producción es 1 repo privado + 1 proyecto Pages por comprador; evitando desperdiciar compilaciones por cambios no relacionados. No usar GitHub Actions para publicar. No almacenar documentos comerciales internos ni datos personales de clientes en este repositorio público.
