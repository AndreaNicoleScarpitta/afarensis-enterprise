# Afarensis Enterprise - PowerShell Build Script
# Creates a self-contained .exe installer

Write-Host "========================================" -ForegroundColor Blue
Write-Host "Afarensis Enterprise - Build Setup.exe" -ForegroundColor Blue  
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

Write-Host "🔨 Starting build process..." -ForegroundColor Cyan
Write-Host

# Run the build script
try {
    & python build_exe.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Build completed successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host
        Write-Host "📁 The setup executable has been created:" -ForegroundColor Yellow
        Write-Host "   - AfarensisEnterprise-Setup.exe" -ForegroundColor White
        Write-Host
        Write-Host "🚀 You can now distribute this file to install" -ForegroundColor Yellow
        Write-Host "   Afarensis Enterprise on any Windows system." -ForegroundColor White
        Write-Host
        
        # Offer to open the dist folder
        $openFolder = Read-Host "Open the output folder? (y/n)"
        if ($openFolder -eq "y" -or $openFolder -eq "Y") {
            if (Test-Path "dist") {
                Invoke-Item "dist"
            } elseif (Test-Path "afarensis_enterprise_release") {
                Invoke-Item "afarensis_enterprise_release"
            }
        }
        
    } else {
        Write-Host
        Write-Host "❌ ERROR: Build failed. Check the output above for details." -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ ERROR: Failed to run build script: $_" -ForegroundColor Red
}

Write-Host
Read-Host "Press Enter to exit"
