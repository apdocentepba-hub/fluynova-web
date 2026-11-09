# FLUYNOVA · Paso 07B — páginas cifradas y propuesta de retención

**Estado: LABORATORIO SIN PUBLICAR. Fecha 09/11/2026.** Este código no produce copias reales de FLUYNOVA, no programa tareas, no escribe en disco ni borra respaldos. No se accedió a D1 remota.

## Motivo del cambio

El prototipo 07A admite un máximo de 2000 filas por tabla y 8 MiB en una instantánea completa de D1. Para operar con más registros hace falta reducir la memoria **en claro** por tanda, preservar integridad, detectar cambios durante la exportación y definir una política de conservación que no destruya copias por error.

## 07B.1 — cifrado de páginas

- Archivo `paged-encrypted-archive.mjs`: exporta `createPagedEncryptedLabArchive` y `openPagedEncryptedLabArchive`. **No está importado** por el Worker público ni el administrador.
- Utiliza paginación por **clave primaria**, no OFFSET, para `leads.id`, `lead_rate_limit(fingerprint,hour_bucket)`, `lead_idempotency.request_id` y `lead_mail_outbox.lead_id`. Tamaño configurable entre 16 y 256 filas/página; límite 100.000 filas combinadas, máximo 1024 segmentos y 512 KiB de texto JSON por página. Son topes de laboratorio, no parámetros aprobados en producción.
- Primero valida que el esquema y las cuatro tablas coincidan exactamente. Cada página se cifra inmediatamente con **AES-256-GCM**, un nonce aleatorio nuevo, AAD que vincula archivo/posición, y una clave derivada por scrypt. Los segmentos cifrados se acumulan en RAM; no se guardan archivos ni se transmiten a la nube. Cada bloque mantiene el contenido de las filas privado frente a quien no posea la frase de recuperación.
- Construye un manifiesto final con HMAC-SHA256 que autentica el encabezado y el orden/contenido de todos los segmentos. El verificador rechaza cambios de bloque, reordenamiento, eliminación y un manifiesto incompleto. **No confundir el HMAC con una firma pública de un origen remoto.**
- Realiza **dos lecturas paginadas** y compara los hashes por página y los conteos de filas, además de verificar esquema antes/después. Si un cambio persiste entre las pasadas, la exportación se aborta. **Esto es detección best-effort, no una instantánea atómica de D1**. Una escritura concurrente puede entrar o salir entre lecturas y pasar inadvertida. Para un respaldo de producción se exige fuente quiescente garantizada o el mecanismo nativo de exportación/Time Travel de D1.
- El descifrado devuelve filas en memoria exclusivamente para el laboratorio. **No escribe en ninguna base D1**. No incluye función de importación, restauración de producción o almacenamiento persistente.

## 07B.2 — política de retención conservadora, no destructiva

Archivo `retention-plan.mjs`, función pura `proposeEncryptedBackupRetention`:

- Por defecto marca **tres copias recientes** como protegidas; protege copias de los últimos 7 días, conserva ejemplos representativos diarios/semanales/mensuales y respeta `legalHold`. Evita proponer pérdida de las únicas 1–3 copias verificadas.
- El umbral mínimo de antigüedad para evaluar excedentes es **90 días** (propuesta de laboratorio, no disposición normativa ni criterio comercial aprobado).
- Datos de origen desconocido, copia sin verificación declarada, almacenamiento público, otro proyecto o fecha inválida quedan en estado `hold`: no se proponen como descartables. La condición `checksumVerified=true` es solo metadata proporcionada por el invocador, **no demuestra criptográficamente** que exista una copia válida.
- Las copias antiguas y redundantes aparecen como `candidateForManualDeletion`, lo cual exige examen humano, copia alternativa verificada y autorización separada. La función NO implementa `fs.unlink`, `DROP`, limpieza D1, cron, nube ni eliminación. Siempre retorna `deletionAuthorized=false` y `filesDeleted=0`.
- No se aceptan entradas duplicadas y nunca se muestran PII de clientes en el reporte. La política final de retención de leads/correos/backups debe definirse con el negocio y la normativa aplicable antes de activarla.

## Pruebas locales de aceptación

`paged-encrypted-archive.test.mjs`:
1. Más de 2.000 consultas ficticias en **D1 LOCAL**, límite del 07A fallando correctamente, 07B paginando/cifrando y descifrando todas con orden y contenido verificado.
2. Clave incorrecta y segmentos eliminados, reordenados, adulterados o con manifiesto alterado rechazados.
3. Modificación intencional del mensaje de un lead entre dos pasadas detectada y backup invalidado.
4. Esquema cambiado, contraseña débil y tamaño de página inválido rechazados.
5. Ninguna ruta pública/administrativa exporta datos.

`retention-plan.test.mjs`: seis tests sobre copias recientes, redundancia, 1–3 copias, legal hold, metadatos ajenos/no verificados, duplicados y privacidad del reporte.

El CI sigue realizando además 07A (recuperación D1 LOCAL), Access JWT, Chromium, release guard y Wrangler `--dry-run`. Se esperan **11 pruebas nuevas**; cifras totales únicamente si la CI concluye correctamente.

## Riesgos que siguen bloqueando el paso 07 real

1. No hay D1 remota auditada, punto de lectura congelado, bookmark consistente ni exportación nativa verificada.
2. No existe destino R2/almacenamiento privado autorizado, ni llaves custodiadas, rotación o proceso de recuperación documentado con datos reales.
3. El resultado de 07B se acumula cifrado en RAM; **no es streaming a un destino duradero** y no mide RPO/RTO de producción.
4. Dos lecturas iguales no certifican que no hubo escrituras concurrentes. Usar mecanismo de exportación nativa D1 antes de publicar backups operativos.
5. La política de conservación es solo propuesta; no tiene autorización para borrar datos, copias o correos.

**Cloudflare D1** ofrece Time Travel automáticamente para bases `version: production`, con ventana de hasta 7 días (Free) o 30 días (Paid), y documentación de exportación D1 hacia R2 mediante Workflows para conservación más extensa. No se invocó ninguna de esas capacidades ni se configuró R2.

## Fuentes primarias

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/

**No aplicar migraciones, backups o restores remotos sin permiso explícito.**
