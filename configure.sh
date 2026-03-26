#!/bin/bash
# Afarensis Enterprise - Linux/Mac Configuration Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================"
echo -e "Afarensis Enterprise - Configuration"
echo -e "========================================${NC}"
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${RED}❌ ERROR: Python is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Please install Python 3.8+ from your package manager or https://python.org${NC}"
    exit 1
fi

# Try python3 first, fallback to python
if command -v python3 &> /dev/null; then
    PYTHON=python3
else
    PYTHON=python
fi

PYTHON_VERSION=$($PYTHON --version 2>&1)
echo -e "${GREEN}✅ Found: $PYTHON_VERSION${NC}"

# Check Python version is 3.8+
PYTHON_MAJOR=$($PYTHON -c 'import sys; print(sys.version_info[0])')
PYTHON_MINOR=$($PYTHON -c 'import sys; print(sys.version_info[1])')

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
    echo -e "${RED}❌ ERROR: Python 3.8+ required, found $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${CYAN}🔧 Starting configuration...${NC}"
echo

# Configuration menu
echo -e "${YELLOW}Configuration Options:${NC}"
echo "1. Full Configuration Wizard (recommended)"
echo "2. Quick Development Setup"
echo "3. API Testing Only"
echo "4. Environment Validation"
echo "5. Generate Sample .env File"
echo "6. Exit"
echo

read -p "Select option (1-6): " choice

case $choice in
    1)
        echo
        echo -e "${CYAN}Starting Full Configuration Wizard...${NC}"
        echo -e "${CYAN}=====================================${NC}"
        
        if $PYTHON scripts/configure_environment.py; then
            echo -e "${GREEN}✅ Configuration completed successfully!${NC}"
        else
            echo -e "${YELLOW}⚠️ Configuration completed with warnings${NC}"
        fi
        ;;
    
    2)
        echo
        echo -e "${CYAN}Starting Quick Development Setup...${NC}"
        echo -e "${CYAN}==================================${NC}"
        
        if $PYTHON scripts/configure_environment.py quick; then
            echo -e "${GREEN}✅ Quick setup completed successfully!${NC}"
        else
            echo -e "${YELLOW}⚠️ Quick setup completed with warnings${NC}"
        fi
        ;;
    
    3)
        echo
        echo -e "${CYAN}Testing API Connections...${NC}"
        echo -e "${CYAN}=========================${NC}"
        
        if $PYTHON scripts/test_apis.py; then
            echo -e "${GREEN}✅ All API tests passed!${NC}"
        else
            echo -e "${YELLOW}⚠️ Some API tests failed - check output above${NC}"
        fi
        ;;
    
    4)
        echo
        echo -e "${CYAN}Validating Environment...${NC}"
        echo -e "${CYAN}========================${NC}"
        
        if $PYTHON scripts/validate_environment.py; then
            echo -e "${GREEN}✅ Environment validation passed!${NC}"
        else
            echo -e "${YELLOW}⚠️ Environment validation found issues${NC}"
        fi
        ;;
    
    5)
        echo
        echo -e "${CYAN}Generating Sample .env File...${NC}"
        echo -e "${CYAN}=============================${NC}"
        
        cat > .env.example << 'EOF'
# Afarensis Enterprise Environment Configuration
# Copy this to .env and fill in your actual values

# API Keys
ANTHROPIC_API_KEY=sk-ant-your-claude-api-key-here
OPENAI_API_KEY=sk-your-openai-api-key-here
PUBMED_API_KEY=your-ncbi-api-key-here
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# Database
DATABASE_URL=postgresql+asyncpg://afarensis_user:secure_password@localhost:5432/afarensis_enterprise
DB_HOST=localhost
DB_PORT=5432
DB_NAME=afarensis_enterprise
DB_USER=afarensis_user
DB_PASSWORD=secure_password

# Security (generate new values for production)
SECRET_KEY=your-secret-key-here-64-characters-minimum
ENCRYPTION_KEY=your-encryption-key-here-32-bytes-base64
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_HOURS=168

# Application
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000"]

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# File Handling
MAX_FILE_SIZE_MB=100
UPLOAD_DIRECTORY=./uploads
ARTIFACT_DIRECTORY=./artifacts

# Monitoring
PROMETHEUS_PORT=9090
RATE_LIMIT_PER_MINUTE=100
EOF
        
        echo -e "${GREEN}✅ Sample .env file created as .env.example${NC}"
        echo -e "${YELLOW}📝 Copy to .env and fill in your actual API keys${NC}"
        ;;
    
    6)
        echo -e "${CYAN}Exiting...${NC}"
        exit 0
        ;;
    
    *)
        echo -e "${RED}Invalid choice. Please select 1, 2, 3, 4, 5, or 6.${NC}"
        exit 1
        ;;
esac

echo
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Start Docker services: docker-compose up -d"
echo "2. Run database migrations: alembic upgrade head"
echo "3. Start the application: python -m app.main"
echo "4. Access the UI at: http://localhost:3000"
echo
echo -e "${CYAN}Admin login: admin@afarensis.com / admin123${NC}"
echo

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker found${NC}"
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose found${NC}"
        echo
        read -p "Start Docker services now? (y/n): " start_docker
        if [ "$start_docker" = "y" ] || [ "$start_docker" = "Y" ]; then
            echo -e "${CYAN}🐳 Starting Docker services...${NC}"
            if docker-compose up -d; then
                echo -e "${GREEN}✅ Docker services started successfully!${NC}"
            else
                echo -e "${RED}❌ Failed to start Docker services${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️ Docker Compose not found - install it for easier service management${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Docker not found - install Docker for database and service management${NC}"
fi

echo
echo -e "${GREEN}🎉 Configuration complete!${NC}"
