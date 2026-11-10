@echo off
setlocal
title FLUYNOVA COPILOT - CORPUS SIN IA
cd /d "%~dp0"
echo ===================================================
echo  FLUYNOVA - VALIDACION DE REGLAS CON CORPUS FICTICIO
echo  53 comprobantes inventados - NO USA OLLAMA
echo ===================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no detectado. Ya deberia estar instalado.
  pause
  exit /b 3
)
set "REPORT=%~dp0INFORME_CORPUS_SIN_IA.txt"
node "%~dp0BENCHMARK-CORPUS.mjs" > "%REPORT%" 2>&1
set "EXIT=%ERRORLEVEL%"
type "%REPORT%"
echo.
echo Informe: INFORME_CORPUS_SIN_IA.txt
echo No se utilizaron facturas reales ni servicios externos.
pause
exit /b %EXIT%
