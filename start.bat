@echo off
title Agri-AI - Smart Crop Advisor
color 0A

echo ===================================================
echo             AGRI-AI SMART CROP ADVISOR             
echo ===================================================
echo.

:: Check for Node.js installation
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not added to PATH.
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Navigate to backend directory
cd /d "%~dp0backend"

:: Check if node_modules exists, install if missing
if not exist "node_modules\" (
    echo [INFO] First time setup detected: Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo [ERROR] Failed to install dependencies. Please check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo [SUCCESS] Backend dependencies installed!
    echo.
)

:: Check if client is built, build if missing
if not exist "%~dp0client\dist\" (
    echo [INFO] Building modern React frontend...
    cd /d "%~dp0client"
    if not exist "node_modules\" call npm install
    call npm run build
    cd /d "%~dp0backend"
)

:: Automatically open default browser to Agri-AI web app in 3 seconds
start "" powershell -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:5000'"

echo [INFO] Starting Agri-AI Server...
echo [INFO] Web app will automatically open at http://localhost:5000
echo ===================================================
echo.

:: Start Node.js application
call npm start

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] Agri-AI server stopped unexpectedly.
    pause
)
