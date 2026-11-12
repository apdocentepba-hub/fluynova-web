@echo off
setlocal
title FLUYNOVA Copilot - DEMO LOCAL IA OPCIONAL
cd /d "%~dp0"
echo =======================================================
echo   FLUYNOVA Copilot - DEMOSTRACION LOCAL DE IA
echo   Sin publicar, sin datos reales, sin servicios de pago
echo =======================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Node.js 22 o superior.
  echo Instalalo desde https://nodejs.org/
  pause
  exit /b 1
)
for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 22 (
 echo ERROR: requiere Node.js 22 o superior.
 echo Instalalo desde https://nodejs.org/
 pause
 exit /b 3
)
where ollama >nul 2>&1
if errorlevel 1 (
  echo INFO: Ollama no encontrado. El control monetario sin IA funcionara igualmente.
) else (
  ollama list 2>nul | findstr /C:"qwen3:1.7b" >nul
  if errorlevel 1 (
    echo INFO: qwen3:1.7b no disponible. El control sin IA sigue funcionando.
  ) else (
    echo INFO: Modelo local detectado. Podes usar ambas modalidades.
  )
)
if not exist "%~dp0node_modules\pdfjs-dist\package.json" (
  echo INFO: Lector PDF opcional no instalado. Para usarlo ejecuta PREPARAR-PDF-WINDOWS.cmd.
)
echo Iniciando servidor local en 127.0.0.1...
echo El navegador se abrira cuando el servidor este listo.
echo Si no se abre, ingresa http://127.0.0.1:8767/
echo.
set "FLUYNOVA_OPEN_BROWSER=1"
node server.mjs
if errorlevel 1 (
 echo El servidor se detuvo con error.
 pause
 exit /b 1
)
endlocal
