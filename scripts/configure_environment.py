#!/usr/bin/env python3
"""
Afarensis Enterprise - Comprehensive Environment Configuration
Validates, tests, and configures all API keys and external services
"""

import os
import sys
import asyncio
import logging
import json
import secrets
import getpass
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

# Import our services for testing
try:
    from app.services.llm_integration import LLMServiceIntegration
    from app.services.external_apis import ExternalAPIService
    SERVICES_AVAILABLE = True
except ImportError:
    SERVICES_AVAILABLE = False
    print("⚠️ Afarensis services not available - running in standalone mode")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class EnvironmentConfigurator:
    """Comprehensive environment configuration and validation"""
    
    def __init__(self):
        self.config = {}
        self.validation_results = {}
        self.api_test_results = {}
        self.env_file_path = Path(".env")
    
    def display_banner(self):
        """Display configuration wizard banner"""
        print("\n" + "="*70)
        print("🔧 AFARENSIS ENTERPRISE - ENVIRONMENT CONFIGURATION")
        print("="*70)
        print("This wizard will help you configure API keys and external services")
        print("for the complete Afarensis Enterprise platform.\n")
    
    def collect_api_keys(self):
        """Interactive API key collection"""
        print("📋 API KEY CONFIGURATION")
        print("-"*30)
        
        api_keys = {
            'ANTHROPIC_API_KEY': {
                'name': 'Claude/Anthropic API Key',
                'description': 'For advanced AI analysis and bias detection',
                'required': True,
                'validation_url': 'https://api.anthropic.com',
                'example': 'sk-ant-...'
            },
            'OPENAI_API_KEY': {
                'name': 'OpenAI API Key',
                'description': 'Fallback LLM for analysis tasks',
                'required': False,
                'validation_url': 'https://api.openai.com',
                'example': 'sk-...'
            },
            'PUBMED_API_KEY': {
                'name': 'PubMed API Key',
                'description': 'For enhanced literature search (optional but recommended)',
                'required': False,
                'validation_url': 'https://eutils.ncbi.nlm.nih.gov',
                'example': 'your-ncbi-api-key'
            },
            'GOOGLE_AI_API_KEY': {
                'name': 'Google AI/Gemini API Key',
                'description': 'Alternative LLM provider (optional)',
                'required': False,
                'validation_url': 'https://ai.google.dev',
                'example': 'AIza...'
            }
        }
        
        for key, info in api_keys.items():
            self._collect_single_api_key(key, info)
    
    def _collect_single_api_key(self, key_name: str, key_info: Dict[str, Any]):
        """Collect a single API key with validation"""
        
        current_value = os.getenv(key_name, '')
        
        print(f"\n🔑 {key_info['name']}")
        print(f"   Purpose: {key_info['description']}")
        print(f"   Required: {'Yes' if key_info['required'] else 'No'}")
        print(f"   Example: {key_info['example']}")
        
        if current_value:
            print(f"   Current: {current_value[:8]}...{current_value[-4:] if len(current_value) > 12 else '***'}")
            keep_current = input(f"   Keep current value? (y/n): ").strip().lower()
            if keep_current == 'y':
                self.config[key_name] = current_value
                return
        
        while True:
            if key_info['required']:
                value = getpass.getpass(f"   Enter {key_info['name']} (required): ").strip()
                if not value:
                    print("   ❌ This API key is required. Please provide a value.")
                    continue
            else:
                value = getpass.getpass(f"   Enter {key_info['name']} (optional, press Enter to skip): ").strip()
            
            if value:
                # Basic validation
                if key_name == 'ANTHROPIC_API_KEY' and not value.startswith('sk-ant-'):
                    print("   ⚠️  Warning: Anthropic API keys usually start with 'sk-ant-'")
                elif key_name == 'OPENAI_API_KEY' and not value.startswith('sk-'):
                    print("   ⚠️  Warning: OpenAI API keys usually start with 'sk-'")
                
                self.config[key_name] = value
                print(f"   ✅ {key_info['name']} configured")
            else:
                if key_info['required']:
                    print("   ❌ Required API key not provided")
                    continue
                else:
                    print(f"   ⏭️  Skipped {key_info['name']}")
                    self.config[key_name] = ''
            break
    
    def collect_database_config(self):
        """Collect database configuration"""
        print("\n🗄️ DATABASE CONFIGURATION")
        print("-"*25)
        
        # Check if we're using Docker (default) or custom database
        use_docker = input("Use Docker for database? (recommended) (y/n): ").strip().lower()
        
        if use_docker != 'n':
            # Use default Docker database configuration
            self.config.update({
                'DATABASE_URL': 'postgresql+asyncpg://afarensis_user:secure_password@localhost:5432/afarensis_enterprise',
                'DB_HOST': 'localhost',
                'DB_PORT': '5432',
                'DB_NAME': 'afarensis_enterprise',
                'DB_USER': 'afarensis_user',
                'DB_PASSWORD': 'secure_password'
            })
            print("✅ Using Docker database configuration")
        else:
            # Custom database configuration
            print("Enter custom database details:")
            self.config['DB_HOST'] = input("Database host (localhost): ").strip() or 'localhost'
            self.config['DB_PORT'] = input("Database port (5432): ").strip() or '5432'
            self.config['DB_NAME'] = input("Database name: ").strip()
            self.config['DB_USER'] = input("Database user: ").strip()
            self.config['DB_PASSWORD'] = getpass.getpass("Database password: ").strip()
            
            # Build connection URL
            self.config['DATABASE_URL'] = (
                f"postgresql+asyncpg://{self.config['DB_USER']}:"
                f"{self.config['DB_PASSWORD']}@{self.config['DB_HOST']}:"
                f"{self.config['DB_PORT']}/{self.config['DB_NAME']}"
            )
    
    def generate_security_config(self):
        """Generate secure configuration"""
        print("\n🔐 SECURITY CONFIGURATION")
        print("-"*25)
        
        # Generate secure secrets
        secret_key = secrets.token_urlsafe(64)
        encryption_key = secrets.token_urlsafe(32)
        
        self.config.update({
            'SECRET_KEY': secret_key,
            'ENCRYPTION_KEY': encryption_key,
            'ALGORITHM': 'HS256',
            'ACCESS_TOKEN_EXPIRE_MINUTES': '30',
            'REFRESH_TOKEN_EXPIRE_HOURS': '168'
        })
        
        print("✅ Security keys generated")
    
    def collect_service_config(self):
        """Collect service configuration"""
        print("\n⚙️ SERVICE CONFIGURATION")
        print("-"*25)
        
        environment = input("Environment (development/staging/production) [development]: ").strip().lower()
        if environment not in ['development', 'staging', 'production']:
            environment = 'development'
        
        self.config.update({
            'ENVIRONMENT': environment,
            'DEBUG': 'true' if environment == 'development' else 'false',
            'LOG_LEVEL': 'DEBUG' if environment == 'development' else 'INFO',
            'CORS_ORIGINS': '["http://localhost:3000", "http://localhost:8000"]',
            
            # Redis configuration
            'REDIS_URL': 'redis://localhost:6379/0',
            'REDIS_HOST': 'localhost', 
            'REDIS_PORT': '6379',
            
            # Celery configuration
            'CELERY_BROKER_URL': 'redis://localhost:6379/1',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6379/2',
            
            # File handling
            'MAX_FILE_SIZE_MB': '100',
            'UPLOAD_DIRECTORY': './uploads',
            'ARTIFACT_DIRECTORY': './artifacts',
            
            # Monitoring
            'PROMETHEUS_PORT': '9090',
            'RATE_LIMIT_PER_MINUTE': '100'
        })
        
        print(f"✅ Configured for {environment} environment")
    
    async def validate_api_keys(self):
        """Validate API keys by testing actual API calls"""
        print("\n🧪 API KEY VALIDATION")
        print("-"*20)
        
        if not SERVICES_AVAILABLE:
            print("⚠️ Service modules not available - skipping API validation")
            return
        
        # Test LLM APIs
        if self.config.get('ANTHROPIC_API_KEY'):
            print("🔍 Testing Claude/Anthropic API...")
            try:
                # Set environment variable for testing
                os.environ['ANTHROPIC_API_KEY'] = self.config['ANTHROPIC_API_KEY']
                
                llm_service = LLMServiceIntegration()
                test_response = await llm_service.call_claude(
                    "Hello, this is a test. Please respond with 'API test successful'.",
                    max_tokens=50
                )
                
                if "api test successful" in test_response.content.lower():
                    print("✅ Claude/Anthropic API working")
                    self.api_test_results['anthropic'] = {'status': 'success', 'response_time': test_response.processing_time_ms}
                else:
                    print("⚠️ Claude/Anthropic API responded but result unexpected")
                    self.api_test_results['anthropic'] = {'status': 'warning', 'message': 'Unexpected response'}
                    
            except Exception as e:
                print(f"❌ Claude/Anthropic API test failed: {str(e)}")
                self.api_test_results['anthropic'] = {'status': 'error', 'error': str(e)}
        
        if self.config.get('OPENAI_API_KEY'):
            print("🔍 Testing OpenAI API...")
            try:
                os.environ['OPENAI_API_KEY'] = self.config['OPENAI_API_KEY']
                
                llm_service = LLMServiceIntegration()
                test_response = await llm_service.call_openai(
                    "Hello, this is a test. Please respond with 'API test successful'.",
                    max_tokens=50
                )
                
                if "api test successful" in test_response.content.lower():
                    print("✅ OpenAI API working")
                    self.api_test_results['openai'] = {'status': 'success', 'response_time': test_response.processing_time_ms}
                else:
                    print("⚠️ OpenAI API responded but result unexpected")
                    self.api_test_results['openai'] = {'status': 'warning', 'message': 'Unexpected response'}
                    
            except Exception as e:
                print(f"❌ OpenAI API test failed: {str(e)}")
                self.api_test_results['openai'] = {'status': 'error', 'error': str(e)}
        
        # Test External APIs
        if self.config.get('PUBMED_API_KEY'):
            print("🔍 Testing PubMed API...")
            try:
                os.environ['PUBMED_API_KEY'] = self.config['PUBMED_API_KEY']
                
                api_service = ExternalAPIService()
                test_results = await api_service.search_pubmed("cancer", max_results=1)
                
                if test_results:
                    print("✅ PubMed API working")
                    self.api_test_results['pubmed'] = {'status': 'success', 'results_count': len(test_results)}
                else:
                    print("⚠️ PubMed API responded but no results")
                    self.api_test_results['pubmed'] = {'status': 'warning', 'message': 'No results returned'}
                    
            except Exception as e:
                print(f"❌ PubMed API test failed: {str(e)}")
                self.api_test_results['pubmed'] = {'status': 'error', 'error': str(e)}
        
        # Test ClinicalTrials.gov (no API key required)
        print("🔍 Testing ClinicalTrials.gov API...")
        try:
            api_service = ExternalAPIService()
            test_results = await api_service.search_clinical_trials("cancer", max_results=1)
            
            if test_results:
                print("✅ ClinicalTrials.gov API working")
                self.api_test_results['clinicaltrials'] = {'status': 'success', 'results_count': len(test_results)}
            else:
                print("⚠️ ClinicalTrials.gov API responded but no results")
                self.api_test_results['clinicaltrials'] = {'status': 'warning', 'message': 'No results returned'}
                
        except Exception as e:
            print(f"❌ ClinicalTrials.gov API test failed: {str(e)}")
            self.api_test_results['clinicaltrials'] = {'status': 'error', 'error': str(e)}
    
    def write_env_file(self):
        """Write configuration to .env file"""
        print("\n📝 WRITING CONFIGURATION")
        print("-"*25)
        
        # Backup existing .env file
        if self.env_file_path.exists():
            backup_path = Path(f".env.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            self.env_file_path.rename(backup_path)
            print(f"📋 Backed up existing .env to {backup_path}")
        
        # Write new configuration
        env_content = []
        env_content.append("# Afarensis Enterprise Environment Configuration")
        env_content.append(f"# Generated on {datetime.now().isoformat()}")
        env_content.append("")
        
        # Group configuration by category
        categories = {
            'API Keys': ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'PUBMED_API_KEY', 'GOOGLE_AI_API_KEY'],
            'Database': ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
            'Security': ['SECRET_KEY', 'ENCRYPTION_KEY', 'ALGORITHM', 'ACCESS_TOKEN_EXPIRE_MINUTES', 'REFRESH_TOKEN_EXPIRE_HOURS'],
            'Application': ['ENVIRONMENT', 'DEBUG', 'LOG_LEVEL', 'CORS_ORIGINS'],
            'Redis & Celery': ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'CELERY_BROKER_URL', 'CELERY_RESULT_BACKEND'],
            'File Handling': ['MAX_FILE_SIZE_MB', 'UPLOAD_DIRECTORY', 'ARTIFACT_DIRECTORY'],
            'Monitoring': ['PROMETHEUS_PORT', 'RATE_LIMIT_PER_MINUTE']
        }
        
        for category, keys in categories.items():
            env_content.append(f"# {category}")
            for key in keys:
                if key in self.config:
                    value = self.config[key]
                    # Quote values that contain special characters
                    if any(char in str(value) for char in [' ', '"', "'", '\\', '$']):
                        value = f'"{value}"'
                    env_content.append(f"{key}={value}")
                else:
                    env_content.append(f"# {key}=")
            env_content.append("")
        
        # Write to file
        with open(self.env_file_path, 'w') as f:
            f.write('\n'.join(env_content))
        
        print(f"✅ Configuration written to {self.env_file_path}")
        
        # Copy to backend and frontend if they exist
        backend_env = Path("backend/.env")
        if Path("backend").exists():
            backend_env.write_text('\n'.join(env_content))
            print(f"✅ Configuration copied to {backend_env}")
        
        frontend_env = Path("frontend/.env")
        if Path("frontend").exists():
            # Frontend gets a subset of the configuration
            frontend_config = []
            frontend_config.append("# Afarensis Enterprise Frontend Configuration")
            frontend_config.append(f"# Generated on {datetime.now().isoformat()}")
            frontend_config.append("")
            frontend_config.append("# API Configuration")
            frontend_config.append("REACT_APP_API_URL=http://localhost:8000")
            frontend_config.append("REACT_APP_ENVIRONMENT=" + self.config.get('ENVIRONMENT', 'development'))
            
            frontend_env.write_text('\n'.join(frontend_config))
            print(f"✅ Frontend configuration written to {frontend_env}")
    
    def generate_summary_report(self):
        """Generate configuration summary report"""
        print("\n📊 CONFIGURATION SUMMARY")
        print("="*50)
        
        # API Keys Status
        print("\n🔑 API Keys Configured:")
        api_keys = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'PUBMED_API_KEY', 'GOOGLE_AI_API_KEY']
        for key in api_keys:
            if self.config.get(key):
                status = "✅ Configured"
                if key.lower().replace('_', '') in self.api_test_results:
                    test_result = self.api_test_results[key.lower().replace('_', '')]
                    if test_result['status'] == 'success':
                        status += " & Tested ✅"
                    elif test_result['status'] == 'warning':
                        status += " & Tested ⚠️"
                    else:
                        status += " & Test Failed ❌"
                print(f"  {key}: {status}")
            else:
                print(f"  {key}: ❌ Not configured")
        
        # External APIs Status
        print("\n🌐 External APIs:")
        external_apis = ['pubmed', 'clinicaltrials', 'fda', 'ema']
        for api in external_apis:
            if api in self.api_test_results:
                test_result = self.api_test_results[api]
                if test_result['status'] == 'success':
                    print(f"  {api.upper()}: ✅ Working")
                elif test_result['status'] == 'warning':
                    print(f"  {api.upper()}: ⚠️ {test_result.get('message', 'Warning')}")
                else:
                    print(f"  {api.upper()}: ❌ {test_result.get('error', 'Failed')}")
            else:
                print(f"  {api.upper()}: ⚪ Not tested")
        
        # Environment Summary
        print(f"\n⚙️ Environment: {self.config.get('ENVIRONMENT', 'not set')}")
        print(f"🗄️ Database: {'Docker (default)' if 'localhost:5432' in self.config.get('DATABASE_URL', '') else 'Custom'}")
        print(f"🔐 Security: {'Configured' if self.config.get('SECRET_KEY') else 'Not configured'}")
        
        # Next Steps
        print("\n🚀 NEXT STEPS:")
        print("1. Start Docker services: docker-compose up -d")
        print("2. Run database migrations: alembic upgrade head")
        print("3. Start the application: python -m app.main")
        print("4. Access the UI at: http://localhost:3000")
        print("\nAdmin login will be: admin@afarensis.com / admin123")
        
        # Warnings
        warnings = []
        
        if not self.config.get('ANTHROPIC_API_KEY'):
            warnings.append("⚠️ No Claude/Anthropic API key - AI features will be limited")
        
        if not self.config.get('OPENAI_API_KEY') and not self.config.get('ANTHROPIC_API_KEY'):
            warnings.append("⚠️ No LLM API keys configured - AI analysis will not work")
        
        if self.config.get('ENVIRONMENT') == 'production' and self.config.get('DEBUG') == 'true':
            warnings.append("⚠️ Debug mode enabled in production environment")
        
        if warnings:
            print("\n⚠️ WARNINGS:")
            for warning in warnings:
                print(f"  {warning}")
    
    async def run_configuration_wizard(self):
        """Run the complete configuration wizard"""
        try:
            self.display_banner()
            
            # Step 1: Collect API keys
            self.collect_api_keys()
            
            # Step 2: Database configuration
            self.collect_database_config()
            
            # Step 3: Generate security configuration
            self.generate_security_config()
            
            # Step 4: Service configuration
            self.collect_service_config()
            
            # Step 5: Validate API keys
            if input("\nTest API connections? (y/n): ").strip().lower() == 'y':
                await self.validate_api_keys()
            
            # Step 6: Write configuration
            self.write_env_file()
            
            # Step 7: Generate summary
            self.generate_summary_report()
            
            print("\n🎉 Configuration complete!")
            return True
            
        except KeyboardInterrupt:
            print("\n\n❌ Configuration cancelled by user")
            return False
        except Exception as e:
            print(f"\n❌ Configuration failed: {str(e)}")
            logger.exception("Configuration wizard failed")
            return False


