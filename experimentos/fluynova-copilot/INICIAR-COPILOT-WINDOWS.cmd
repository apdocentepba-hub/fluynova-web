@echo off
setlocal
title FLUYNOVA Copilot - DEMO LOCAL
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
where ollama >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Ollama.
  echo Instalalo desde https://ollama.com/download
  pause
  exit /b 1
)
ollama list 2>nul | findstr /C:"qwen3:1.7b" >nul
if errorlevel 1 (
  echo FALTA EL MODELO: abre otra terminal y ejecuta:
  echo   ollama pull qwen3:1.7b
  echo Inicia Ollama si no esta activo y volve a abrir este archivo.
  pause
  exit /b 1
)
echo Modelo detectado. Iniciando servidor solo en 127.0.0.1...
echo Si tu GPU no es compatible, Ollama puede funcionar por CPU.
echo.
start "" "http://127.0.0.1:8767/"
node server.mjs
if errorlevel 1 (
 echo El servidor se detuvo con error.
 pause
 exit /b 1
)
endlocal
