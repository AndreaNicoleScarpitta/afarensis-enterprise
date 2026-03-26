@echo off
echo ========================================
echo Afarensis Enterprise - Build Setup.exe
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

echo Python found, starting build process...
echo.

REM Run the build script
python build_exe.py

if errorlevel 1 (
    echo.
    echo ERROR: Build failed. Check the output above for details.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo The setup executable has been created:
echo   - AfarensisEnterprise-Setup.exe
echo.
echo You can now distribute this file to install
echo Afarensis Enterprise on any Windows system.
echo.
pause
