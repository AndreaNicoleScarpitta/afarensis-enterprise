# Afarensis Enterprise - One-Click Setup Builder

This directory contains everything needed to create a self-contained Windows executable (.exe) that sets up the complete Afarensis Enterprise clinical evidence review platform in one click.

## 🎯 What This Creates

The resulting `.exe` file will:
- ✅ Install and configure the complete Afarensis Enterprise platform
- ✅ Set up PostgreSQL database with all tables
- ✅ Configure Redis for background tasks
- ✅ Start all application services via Docker
- ✅ Create an admin user account
- ✅ Open the web application in your browser
- ✅ Include demo data for immediate testing

## 🔧 Building the Setup.exe

### Option 1: Quick Build (Recommended)
**Windows Batch File:**
```cmd
double-click: build_setup_exe.bat
```

**PowerShell:**
```powershell
.\build_setup_exe.ps1
```

### Option 2: Manual Build
```cmd
# Install dependencies
pip install -r setup_requirements.txt

# Run build script  
python build_exe.py
```

### Option 3: Direct PyInstaller
```cmd
pip install pyinstaller
pyinstaller --clean afarensis_setup.spec
```

## 📋 Prerequisites for Building

- **Python 3.8+** - Download from [python.org](https://python.org)
- **pip** (comes with Python)
- **Windows 10/11** (for .exe creation)
- **Internet connection** (for downloading dependencies)

## 📁 Output Files

After building, you'll find:
```
dist/
  └── AfarensisEnterprise-Setup.exe    # Main installer (distribute this)

afarensis_enterprise_release/
  ├── AfarensisEnterprise-Setup.exe    # Copy of installer  
  └── README.txt                       # User instructions
```

## 🚀 Using the Setup.exe

### For End Users (No Technical Experience Required)

1. **Download** `AfarensisEnterprise-Setup.exe`
2. **Double-click** the executable
3. **Click "Start Setup"** and wait (5-10 minutes)
4. **Click "Open Application"** when complete
5. **Login** with: `admin@afarensis.com` / `admin123`

### System Requirements for End Users
- Windows 10/11 (64-bit)
- 4GB RAM minimum, 8GB recommended
- 2GB free disk space
- Internet connection (for Docker images)
- Ports 3000, 5432, 6379, 8000 available

### What the Setup.exe Does
1. 🔍 **Checks Prerequisites** - Verifies Docker, Python, available ports
2. 📁 **Creates Project Structure** - Sets up complete application directory
3. 🔐 **Generates Security Config** - Creates secure JWT keys, encryption keys
4. 🗄️ **Sets Up Database** - Installs PostgreSQL, runs migrations
5. 🔄 **Starts Services** - Launches Redis, Celery, API, and frontend
6. 👤 **Creates Admin User** - Sets up initial admin account
7. 📊 **Loads Demo Data** - Creates sample projects and evidence
8. 🌐 **Opens Browser** - Launches the web application

## 🛠️ Troubleshooting

### Build Issues
```bash
# If build fails, check:
python --version    # Should be 3.8+
pip --version      # Should work
pip install pyinstaller  # Try manually

# Clean and retry:
rmdir /s build dist __pycache__
python build_exe.py
```

### Docker Issues (End User)
```bash
# Install Docker Desktop from:
https://docs.docker.com/get-docker/

# Restart Docker Desktop after installation
# Ensure Docker is running before setup
```

### Port Conflicts (End User)
```bash
# Check what's using required ports:
netstat -an | find "3000"
netstat -an | find "8000" 
netstat -an | find "5432"
netstat -an | find "6379"

# Stop conflicting services or choose different ports
```

## 📂 Project Structure

```
afarensis-enterprise/
├── afarensis_setup.py          # Main setup script
├── afarensis_setup.spec        # PyInstaller configuration
├── build_exe.py               # Build automation
├── build_setup_exe.bat        # Windows batch builder
├── build_setup_exe.ps1        # PowerShell builder  
├── setup_requirements.txt     # Dependencies for building
├── version_info.txt           # Executable metadata
├── backend/                   # Complete backend application
│   ├── app/                   # FastAPI application
│   ├── migrations/            # Database migrations
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile            # Backend container
├── frontend/                  # Complete frontend application  
│   ├── src/                   # React TypeScript application
│   ├── package.json          # Node.js dependencies
│   └── Dockerfile            # Frontend container
├── docker-compose.yml         # Multi-service orchestration
└── scripts/                   # Utility scripts
    └── validate_environment.py
```

## 🔐 Security Notes

### For Distribution
- The .exe is **self-contained** - no external dependencies
- **Generated secrets** are unique per installation
- **Default passwords** should be changed after setup
- **Demo API keys** are placeholders - add real keys for production

### For Production Use
- Change default admin password immediately
- Add real API keys for PubMed, Claude, etc.
- Enable SSL/TLS in production
- Configure proper firewall rules
- Regular security updates

## 🎨 Customization

### Branding
- Replace `afarensis_icon.ico` with your icon
- Modify company info in `version_info.txt`
- Update application title in `afarensis_setup.py`

### Configuration
- Edit default environment variables in `generate_environment_config()`
- Modify demo data in `create_demo_data()`
- Customize Docker services in `docker-compose.yml`

## 📊 Demo Features

The setup includes:
- **Sample Projects** - Alzheimer drug trials, oncology studies
- **Evidence Records** - Simulated PubMed and clinical trial data
- **Bias Analysis** - Pre-configured bias detection examples
- **Regulatory Artifacts** - Sample FDA submission documents
- **User Roles** - Admin, reviewer, analyst, viewer accounts

## 🚀 Distribution

### Simple Distribution
1. Build the .exe using any method above
2. Copy `AfarensisEnterprise-Setup.exe` to USB drive or file share
3. Share with end users

### Professional Distribution  
1. Code-sign the .exe for security
2. Create installer package with custom branding
3. Distribute via company software center
4. Include user training materials

## 📞 Support

### For Developers
- Check build logs in console output
- Review `afarensis_setup.log` for detailed information
- Test in clean Windows VM environment

### For End Users  
- Built-in setup progress tracking
- Automatic fallback to mock data if services fail
- Comprehensive error logging
- Step-by-step troubleshooting guides

## 🔄 Updates

To create updated versions:
1. Update the source code in `backend/` and `frontend/`
2. Increment version numbers in `version_info.txt`
3. Rebuild the .exe using the same process
4. Test in clean environment before distribution

---

## Quick Reference Commands

```bash
# Build the .exe (Windows)
build_setup_exe.bat

# Build the .exe (PowerShell) 
.\build_setup_exe.ps1

# Build the .exe (Manual)
python build_exe.py

# Test the .exe
.\dist\AfarensisEnterprise-Setup.exe

# Clean build files
rmdir /s build dist __pycache__
```

🎉 **Ready to create your one-click Afarensis Enterprise installer!**
