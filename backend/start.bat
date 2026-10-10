@echo off
setlocal
title LearnHub Backend
cd /d "%~dp0"
echo.
echo ========================================
echo       LearnHub Backend Launcher
echo ========================================
echo.
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    pause
    exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (echo ERROR: Could not create virtual environment.& pause & exit /b 1)
)
echo Installing requirements from PyPI...
".venv\Scripts\python.exe" -m pip install --upgrade pip --index-url https://pypi.org/simple
if errorlevel 1 (echo ERROR: Could not upgrade pip.& pause & exit /b 1)
".venv\Scripts\python.exe" -m pip install --index-url https://pypi.org/simple -r requirements.txt
if errorlevel 1 (echo ERROR: Dependency installation failed.& pause & exit /b 1)
echo.
echo Applying database migrations...
".venv\Scripts\python.exe" migrate.py
if errorlevel 1 (echo ERROR: Database migration failed.& pause & exit /b 1)
echo.
echo Starting LearnHub API at http://localhost:5000
echo Press Ctrl+C to stop.
echo.
".venv\Scripts\python.exe" run.py
pause
