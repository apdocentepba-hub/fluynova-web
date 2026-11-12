# FLUYNOVA: ZIP de laboratorio, lista explicita y sin descargas ni datos reales.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Destination)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSCommandPath
$allow=@(
 'index.html','README.md','package.json',
 'INICIAR-COPILOT-WINDOWS.cmd','DIAGNOSTICAR-COPILOT-WINDOWS.cmd',
 'PREPARAR-PDF-WINDOWS.cmd','PREPARAR-OCR-WINDOWS.cmd',
 'PREPARAR-MODELO-OCR.mjs','server.mjs','startup-preflight.mjs',
 'browser-launch-windows.mjs','analysis.mjs','verify-money.mjs',
 'manual-review.mjs','money-ar.mjs','ocr-manual-review.mjs',
 'ocr-model.mjs','ocr-image.mjs','ocr-layout.mjs',
 'ocr-readability.mjs','ocr-score.mjs','image-input.mjs',
 'pdf-text.mjs','isolated-processing.mjs','processor-child.mjs'
)
$zip=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $zip){throw 'No se sobrescribe un ZIP existente.'}
if(-not (Test-Path -LiteralPath (Split-Path -Parent $zip) -PathType Container)){throw 'Carpeta de destino inexistente.'}
$tmp=Join-Path ([IO.Path]::GetTempPath()) ('fluynova-test-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $tmp)
try {
 foreach($name in $allow){
  if($name -notmatch '^[A-Za-z0-9._-]+$'){throw 'Nombre prohibido en lista blanca.'}
  $src=Join-Path $root $name
  if(-not(Test-Path -LiteralPath $src -PathType Leaf)){throw "Falta $name"}
  Copy-Item -LiteralPath $src -Destination (Join-Path $tmp $name)
 }
 $info=@'
FLUYNOVA COPILOT - LABORATORIO WINDOWS
Extrae el ZIP completo en una carpeta local.
Necesitas Node.js 22+ (24 recomendado para PDF/OCR).
Primero abre DIAGNOSTICAR-COPILOT-WINDOWS.cmd.
Despues abre INICIAR-COPILOT-WINDOWS.cmd.
Navegador: http://127.0.0.1:8767/
Para terminar, cierra la ventana de consola o presiona Ctrl+C.
PDF/OCR opcionales: PREPARAR-PDF-WINDOWS.cmd / PREPARAR-OCR-WINDOWS.cmd
Esos preparadores piden permiso antes de descargar.
El control monetario sin IA no necesita Ollama.
NO USAR FACTURAS REALES NI DATOS PERSONALES O CONFIDENCIALES.
Sin usuarios, auditoria comercial, almacenamiento ni certificacion fiscal.
'@
 Set-Content -LiteralPath (Join-Path $tmp 'LEEME-PRIMERO.txt') -Value $info -Encoding utf8
 $hashes=Get-ChildItem -LiteralPath $tmp -File | Sort-Object Name | ForEach-Object {
  (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+$_.Name
 }
 Set-Content -LiteralPath (Join-Path $tmp 'SHA256SUMS.txt') -Value $hashes -Encoding utf8
 Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zip -CompressionLevel Optimal
 if(-not(Test-Path -LiteralPath $zip -PathType Leaf)){throw 'Fallo la generacion del ZIP'}
 Write-Output ('ZIP_ENSAYO_CREADO: '+$zip)
 Write-Output ('TOTAL_ARCHIVOS: '+($allow.Count+2))
}finally{
 Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
