#!/usr/bin/env python3
"""
Environment Configuration Validator for Afarensis Enterprise
Validates all required environment variables and external service connections
"""

import os
import sys
import asyncio
import logging
from typing import Dict, List, Tuple, Optional
import asyncpg
import redis
import httpx
from sqlalchemy.ext.asyncio import create_async_engine

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnvironmentValidator:
    """Validates environment configuration and service connectivity"""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        
    def validate_required_env_vars(self) -> None:
        """Validate all required environment variables are set"""
        required_vars = {
            # Database
            'DATABASE_URL': 'PostgreSQL connection string',
            'DB_HOST': 'PostgreSQL host',
            'DB_PORT': 'PostgreSQL port',
            'DB_NAME': 'Database name', 
            'DB_USER': 'Database user',
            'DB_PASSWORD': 'Database password',
            
            # Redis
            'REDIS_URL': 'Redis connection string',
            'REDIS_HOST': 'Redis host',
            'REDIS_PORT': 'Redis port',
            
            # Security
            'SECRET_KEY': 'JWT secret key',
            'ALGORITHM': 'JWT algorithm',
            'ACCESS_TOKEN_EXPIRE_MINUTES': 'Token expiration time',
            'REFRESH_TOKEN_EXPIRE_HOURS': 'Refresh token expiration',
            
            # API Keys
            'ANTHROPIC_API_KEY': 'Claude API key for LLM integration',
            'OPENAI_API_KEY': 'OpenAI API key (optional)',
            
            # External Services
            'PUBMED_API_KEY': 'PubMed API key',
            'CLINICALTRIALS_API_URL': 'ClinicalTrials.gov API endpoint',
            
            # Application
            'ENVIRONMENT': 'Application environment (dev/staging/prod)',
            'LOG_LEVEL': 'Logging level',
            'CORS_ORIGINS': 'Allowed CORS origins',
            
            # Security Configuration
            'ENCRYPTION_KEY': 'Data encryption key',
            'RATE_LIMIT_PER_MINUTE': 'API rate limiting',
            'MAX_FILE_SIZE_MB': 'Maximum upload file size',
            
            # Celery
            'CELERY_BROKER_URL': 'Celery broker URL',
            'CELERY_RESULT_BACKEND': 'Celery result backend',
            
            # Monitoring
            'SENTRY_DSN': 'Sentry monitoring DSN (optional)',
            'PROMETHEUS_PORT': 'Prometheus metrics port',
        }
        
        for var, description in required_vars.items():
            value = os.getenv(var)
            if not value:
                self.errors.append(f"Missing required environment variable: {var} ({description})")
            elif var.endswith('_KEY') and len(value) < 32:
                self.warnings.append(f"Weak {var}: should be at least 32 characters")
    
    def validate_security_config(self) -> None:
        """Validate security-specific configuration"""
        # JWT Secret validation
        secret_key = os.getenv('SECRET_KEY', '')
        if len(secret_key) < 64:
            self.errors.append("SECRET_KEY must be at least 64 characters for production")
        
        # Encryption key validation
        encryption_key = os.getenv('ENCRYPTION_KEY', '')
        if len(encryption_key) != 44:  # Base64 encoded 32-byte key
            self.errors.append("ENCRYPTION_KEY must be a base64-encoded 32-byte key")
        
        # Environment-specific checks
        environment = os.getenv('ENVIRONMENT', 'development')
        if environment == 'production':
            if os.getenv('DEBUG', 'false').lower() == 'true':
                self.errors.append("DEBUG must be false in production")
            
            if not os.getenv('SSL_REQUIRED', 'false').lower() == 'true':
                self.warnings.append("SSL_REQUIRED should be true in production")
    
    async def validate_database_connection(self) -> None:
        """Test database connectivity"""
        try:
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                self.errors.append("DATABASE_URL not configured")
                return
            
            engine = create_async_engine(database_url)
            async with engine.begin() as conn:
                result = await conn.execute("SELECT 1")
                await result.fetchone()
            
            await engine.dispose()
            logger.info("✅ Database connection successful")
            
        except Exception as e:
            self.errors.append(f"Database connection failed: {str(e)}")
    
    async def validate_redis_connection(self) -> None:
        """Test Redis connectivity"""
        try:
            redis_url = os.getenv('REDIS_URL')
            if not redis_url:
                redis_host = os.getenv('REDIS_HOST', 'localhost')
                redis_port = int(os.getenv('REDIS_PORT', 6379))
                
                r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
            else:
                r = redis.from_url(redis_url, decode_responses=True)
            
            # Test connection
            await asyncio.get_event_loop().run_in_executor(None, r.ping)
            logger.info("✅ Redis connection successful")
            
        except Exception as e:
            self.errors.append(f"Redis connection failed: {str(e)}")
    
    async def validate_external_apis(self) -> None:
        """Test external API connectivity"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Test PubMed API
            try:
                pubmed_api_key = os.getenv('PUBMED_API_KEY')
                if pubmed_api_key:
                    response = await client.get(
                        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                        params={
                            "db": "pubmed",
                            "term": "cancer",
                            "retmax": "1",
                            "api_key": pubmed_api_key
                        }
                    )
                    if response.status_code == 200:
                        logger.info("✅ PubMed API connection successful")
                    else:
                        self.warnings.append(f"PubMed API returned status {response.status_code}")
                else:
                    self.warnings.append("PubMed API key not configured")
            except Exception as e:
                self.warnings.append(f"PubMed API connection failed: {str(e)}")
            
            # Test ClinicalTrials.gov API
            try:
                response = await client.get("https://clinicaltrials.gov/api/query/study_fields")
                if response.status_code == 200:
                    logger.info("✅ ClinicalTrials.gov API connection successful")
                else:
                    self.warnings.append(f"ClinicalTrials.gov API returned status {response.status_code}")
            except Exception as e:
                self.warnings.append(f"ClinicalTrials.gov API connection failed: {str(e)}")
    
    def validate_file_paths(self) -> None:
        """Validate required file paths and permissions"""
        paths_to_check = [
            ('/tmp', 'Temporary file directory'),
            ('/var/log', 'Log directory (if using file logging)'),
            (os.getenv('UPLOAD_DIRECTORY', './uploads'), 'Upload directory'),
            (os.getenv('ARTIFACT_DIRECTORY', './artifacts'), 'Generated artifact directory'),
        ]
        
        for path, description in paths_to_check:
            if not os.path.exists(path):
                try:
                    os.makedirs(path, exist_ok=True)
                    logger.info(f"Created missing directory: {path}")
                except OSError as e:
                    self.errors.append(f"Cannot create {description} at {path}: {str(e)}")
            elif not os.access(path, os.W_OK):
                self.errors.append(f"No write permission for {description} at {path}")
    
    async def run_validation(self) -> Tuple[bool, Dict[str, List[str]]]:
        """Run all validation checks"""
        logger.info("🔍 Starting environment validation...")
        
        # Synchronous validations
        self.validate_required_env_vars()
        self.validate_security_config()
        self.validate_file_paths()
        
        # Asynchronous validations
        await asyncio.gather(
            self.validate_database_connection(),
            self.validate_redis_connection(), 
            self.validate_external_apis(),
            return_exceptions=True
        )
        
        # Report results
        has_errors = len(self.errors) > 0
        
        return not has_errors, {
            'errors': self.errors,
            'warnings': self.warnings
        }

async def main():
    """Main validation script"""
    validator = EnvironmentValidator()
    success, results = await validator.run_validation()
    
    # Print results
    if results['errors']:
        logger.error("❌ Environment validation FAILED:")
        for error in results['errors']:
            logger.error(f"  - {error}")
    
    if results['warnings']:
        logger.warning("⚠️  Environment warnings:")
        for warning in results['warnings']:
            logger.warning(f"  - {warning}")
    
    if success and not results['warnings']:
        logger.info("✅ Environment validation PASSED - all systems ready!")
    elif success:
        logger.info("✅ Environment validation PASSED with warnings")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
