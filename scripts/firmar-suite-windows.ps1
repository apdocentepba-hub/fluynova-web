#requires -Version 5.1
<#
Firma de codigo de FLUYNOVA 0.4.0. Necesita certificado CA confiable,
instalado en Windows, con clave NO exportable (HSM/token/proveedor).
No publica archivos, no copia claves, y nunca simula firmas.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Thumbprint,
  [ValidatePattern('^https://')][string]$TimestampUrl='https://timestamp.digicert.com',
  [switch]$NoInstalarDependencias
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Solo Windows x64.' }
$thumb=($Thumbprint -replace '[^0-9a-fA-F]','').ToUpperInvariant()
if ($thumb -notmatch '^[0-9A-F]{40}$') { throw 'Thumbprint SHA1 de certificado invalido.' }
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$payload=Join-Path $root 'productos\source-v0.4.b64'
if (-not (Test-Path -LiteralPath $payload)) { throw 'No existe el paquete fuente versionado 0.4.' }
$cert=$null
$localMachine=$false
foreach ($store in @("Cert:\CurrentUser\My\$thumb","Cert:\LocalMachine\My\$thumb")) {
  if (Test-Path $store) {
    $cert=Get-Item $store
    $localMachine=($store -like 'Cert:\LocalMachine*')
    break
  }
}
if (-not $cert -or -not $cert.HasPrivateKey) { throw 'Certificado de firma de codigo ausente o sin acceso a clave privada.' }
if ((Get-Date) -lt $cert.NotBefore -or (Get-Date) -ge $cert.NotAfter) { throw 'Certificado no vigente.' }
$ekus=@()
foreach ($ext in $cert.Extensions) {
  if ($ext -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]) {
    foreach ($u in $ext.EnhancedKeyUsages) { $ekus+= $u.Value }
  }
}
if ('1.3.6.1.5.5.7.3.3' -notin $ekus) { throw 'Certificado sin EKU Code Signing.' }
$programFilesX86=[Environment]::GetFolderPath('ProgramFilesX86')
$sdk=Join-Path $programFilesX86 'Windows Kits\10\bin'
$signtool=Get-ChildItem $sdk -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
  Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $signtool) { throw 'Instala el Windows SDK (SignTool x64).' }
$iscc=Join-Path $programFilesX86 'Inno Setup 6\ISCC.exe'
if (-not (Test-Path $iscc)) { throw 'Instala Inno Setup 6.' }
$python=(Get-Command python.exe -ErrorAction Stop).Source
$pythonOk=& $python -c 'import sys; print(int(sys.version_info[:2] == (3, 12) and sys.maxsize > 2**32))'
if ($pythonOk -ne '1') { throw 'Es necesario Python 3.12 de 64 bits.' }

function Test-Firma([string]$file) {
  & $signtool verify /pa /all /v /tw $file
  if ($LASTEXITCODE -ne 0) { throw "Firma invalida o cadena CA no confiable: $file" }
  $s=Get-AuthenticodeSignature -LiteralPath $file
  if ($s.Status -ne 'Valid') { throw "Firma no valida: $file ($($s.Status))" }
  if (-not $s.SignerCertificate -or $s.SignerCertificate.Thumbprint -ne $thumb) {
    throw "Firmante distinto del certificado seleccionado: $file"
  }
  if (-not $s.TimeStamperCertificate) { throw "Falta marca de tiempo confiable: $file" }
}
function Firmar([string]$file,[string]$nombre) {
  $argsFirma=@('sign','/v','/sha1',$thumb,'/s','My','/fd','SHA256','/tr',$TimestampUrl,'/td','SHA256','/d',$nombre)
  if ($localMachine) { $argsFirma+='/sm' }
  $argsFirma+=$file
  & $signtool @argsFirma
  if ($LASTEXITCODE -ne 0) { throw "No se pudo firmar $file" }
  Test-Firma $file
}

