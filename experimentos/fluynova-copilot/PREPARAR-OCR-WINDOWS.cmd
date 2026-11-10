@echo off
setlocal
title FLUYNOVA - PREPARACION OCR ESPANOL
cd /d "%~dp0"
echo ==========================================================
echo  FLUYNOVA COPILOT - LECTOR OCR LOCAL OPCIONAL
echo  No instala servidores ni expone archivos a Internet
echo ==========================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
 echo ERROR: Node.js no esta instalado.
 pause
 exit /b 3
)
for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 24 (
 echo ERROR: para el OCR se requiere Node.js 24 o superior.
 echo El control sin IA puede seguir funcionando con tu instalacion actual.
 pause
 exit /b 3
)
where npm >nul 2>&1
if errorlevel 1 (
 echo ERROR: npm no esta disponible.
 pause
 exit /b 3
)
echo Esta preparacion descargara las dependencias de este laboratorio
echo desde npm y un modelo de espanol del repositorio oficial
echo Tesseract tessdata_fast, con version fijada y verificacion.
echo.
echo IMPORTANTE: NO uses datos reales en este prototipo.
echo Al usar el OCR no se consultan servicios externos.
echo.
choice /C SN /N /M "Autorizar la descarga opcional [S/N]? "
if errorlevel 2 exit /b 0
call npm install --prefix "%~dp0" --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
 echo ERROR: No se pudieron instalar las dependencias.
 pause
 exit /b 1
)
node "%~dp0PREPARAR-MODELO-OCR.mjs" --autorizar-descarga
if errorlevel 1 (
 echo ERROR: Modelo OCR no preparado o verificado.
 pause
 exit /b 1
)
echo.
echo OCR espanol preparado. Inicia INICIAR-COPILOT-WINDOWS.cmd.
pause
exit /b 0
