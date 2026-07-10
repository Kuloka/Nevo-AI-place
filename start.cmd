@echo off
title Nevo
echo.
echo   ========================================
echo            Nevo - Starting
echo   ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js not installed.
    echo   Run install.cmd first.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo   [*] Installing dependencies...
    call npm install
    echo.
)

if not exist "%~dp0node_modules\electron\dist\electron.exe" (
    echo   [!] Electron is not installed correctly.
    echo   Run install.cmd first.
    pause
    exit /b 1
)

wscript.exe //B "%~dp0start.vbs"
exit /b 0
