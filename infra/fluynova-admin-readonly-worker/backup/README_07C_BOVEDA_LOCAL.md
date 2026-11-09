# FLUYNOVA — Paso 07C: bóveda local cifrada (laboratorio)

**Estado:** desarrollo en la rama aislada PR #23. No conectado a una D1 remota, R2 ni a producción. Los datos de prueba son completamente ficticios.

## Qué hace

`private-local-vault.mjs` persiste en una carpeta **local, previamente creada y privada**, el resultado YA CIFRADO de `createPagedEncryptedLabArchive` del Paso 07B. La bóveda no consulta D1, no exporta consultas por HTTP y no restaura bases.

- Solo se acepta un directorio real sin enlaces simbólicos, propiedad del usuario del proceso y con permisos de dueño exclusivamente (por ejemplo `0700`). La implementación es un **laboratorio POSIX/Linux**, no un programa de instalación Windows ni servicio Cloudflare.
- El nombre se deriva del identificador hexadecimal aleatorio de 32 caracteres ya autenticado en el archivo; no se permiten nombres ni rutas arbitrarias proporcionadas por el usuario.
- Antes de escribir, vuelve a verificar el sobre cifrado con la contraseña de recuperación (AES-256-GCM por segmento + HMAC del archivo); si la clave o integridad fallan, no crea el archivo.
- Escribe en un temporal con permisos `0600`, sincroniza datos y publica el destino con creación atómica mediante enlace duro. Nunca sobrescribe una copia existente. Luego intenta sincronizar el directorio y eliminar el temporal. No implementa borrado de copias.
- Calcula SHA-256 del contenido cifrado y devuelve únicamente metadatos: nombre seguro, checksum, tamaño, ID y señal de **no producción**. La contraseña y los registros no aparecen en esa respuesta.
- Al leer una copia exige directorio privado, archivo regular no enlazado de modo inseguro, checksum externo SHA-256 y contraseña correcta. Devuelve las filas **solo en memoria del proceso** tras verificar cifrado y manifiesto.

## Limitaciones decisivas

**La persistencia en disco NO vuelve atómica la extracción paginada original.** La doble lectura del Paso 07B es best-effort y puede pasar por alto escrituras concurrentes transitorias. No usar esta bóveda para operar respaldos de clientes reales ni afirmar objetivos RPO/RTO. Se requiere snapshot consistente de D1, custodia de claves, pruebas de recuperación reales y almacenamiento remoto protegido previamente autorizado.

El prototipo mantiene el archivo completo ya cifrado en memoria al serializar y durante la lectura; no está diseñado para volúmenes sin límite. La limpieza de Buffer no borra todas las copias posibles del heap de JavaScript. No genera una política automática de retención ni permite eliminar archivos. No gestiona claves, MFA, hardware de cifrado ni rotación.

Un fallo de sincronización posterior a la publicación puede dejar el archivo creado, aunque el método devuelva error. Para recuperar, inspeccionar el destino y su checksum; nunca ejecutar escrituras de reemplazo ni suprimir archivos dudosos automáticamente.

**Ninguna ruta del Worker público o administrativo importa este código**. Los archivos de la carpeta no son un producto listo para publicar ni una función de Cloudflare.

## Evidencias previstas y verificación

`private-local-vault.test.mjs` en GitHub Actions crea carpetas temporales `0700` y D1 **LOCAL** con datos ficticios. Comprueba: escritura `0600`, integridad y lectura de recuperación; rechazo de contraseña incorrecta, no sobrescritura ante nombre repetido, archivo alterado, archivo público `0644`, carpeta pública `0755`, symlink y ruta manipulada. El workflow ejecuta además las suites previas de cifrado, retención, JWT, navegador y release gate, con `wrangler deploy --dry-run`.

El cierre del Paso 07C local queda sujeto a **GitHub Actions en verde**. La puesta en producción sigue bloqueada y requiere permisos específicos, sin TinyFish.
