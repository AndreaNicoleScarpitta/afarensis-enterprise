#!/usr/bin/env python3
"""
Environment Configuration Validation for Afarensis Enterprise

This script validates environment variables and configuration settings
before application startup to catch configuration errors early.

Usage:
    python scripts/validate_env.py              # Validate current environment
    python scripts/validate_env.py --fix       # Attempt to fix common issues
    python scripts/validate_env.py --template  # Generate .env template
"""

import os
import sys
import argparse
import re
from pathlib import Path
from urllib.parse import urlparse

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from app.core.config import settings
    SETTINGS_AVAILABLE = True
except Exception as e:
    print(f"⚠️  Could not load settings: {e}")
    SETTINGS_AVAILABLE = False


class EnvValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.suggestions = []
    
    def error(self, message):
        self.errors.append(f"❌ {message}")
    
    def warning(self, message):
        self.warnings.append(f"⚠️  {message}")
    
    def suggestion(self, message):
        self.suggestions.append(f"💡 {message}")
    
    def validate_database_url(self, database_url):
        """Validate DATABASE_URL format and accessibility"""
        if not database_url:
            self.error("DATABASE_URL is required")
            self.suggestion("Set DATABASE_URL=postgresql://user:password@host:port/database")
            return False
        
        try:
            parsed = urlparse(database_url)
            
            # Check scheme
            if parsed.scheme != 'postgresql':
                self.warning(f"Unexpected database scheme: {parsed.scheme} (expected: postgresql)")
            
            # Check required components
            if not parsed.hostname:
                self.error("DATABASE_URL missing hostname")
                return False
                
            if not parsed.username:
                self.warning("DATABASE_URL missing username")
            
            if not parsed.password:
                self.warning("DATABASE_URL missing password (consider using .pgpass or environment-specific auth)")
            
            if not parsed.path or parsed.path == '/':
                self.error("DATABASE_URL missing database name")
                return False
            
            # Check port
            port = parsed.port or 5432
            if port < 1024 or port > 65535:
                self.warning(f"Unusual database port: {port}")
            
            return True
            
        except Exception as e:
            self.error(f"Invalid DATABASE_URL format: {e}")
            return False
    
    def validate_redis_config(self, redis_host, redis_port, redis_password=None):
        """Validate Redis configuration"""
        if not redis_host:
            self.error("REDIS_HOST is required")
            self.suggestion("Set REDIS_HOST=localhost for local development")
            return False
        
        try:
            # Validate port
            port = int(redis_port) if redis_port else 6379
            if port < 1 or port > 65535:
                self.error(f"Invalid REDIS_PORT: {port}")
                return False
            
            # Check host format
            if redis_host.startswith('redis://'):
                self.warning("REDIS_HOST should be hostname only, not URL")
                self.suggestion("Use REDIS_HOST=localhost instead of redis://localhost")
            
            return True
            
        except ValueError:
            self.error(f"REDIS_PORT must be a number, got: {redis_port}")
            return False
    
    def validate_secret_key(self, secret_key):
        """Validate SECRET_KEY strength"""
        if not secret_key:
            self.error("SECRET_KEY is required for security")
            self.suggestion("Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
            return False
        
        if len(secret_key) < 32:
            self.warning("SECRET_KEY should be at least 32 characters long")
        
        if secret_key in ['secret', 'dev', 'development', 'changeme']:
            self.error("SECRET_KEY is using a default/weak value")
            return False
        
        # Check for sufficient randomness (basic check)
        if secret_key.isalnum() and len(set(secret_key)) < 10:
            self.warning("SECRET_KEY may not be random enough")
        
        return True
    
    def validate_ai_api_keys(self, openai_key=None, anthropic_key=None):
        """Validate AI API keys format"""
        if not openai_key and not anthropic_key:
            self.warning("No AI API keys configured - AI features will not work")
            self.suggestion("Set OPENAI_API_KEY or ANTHROPIC_API_KEY for AI functionality")
            return True
        
        if openai_key:
            if not openai_key.startswith('sk-'):
                self.warning("OPENAI_API_KEY may be invalid (should start with 'sk-')")
            elif len(openai_key) < 40:
                self.warning("OPENAI_API_KEY appears too short")
        
        if anthropic_key:
            if not anthropic_key.startswith('sk-ant-'):
                self.warning("ANTHROPIC_API_KEY may be invalid (should start with 'sk-ant-')")
            elif len(anthropic_key) < 40:
                self.warning("ANTHROPIC_API_KEY appears too short")
        
        return True
    
    def validate_smtp_config(self, smtp_host=None, smtp_port=None, smtp_user=None, smtp_password=None):
        """Validate email configuration"""
        if not smtp_host:
            self.warning("SMTP not configured - email notifications disabled")
            return True
        
        try:
            port = int(smtp_port) if smtp_port else 587
            if port not in [25, 465, 587, 2525]:
                self.warning(f"Unusual SMTP port: {port} (common ports: 25, 465, 587, 2525)")
            
            if smtp_user and not smtp_password:
                self.warning("SMTP username provided but no password")
            
            return True
            
        except ValueError:
            self.error(f"SMTP_PORT must be a number, got: {smtp_port}")
            return False
    
    def validate_cors_origins(self, cors_origins=None):
        """Validate CORS origins configuration"""
        if not cors_origins:
            self.warning("CORS_ORIGINS not configured - may cause frontend issues")
            self.suggestion("Set CORS_ORIGINS=['http://localhost:3000'] for development")
            return True
        
        if isinstance(cors_origins, str):
            if cors_origins == '*':
                self.warning("CORS allows all origins - security risk in production")
            elif ',' in cors_origins:
                # Comma-separated string
                origins = [o.strip() for o in cors_origins.split(',')]
            else:
                origins = [cors_origins]
        else:
            origins = cors_origins if isinstance(cors_origins, list) else [str(cors_origins)]
        
        for origin in origins:
            if origin == '*':
                self.warning("Wildcard CORS origin (*) is a security risk")
            elif not origin.startswith(('http://', 'https://')):
                self.warning(f"CORS origin should include protocol: {origin}")
        
        return True
    
    def validate_file_paths(self, upload_path=None, log_path=None):
        """Validate file system paths"""
        if upload_path:
            upload_dir = Path(upload_path)
            if not upload_dir.exists():
                self.warning(f"Upload directory does not exist: {upload_path}")
                self.suggestion(f"Create directory: mkdir -p {upload_path}")
            elif not upload_dir.is_dir():
                self.error(f"Upload path is not a directory: {upload_path}")
        
        if log_path:
            log_dir = Path(log_path).parent
            if not log_dir.exists():
                self.warning(f"Log directory does not exist: {log_dir}")
                self.suggestion(f"Create directory: mkdir -p {log_dir}")
        
        return True
    
    def validate_environment(self):
        """Run all validation checks"""
        if not SETTINGS_AVAILABLE:
            self.error("Cannot load application settings - check configuration")
            return False
        
        # Get configuration values
        database_url = getattr(settings, 'database_url', None)
        redis_host = getattr(settings, 'redis_host', None)
        redis_port = getattr(settings, 'redis_port', None)
        redis_password = getattr(settings, 'redis_password', None)
        secret_key = getattr(settings, 'secret_key', None)
        openai_key = getattr(settings, 'openai_api_key', None)
        anthropic_key = getattr(settings, 'anthropic_api_key', None)
        smtp_host = getattr(settings, 'smtp_host', None)
        smtp_port = getattr(settings, 'smtp_port', None)
        smtp_user = getattr(settings, 'smtp_user', None)
        smtp_password = getattr(settings, 'smtp_password', None)
        cors_origins = getattr(settings, 'cors_origins', None)
        
        # Run validations
        self.validate_database_url(database_url)
        self.validate_redis_config(redis_host, redis_port, redis_password)
        self.validate_secret_key(secret_key)
        self.validate_ai_api_keys(openai_key, anthropic_key)
        self.validate_smtp_config(smtp_host, smtp_port, smtp_user, smtp_password)
        self.validate_cors_origins(cors_origins)
        
        return len(self.errors) == 0
    
    def generate_env_template(self):
        """Generate a .env template file"""
        template = '''# Afarensis Enterprise Configuration Template
# Copy this to .env and customize for your environment

# Database Configuration (REQUIRED)
DATABASE_URL=postgresql://afarensis_user:secure_password@localhost:5432/afarensis_enterprise

# Redis Configuration (REQUIRED)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security Configuration (REQUIRED)
SECRET_KEY=  # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"

# AI API Keys (OPTIONAL - but required for AI features)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email Configuration (OPTIONAL)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_USE_TLS=true

# Frontend Configuration
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]

# File Storage
UPLOAD_PATH=/tmp/afarensis_uploads
LOG_PATH=/tmp/afarensis_logs

# Environment
ENVIRONMENT=development
DEBUG=true

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Regulatory Configuration
FDA_GUIDANCE_API_KEY=
EMA_GUIDANCE_API_KEY=

# Monitoring and Analytics
SENTRY_DSN=
ANALYTICS_ENABLED=false

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100

# Security Headers
SECURITY_HEADERS_ENABLED=true
HSTS_MAX_AGE=31536000
'''
        return template
    
    def attempt_fixes(self):
        """Attempt to fix common configuration issues"""
        fixes_applied = []
        
        # Create missing directories
        for env_var in ['UPLOAD_PATH', 'LOG_PATH']:
            path = os.getenv(env_var)
            if path:
                path_obj = Path(path)
                if not path_obj.exists():
                    try:
                        path_obj.mkdir(parents=True, exist_ok=True)
                        fixes_applied.append(f"Created directory: {path}")
                    except Exception as e:
                        self.error(f"Failed to create directory {path}: {e}")
        
        # Generate SECRET_KEY if missing or weak
        if not os.getenv('SECRET_KEY') or os.getenv('SECRET_KEY') in ['secret', 'dev', 'development']:
            import secrets
            new_secret = secrets.token_urlsafe(32)
            fixes_applied.append(f"Generated new SECRET_KEY: {new_secret}")
            self.suggestion(f"Add this to your .env file: SECRET_KEY={new_secret}")
        
        return fixes_applied
    
    def print_results(self):
        """Print validation results"""
        if self.errors:
            print("🚨 Configuration Errors:")
            for error in self.errors:
                print(f"  {error}")
            print()
        
        if self.warnings:
            print("⚠️  Configuration Warnings:")
            for warning in self.warnings:
                print(f"  {warning}")
            print()
        
        if self.suggestions:
            print("💡 Suggestions:")
            for suggestion in self.suggestions:
                print(f"  {suggestion}")
            print()
        
        if not self.errors and not self.warnings:
            print("✅ All configuration checks passed!")


def main():
    parser = argparse.ArgumentParser(description="Validate Afarensis Enterprise environment configuration")
    parser.add_argument("--fix", action="store_true", help="Attempt to fix common issues")
    parser.add_argument("--template", action="store_true", help="Generate .env template")
    
    args = parser.parse_args()
    
    if args.template:
        validator = EnvValidator()
        template = validator.generate_env_template()
        
        template_path = Path(".env.template")
        template_path.write_text(template)
        
        print(f"📝 Environment template generated: {template_path}")
        print("Copy this to .env and customize for your environment")
        return
    
    print("🔍 Afarensis Enterprise Environment Validation")
    print("=" * 50)
    
    validator = EnvValidator()
    
    if args.fix:
        print("🔧 Attempting to fix common issues...")
        fixes = validator.attempt_fixes()
        if fixes:
            print("Applied fixes:")
            for fix in fixes:
                print(f"  ✅ {fix}")
        else:
            print("  No automatic fixes available")
        print()
    
    # Run validation
    is_valid = validator.validate_environment()
    
    # Print results
    validator.print_results()
    
    # Summary
    if is_valid:
        print("🎉 Environment configuration is valid!")
        sys.exit(0)
    else:
        print("💥 Environment configuration has errors that must be fixed")
        print("\nNext steps:")
        print("1. Fix the configuration errors listed above")
        print("2. Run this script again to verify")
        print("3. Use --template to generate a configuration template")
        sys.exit(1)


if __name__ == "__main__":
    main()
