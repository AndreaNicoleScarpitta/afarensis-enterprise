# Afarensis Enterprise Deployment Guide

> Complete deployment instructions for the enterprise-grade regulatory evidence review platform

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose**: Version 20.10+ recommended
- **Node.js**: Version 18+ for frontend development
- **Python**: Version 3.11+ for backend development
- **PostgreSQL**: Version 14+ (or use Docker)
- **Redis**: Version 6+ (or use Docker)

### API Keys Required

1. **OpenAI API Key**: Get from https://platform.openai.com/api-keys
2. **PubMed API Email**: Valid email for PubMed API requests
3. **Optional**: Claude API key for alternative LLM provider

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd afarensis-enterprise

# Copy environment template
cp .env.example .env

# Generate secure secrets
openssl rand -hex 32  # Use for SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # Use for ENCRYPTION_KEY
```

### 2. Configure Environment

Edit `.env` file with your settings:

```bash
# Required settings
SECRET_KEY=your-generated-secret-key
ENCRYPTION_KEY=your-generated-encryption-key
OPENAI_API_KEY=your-openai-api-key
PUBMED_EMAIL=your-email@organization.com

# Database (will be created automatically with Docker)
DATABASE_URL=postgresql://afarensis_user:afarensis_secure_password@postgres:5432/afarensis_enterprise

# Update domain names for production
ALLOWED_ORIGINS=https://your-domain.com
ALLOWED_HOSTS=your-domain.com,api.your-domain.com
```

### 3. Deploy with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 4. Initialize Database

```bash
# Run database migrations
docker-compose exec backend alembic upgrade head

# Create initial admin user
docker-compose exec backend python -m app.cli create-admin \
  --email admin@yourorganization.com \
  --name "System Administrator" \
  --password your-secure-password
```

### 5. Verify Installation

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs
- **Monitoring**: http://localhost:3001 (Grafana)
- **Task Queue**: http://localhost:5555 (Flower)

## 🏭 Production Deployment

### SSL/TLS Configuration

```bash
# Generate SSL certificates with Let's Encrypt
docker-compose --profile ssl run --rm certbot

# Update nginx configuration for HTTPS
# Edit nginx/conf.d/default.conf
```

### Load Balancing

For high availability, deploy multiple backend instances:

```bash
# Scale backend services
docker-compose up -d --scale backend=3 --scale celery-worker=2
```

### Database Backup

```bash
# Start backup service
docker-compose --profile backup up -d backup

# Manual backup
docker-compose exec postgres pg_dump -U afarensis_user afarensis_enterprise > backup.sql
```

### Monitoring Setup

1. **Prometheus**: Metrics collection at http://localhost:9090
2. **Grafana**: Dashboards at http://localhost:3001
3. **ELK Stack**: Log analysis at http://localhost:5601

## 🔧 Development Setup

### Backend Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up pre-commit hooks
pre-commit install

# Run development server
uvicorn app.main:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Database Development

```bash
# Create new migration
alembic revision --autogenerate -m "Add new feature"

# Apply migrations
alembic upgrade head

