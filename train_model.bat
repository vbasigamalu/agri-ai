@echo off
REM ============================================================
REM  Agri-AI — PyTorch Training Launcher
REM  Trains the plant disease model and exports ONNX for Node.js
REM ============================================================

echo.
echo  =============================================
echo   Agri-AI ^| PyTorch ML Engine Setup
echo  =============================================
echo.

cd /d "%~dp0backend\ml_engine"

echo [1/3] Installing Python dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: pip install failed. Make sure Python 3.9+ is installed.
    echo  Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo.
echo [2/3] Starting training...
echo  This will take 30-90 min on CPU. Press Ctrl+C to stop early.
echo.
python train.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Training failed. Check the error above.
    pause
    exit /b 1
)

echo.
echo [3/3] Training complete!
echo.
echo  Output files in backend\ml_engine\:
echo    crop_disease_model.onnx  ^<-- Node.js will auto-load this
echo    labels.json
echo    training_results.json
echo    confusion_matrix.png
echo.
echo  Next: Run start.bat to start the server with the new model.
echo.
pause
