# Firma digital de Windows para FLUYNOVA (Authenticode)

Estado al **24 de octubre de 2026**: el proceso de firma ya está incorporado al repositorio, pero los siete instaladores publicados de la versión 0.4.0 **siguen sin firma digital reconocida por Windows**. Todavía falta un certificado comercial auténtico de Code Signing.

## Tres firmas distintas

- **Authenticode:** la que verifica Windows en un instalador `.exe` o aplicación. Identifica al editor legal y protege la integridad.
- **Ed25519 del sistema de licencias:** autoriza licencias de FLUYNOVA. No acredita el programa frente a Windows.
- **Ed25519 de avisos de actualización:** comprueba anuncios de actualización. No convierte a un instalador en firmado para Windows.

## Qué necesitamos contratar

Un certificado de **firma de código**, emitido por una autoridad de certificación comercial (CA) de confianza en Windows y con el uso extendido **Code Signing** (OID `1.3.6.1.5.5.7.3.3`). El proveedor debe validar al propietario y custodiar la clave de firma en hardware seguro o servicio de firma compatible. Consultar emisión para Argentina y modalidades de persona física/organización.

Si se firma como persona física, Windows mostrará su **nombre legal**, no necesariamente «FLUYNOVA». Para que muestre una organización con el nombre FLUYNOVA, ese nombre debe figurar legalmente en el certificado tras la verificación del emisor.

Microsoft Artifact Signing Public Trust no admite actualmente la validación de identidad individual radicada en Argentina. No comprar Azure por error suponiendo que resuelve ese punto.

La firma de código **no garantiza eliminar al instante** SmartScreen. La reputación del editor y los archivos se obtiene con el tiempo.

## Proceso técnico ya preparado

Archivo: `scripts/firmar-suite-windows.ps1`.

En un equipo de confianza Windows x64 con Python 3.12, Windows SDK/SignTool x64, Inno Setup 6 y un certificado de Code Signing legítimo instalado en almacén Personal de Windows, con acceso a su clave mediante token/HSM:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\firmar-suite-windows.ps1 -Thumbprint "HUELLA_SHA1_CERTIFICADO"
```

El script:
1. Comprueba que el certificado existe, tiene acceso a clave privada, está vigente y permite firma de código.
2. Extrae el código 0.4.0 y ejecuta las pruebas.
3. Compila los siete ejecutables de las seis aplicaciones y de Licencias Operador.
4. Firma cada ejecutable antes de incorporarlo al instalador.
5. Compila siete instaladores con Inno Setup y firma los siete.
6. Comprueba con SignTool y PowerShell cada firma, la confianza de la cadena y la presencia del sello de tiempo RFC3161/SHA-256. Si hay un fallo, termina sin dar el resultado por firmado.
7. Genera los SHA-256 definitivos y deja los archivos en `dist-firmados/0.4.0`.

**No publica automáticamente ningún release.** Tampoco modifica datos de clientes ni elimina las versiones públicas anteriores. Una futura edición firmada se publicará con una versión/tag nuevo, sin reemplazar silenciosamente binarios sin firma.

El script usa el almacén de certificados de Windows. Si el emisor utiliza un servicio remoto con otra integración de SignTool, se adaptará el proceso sin exportar la clave.

## Seguridad

- Nunca subir PFX, llaves privadas, PIN, token, contraseñas, claves de licencias ni certificados privados a GitHub o a este chat.
- No usar un certificado autofirmado como si fuera confiable públicamente.
- Usar un equipo de firma controlado; evitar colocar claves de firma en runners públicos, especialmente de repositorios públicos.
- El certificado para firmar programas no es la misma clave Ed25519 para emitir licencias.
- Las firmas **no son retroactivas**: los instaladores 0.1–0.4 publicados antes seguirán sin firmar.
- Comprobar con pruebas manuales instalación y actualización en Windows 10/11 limpio antes de comercializar.

Fuentes oficiales:
- [Microsoft: sellos de tiempo Authenticode](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [Microsoft: SignTool](https://learn.microsoft.com/en-us/windows/desktop/seccrypto/signtool)
- [Microsoft: regiones elegibles Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
