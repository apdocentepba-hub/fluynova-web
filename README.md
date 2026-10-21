# FLUYNOVA — Automatización y software a medida

**Si lo hacés mil veces, podemos hacer que se haga solo.**

FLUYNOVA es un proyecto independiente de Buenos Aires, Argentina, dedicado a simplificar tareas repetitivas y desarrollar herramientas para negocios, profesionales e instituciones.

**[Conocer FLUYNOVA](https://fluynova-web.onrender.com/)** · **[Leer la guía gratuita: 7 tareas para automatizar](https://fluynova-web.onrender.com/guia-automatizacion/)** · **[Enviar una consulta](https://fluynova-web.onrender.com/#contacto)**

Servicios: automatización de planillas Excel/Google Sheets, desarrollo web y software a medida, integración de datos, formularios y reportes.

---

## Detalles técnicos del sitio

- **Web pública:** https://fluynova-web.onrender.com/
- **Código:** https://github.com/apdocentepba-hub/fluynova-web
- **Despliegue:** Render Web Service, workspace FLUYNOVA, rama `main` con auto-deploy confirmado.
- **Consultas:** FormSubmit por HTTPS → `martin.nicolas.podubinio@gmail.com`.

## Qué está funcionando

- Landing adaptable a escritorio y móvil, servicios, ejemplos conceptuales, proyectos propios identificados por estado, metodología, FAQ y contacto.
- Formulario AJAX que envía directamente a FormSubmit, con nombre, email, organización, tipo de proyecto, descripción, plazo opcional, etapa opcional y presupuesto opcional. Si no hay confirmación, ofrece un **botón manual de POST HTML tradicional** que abre la página del proveedor. El enlace mailto siempre está disponible.
- Correo con asunto `FLUYNOVA | Nueva consulta: <categoría>`, con `_replyto` para responder al interesado.
- Campo trampa antispam y validación en el navegador. FormSubmit incorpora medidas adicionales, como reCAPTCHA.
- Página de privacidad, metadatos sociales, enlace canónico, JSON-LD de organización, sitemap XML y robots.txt.
- Gmail confirmado: **21/10/2026** se realizó una prueba técnica desde el servidor Render a FormSubmit. Respondió HTTP 200 con `success:true` y se verificó en Gmail el mensaje `FLUYNOVA | TEST AUTOMATICO - NO ES CLIENTE`, con los campos recibidos correctamente. Se deshabilitó la ejecución y se eliminó el código temporal. Posteriormente, el 21/10/2026 a las 19:42 (Argentina), un envío manual desde Chrome fue recibido en Gmail con el asunto «FLUYNOVA | Nueva consulta: Desarrollar software»; esto confirmó el funcionamiento del formulario corregido.
- El 21/10/2026 se intentó una ruta experimental de reenvío por el servidor FastAPI (`/api/lead`) y dio **HTTP 502 por timeout de FormSubmit**. Se retiró la ruta y el código de prueba para no depender de una comunicación fallida. La prueba manual posterior confirmó al menos una entrega exitosa desde un navegador real. No implica garantía de entrega futura del proveedor.
- **Marketing orgánico:** guía pública en `/guia-automatizacion/`, opción de compartir desde la portada y copys de difusión en `/marketing/campana-lanzamiento-2026-10-21.md`. Las publicaciones externas requieren una cuenta social conectada, y no se han enviado campañas masivas.
- **QA estructural:** enlaces internos, duplicados de IDs, campos requeridos, FAQ, proyectos, sitemap y eliminación del código temporal comprobados.

## Particularidades de la arquitectura

La versión inicial conserva una API en FastAPI y un prototipo de panel de administración basado en SQLite. El formulario público **no** usa esa base: envía directamente a FormSubmit, que remite el mensaje al Gmail personal y conserva un archivo temporal (ver la documentación del proveedor). **El panel `/admin` está deshabilitado por defecto** (`ADMIN_PANEL_ENABLED=0`) porque aún no se integró una base persistente. No se deben prometer funciones de CRM que no existen.

No activar `CONTACT_STORAGE_READY` en Render gratuito: SQLite local es efímero. Si más adelante se necesita un CRM propio, elegir almacenamiento persistente, políticas de acceso, copias de seguridad y un conector seguro con los mensajes.

## Desarrollo local

```bash
python -m pip install -r requirements.txt
uvicorn app:app --reload
```

Visitar `http://127.0.0.1:8000`. Configurar credenciales y opciones desde variables de entorno; nunca subir valores secretos al repositorio.

## Pendiente antes de escalar comercialmente

1. Confirmar el flujo completo desde el navegador de un usuario con un mensaje de prueba real.
2. Completar identificación legal del responsable y revisar formalmente la política de privacidad.
3. Incorporar casos con resultados documentados cuando existan, sin inventar clientes.
4. Dominio propio, correo comercial, imagen social en formato PNG/JPEG, medición de consultas y eventual CRM persistente.
5. Si se requiere uptime permanente, evaluar plan de alojamiento con disponibilidad apropiada y backups.

Estas mejoras **no requieren contratar un servicio de pago** para mantenerse en su estado actual.