# Downgrade migration
alembic downgrade -1
```

## 📋 Configuration Guide

### Environment Variables

| Category | Variable | Description | Required |
|----------|----------|-------------|----------|
| **Security** | `SECRET_KEY` | JWT signing secret | ✅ |
| **Database** | `DATABASE_URL` | PostgreSQL connection | ✅ |
| **AI/LLM** | `OPENAI_API_KEY` | OpenAI API access | ✅ |
| **External** | `PUBMED_EMAIL` | PubMed API email | ✅ |
| **Features** | `FEDERATED_MODE` | Enable federated network | ❌ |

### Capability Layer Configuration

The system implements all 12 capability layers:

1. **Research Specification Layer** ✅
   - Protocol/SAP ingestion and parsing
   - Trial design extraction

2. **Evidence Discovery Layer** ✅
   - PubMed literature retrieval
   - ClinicalTrials.gov integration

3. **Evidence Extraction Layer** ✅
   - LLM-powered structured extraction
   - Multi-format document processing

4. **Anchor Candidate Generation** ✅
   - Comparator discovery algorithms
   - Cohort mapping engine

5. **Anchor Comparability Engine** ✅
   - Multi-dimensional scoring (6 dimensions)
   - Population alignment analysis

6. **Bias & Fragility Analysis** ✅
   - Automated bias detection
   - Regulatory vulnerability assessment

7. **Anchor Evaluation & Ranking** ✅
   - Composite scoring algorithm
   - Regulatory viability assessment

8. **Evidence Critique Layer** ✅
   - AI-generated regulatory critique
   - FDA reviewer simulation

9. **Reviewer Decision Layer** ✅
   - Human review interface
   - Audit trail compliance

10. **Regulatory Artifact Generation** ✅
    - FDA reviewer packets
    - EMA report templates

11. **Federated Evidence Network** 🔄 Beta
    - Multi-institutional data sharing
    - Privacy-preserving queries

12. **Evidence Operating System** 🔄 Beta
    - Pattern library
    - Regulatory precedent database

## 🔒 Security & Compliance

### 21 CFR Part 11 Compliance

- **Electronic Records**: Full audit trails maintained
- **Electronic Signatures**: Digital signature support
- **Data Integrity**: Encryption at rest and in transit
- **Access Controls**: Role-based permissions

### Security Features

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: AES-256 for sensitive data
- **Audit Logging**: Comprehensive action logging
- **Input Validation**: Strict validation and sanitization

### HIPAA Compliance (when applicable)

- **Data Encryption**: All PHI encrypted
- **Access Logs**: Complete access audit trails
- **User Training**: Built-in compliance documentation
- **Business Associate**: Contract templates provided

## 📊 Monitoring & Analytics

### Built-in Dashboards

1. **System Health**: Service status and performance
2. **Evidence Analytics**: Processing metrics and success rates
3. **User Activity**: Review patterns and throughput
4. **Compliance Metrics**: Audit trail and validation status

### Custom Metrics

```python
# Add custom metrics in your code
from app.monitoring import track_evidence_processing

@track_evidence_processing
async def process_evidence(evidence_id: str):
    # Your processing logic
    pass
```

### Alerting

Configure alerts for:
- System health issues
- Compliance violations
- Processing failures
- Security events

## 🚨 Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check PostgreSQL status
docker-compose logs postgres

# Reset database
docker-compose down -v postgres
docker-compose up -d postgres
```

**2. OpenAI API Rate Limits**
```bash
# Check API usage
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/usage

# Configure rate limiting in .env
RATE_LIMIT_PER_MINUTE=50
```

**3. Memory Issues**
```bash
# Monitor memory usage
docker stats

# Increase memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 8G
```

### Log Analysis

```bash
# Backend logs
docker-compose logs -f backend

# Database logs  
docker-compose logs -f postgres

# All services
docker-compose logs -f

# Specific time range
docker-compose logs --since 1h backend
```

### Performance Optimization

1. **Database Indexing**
   ```sql
   -- Add custom indexes for your queries
   CREATE INDEX CONCURRENTLY idx_evidence_project_score 
   ON evidence_records(project_id, (score->>'overall'));
   ```

2. **Caching Strategy**
   ```python
   # Use Redis for expensive operations
   from app.cache import cache_result
   
   @cache_result(ttl=3600)
   async def expensive_analysis():
       # Your analysis code
       pass
   ```

3. **Background Processing**
   ```python
   # Move heavy tasks to Celery
   from app.tasks import process_evidence_async
   
   task = process_evidence_async.delay(evidence_id)
   ```

## 🎯 Next Steps

### Immediate Actions
1. Complete environment configuration
2. Deploy to staging environment
3. Import initial data/evidence patterns
4. Configure user authentication
5. Set up monitoring alerts

### Week 1
1. User training and onboarding
2. Data migration from existing systems
3. Compliance validation testing
4. Performance optimization
5. Security penetration testing

### Month 1
1. Full production deployment
2. Federated network setup (if applicable)
3. Advanced analytics configuration
4. Custom workflow implementation
5. Regulatory submission testing

## 📞 Support

- **Documentation**: Full docs available in `docs/` directory
- **Issues**: GitHub Issues for bug reports
- **Enterprise Support**: contact@afarensis-enterprise.com
- **Security Issues**: security@afarensis-enterprise.com

## 📜 License

MIT License - see LICENSE file for details.

---

> **🏆 You're now ready to deploy the most advanced regulatory evidence review platform available.**
> 
> This system implements the complete 12-layer capability model described in the Synthetic Ascension framework, providing enterprise-grade regulatory evidence evaluation for FDA and international submissions.
