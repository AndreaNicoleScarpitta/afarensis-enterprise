# Afarensis Enterprise - PowerShell Configuration Script

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Afarensis Enterprise - Configuration" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host

# Check PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "ERROR: PowerShell 5.0+ required" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Python is installed
try {
    $pythonVersion = python --version 2>$null
    Write-Host "✅ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://python.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "🔧 Starting configuration..." -ForegroundColor Cyan
Write-Host

# Configuration menu
Write-Host "Configuration Options:" -ForegroundColor Yellow
Write-Host "1. Full Configuration Wizard (recommended)"
Write-Host "2. Quick Development Setup"
Write-Host "3. API Testing Only"
Write-Host "4. Environment Validation"
Write-Host "5. Exit"
Write-Host

$choice = Read-Host "Select option (1-5)"

switch ($choice) {
    "1" {
        Write-Host
        Write-Host "Starting Full Configuration Wizard..." -ForegroundColor Cyan
        Write-Host "=====================================" -ForegroundColor Cyan
        
        try {
            & python scripts/configure_environment.py
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Configuration completed successfully!" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Configuration completed with warnings" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Configuration failed: $_" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host
        Write-Host "Starting Quick Development Setup..." -ForegroundColor Cyan
        Write-Host "==================================" -ForegroundColor Cyan
        
        try {
            & python scripts/configure_environment.py quick
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Quick setup completed successfully!" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Quick setup completed with warnings" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Quick setup failed: $_" -ForegroundColor Red
        }
    }
    
    "3" {
        Write-Host
        Write-Host "Testing API Connections..." -ForegroundColor Cyan
        Write-Host "=========================" -ForegroundColor Cyan
        
        try {
            & python scripts/test_apis.py
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ All API tests passed!" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Some API tests failed - check output above" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ API testing failed: $_" -ForegroundColor Red
        }
    }
    
    "4" {
        Write-Host
        Write-Host "Validating Environment..." -ForegroundColor Cyan
        Write-Host "========================" -ForegroundColor Cyan
        
        try {
            & python scripts/validate_environment.py
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Environment validation passed!" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Environment validation found issues" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Environment validation failed: $_" -ForegroundColor Red
        }
    }
    
    "5" {
        Write-Host "Exiting..." -ForegroundColor Gray
        exit 0
    }
    
    default {
        Write-Host "Invalid choice. Please select 1, 2, 3, 4, or 5." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start Docker services: docker-compose up -d"
Write-Host "2. Run database migrations: alembic upgrade head"
Write-Host "3. Start the application: python -m app.main"
Write-Host "4. Access the UI at: http://localhost:3000"
Write-Host
Write-Host "Admin login: admin@afarensis.com / admin123" -ForegroundColor Cyan
Write-Host

Read-Host "Press Enter to exit"
