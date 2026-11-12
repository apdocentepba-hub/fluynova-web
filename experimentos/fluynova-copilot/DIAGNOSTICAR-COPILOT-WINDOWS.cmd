@echo off
setlocal EnableExtensions DisableDelayedExpansion
title FLUYNOVA Copilot - DIAGNOSTICO LOCAL
cd /d "%~dp0"
echo ================================================
echo  FLUYNOVA COPILOT - DIAGNOSTICO DE ESTA PC
echo ================================================
where node >nul 2>&1
if errorlevel 1 (
 echo ERROR: Falta Node.js 22 o superior: https://nodejs.org/
 set "RESULT=3"
 goto :finish
)
node "%~dp0startup-preflight.mjs"
set "RESULT=%ERRORLEVEL%"
:finish
echo.
if "%RESULT%"=="0" (
 echo Diagnostico finalizado. Ya podes ejecutar INICIAR-COPILOT-WINDOWS.cmd
) else (
 echo Diagnostico finalizado con errores. No instales nada sin revisar lo indicado.
)
echo.
if not "%FLUYNOVA_NO_PAUSE%"=="1" pause
exit /b %RESULT%
