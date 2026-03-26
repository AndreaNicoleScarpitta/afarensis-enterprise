#!/usr/bin/env python3
"""
Test Runner Script for Afarensis Enterprise

This script provides convenient test execution with different options.

Usage:
    python scripts/run_tests.py                 # Run all tests
    python scripts/run_tests.py --unit          # Run unit tests only
    python scripts/run_tests.py --integration   # Run integration tests only
    python scripts/run_tests.py --fast          # Run fast tests only (exclude slow)
    python scripts/run_tests.py --coverage      # Run with detailed coverage report
    python scripts/run_tests.py --parallel      # Run tests in parallel
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))


def run_command(cmd, cwd=None):
    """Run a shell command and return the result."""
    try:
        print(f"🏃 Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        return result.returncode
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed with exit code {e.returncode}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return e.returncode


def check_dependencies():
    """Check that required test dependencies are installed."""
    required_packages = [
        "pytest",
        "pytest-asyncio", 
        "pytest-cov",
        "httpx",
        "pytest-xdist"  # for parallel execution
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required test packages: {', '.join(missing_packages)}")
        print(f"💡 Install with: pip install {' '.join(missing_packages)}")
        return False
    
    return True


def setup_test_database():
    """Set up the test database."""
    print("🗄️  Setting up test database...")
    
    # Check if PostgreSQL is running
    pg_check = subprocess.run(
        ["pg_isready", "-h", "localhost"],
        capture_output=True
    )
    
    if pg_check.returncode != 0:
        print("❌ PostgreSQL is not running. Please start PostgreSQL first.")
        return False
    
    # Create test database if it doesn't exist
    create_db_cmd = [
        "createdb",
        "-h", "localhost",
        "-U", "postgres",
        "afarensis_test",
        "--if-not-exists"
    ]
    
    subprocess.run(create_db_cmd, capture_output=True)
    print("✅ Test database ready")
    return True


def cleanup_test_database():
    """Clean up the test database after tests."""
    print("🧹 Cleaning up test database...")
    
    drop_db_cmd = [
        "dropdb",
        "-h", "localhost", 
        "-U", "postgres",
        "afarensis_test",
        "--if-exists"
    ]
    
    subprocess.run(drop_db_cmd, capture_output=True)
    print("✅ Test database cleaned up")


def main():
    parser = argparse.ArgumentParser(description="Run Afarensis Enterprise tests")
    parser.add_argument("--unit", action="store_true", help="Run unit tests only")
    parser.add_argument("--integration", action="store_true", help="Run integration tests only")
    parser.add_argument("--e2e", action="store_true", help="Run end-to-end tests only")
    parser.add_argument("--fast", action="store_true", help="Skip slow tests")
    parser.add_argument("--coverage", action="store_true", help="Generate detailed coverage report")
    parser.add_argument("--parallel", action="store_true", help="Run tests in parallel")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--no-cleanup", action="store_true", help="Don't cleanup test database")
    parser.add_argument("--pattern", "-k", help="Run tests matching pattern")
    parser.add_argument("--file", help="Run specific test file")
    
    args = parser.parse_args()
    
    print("🧪 Afarensis Enterprise Test Runner")
    print("=" * 40)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Set up test database
    if not setup_test_database():
        sys.exit(1)
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent / "backend"
    os.chdir(backend_dir)
    
    # Build pytest command
    pytest_cmd = ["python", "-m", "pytest"]
    
    # Add markers based on arguments
    if args.unit:
        pytest_cmd.extend(["-m", "unit"])
    elif args.integration:
        pytest_cmd.extend(["-m", "integration"])
    elif args.e2e:
        pytest_cmd.extend(["-m", "e2e"])
    
    # Add other options
    if args.fast:
        pytest_cmd.extend(["-m", "not slow"])
    
    if args.coverage:
        pytest_cmd.extend([
            "--cov=app",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov",
            "--cov-report=xml:coverage.xml"
        ])
    
    if args.parallel:
        pytest_cmd.extend(["-n", "auto"])  # Auto-detect number of CPUs
    
    if args.verbose:
        pytest_cmd.append("-v")
    
    if args.pattern:
        pytest_cmd.extend(["-k", args.pattern])
    
    if args.file:
        pytest_cmd.append(args.file)
    else:
        pytest_cmd.append("tests/")
    
    # Add default options
    pytest_cmd.extend([
        "--tb=short",
        "--strict-markers",
        "--strict-config"
    ])
    
    try:
        # Run the tests
        exit_code = run_command(pytest_cmd, cwd=backend_dir)
        
        if exit_code == 0:
            print("\n🎉 All tests passed!")
            
            if args.coverage:
                print("\n📊 Coverage report generated:")
                print("   - Terminal: See output above")
                print("   - HTML: Open htmlcov/index.html")
                print("   - XML: coverage.xml")
        else:
            print(f"\n💥 Tests failed with exit code {exit_code}")
        
        return exit_code
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 130
    
    finally:
        # Cleanup unless requested not to
        if not args.no_cleanup:
            cleanup_test_database()


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
