@echo off
setlocal EnableExtensions DisableDelayedExpansion
title FLUYNOVA Copilot - DEMO LOCAL SIN PUBLICAR
cd /d "%~dp0"
echo =======================================================
echo  FLUYNOVA Copilot - DEMOSTRACION LOCAL
echo  Sin documentos reales, sin publicacion, IA opcional
echo =======================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
 echo ERROR: Instala Node.js 22 o superior desde https://nodejs.org/
 pause
 exit /b 3
)
node "%~dp0startup-preflight.mjs"
if errorlevel 1 (
 echo.
 echo Inicio bloqueado. Podes repetir DIAGNOSTICAR-COPILOT-WINDOWS.cmd
 echo No se instalo ni modifico ningun componente.
 pause
 exit /b 2
)
echo.
echo Servidor exclusivo de 127.0.0.1. Ctrl+C para cerrar.
echo Cuando este listo se solicitara abrir el navegador.
echo En caso contrario ingresa http://127.0.0.1:8767/
echo.
if not "%FLUYNOVA_OPEN_BROWSER%"=="0" set "FLUYNOVA_OPEN_BROWSER=1"
node "%~dp0server.mjs"
set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" (
 echo ERROR: El servidor se detuvo. Ejecuta el diagnostico para ver causas.
 pause
 exit /b %SERVER_EXIT%
)
echo El servidor finalizo sin errores.
if not "%FLUYNOVA_NO_PAUSE%"=="1" pause
exit /b 0