# CLI Functions

def quick_setup():
    """Quick setup with defaults for development"""
    print("🚀 QUICK DEVELOPMENT SETUP")
    print("-"*30)
    
    configurator = EnvironmentConfigurator()
    
    # Get only essential API keys
    anthropic_key = getpass.getpass("Enter Claude/Anthropic API key (required): ").strip()
    if not anthropic_key:
        print("❌ Claude API key is required for quick setup")
        return False
    
    openai_key = getpass.getpass("Enter OpenAI API key (optional, press Enter to skip): ").strip()
    pubmed_key = input("Enter PubMed API key (optional, press Enter to skip): ").strip()
    
    # Generate configuration
    configurator.config = {
        'ANTHROPIC_API_KEY': anthropic_key,
        'OPENAI_API_KEY': openai_key,
        'PUBMED_API_KEY': pubmed_key,
        'GOOGLE_AI_API_KEY': '',
        
        # Development defaults
        'DATABASE_URL': 'postgresql+asyncpg://afarensis_user:secure_password@localhost:5432/afarensis_enterprise',
        'DB_HOST': 'localhost',
        'DB_PORT': '5432', 
        'DB_NAME': 'afarensis_enterprise',
        'DB_USER': 'afarensis_user',
        'DB_PASSWORD': 'secure_password',
        
        'SECRET_KEY': secrets.token_urlsafe(64),
        'ENCRYPTION_KEY': secrets.token_urlsafe(32),
        'ALGORITHM': 'HS256',
        'ACCESS_TOKEN_EXPIRE_MINUTES': '30',
        'REFRESH_TOKEN_EXPIRE_HOURS': '168',
        
        'ENVIRONMENT': 'development',
        'DEBUG': 'true',
        'LOG_LEVEL': 'DEBUG',
        'CORS_ORIGINS': '["http://localhost:3000", "http://localhost:8000"]',
        
        'REDIS_URL': 'redis://localhost:6379/0',
        'REDIS_HOST': 'localhost',
        'REDIS_PORT': '6379',
        'CELERY_BROKER_URL': 'redis://localhost:6379/1',
        'CELERY_RESULT_BACKEND': 'redis://localhost:6379/2',
        
        'MAX_FILE_SIZE_MB': '100',
        'UPLOAD_DIRECTORY': './uploads',
        'ARTIFACT_DIRECTORY': './artifacts',
        'PROMETHEUS_PORT': '9090',
        'RATE_LIMIT_PER_MINUTE': '100'
    }
    
    configurator.write_env_file()
    print("✅ Quick development setup complete!")
    print("\nNext steps:")
    print("1. docker-compose up -d")
    print("2. Run the application")
    
    return True


async def main():
    """Main configuration entry point"""
    if len(sys.argv) > 1 and sys.argv[1] == 'quick':
        quick_setup()
    else:
        configurator = EnvironmentConfigurator()
        await configurator.run_configuration_wizard()


if __name__ == "__main__":
    asyncio.run(main())
