#!/usr/bin/env python3
"""
Alternative EXE Builder - Simplified Version
Bypasses SSL issues by building with minimal dependencies
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

def simple_exe_build():
    """Build EXE with minimal dependencies to avoid SSL issues"""
    
    print("""
🔨 AFARENSIS ENTERPRISE - SIMPLE EXE BUILDER
==========================================
Builds a lightweight EXE that bypasses SSL certificate issues
""")
    
    # Check Python
    try:
        result = subprocess.run([sys.executable, '--version'], capture_output=True, text=True)
        print(f"✅ Python found: {result.stdout.strip()}")
    except:
        print("❌ Python not found")
        return False
    
    # Install minimal requirements only
    minimal_packages = [
        "pyinstaller",
        "tkinter",  # Usually included
        "pathlib",  # Usually included  
        "subprocess",  # Usually included
    ]
    
    print("\n📦 Installing minimal packages...")
    for package in minimal_packages:
        try:
            if package not in ['tkinter', 'pathlib', 'subprocess']:  # Skip built-ins
                cmd = [
                    sys.executable, '-m', 'pip', 'install', 
                    '--trusted-host', 'pypi.org',
                    '--trusted-host', 'pypi.python.org', 
                    '--trusted-host', 'files.pythonhosted.org',
                    package
                ]
                subprocess.run(cmd, check=True, capture_output=True)
                print(f"  ✅ {package}")
        except subprocess.CalledProcessError:
            print(f"  ⚠️ {package} - using built-in or skipping")
    
    # Create simple launcher script
    launcher_content = '''#!/usr/bin/env python3
"""
Afarensis Enterprise v2.1 - Simple Launcher
Launches the platform without complex dependencies
"""

import os
import sys
import webbrowser
import subprocess
from pathlib import Path

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  🧬 AFARENSIS ENTERPRISE v2.1 - SIMPLE LAUNCHER             ║
║                                                              ║
║  Enhanced AI-Powered Clinical Evidence Review Platform      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

🚀 QUICK OPTIONS:

1. 🐳 Start with Docker (Recommended)
2. 🔧 Manual Setup 
3. 🧪 Test API Connections
4. 📖 View Documentation
5. 🌐 Open Application (if running)

""")
    
    choice = input("Choose option (1-5): ").strip()
    
    if choice == "1":
        print("\\n🐳 Starting Docker services...")
        print("This will start all Afarensis services automatically.")
        print("\\nRunning: docker-compose up -d")
        print("\\nAfter startup, access:")
        print("• Frontend: http://localhost:3000")
        print("• Advanced Search: http://localhost:3000/search") 
        print("• API Docs: http://localhost:8000/docs")
        print("\\nDefault login: admin@afarensis.com / admin123")
        
        try:
            subprocess.run(["docker-compose", "up", "-d"], check=True)
            print("\\n✅ Services started successfully!")
            
            # Open browser
            try:
                webbrowser.open("http://localhost:3000")
                print("🌐 Opening browser...")
            except:
                print("Please manually open: http://localhost:3000")
                
        except subprocess.CalledProcessError:
            print("❌ Docker not found or failed to start")
            print("\\nAlternatives:")
            print("• Install Docker Desktop")
            print("• Use manual setup (option 2)")
        except FileNotFoundError:
            print("❌ docker-compose not found")
            print("\\nPlease install Docker Desktop and try again")
    
    elif choice == "2":
        print("\\n🔧 Manual Setup Instructions:")
        print("\\n1. Backend setup:")
        print("   cd backend")
        print("   pip install -r requirements.txt")
        print("   uvicorn app.main:app --reload")
        print("\\n2. Frontend setup:")
        print("   cd frontend") 
        print("   npm install")
        print("   npm run dev")
        print("\\n3. Access: http://localhost:3000")
    
    elif choice == "3":
        print("\\n🧪 Testing API connections...")
        try:
            subprocess.run([sys.executable, "test_api_connections.py"], check=True)
        except:
            print("❌ Test script not found or failed")
            print("Check that test_api_connections.py exists")
    
    elif choice == "4":
        print("\\n📖 Documentation available:")
        print("• README.md - Main setup guide")
        print("• DEPLOYMENT.md - Production deployment")
        print("• PREMIUM_CONFIGURATION_COMPLETE.md - Your API status")
        print("• API_SETUP_GUIDE.md - API configuration")
    
    elif choice == "5":
        print("\\n🌐 Opening application...")
        try:
            webbrowser.open("http://localhost:3000")
            print("✅ Browser opened to http://localhost:3000")
        except:
            print("Please manually open: http://localhost:3000")
    
    else:
        print("\\n❌ Invalid option")
    
    input("\\nPress Enter to exit...")

if __name__ == "__main__":
    main()
'''
    
    # Write launcher script
    launcher_path = Path("afarensis_simple_launcher.py")
    launcher_path.write_text(launcher_content)
    print(f"✅ Created launcher: {launcher_path}")
    
    # Build EXE
    print("\n🔨 Building simple EXE...")
    try:
        cmd = [
            sys.executable, '-m', 'PyInstaller',
            '--onefile',
            '--windowed',
            '--name', 'AfarensisEnterprise-Simple-Launcher',
            '--icon=afarensis_icon.ico' if Path('afarensis_icon.ico').exists() else '',
            str(launcher_path)
        ]
        
        # Remove empty icon parameter if no icon exists
        cmd = [arg for arg in cmd if arg]
        
        subprocess.run(cmd, check=True)
        print("✅ Simple EXE built successfully!")
        
        if Path("dist/AfarensisEnterprise-Simple-Launcher.exe").exists():
            print("\n🎉 SUCCESS!")
            print("📁 Location: dist/AfarensisEnterprise-Simple-Launcher.exe")
            print("\n🚀 This lightweight EXE will:")
            print("• Launch Docker services")
            print("• Provide setup instructions")
            print("• Test API connections")
            print("• Open your browser to the application")
            print("\n✅ No SSL certificate issues!")
            return True
        else:
            print("❌ EXE not found after build")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        return False
    except FileNotFoundError:
        print("❌ PyInstaller not found")
        print("Try: pip install --trusted-host pypi.org pyinstaller")
        return False

if __name__ == "__main__":
    success = simple_exe_build()
    
    if not success:
        print("\n💡 Alternative: Use the included setup simulator")
        print("   python AfarensisEnterprise-v2.1-Setup-SIMULATOR.py")
    
    input("\nPress Enter to exit...")
