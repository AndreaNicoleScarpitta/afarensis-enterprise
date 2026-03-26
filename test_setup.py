#!/usr/bin/env python3
"""
Test script for Afarensis Enterprise Setup
Validates that all components can be built and work properly
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

def test_build_environment():
    """Test that the build environment is ready"""
    print("🧪 Testing build environment...")
    
    # Test Python
    try:
        result = subprocess.run([sys.executable, '--version'], 
                              capture_output=True, text=True, timeout=10)
        print(f"✅ Python: {result.stdout.strip()}")
    except Exception as e:
        print(f"❌ Python test failed: {e}")
        return False
    
    # Test pip
    try:
        result = subprocess.run([sys.executable, '-m', 'pip', '--version'], 
                              capture_output=True, text=True, timeout=10)
        print(f"✅ Pip available")
    except Exception as e:
        print(f"❌ Pip test failed: {e}")
        return False
    
    return True

def test_setup_script():
    """Test that the setup script can run without errors"""
    print("🧪 Testing setup script...")
    
    try:
        # Test import of the setup script
        import importlib.util
        spec = importlib.util.spec_from_file_location("afarensis_setup", "afarensis_setup.py")
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            print("✅ Setup script imports successfully")
            return True
        else:
            print("❌ Could not load setup script")
            return False
            
    except Exception as e:
        print(f"❌ Setup script test failed: {e}")
        return False

def test_project_structure():
    """Test that all required files are present"""
    print("🧪 Testing project structure...")
    
    required_files = [
        'afarensis_setup.py',
        'afarensis_setup.spec',
        'build_exe.py',
        'build_setup_exe.bat',
        'build_setup_exe.ps1',
        'setup_requirements.txt',
        'BUILD_README.md'
    ]
    
    required_dirs = [
        'backend',
        'frontend',
        'scripts'
    ]
    
    missing_files = []
    missing_dirs = []
    
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    for dir_path in required_dirs:
        if not Path(dir_path).exists():
            missing_dirs.append(dir_path)
    
    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return False
    else:
        print("✅ All required files present")
    
    if missing_dirs:
        print(f"❌ Missing directories: {missing_dirs}")
        return False
    else:
        print("✅ All required directories present")
    
    return True

def test_docker_compose():
    """Test that Docker Compose file is valid"""
    print("🧪 Testing Docker Compose configuration...")
    
    try:
        result = subprocess.run(['docker-compose', 'config'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ Docker Compose configuration valid")
            return True
        else:
            print(f"❌ Docker Compose validation failed: {result.stderr}")
            return False
    except FileNotFoundError:
        print("⚠️ Docker Compose not available - this is OK for .exe distribution")
        return True
    except Exception as e:
        print(f"❌ Docker Compose test failed: {e}")
        return False

def test_build_process():
    """Test the build process (without actually building to save time)"""
    print("🧪 Testing build process components...")
    
    # Test PyInstaller spec file
    try:
        with open('afarensis_setup.spec', 'r') as f:
            spec_content = f.read()
            if 'Analysis' in spec_content and 'EXE' in spec_content:
                print("✅ PyInstaller spec file valid")
            else:
                print("❌ PyInstaller spec file invalid")
                return False
    except Exception as e:
        print(f"❌ Spec file test failed: {e}")
        return False
    
    return True

def generate_test_report():
    """Generate a test report"""
    print("\n" + "="*50)
    print("🧪 AFARENSIS ENTERPRISE SETUP - TEST REPORT")
    print("="*50)
    
    tests = [
        ("Build Environment", test_build_environment),
        ("Project Structure", test_project_structure), 
        ("Setup Script", test_setup_script),
        ("Docker Configuration", test_docker_compose),
        ("Build Process", test_build_process)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*50)
    print("📊 TEST RESULTS SUMMARY")
    print("="*50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Ready to build .exe!")
        print("\nNext steps:")
        print("1. Run: build_setup_exe.bat")
        print("2. Distribute: dist/AfarensisEnterprise-Setup.exe")
        return True
    else:
        print(f"\n⚠️ {total-passed} tests failed - Fix issues before building")
        return False

def main():
    """Main test function"""
    print("🚀 Afarensis Enterprise Setup - Test Suite")
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    success = generate_test_report()
    
    if not success:
        print("\n❌ Some tests failed. Please fix the issues above.")
        sys.exit(1)
    else:
        print("\n✅ All systems ready for .exe creation!")
        sys.exit(0)

if __name__ == "__main__":
    main()
