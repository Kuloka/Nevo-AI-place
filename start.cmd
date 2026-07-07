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

echo   [*] Starting Nevo...
echo   [*] Projects folder: %USERPROFILE%\NevoProject
echo.
call npx electron .
