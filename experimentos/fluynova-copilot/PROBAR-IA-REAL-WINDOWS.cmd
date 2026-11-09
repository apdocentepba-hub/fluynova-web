@echo off
setlocal
title FLUYNOVA Copilot - PRUEBA LOCAL REAL
cd /d "%~dp0"
echo ===========================================================
echo   FLUYNOVA COPILOT - PRUEBA CON MODELO REAL EN ESTA PC
echo   Dos comprobantes INVENTADOS, sin datos personales
echo   No instala, no compra, no envia documentos a Internet
echo ===========================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node 22 o superior no disponible en PATH.
  echo Descargalo desde https://nodejs.org/
  pause
  exit /b 3
)
set "INFORME=%~dp0INFORME_FLUYNOVA_IA_LOCAL.txt"
node "%~dp0DIAGNOSTICO-IA-LOCAL.mjs" > "%INFORME%" 2>&1
set "RC=%ERRORLEVEL%"
type "%INFORME%"
echo.
echo ===========================================================
echo El informe se guardo en esta carpeta como:
echo INFORME_FLUYNOVA_IA_LOCAL.txt
echo Podes compartir ese informe: no contiene documentos reales.
echo Codigo de salida: %RC%
echo ===========================================================
pause
exit /b %RC%
