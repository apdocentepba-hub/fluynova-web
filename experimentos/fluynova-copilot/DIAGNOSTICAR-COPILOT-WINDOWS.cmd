@echo off
setlocal EnableExtensions DisableDelayedExpansion
title FLUYNOVA Copilot - DIAGNOSTICO LOCAL
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo ERROR: Falta Node.js 22 o superior: https://nodejs.org/
 exit /b 3
)
node "%~dp0startup-preflight.mjs"
exit /b %ERRORLEVEL%
