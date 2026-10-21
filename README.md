# FLUYNOVA

Sitio de automatización de procesos y desarrollo de software a medida.

Este repositorio incluye la landing page, formulario de consultas, API en FastAPI y panel privado para gestionar mensajes.

## Ejecución local

```bash
pip install -r requirements.txt
uvicorn app:app --reload
```

Abrí `http://localhost:8000`. Panel privado en `/admin`, protegido por `ADMIN_USER` y `ADMIN_PASSWORD` de al menos 12 caracteres.

## Publicación

Requiere un servidor con Python y HTTPS, además de almacenamiento persistente para SQLite (`DATA_DIR`). GitHub Pages puede mostrar un sitio estático, pero **no** ejecuta la API de este proyecto ni recibe formularios. Configurá las variables de `.env.example` en tu proveedor antes de desplegar.

**Estado:** versión inicial. Revisar aviso legal, datos del responsable, políticas de conservación y configuración de correo antes de publicar.
