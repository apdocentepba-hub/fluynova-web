@echo off
setlocal
title FLUYNOVA Copilot - instalar lector PDF opcional
cd /d "%~dp0"
echo ===============================================================
echo   FLUYNOVA COPILOT - LECTOR LOCAL PDF DE TEXTO
echo   Opcional: NO instala servicios ni publica nada
echo ===============================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js 22 o superior no encontrado.
  pause
  exit /b 3
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no disponible junto a Node.js.
  pause
  exit /b 3
)
if exist "%~dp0node_modules\pdfjs-dist\package.json" (
  echo Lector PDF.js ya presente.
  pause
  exit /b 0
)
echo Para leer PDF con texto seleccionable se necesita PDF.js version fija.
echo Se descargara el paquete desde npm a ESTA carpeta solamente.
echo No requiere Ollama. No abre puertos, no publica, no carga archivos.
echo.
choice /C SN /N /M "Autorizar descarga local de PDF.js [S/N]? "
if errorlevel 2 exit /b 0
call npm install --prefix "%~dp0" --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  echo ERROR: No se pudo obtener el paquete. El modo de texto manual sigue funcionando.
  pause
  exit /b 1
)
echo PDF.js preparado. Ahora podes usar INICIAR-COPILOT-WINDOWS.cmd.
pause
exit /b 0
