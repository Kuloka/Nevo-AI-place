@echo off
title Nevo - Install
echo.
echo   ========================================
echo          Nevo - Installation
echo   ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js not found.
    echo   Download from https://nodejs.org and install.
    echo.
    pause
    exit /b 1
)

echo   [OK] Node.js found
node --version
echo.

echo   [*] Installing Electron...
call npm install
echo.

where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Ollama not found.
    echo   [*] Installing Ollama from https://ollama.com...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://ollama.com/install.ps1 | iex"
    echo.
    where ollama >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [!] Ollama installation did not finish successfully.
        echo   You can still install it manually from https://ollama.com/download/windows
    ) else (
        echo   [OK] Ollama installed
    )
    echo.
) else (
    echo   [OK] Ollama found
    echo   Models:
    ollama list
)

echo.
echo   ========================================
echo   Done! Now run start.vbs without a terminal window
echo   Projects will be saved to: %USERPROFILE%\NevoProject
echo   ========================================
echo.
pause
