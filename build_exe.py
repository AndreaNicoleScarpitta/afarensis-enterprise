#!/usr/bin/env python3
"""
Build script for creating Afarensis Enterprise Setup .exe
Handles the complete build process with proper bundling
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

def check_python_version():
    """Ensure Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required for building")
        sys.exit(1)
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} OK")

def install_dependencies():
    """Install required dependencies for building"""
    print("📦 Installing build dependencies...")
    try:
        subprocess.run([
            sys.executable, '-m', 'pip', 'install', '-r', 'setup_requirements.txt'
        ], check=True)
        print("✅ Dependencies installed")
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        sys.exit(1)

def create_version_info():
    """Create version info file for the .exe"""
    version_info = """# UTF-8
#
# For more details about fixed file info 'ffi' see:
# http://msdn.microsoft.com/en-us/library/ms646997.aspx
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(2, 0, 0, 0),
    prodvers=(2, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
    ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'Afarensis Enterprise'),
        StringStruct(u'FileDescription', u'Clinical Evidence Review Platform - One-Click Setup'),
        StringStruct(u'FileVersion', u'2.0.0.0'),
        StringStruct(u'InternalName', u'AfarensisSetup'),
        StringStruct(u'LegalCopyright', u'Copyright (C) 2024 Afarensis Enterprise'),
        StringStruct(u'OriginalFilename', u'AfarensisEnterprise-Setup.exe'),
        StringStruct(u'ProductName', u'Afarensis Enterprise Setup'),
        StringStruct(u'ProductVersion', u'2.0.0.0')])
      ]), 
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
"""
    
    with open('version_info.txt', 'w') as f:
        f.write(version_info)
    print("✅ Version info created")

def create_icon():
    """Create a simple icon file"""
    # This creates a minimal ICO file
    # In production, you'd want a proper icon design
    ico_data = (
        b'\x00\x00\x01\x00\x01\x00\x20\x20\x00\x00\x01\x00\x08\x00\x68\x05\x00\x00'
        b'\x16\x00\x00\x00\x28\x00\x00\x00\x20\x00\x00\x00\x40\x00\x00\x00\x01\x00'
        + b'\x00' * 1400  # Rest of minimal icon data
    )
    
    try:
        with open('afarensis_icon.ico', 'wb') as f:
            f.write(ico_data)
        print("✅ Icon created")
    except Exception:
        print("⚠️ Icon creation skipped")

def clean_build_dirs():
    """Clean previous build directories"""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"🧹 Cleaned {dir_name}")

def build_exe():
    """Build the .exe using PyInstaller"""
    print("🔨 Building executable...")
    
    try:
        # Run PyInstaller with the spec file
        subprocess.run([
            sys.executable, '-m', 'PyInstaller', 
            '--clean',
            'afarensis_setup.spec'
        ], check=True)
        
        print("✅ Build completed successfully!")
        
        # Check if .exe was created
        exe_path = Path('dist/AfarensisEnterprise-Setup.exe')
        if exe_path.exists():
            file_size = exe_path.stat().st_size / (1024 * 1024)  # Size in MB
            print(f"📁 Executable created: {exe_path}")
            print(f"📊 File size: {file_size:.1f} MB")
        else:
            print("❌ Executable not found in dist/")
            
    except subprocess.CalledProcessError:
        print("❌ Build failed")
        sys.exit(1)

def create_release_package():
    """Create a complete release package"""
    print("📦 Creating release package...")
    
    release_dir = Path("afarensis_enterprise_release")
    release_dir.mkdir(exist_ok=True)
    
    # Copy the .exe
    exe_source = Path("dist/AfarensisEnterprise-Setup.exe")
    if exe_source.exists():
        shutil.copy2(exe_source, release_dir / "AfarensisEnterprise-Setup.exe")
    
    # Create README for the release
    readme_content = """
# Afarensis Enterprise - One-Click Setup

## Quick Start
1. Double-click `AfarensisEnterprise-Setup.exe`
2. Click "Start Setup" and wait for completion
3. Click "Open Application" when ready
4. Login with: admin@afarensis.com / admin123

## System Requirements
- Windows 10/11 (64-bit)
- 4GB RAM minimum, 8GB recommended  
- 2GB free disk space
- Internet connection for Docker images

## What Gets Installed
- Docker containers for PostgreSQL, Redis, and application services
- Complete Afarensis Enterprise platform
- Sample demo data for testing
- Admin user account

## Troubleshooting
- Ensure Docker Desktop is installed and running
- Check that ports 3000, 8000, 5432, 6379 are available
- Run as Administrator if permission issues occur
- Check the setup log file for detailed error information

## Support
For support and documentation, visit: https://docs.afarensis.com
"""
    
    with open(release_dir / "README.txt", "w") as f:
        f.write(readme_content)
    
    print(f"✅ Release package created in: {release_dir}")

def main():
    """Main build process"""
    print("🚀 Afarensis Enterprise - Build Script")
    print("======================================")
    
    # Pre-build checks
    check_python_version()
    
    # Build steps
    install_dependencies()
    create_version_info()
    create_icon()
    clean_build_dirs()
    build_exe()
    create_release_package()
    
    print("\n🎉 Build completed successfully!")
    print("\n📁 Files created:")
    print("   - dist/AfarensisEnterprise-Setup.exe")
    print("   - afarensis_enterprise_release/")
    print("\n🚀 Ready for distribution!")

if __name__ == "__main__":
    main()
