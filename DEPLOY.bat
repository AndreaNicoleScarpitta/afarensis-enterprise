@echo off
REM Afarensis Enterprise v2.1 - Windows Deployment Script
REM Automatically deploys the complete system with all fixes

echo ============================================================
echo AFARENSIS ENTERPRISE v2.1 - AUTOMATED DEPLOYMENT
echo ============================================================
echo.

REM Check if Docker is running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed or not running
    echo Please install Docker Desktop and start it first
    echo Download from: https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe
    pause
    exit /b 1
)

echo ✅ Docker is running

REM Verify deployment readiness
echo.
echo 🔍 Verifying deployment configuration...
python verify_deployment.py
if errorlevel 1 (
    echo.
    echo ❌ Deployment verification failed
    echo Please check the issues above before proceeding
    pause
    exit /b 1
)

echo.
echo ✅ All deployment checks passed!
echo.

REM Ask user for deployment confirmation
choice /C YN /M "🚀 Ready to deploy Afarensis Enterprise? This will start 12 Docker services"
if errorlevel 2 goto :cancel

echo.
echo 📦 Starting Afarensis Enterprise deployment...
echo.

REM Generate SSL certificates first
echo 🔐 Step 1/3: Generating SSL certificates...
docker-compose up ssl-generator
if errorlevel 1 (
    echo ❌ SSL certificate generation failed
    pause
    exit /b 1
)

echo ✅ SSL certificates generated
echo.

REM Start all services
echo 🚀 Step 2/3: Starting all services...
docker-compose up -d
if errorlevel 1 (
    echo ❌ Service startup failed
    pause
    exit /b 1
)

echo ✅ All services started
echo.

REM Wait for services to be ready
echo ⏳ Step 3/3: Waiting for services to be ready...
timeout /t 30 /nobreak > nul

REM Check service status
echo 📊 Service Status:
docker-compose ps

echo.
echo 🎉 DEPLOYMENT COMPLETE!
echo.
echo 📱 Access your Afarensis Enterprise platform:
echo    Frontend: http://localhost:3000
echo    Admin Portal: http://localhost:3000/admin
echo    API Documentation: http://localhost:8000/docs
echo    Monitoring: http://localhost:3001 (Grafana)
echo.
echo 🔑 Default Login Credentials:
echo    Email: admin@afarensis.com
echo    Password: admin123
echo.
echo 📖 For detailed documentation, see:
echo    - RELEASE_NOTES.md
echo    - DEPLOYMENT-GUIDE-COMPREHENSIVE-FIXES.md
echo.

REM Ask if user wants to open the application
choice /C YN /M "🌐 Open Afarensis Enterprise in your browser now"
if errorlevel 2 goto :end

start http://localhost:3000
goto :end

:cancel
echo.
echo ⏹️ Deployment cancelled by user
goto :end

:end
echo.
echo 📞 Need help? Check the documentation or contact support
echo.
pause
