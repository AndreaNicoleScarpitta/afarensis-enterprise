#!/usr/bin/env python3
"""
System Health Check Script for Afarensis Enterprise

This script performs comprehensive health checks on all system components.

Usage:
    python scripts/health_check.py              # Full health check
    python scripts/health_check.py --quick      # Quick check (basic connectivity)
    python scripts/health_check.py --verbose    # Detailed output
    python scripts/health_check.py --json       # JSON output for monitoring
"""

import sys
import os
import asyncio
import argparse
import json
import time
from pathlib import Path
from datetime import datetime
import subprocess

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.database import engine
import redis
import httpx


class HealthChecker:
    def __init__(self, verbose=False):
        self.verbose = verbose
        self.results = {}
        self.start_time = time.time()
    
    def log(self, message, level="INFO"):
        """Log a message if verbose mode is enabled"""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {level}: {message}")
    
    async def check_database(self):
        """Check PostgreSQL database connectivity and performance"""
        self.log("Checking database connectivity...")
        
        try:
            start_time = time.time()
            
            async with engine.begin() as conn:
                # Test basic connectivity
                await conn.execute("SELECT 1")
                
                # Check if key tables exist
                from sqlalchemy import text
                tables_check = await conn.execute(
                    text("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name IN ('users', 'projects', 'evidence_records')
                    """)
                )
                tables = [row[0] for row in tables_check.fetchall()]
                
                # Performance check - simple query
                perf_start = time.time()
                await conn.execute("SELECT COUNT(*) FROM users")
                query_time = (time.time() - perf_start) * 1000  # Convert to ms
                
            connection_time = (time.time() - start_time) * 1000
            
            self.results['database'] = {
                "status": "healthy",
                "connection_time_ms": round(connection_time, 2),
                "query_performance_ms": round(query_time, 2),
                "tables_found": len(tables),
                "expected_tables": 3,
                "details": {
                    "engine": str(engine.url).split('@')[0] + "@[HIDDEN]",
                    "tables": tables
                }
            }
            
            self.log(f"Database healthy - Connection: {connection_time:.1f}ms")
            
        except Exception as e:
            self.results['database'] = {
                "status": "unhealthy",
                "error": str(e),
                "details": {"engine_url": str(engine.url).split('@')[0] + "@[HIDDEN]"}
            }
            self.log(f"Database check failed: {str(e)}", "ERROR")
    
    def check_redis(self):
        """Check Redis connectivity and performance"""
        self.log("Checking Redis connectivity...")
        
        try:
            start_time = time.time()
            
            # Connect to Redis
            redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=getattr(settings, 'REDIS_PASSWORD', None),
                decode_responses=True
            )
            
            # Test basic operations
            test_key = "health_check_test"
            redis_client.set(test_key, "test_value", ex=30)  # Expires in 30 seconds
            retrieved_value = redis_client.get(test_key)
            redis_client.delete(test_key)
            
            # Get Redis info
            redis_info = redis_client.info()
            
            connection_time = (time.time() - start_time) * 1000
            
            self.results['redis'] = {
                "status": "healthy",
                "connection_time_ms": round(connection_time, 2),
                "version": redis_info.get('redis_version', 'unknown'),
                "memory_usage_mb": round(redis_info.get('used_memory', 0) / 1024 / 1024, 2),
                "connected_clients": redis_info.get('connected_clients', 0),
                "details": {
                    "host": settings.REDIS_HOST,
                    "port": settings.REDIS_PORT,
                    "test_operation": "success" if retrieved_value == "test_value" else "failed"
                }
            }
            
            self.log(f"Redis healthy - Connection: {connection_time:.1f}ms")
            
        except Exception as e:
            self.results['redis'] = {
                "status": "unhealthy",
                "error": str(e),
                "details": {
                    "host": settings.REDIS_HOST,
                    "port": settings.REDIS_PORT
                }
            }
            self.log(f"Redis check failed: {str(e)}", "ERROR")
    
    def check_file_system(self):
        """Check file system accessibility and permissions"""
        self.log("Checking file system...")
        
        try:
            # Check if we can write to critical directories
            write_tests = []
            
            # Test backend directory
            backend_dir = Path(__file__).parent.parent / "backend"
            if backend_dir.exists():
                test_file = backend_dir / "health_check_test.tmp"
                try:
                    test_file.write_text("test")
                    test_file.unlink()
                    write_tests.append({"path": "backend", "writable": True})
                except:
                    write_tests.append({"path": "backend", "writable": False})
            
            # Test logs directory (create if needed)
            logs_dir = Path("/tmp/afarensis_logs")
            logs_dir.mkdir(exist_ok=True)
            test_file = logs_dir / "health_check_test.tmp"
            try:
                test_file.write_text("test")
                test_file.unlink()
                write_tests.append({"path": "logs", "writable": True})
            except:
                write_tests.append({"path": "logs", "writable": False})
            
            # Check disk space
            import shutil
            disk_usage = shutil.disk_usage("/")
            free_space_gb = disk_usage.free / (1024**3)
            
            all_writable = all(test["writable"] for test in write_tests)
            
            self.results['filesystem'] = {
                "status": "healthy" if all_writable and free_space_gb > 1 else "warning",
                "free_space_gb": round(free_space_gb, 2),
                "write_tests": write_tests,
                "details": {
                    "total_space_gb": round(disk_usage.total / (1024**3), 2),
                    "used_space_gb": round(disk_usage.used / (1024**3), 2)
                }
            }
            
            self.log(f"File system check - Free space: {free_space_gb:.1f}GB")
            
        except Exception as e:
            self.results['filesystem'] = {
                "status": "unhealthy",
                "error": str(e)
            }
            self.log(f"File system check failed: {str(e)}", "ERROR")
    
    def check_environment_variables(self):
        """Check critical environment variables"""
        self.log("Checking environment variables...")
        
        try:
            required_vars = [
                'DATABASE_URL',
                'REDIS_HOST',
                'REDIS_PORT',
                'SECRET_KEY'
            ]
            
            optional_vars = [
                'OPENAI_API_KEY',
                'ANTHROPIC_API_KEY',
                'SMTP_HOST',
                'SMTP_PORT'
            ]
            
            missing_required = []
            missing_optional = []
            configured_vars = []
            
            for var in required_vars:
                if hasattr(settings, var.lower()) and getattr(settings, var.lower()):
                    configured_vars.append(var)
                else:
                    missing_required.append(var)
            
            for var in optional_vars:
                if hasattr(settings, var.lower()) and getattr(settings, var.lower()):
                    configured_vars.append(var)
                else:
                    missing_optional.append(var)
            
            self.results['environment'] = {
                "status": "healthy" if not missing_required else "unhealthy",
                "configured_variables": len(configured_vars),
                "missing_required": missing_required,
                "missing_optional": missing_optional,
                "details": {
                    "configured": configured_vars,
                    "environment": getattr(settings, 'environment', 'unknown')
                }
            }
            
            self.log(f"Environment check - {len(configured_vars)} variables configured")
            
        except Exception as e:
            self.results['environment'] = {
                "status": "unhealthy", 
                "error": str(e)
            }
            self.log(f"Environment check failed: {str(e)}", "ERROR")
    
    def check_dependencies(self):
        """Check Python dependencies and versions"""
        self.log("Checking Python dependencies...")
        
        try:
            import pkg_resources
            
            critical_packages = [
                'fastapi',
                'sqlalchemy',
                'celery',
                'redis',
                'asyncpg'
            ]
            
            package_info = []
            missing_packages = []
            
            for package in critical_packages:
                try:
                    version = pkg_resources.get_distribution(package).version
                    package_info.append({"name": package, "version": version, "status": "installed"})
                except pkg_resources.DistributionNotFound:
                    missing_packages.append(package)
                    package_info.append({"name": package, "version": None, "status": "missing"})
            
            # Check Python version
            python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            
            self.results['dependencies'] = {
                "status": "healthy" if not missing_packages else "unhealthy",
                "python_version": python_version,
                "packages": package_info,
                "missing_packages": missing_packages
            }
            
            self.log(f"Dependencies check - Python {python_version}, {len(package_info)} packages checked")
            
        except Exception as e:
            self.results['dependencies'] = {
                "status": "unhealthy",
                "error": str(e)
            }
            self.log(f"Dependencies check failed: {str(e)}", "ERROR")
    
    async def check_api_endpoints(self):
        """Check if API endpoints are accessible (if server is running)"""
        self.log("Checking API endpoints...")
        
        try:
            # Try to connect to the local API server
            api_url = getattr(settings, 'api_url', 'http://localhost:8000')
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Test health endpoint
                health_response = await client.get(f"{api_url}/health")
                health_status = health_response.status_code == 200
                
                # Test API documentation
                docs_response = await client.get(f"{api_url}/docs")
                docs_status = docs_response.status_code == 200
                
            self.results['api'] = {
                "status": "healthy" if health_status else "warning",
                "health_endpoint": health_status,
                "docs_endpoint": docs_status,
                "api_url": api_url,
                "details": {
                    "health_status_code": health_response.status_code,
                    "docs_status_code": docs_response.status_code
                }
            }
            
            self.log(f"API endpoints check - Server accessible at {api_url}")
            
        except httpx.ConnectError:
            self.results['api'] = {
                "status": "offline",
                "health_endpoint": False,
                "docs_endpoint": False,
                "api_url": getattr(settings, 'api_url', 'http://localhost:8000'),
                "details": {"error": "Server not running or not accessible"}
            }
            self.log("API endpoints check - Server not running", "WARNING")
            
        except Exception as e:
            self.results['api'] = {
                "status": "unhealthy",
                "error": str(e)
            }
            self.log(f"API endpoints check failed: {str(e)}", "ERROR")
    
    def generate_summary(self):
        """Generate overall health summary"""
        total_checks = len(self.results)
        healthy_checks = len([r for r in self.results.values() if r.get('status') == 'healthy'])
        warning_checks = len([r for r in self.results.values() if r.get('status') == 'warning'])
        unhealthy_checks = len([r for r in self.results.values() if r.get('status') in ['unhealthy', 'offline']])
        
        if unhealthy_checks > 0:
            overall_status = "unhealthy"
        elif warning_checks > 0:
            overall_status = "warning"
        else:
            overall_status = "healthy"
        
        execution_time = round((time.time() - self.start_time) * 1000, 2)
        
        summary = {
            "overall_status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "execution_time_ms": execution_time,
            "checks": {
                "total": total_checks,
                "healthy": healthy_checks,
                "warning": warning_checks,
                "unhealthy": unhealthy_checks
            },
            "components": self.results
        }
        
        return summary


async def main():
    parser = argparse.ArgumentParser(description="Afarensis Enterprise health check")
    parser.add_argument("--quick", action="store_true", help="Quick check (basic connectivity only)")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--json", action="store_true", help="JSON output")
    
    args = parser.parse_args()
    
    if not args.json:
        print("🏥 Afarensis Enterprise Health Check")
        print("=" * 40)
    
    checker = HealthChecker(verbose=args.verbose and not args.json)
    
    # Run health checks
    if args.quick:
        await checker.check_database()
        checker.check_redis()
    else:
        await checker.check_database()
        checker.check_redis()
        checker.check_file_system()
        checker.check_environment_variables()
        checker.check_dependencies()
        await checker.check_api_endpoints()
    
    # Generate and display results
    summary = checker.generate_summary()
    
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(f"\n📊 Health Check Results")
        print(f"Overall Status: {summary['overall_status'].upper()}")
        print(f"Execution Time: {summary['execution_time_ms']}ms")
        print(f"Components: {summary['checks']['healthy']}/{summary['checks']['total']} healthy")
        
        if summary['checks']['unhealthy'] > 0:
            print(f"\n❌ Unhealthy Components:")
            for name, result in summary['components'].items():
                if result.get('status') in ['unhealthy', 'offline']:
                    print(f"   - {name}: {result.get('error', result.get('status'))}")
        
        if summary['checks']['warning'] > 0:
            print(f"\n⚠️  Warnings:")
            for name, result in summary['components'].items():
                if result.get('status') == 'warning':
                    print(f"   - {name}: Check details for issues")
    
    # Exit with appropriate code
    if summary['overall_status'] == 'unhealthy':
        sys.exit(1)
    elif summary['overall_status'] == 'warning':
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
