#!/usr/bin/env python3
"""
Afarensis Enterprise v2.1 - Deployment Verification Script
Validates that all critical fixes are properly applied before deployment
"""

import os
import sys
import json
from pathlib import Path

def check_file_exists(filepath, description):
    """Check if a file exists and report status"""
    if os.path.exists(filepath):
        print(f"✅ {description}: {filepath}")
        return True
    else:
        print(f"❌ {description}: {filepath} - NOT FOUND")
        return False

def check_file_contains(filepath, content, description):
    """Check if a file contains specific content"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            file_content = f.read()
            if content in file_content:
                print(f"✅ {description}: VERIFIED")
                return True
            else:
                print(f"❌ {description}: NOT FOUND")
                return False
    except Exception as e:
        print(f"❌ {description}: ERROR - {e}")
        return False

def main():
    """Main verification routine"""
    print("="*60)
    print("AFARENSIS ENTERPRISE v2.1 - DEPLOYMENT VERIFICATION")
    print("="*60)
    
    issues = []
    
    # Check critical backend files
    print("\n🔧 BACKEND INFRASTRUCTURE")
    if not check_file_exists("backend/requirements.txt", "Requirements file"):
        issues.append("Missing requirements.txt")
    
    if not check_file_contains("backend/requirements.txt", "bcrypt==4.0.1", "bcrypt version pinning"):
        issues.append("bcrypt version not pinned")
        
    if not check_file_contains("backend/requirements.txt", "httpx==0.28.1", "httpx version unification"):
        issues.append("httpx version not unified")
    
    if not check_file_exists("backend/app/core/security.py", "Security module"):
        issues.append("Missing security module")
        
    if not check_file_contains("backend/app/core/security.py", "bcrypt.checkpw", "Direct bcrypt usage"):
        issues.append("Security module not using direct bcrypt")
    
    # Check Docker configuration
    print("\n🐳 DOCKER CONFIGURATION")
    if not check_file_exists("docker-compose.yml", "Docker Compose file"):
        issues.append("Missing docker-compose.yml")
        
    if not check_file_contains("docker-compose.yml", "service_completed_successfully", "Migration dependency fix"):
        issues.append("Migration dependency not fixed")
        
    if not check_file_contains("docker-compose.yml", "maxmemory 256mb", "Redis memory limit"):
        issues.append("Redis memory limit not configured")
    
    if not check_file_exists("nginx/nginx.conf", "Nginx configuration"):
        issues.append("Missing nginx.conf")
        
    if not check_file_contains("nginx/nginx.conf", "proxy_http_version 1.1", "WebSocket support"):
        issues.append("Nginx WebSocket support not configured")
    
    # Check PyInstaller configuration
    print("\n📦 PYINSTALLER CONFIGURATION")
    if not check_file_exists("afarensis_setup.spec", "PyInstaller spec"):
        issues.append("Missing PyInstaller spec")
        
    if not check_file_contains("afarensis_setup.spec", "pydantic_core._pydantic_core", "Pydantic core imports"):
        issues.append("PyInstaller missing Pydantic core imports")
        
    if not check_file_contains("afarensis_setup.spec", "collect_submodules", "Dynamic import collection"):
        issues.append("PyInstaller missing dynamic imports")
    
    # Check frontend files
    print("\n⚛️ FRONTEND APPLICATION")
    if not check_file_exists("frontend/src/services/apiClient.ts", "API client"):
        issues.append("Missing API client")
        
    if not check_file_contains("frontend/src/services/apiClient.ts", "import { z }", "Zod validation"):
        issues.append("API client missing Zod validation")
        
    if not check_file_exists("frontend/src/services/hooks.ts", "React hooks"):
        issues.append("Missing React hooks")
        
    if not check_file_contains("frontend/src/services/hooks.ts", "AbortController", "Race condition prevention"):
        issues.append("Hooks missing race condition prevention")
    
    if not check_file_exists("frontend/src/App.tsx", "App component"):
        issues.append("Missing App component")
        
    if not check_file_contains("frontend/src/App.tsx", "useAuth", "Authentication integration"):
        issues.append("App component missing authentication")
    
    # Check environment configuration
    print("\n⚙️ ENVIRONMENT CONFIGURATION")
    env_files = [".env.example", ".env.production", ".env.development"]
    for env_file in env_files:
        if not check_file_exists(env_file, f"Environment file {env_file}"):
            issues.append(f"Missing {env_file}")
        else:
            if not check_file_contains(env_file, "ANTHROPIC_API_KEY=sk-ant-api03", "Production API keys"):
                issues.append(f"{env_file} missing production API keys")
    
    # Check documentation
    print("\n📚 DOCUMENTATION")
    docs = [
        "RELEASE_NOTES.md",
        "DEPLOYMENT-GUIDE-COMPREHENSIVE-FIXES.md", 
        "STRESS_TEST_RESULTS_2026_03_15.md",
        "README.md"
    ]
    for doc in docs:
        if not check_file_exists(doc, f"Documentation {doc}"):
            issues.append(f"Missing {doc}")
    
    # Final assessment
    print("\n" + "="*60)
    print("DEPLOYMENT VERIFICATION RESULTS")
    print("="*60)
    
    if not issues:
        print("🎉 ALL CHECKS PASSED - READY FOR DEPLOYMENT!")
        print("\nNext steps:")
        print("1. Run: docker-compose up ssl-generator")
        print("2. Run: docker-compose up -d")
        print("3. Access: http://localhost:3000")
        print("4. Login: admin@afarensis.com / admin123")
        return True
    else:
        print(f"❌ {len(issues)} ISSUES FOUND:")
        for i, issue in enumerate(issues, 1):
            print(f"   {i}. {issue}")
        print("\nPlease resolve these issues before deployment.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
