@echo off
setlocal EnableDelayedExpansion

title Agri-AI - Smart Crop Health and Advisory Platform
color 0A

echo ===================================================
echo        AGRI-AI SMART CROP HEALTH ADVISOR           
echo ===================================================
echo [INFO] Starting Agri-AI Multi-Service Environment...
echo.

set "ROOT_DIR=%~dp0"

:: 1. Check for Node.js installation
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not added to PATH.
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check Backend dependencies
if not exist "%ROOT_DIR%backend\node_modules\" (
    echo [INFO] Installing Backend dependencies...
    cd /d "%ROOT_DIR%backend"
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
    echo [SUCCESS] Backend dependencies ready!
    echo.
)

:: 3. Check Client dependencies
if not exist "%ROOT_DIR%client\node_modules\" (
    echo [INFO] Installing Frontend dependencies...
    cd /d "%ROOT_DIR%client"
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo [ERROR] Failed to install client dependencies.
        pause
        exit /b 1
    )
    echo [SUCCESS] Frontend dependencies ready!
    echo.
)

:: 4. Ensure production build exists
if not exist "%ROOT_DIR%client\dist\" (
    echo [INFO] Building production bundle for client...
    cd /d "%ROOT_DIR%client"
    call npm run build
    echo [SUCCESS] Client build ready!
    echo.
)

echo ===================================================
echo [1/2] Launching Backend API Service on Port 5000...
start "Agri-AI Backend [5000]" cmd /k "cd /d "%ROOT_DIR%backend" && npm start"

echo [2/2] Launching Frontend React App on Port 5173...
start "Agri-AI Frontend [5173]" cmd /k "cd /d "%ROOT_DIR%client" && npm run dev"

echo ===================================================
echo [INFO] All services started successfully!
echo   - Frontend React UI : http://localhost:5173
echo   - Backend REST API  : http://localhost:5000
echo.
echo [INFO] Opening default browser in 3 seconds...
start "" powershell -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:5173'"

echo.
echo Press any key to exit this launcher window.
echo (The Backend and Frontend windows will stay running).
pause >nul
