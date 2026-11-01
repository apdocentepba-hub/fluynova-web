# FLUYNOVA — Configuración directa Cloudflare Pages (pilotos)

Verificado: 2026-11-01. Estado: CONFIGURACIÓN LISTA / CONEXIÓN A CLOUDFLARE PENDIENTE.

## Objetivo
Publicar dos demostraciones ya existentes en la rama `plan/fabrica-webs-comerciales-20261101`, sin Cloudflare API tokens, sin GitHub Actions, sin tocar `main`, sin modificar APDocentePBA ni los despliegues actuales en Render.

Repositorio GitHub: `apdocentepba-hub/fluynova-web`.
Branch de producción de CADA Pages demo: `plan/fabrica-webs-comerciales-20261101`.

### Crear proyectos
Abrir https://dash.cloudflare.com/ > Workers & Pages > Create application > Pages > Connect to Git > GitHub.
En GitHub, instalar/autorizar Cloudflare Pages si lo solicita. Seleccionar solo `apdocentepba-hub/fluynova-web` cuando se ofrecen permisos por repositorio.
No modificar los Workers/APD existentes. No ingresar datos de tarjeta.

Configurar el PRIMER proyecto:
- Project name: `fluynova-demo-pasteleria` (si ocupado, usar un nombre alternativo disponible)
- Git repository: `apdocentepba-hub/fluynova-web`
- Production branch: `plan/fabrica-webs-comerciales-20261101` (NO main)
- Framework preset: None
- Build command: vacío; si la interfaz exige valor, `exit 0`
- Build output directory: `demos/pasteleria`
- Root directory (advanced): vacío, raíz del repo
- Variables de entorno: ninguna
- Save and Deploy

Configurar el SEGUNDO proyecto desde Workers & Pages > Create application > Pages > Connect to Git (mismo repo):
- Project name: `fluynova-demo-distribuidora`
- Git repository: `apdocentepba-hub/fluynova-web`
- Production branch: `plan/fabrica-webs-comerciales-20261101` (NO main)
- Framework preset: None
- Build command: vacío; si la interfaz exige valor, `exit 0`
- Build output directory: `demos/distribuidora`
- Root directory: vacío
- Variables de entorno: ninguna
- Save and Deploy

Cloudflare Pages permite varios proyectos por repo (máximo 5 sin aumento de límite; Build System V2+); limitar compilaciones innecesarias por Build watch paths:
- Pastelería: include `demos/pasteleria/*`
- Distribuidora: include `demos/distribuidora/*`
Desde cada Pages project > Settings > Build > Build watch paths.
Desactivar previews de todas las ramas excepto la rama piloto si no hacen falta.

## Pruebas de aceptación
- Ambos proyectos indican `Success`; cada URL termina en `.pages.dev`.
- `GET /` es HTTP 200 y presenta respectivamente títulos `Alba & Miga` y `Nórdica Pro`.
- Navegar y probar búsqueda/filtros y consultas ficticias sin envío.
- Cambiar un comentario HTML de cada demo en GitHub (rama piloto) y comprobar que el deploy en Cloudflare se actualiza sin GitHub Actions.
- Examinar errores y compatibilidad móvil; verificar el historial de despliegues y rollback.
- Hasta pasar estas pruebas, NO considerar completa la migración ni reemplazar Render.

## Fuentes
https://developers.cloudflare.com/pages/get-started/git-integration/
https://developers.cloudflare.com/pages/configuration/monorepos/
https://developers.cloudflare.com/pages/configuration/build-watch-paths/
https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## Controles de seguridad
- Ninguna contraseña, API token o dato personal en este documento o GitHub.
- Ambas demostraciones son ficticias y ya tienen `noindex,nofollow`.
- NO vincular dominios reales para esta prueba.
- NO usar repositorios ni credenciales de APDocentePBA para FLUYNOVA.
- Este repositorio es público y SOLO aloja demos; nuevos clientes requieren repositorio privado separado, políticas de aislamiento y autorización de cada cliente.
