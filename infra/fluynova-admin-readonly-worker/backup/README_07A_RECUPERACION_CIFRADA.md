# FLUYNOVA · Paso 07A — respaldo cifrado de consultas y restauración de laboratorio

**Estado: APROBADO LOCALMENTE el 09/11/2026. No instalado ni automatizado en Cloudflare. No es una copia de seguridad real del negocio.**

## Objetivo y alcance

Preparar un procedimiento que permita extraer, cifrar y comprobar de extremo a extremo la **información de las cuatro tablas operativas conocidas** de FLUYNOVA. El código está en `backup/encrypted-snapshot.mjs` e incluye únicamente:

- `leads`: consultas comerciales (incluye PII, nombre, email, mensaje y consentimiento).
- `lead_rate_limit`: huellas HMAC de limitación, contadores y períodos.
- `lead_idempotency`: claves de solicitud, huellas, referencias y fecha.
- `lead_mail_outbox`: estado de los avisos, intentos, marcas temporales e ID proveedor.

**No es un backup integral de D1, ni conserva todas sus tablas si se agregaran otras.** Tampoco respalda registros de Cloudflare Access, DNS, secretos, configuración Worker, OAuth, versiones desplegadas ni bookmarks Time Travel. Si cambia el esquema de las tablas conocidas, el proceso se niega a respaldar para evitar una falsa copia de seguridad.

## Qué hace el código

1. Inspecciona el esquema sin consultar los datos sensibles. Reutiliza el preflight previo de D1 (claves/índices/NOT NULL en tablas anteriores) y exige columnas exactamente conocidas, clave foránea e índice del outbox. Si falta una tabla o se agrega una columna desconocida, falla.
2. Ejecuta **cuatro SELECT de filas y cuatro COUNT en una única llamada D1.batch de lectura**, que Cloudflare documenta como transaccional. Para esta versión de laboratorio fija un límite de **2000 registros por tabla** y un máximo de **8 MiB de contenido JSON**; si se supera o el conteo no coincide, falla sin emitir un respaldo parcial.
3. Genera una instantánea en memoria con hora ISO y cuatro conjuntos de filas, preservando Unicode, consentimiento, estado y relaciones entre tablas.
4. Deriva una clave mediante **scrypt (N=32768, r=8, p=1, salt aleatoria de 16 bytes)** a partir de una frase de al menos 20 caracteres; cifra con **AES-256-GCM**, IV aleatorio de 12 bytes, etiqueta de autenticación de 16 bytes y AAD de versión. No se utiliza una contraseña real de FLUYNOVA en CI.
5. Devuelve un sobre JSON que sólo contiene versión, algoritmo/KDF, parámetros y datos cifrados codificados en base64. **No incluye nombres, correos, mensajes ni conteos públicos fuera del ciphertext.** La función no escribe archivos ni transmite contenidos por red.
6. La función de descifrado valida estructura/versión, límites, formato base64, autenticidad GCM y esquema lógico antes de devolver las filas **en memoria**. No incluye comando para restaurar una base D1 remota.

## Prueba de recuperación — SOLO D1 LOCAL

`encrypted-snapshot.test.mjs` ejecuta Workerd/Miniflare con dos bases locales aisladas y datos totalmente ficticios en dominios `example.invalid`:

- Crea dos leads sintéticos, registro de control de frecuencia, dos IDs de idempotencia y dos entradas de avisos.
- Obtiene respaldo cifrado y comprueba que el sobre JSON no contiene PII visible, IP, huellas ni IDs en claro.
- Descifra en memoria con la clave de prueba, crea **una segunda D1 local vacía**, inserta los registros recuperados en el orden permitido por las relaciones y genera otro respaldo; verifica igualdad exacta de las cuatro tablas.
- Verifica que dos respaldos usan distintas salt, IV y ciphertext; rechaza contraseña incorrecta, tag alterado, ciphertext adulterado y metadatos manipulados.
- Comprueba que un esquema alterado, un índice faltante, una clave insuficiente y un conteo truncado impiden generar un respaldo con falsa apariencia de integridad.
- Verifica que el código no está importado por el Worker público ni por el Worker administrativo, y no crea ruta HTTP para exportación.

**Evidencia CI:** [GitHub Actions #42616286409](https://github.com/apdocentepba-hub/fluynova-web/actions/runs/42616286409): **SUCCESS**. Cinco pruebas específicas de backup + suites previas de paquete, release guard, JWT y Chromium: **30 pruebas distintas PASS**, Wrangler `--dry-run`. No se envió correo ni se conectó D1 remota.

## Restricciones importantes

- **Las filas existen en la memoria del proceso mientras se cifra/descifra**. No afirmar que se borraron todas las copias del heap de JavaScript: la limpieza de buffers es una mitigación, no una garantía.
- No se suministró un mecanismo persistente para almacenar, custodiar o rotar las claves; no se genera ni se descarga un archivo con datos reales. La frase debe mantenerse fuera del repositorio, mensajes, scripts de CI y logs.
- El límite de 2000 filas por tabla y 8 MiB **no es suficiente para garantizar escalabilidad de producción**. Antes de activarlo requiere lectura incremental con consistencia demostrada, control de tamaño, monitoreo sin PII y política de retención.
- Recuperar datos en una nueva D1 local no equivale a restaurar Cloudflare D1. **No ejecutar inserciones masivas en una D1 remota** antes de verificar aislamiento, respaldos, permisos y autorización independiente.
- El proceso no sustituye Time Travel de Cloudflare. Debe decidirse cómo conservar copias cifradas en un destino autorizado, con control de acceso, cifrado y pruebas periódicas, respetando plazos de conservación de datos personales.
- No incluye guardado automático, schedule/cron, restauración en producción, cobertura de nuevas tablas, custodia de claves o validación de un RPO/RTO real.

## Para cerrar Paso 07

Se requiere: auditoría real de D1 y su versión, recuperación por Cloudflare Time Travel si corresponde, diseño de backups cifrados incrementales o por lotes, almacenamiento protegido y retención, rotación de claves y procedimiento de restauración autorizado. Validar el tiempo y la pérdida máxima aceptables para recuperar consultas ante una caída real.

**El Paso 07A quedó implementado y probado LOCALMENTE; el paso 07 y el sistema general siguen pendientes de integración real.**
