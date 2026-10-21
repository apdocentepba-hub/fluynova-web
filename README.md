# FLUYNOVA

Web pública para automatización de procesos, integraciones y desarrollo de software a medida.

## Despliegue automático

Render escucha los cambios de la rama `main` cuando el servicio está vinculado a GitHub como proveedor de origen. Esta actualización sirve para verificar el circuito GitHub → Render.

## Web pública

https://fluynova-web.onrender.com

## Recepción de consultas

- Correo oficial de consultas: **martin.nicolas.podubinio@gmail.com** (conectado y verificado).
- En la web existe un enlace `mailto:` que permite escribir directamente a esa cuenta y funciona sin servidor de correo.
- La recepción automática vía **FormSubmit** está **habilitada**, luego de la validación del correo receptor el 21/10/2026. El estado visible se consulta en `GET /api/config`. La prueba de activación llegó correctamente a Gmail; resta una prueba del formulario AJAX de producción.
- Render tiene `FORMSUBMIT_ACTIVE=1`; no desactivar mientras la integración funcione. La página pública de activación temporal fue eliminada.
- El formulario envía una solicitud HTTPS a FormSubmit; `_subject` comienza con `FLUYNOVA | Nueva consulta:`, `_replyto` contiene el correo de quien consulta. FormSubmit conserva un archivo de formularios por 30 días (según su documentación).
- El panel `/admin` y la API `/api/contact` son prototipos anteriores con SQLite local; **no habilitar `CONTACT_STORAGE_READY` en Render gratuito** porque el disco es efímero. No se guardan en este panel las consultas enviadas por FormSubmit. Para gestionar consultas desde el panel, implementar una base externa persistente y sincronizarla con los formularios.

## Ejecución local

```sh
pip install -r requirements.txt
uvicorn app:app --reload
```

Abrí `http://127.0.0.1:8000`. Las variables de ejemplo figuran en `.env.example`. Para desarrollo local puede usarse SQLite, no para persistencia en Render gratuito.

## Seguridad y publicación

- No subir secretos ni contraseñas a GitHub.
- Configurar `ADMIN_USER` y `ADMIN_PASSWORD` como secretos en Render (no mostrarlos ni copiarlos al código).
- El servicio gratuito Render bloquea conexiones SMTP salientes en puertos 25, 465 y 587: por eso no se emplea SMTP.
- Completar identificación legal de la persona responsable, conservar la política de privacidad actualizada y revisar el proveedor de formularios antes de difusión comercial.

Estado: landing publicada, contacto directo disponible, formulario automático activado. El almacenamiento del panel `/admin` permanece separado del servicio de correo; las consultas de FormSubmit se reciben en Gmail y su archivo temporal.