$apps=@('Pedidos','Turnos','Stock','Fabrica','Evidencia','Cotizador','LicenciasOperador')
$entries=@{
  'Pedidos'='pedidos.py'; 'Turnos'='turnos.py'; 'Stock'='stock.py';
  'Fabrica'='fabrica.py'; 'Evidencia'='evidencia.py';
  'Cotizador'='cotizador.py'; 'LicenciasOperador'='licencias_operador.py'
}
$temp=Join-Path ([IO.Path]::GetTempPath()) ('FLUYNOVA-FIRMA-'+[Guid]::NewGuid().ToString('N'))
$work=Join-Path $temp 'productos'
New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
  $archive=Join-Path $temp 'fuentes.tar.gz'
  [IO.File]::WriteAllBytes($archive,[Convert]::FromBase64String((Get-Content -Raw -LiteralPath $payload).Trim()))
  & tar.exe -xzf $archive -C $work
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo extraer el codigo 0.4.' }
  Push-Location $work
  try {
    if (-not $NoInstalarDependencias) {
      & $python -m pip install -r 'requirements-build.txt'
      if ($LASTEXITCODE -ne 0) { throw 'Error al instalar dependencias.' }
    }
    & $python -m pytest -q tests
    if ($LASTEXITCODE -ne 0) { throw 'Pruebas fallidas: no se firma ningun ejecutable.' }
    foreach ($app in $apps) {
      $program="FLUYNOVA-$app"
      & $python -m PyInstaller --noconfirm --clean --windowed --onedir --name $program --icon 'assets/fluynova.ico' $entries[$app]
      if ($LASTEXITCODE -ne 0) { throw "Error compilando $app" }
      $exe=Join-Path $work "dist\$program\$program.exe"
      Firmar $exe "FLUYNOVA $app"
    }
    # Firmar DESDE Inno Setup incluye instalador, desinstalador y copias
    # temporales usadas durante la instalación. Firmar solo el instalador al
    # final no alcanza (ver documentación oficial de Inno SignTool).
    $issPath=Join-Path $work 'installer\product.iss'
    $issText=Get-Content -Raw -LiteralPath $issPath
    if (-not $issText.Contains('[Setup]') -or $issText.Contains('SignTool=')) {
      throw 'No se puede configurar automaticamente el firmador de Inno.'
    }
    $setupDirectives='[Setup]'+[Environment]::NewLine+'SignTool=FLUYNOVA_SIGNER'+[Environment]::NewLine+'SignedUninstaller=yes'
    $issText=$issText.Replace('[Setup]', $setupDirectives)
    [IO.File]::WriteAllText($issPath,$issText,(New-Object System.Text.UTF8Encoding($false)))
    $innoStore=if ($localMachine) { ' /sm' } else { '' }
    $innoSignCommand='"'+$signtool+'" sign /v /sha1 '+$thumb+' /s My'+$innoStore+' /fd SHA256 /tr '+$TimestampUrl+' /td SHA256 /d "FLUYNOVA" $f'
    foreach ($app in $apps) {
      & $iscc "/SFLUYNOVA_SIGNER=$innoSignCommand" "/DProduct=$app" 'installer\product.iss'
      if ($LASTEXITCODE -ne 0) { throw "Error empaquetando y firmando $app" }
      $setup=Join-Path $work "out\FLUYNOVA-$app-Instalador-0.4.0-Windows-x64.exe"
      Test-Firma $setup
    }
    $installers=@(Get-ChildItem (Join-Path $work 'out') -Filter 'FLUYNOVA-*-Instalador-0.4.0-Windows-x64.exe' -File)
    if ($installers.Count -ne 7) { throw 'No se generaron los siete instaladores.' }
    $out=Join-Path $root 'dist-firmados\0.4.0'
    New-Item -ItemType Directory -Path $out -Force | Out-Null
    foreach($file in $installers) {
      Test-Firma $file.FullName
      Copy-Item -LiteralPath $file.FullName -Destination $out -Force
    }
    $hashes=foreach ($f in (Get-ChildItem $out -Filter '*.exe' | Sort-Object Name)) {
      "$((Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash)  $($f.Name)"
    }
    $hashes | Set-Content -LiteralPath (Join-Path $out 'SHA256SUMS.txt') -Encoding Ascii
    Write-Host "OK: siete instaladores firmados + sello RFC3161, en $out"
    Write-Host 'No se publico ningun release. Nunca subir claves privadas.'
  } finally { Pop-Location }
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
