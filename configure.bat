@echo off
echo ========================================
echo Afarensis Enterprise - Configuration
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo Python found, starting configuration...
echo.

REM Ask user for configuration type
echo Configuration Options:
echo 1. Full Configuration Wizard (recommended)
echo 2. Quick Development Setup
echo 3. API Testing Only
echo 4. Exit
echo.

set /p choice="Select option (1-4): "

if "%choice%"=="1" goto full_config
if "%choice%"=="2" goto quick_config  
if "%choice%"=="3" goto api_test
if "%choice%"=="4" goto exit
goto invalid_choice

:full_config
echo.
echo Starting Full Configuration Wizard...
echo =====================================
python scripts/configure_environment.py
goto end

:quick_config
echo.
echo Starting Quick Development Setup...
echo ==================================
python scripts/configure_environment.py quick
goto end

:api_test
echo.
echo Testing API Connections...
echo =========================
python scripts/test_apis.py
goto end

:invalid_choice
echo Invalid choice. Please select 1, 2, 3, or 4.
pause
goto start

:end
echo.
if errorlevel 1 (
    echo Configuration completed with warnings or errors.
    echo Check the output above for details.
) else (
    echo Configuration completed successfully!
)

echo.
echo Next Steps:
echo 1. Start Docker services: docker-compose up -d
echo 2. Run database migrations: alembic upgrade head  
echo 3. Start the application: python -m app.main
echo 4. Access the UI at: http://localhost:3000
echo.

:exit
pause
