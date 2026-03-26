#!/usr/bin/env python3
"""
Complete System Setup Script for Afarensis Enterprise

This script performs a complete setup of the Afarensis Enterprise system,
including environment validation, database initialization, and verification.

Usage:
    python scripts/setup_system.py                    # Interactive setup
    python scripts/setup_system.py --auto            # Automated setup with defaults
    python scripts/setup_system.py --docker          # Docker-based setup
    python scripts/setup_system.py --verify-only     # Just verify existing setup
"""

import sys
import os
import subprocess
import asyncio
import argparse
import json
from pathlib import Path
from datetime import datetime

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))


class SystemSetup:
    def __init__(self, auto_mode=False, docker_mode=False):
        self.auto_mode = auto_mode
        self.docker_mode = docker_mode
        self.setup_log = []
        self.start_time = datetime.now()
    
    def log(self, message, level="INFO"):
        """Log a setup step."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {level}: {message}"
        print(log_entry)
        self.setup_log.append(log_entry)
    
    def run_script(self, script_name, args=None, description=None):
        """Run another setup script."""
        if description:
            self.log(f"Running {description}...")
        
        script_path = Path(__file__).parent / script_name
        cmd = ["python", str(script_path)]
        if args:
            cmd.extend(args)
        
        try:
            result = subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                self.log(f"✅ {script_name} completed successfully")
                if description:
                    self.log(f"   Output: {result.stdout.strip()}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"❌ {script_name} failed: {e.stderr.strip()}", "ERROR")
            return False
    
    async def check_prerequisites(self):
        """Check system prerequisites."""
        self.log("🔍 Checking system prerequisites...")
        
        checks = [
            ("Python version", self.check_python_version),
            ("PostgreSQL", self.check_postgresql),
            ("Redis", self.check_redis),
            ("Node.js", self.check_nodejs),
            ("Docker", self.check_docker) if self.docker_mode else None
        ]
        
        all_good = True
        for check_name, check_func in filter(None, checks):
            if check_func:
                if await check_func():
                    self.log(f"   ✅ {check_name}")
                else:
                    self.log(f"   ❌ {check_name}", "ERROR")
                    all_good = False
        
        return all_good
    
    def check_python_version(self):
        """Check Python version."""
        version = sys.version_info
        if version.major >= 3 and version.minor >= 9:
            return True
        else:
            self.log(f"   Python {version.major}.{version.minor} found, but 3.9+ required", "ERROR")
            return False
    
    def check_postgresql(self):
        """Check if PostgreSQL is accessible."""
        try:
            result = subprocess.run(
                ["pg_isready", "-h", "localhost"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            self.log("   PostgreSQL client tools not found", "ERROR")
            return False
    
    def check_redis(self):
        """Check if Redis is accessible."""
        try:
            result = subprocess.run(
                ["redis-cli", "ping"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return "PONG" in result.stdout
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def check_nodejs(self):
        """Check if Node.js is available."""
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True
            )
            version = result.stdout.strip()
            # Extract major version (e.g., "v18.17.0" -> 18)
            major_version = int(version.split('.')[0][1:])
            return major_version >= 16
        except (FileNotFoundError, ValueError):
            return False
    
    def check_docker(self):
        """Check if Docker is available."""
        try:
            result = subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False
    
    def setup_environment(self):
        """Set up environment configuration."""
        self.log("🔧 Setting up environment configuration...")
        
        env_file = Path(".env")
        if env_file.exists() and not self.auto_mode:
            response = input("🤔 .env file exists. Overwrite? (y/N): ")
            if response.lower() != 'y':
                self.log("   Using existing .env file")
                return True
        
        # Generate .env template
        success = self.run_script(
            "validate_env.py",
            ["--template"],
            "environment template generation"
        )
        
        if success:
            # In auto mode, create a basic .env with defaults
            if self.auto_mode:
                self.create_default_env()
            else:
                self.log("📝 Please edit .env.template and save as .env")
                self.log("   Configure your database, Redis, and API keys")
                input("Press Enter when ready to continue...")
        
        return success
    
    def create_default_env(self):
        """Create a default .env file for automated setup."""
        self.log("   Creating default .env configuration...")
        
        import secrets
        
        env_content = f'''# Afarensis Enterprise Configuration - Auto-generated
DATABASE_URL=postgresql://afarensis_user:secure_password@localhost:5432/afarensis_enterprise
REDIS_HOST=localhost
REDIS_PORT=6379
SECRET_KEY={secrets.token_urlsafe(32)}
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
ENVIRONMENT=development
DEBUG=true
UPLOAD_PATH=/tmp/afarensis_uploads
LOG_PATH=/tmp/afarensis_logs
'''
        
        Path(".env").write_text(env_content)
        self.log("   ✅ Default .env file created")
    
    def validate_environment(self):
        """Validate environment configuration."""
        self.log("✅ Validating environment configuration...")
        
        return self.run_script(
            "validate_env.py",
            ["--fix"],
            "environment validation"
        )
    
    def initialize_database(self):
        """Initialize the database."""
        self.log("🗄️  Initializing database...")
        
        args = []
        if self.auto_mode:
            args.append("--seed")
        
        return self.run_script(
            "init_database.py",
            args,
            "database initialization"
        )
    
    def create_admin_user(self):
        """Create admin user."""
        self.log("👤 Creating admin user...")
        
        if self.auto_mode:
            # Create with default credentials in auto mode
            args = [
                "--email", "admin@afarensis.local",
                "--name", "System Administrator",
                "--password", "admin123!",
                "--organization", "Afarensis Enterprise"
            ]
            
            success = self.run_script(
                "create_admin.py",
                args,
                "admin user creation"
            )
            
            if success:
                self.log("   🔑 Default admin credentials:")
                self.log("   📧 Email: admin@afarensis.local")
                self.log("   🔐 Password: admin123!")
                self.log("   ⚠️  Change password after first login!")
            
            return success
        else:
            return self.run_script(
                "create_admin.py",
                ["--interactive"],
                "interactive admin user creation"
            )
    
    def install_dependencies(self):
        """Install Python and Node.js dependencies."""
        self.log("📦 Installing dependencies...")
        
        # Backend dependencies
        self.log("   Installing Python dependencies...")
        backend_dir = Path(__file__).parent.parent / "backend"
        
        pip_cmd = [
            sys.executable, "-m", "pip", "install", 
            "-r", str(backend_dir / "requirements.txt"),
            "--break-system-packages"
        ]
        
        try:
            subprocess.run(pip_cmd, check=True, capture_output=True)
            self.log("   ✅ Python dependencies installed")
        except subprocess.CalledProcessError as e:
            self.log(f"   ❌ Failed to install Python dependencies: {e}", "ERROR")
            return False
        
        # Frontend dependencies (if Node.js is available)
        if self.check_nodejs():
            self.log("   Installing Node.js dependencies...")
            frontend_dir = Path(__file__).parent.parent / "frontend"
            
            try:
                subprocess.run(
                    ["npm", "install"],
                    cwd=frontend_dir,
                    check=True,
                    capture_output=True
                )
                self.log("   ✅ Node.js dependencies installed")
            except subprocess.CalledProcessError as e:
                self.log(f"   ❌ Failed to install Node.js dependencies: {e}", "ERROR")
                return False
        
        return True
    
    def run_tests(self):
        """Run basic system tests."""
        self.log("🧪 Running system tests...")
        
        return self.run_script(
            "run_tests.py",
            ["--fast", "--unit"],
            "basic system tests"
        )
    
    def perform_health_check(self):
        """Perform comprehensive health check."""
        self.log("🏥 Performing health check...")
        
        return self.run_script(
            "health_check.py",
            ["--verbose"],
            "system health check"
        )
    
    def start_services(self):
        """Start the application services."""
        if self.docker_mode:
            self.log("🐳 Starting services with Docker Compose...")
            
            try:
                subprocess.run(
                    ["docker-compose", "up", "-d"],
                    check=True,
                    capture_output=True
                )
                self.log("   ✅ Docker services started")
                return True
            except subprocess.CalledProcessError as e:
                self.log(f"   ❌ Failed to start Docker services: {e}", "ERROR")
                return False
        else:
            self.log("🚀 Setup complete! To start the services manually:")
            self.log("   Backend:  cd backend && uvicorn app.main:app --reload")
            self.log("   Frontend: cd frontend && npm run dev")
            self.log("   Celery:   cd backend && celery -A app.tasks worker --loglevel=info")
            return True
    
    def generate_setup_report(self):
        """Generate a setup report."""
        duration = datetime.now() - self.start_time
        
        report = {
            "setup_completed": True,
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": duration.total_seconds(),
            "mode": "auto" if self.auto_mode else "interactive",
            "docker_mode": self.docker_mode,
            "setup_log": self.setup_log
        }
        
        report_file = Path("setup_report.json")
        report_file.write_text(json.dumps(report, indent=2))
        
        self.log(f"📊 Setup report saved to {report_file}")
        
        # Print summary
        self.log("\n🎉 Afarensis Enterprise Setup Complete!")
        self.log(f"   Duration: {duration.total_seconds():.1f} seconds")
        self.log(f"   Mode: {'Automated' if self.auto_mode else 'Interactive'}")
        
        if self.auto_mode:
            self.log("\n🔑 Default Admin Credentials:")
            self.log("   📧 Email: admin@afarensis.local")
            self.log("   🔐 Password: admin123!")
            self.log("   ⚠️  IMPORTANT: Change password after first login!")
        
        self.log("\n📚 Next Steps:")
        self.log("   1. Review configuration in .env file")
        self.log("   2. Start the application services")
        self.log("   3. Access the web interface")
        self.log("   4. Complete initial configuration")
        
        return True
    
    async def run_complete_setup(self):
        """Run the complete setup process."""
        self.log("🚀 Starting Afarensis Enterprise System Setup")
        self.log("=" * 50)
        
        steps = [
            ("Prerequisites", self.check_prerequisites),
            ("Dependencies", self.install_dependencies),
            ("Environment", self.setup_environment),
            ("Environment Validation", self.validate_environment),
            ("Database", self.initialize_database),
            ("Admin User", self.create_admin_user),
            ("Health Check", self.perform_health_check),
            ("Services", self.start_services)
        ]
        
        if not self.auto_mode:
            steps.insert(-2, ("Tests", self.run_tests))
        
        for step_name, step_func in steps:
            self.log(f"\n📋 Step: {step_name}")
            
            if asyncio.iscoroutinefunction(step_func):
                success = await step_func()
            else:
                success = step_func()
            
            if not success:
                self.log(f"❌ Setup failed at step: {step_name}", "ERROR")
                return False
        
        self.generate_setup_report()
        return True


async def main():
    parser = argparse.ArgumentParser(description="Complete Afarensis Enterprise system setup")
    parser.add_argument("--auto", action="store_true", help="Automated setup with defaults")
    parser.add_argument("--docker", action="store_true", help="Docker-based setup")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing setup")
    
    args = parser.parse_args()
    
    setup = SystemSetup(auto_mode=args.auto, docker_mode=args.docker)
    
    if args.verify_only:
        print("🔍 Verifying Afarensis Enterprise Setup")
        print("=" * 40)
        
        # Run verification steps
        prereqs_ok = await setup.check_prerequisites()
        env_ok = setup.validate_environment()
        health_ok = setup.perform_health_check()
        
        if prereqs_ok and env_ok and health_ok:
            print("\n✅ System verification passed!")
            sys.exit(0)
        else:
            print("\n❌ System verification failed!")
            sys.exit(1)
    
    # Run complete setup
    success = await setup.run_complete_setup()
    
    if success:
        print("\n🎊 Setup completed successfully!")
        sys.exit(0)
    else:
        print("\n💥 Setup failed!")
        print("Check the setup log above for details.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
