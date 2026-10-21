# FLUYNOVA — Web comercial

Sitio oficial de servicios de automatización, integraciones y desarrollo de software a medida.

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
- Gmail confirmado: **21/10/2026** se realizó una prueba técnica desde el servidor Render a FormSubmit. Respondió HTTP 200 con `success:true` y se verificó en Gmail el mensaje `FLUYNOVA | TEST AUTOMATICO - NO ES CLIENTE`, con los campos recibidos correctamente. Se deshabilitó la ejecución y se eliminó el código temporal. **Queda pendiente la prueba end-to-end del clic del visitante en un navegador real.**
- El 21/10/2026 se intentó una ruta experimental de reenvío por el servidor FastAPI (`/api/lead`) y dio **HTTP 502 por timeout de FormSubmit**. Se retiró la ruta y el código de prueba para no depender de una comunicación fallida. **No se ha probado aún el formulario AJAX completo desde un navegador real y no se debe prometer que todos los envíos están llegando.**
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
