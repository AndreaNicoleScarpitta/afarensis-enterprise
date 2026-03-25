# Afarensis Enterprise: Clinical Evidence Review Platform

> Enterprise-grade regulatory evidence review platform for FDA and international regulatory submissions

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![Security: bandit](https://img.shields.io/badge/security-bandit-yellow.svg)](https://github.com/PyCQA/bandit)

## 🎯 Executive Summary

Afarensis Enterprise is the definitive clinical evidence review system designed for regulatory agencies, pharmaceutical companies, and clinical research organizations. It transforms the complex process of evaluating external control cohorts and synthetic control arms into a structured, AI-enhanced workflow that meets FDA requirements for evidence-based regulatory submissions.

Built from the ground up for enterprise environments, this system implements the complete 12-layer capability model described in the Synthetic Ascension framework, from protocol ingestion through regulatory artifact generation.

## 🏗️ Architecture Overview

### Core Capability Layers (Fully Implemented)

1. **Research Specification Layer** - Protocol/SAP ingestion and parsing
2. **Evidence Discovery Layer** - Automated literature and trial registry retrieval  
3. **Evidence Extraction Layer** - LLM-powered structured data extraction
4. **Anchor Candidate Generation** - Comparator discovery and mapping
5. **Anchor Comparability Engine** - Multi-dimensional scoring and alignment
6. **Bias & Fragility Analysis** - Regulatory vulnerability detection
7. **Anchor Evaluation & Ranking** - Composite scoring and ranking
8. **Evidence Critique Layer** - Automated regulatory critique generation
9. **Reviewer Decision Layer** - Human review interface with audit trails
10. **Regulatory Artifact Generation** - FDA-style reviewer packets and reports
11. **Federated Evidence Network** - Institutional data integration (Beta)
12. **Evidence Operating System** - Pattern library and network effects

### Key Features

- **🔍 Intelligent Evidence Extraction**: Advanced LLM processing of protocols, SAPs, and literature
- **📊 Multi-Dimensional Scoring**: Regulatory-grade comparability assessment across 6+ dimensions
- **👨‍⚕️ Professional Review Interface**: Purpose-built for regulatory reviewers and statisticians
- **📋 Regulatory Compliance**: 21 CFR Part 11, GxP, and audit trail compliance
- **🔒 Enterprise Security**: RBAC, encryption, and secure multi-tenant architecture
- **📈 Advanced Analytics**: Bias detection, fragility analysis, and evidence quality metrics
- **📑 Export Capabilities**: FDA reviewer packets, EMA reports, and regulatory submissions
- **🏥 Institutional Integration**: Federated data access and shared constraint libraries

### Target Users

- **FDA/EMA Reviewers**: Clinical and statistical reviewers assessing drug applications
- **Pharmaceutical Companies**: Regulatory affairs teams preparing evidence packages
- **Clinical Research Organizations**: Evidence synthesis and regulatory consulting
- **Academic Medical Centers**: Systematic review and real-world evidence research
- **Regulatory Consultants**: Independent evidence evaluation and advisory services

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- OpenAI API key (or Claude API)

### Production Deployment (Docker)

```bash
git clone <repository-url>
cd afarensis-enterprise
cp .env.example .env
# Configure your environment variables
docker-compose -f docker-compose.prod.yml up -d
```

### Development Setup

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head

# Frontend setup  
cd ../frontend
npm install
npm run dev

# Start services
cd ../backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

🌐 **Access the application**: http://localhost:3000

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `SECRET_KEY` | JWT signing secret | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes | - |
| `CLAUDE_API_KEY` | Claude API key (alternative) | No | - |
| `PUBMED_EMAIL` | Email for PubMed API requests | Yes | - |
| `LOG_LEVEL` | Application log level | No | `INFO` |
| `ENABLE_AUDIT_LOG` | Enable detailed audit logging | No | `true` |
| `MAX_UPLOAD_SIZE` | Maximum file upload size (MB) | No | `100` |
| `FEDERATED_NODES` | Comma-separated federated node URLs | No | - |

## 🎨 Professional Interface

The Afarensis Enterprise interface features a distinctive, regulatory-focused design built with:

- **Modern React Architecture**: TypeScript, Vite, and component-based architecture
- **Regulatory-First UX**: Workflows optimized for evidence review and decision-making
- **Professional Typography**: Custom font pairing for readability and authority
- **Advanced Visualizations**: Comparability heatmaps, bias indicators, and evidence quality scores
- **Responsive Design**: Optimized for both desktop review stations and mobile devices
- **Accessibility**: WCAG 2.1 AA compliance for government and institutional use

## 📚 Documentation

- **[User Guide](docs/user-guide.md)**: Complete guide for reviewers and administrators
- **[API Documentation](docs/api.md)**: Comprehensive API reference and examples  
- **[Deployment Guide](docs/deployment.md)**: Production deployment and scaling
- **[Security Guide](docs/security.md)**: Security controls and compliance features
- **[Integration Guide](docs/integration.md)**: Federated network setup and CTMS integration
- **[Validation Guide](docs/validation.md)**: GxP validation and regulatory documentation

## 🧪 Quality Assurance

### Testing Suite

```bash
# Run complete test suite
pytest

# Coverage reporting
pytest --cov=app --cov-report=html --cov-report=term

# Test categories
pytest tests/unit/           # Unit tests  
pytest tests/integration/    # Integration tests
pytest tests/security/       # Security tests
pytest tests/regulatory/     # Regulatory compliance tests
pytest tests/performance/    # Performance and load tests
```

### Code Quality

- **Static Analysis**: mypy, bandit, and pylint
- **Code Formatting**: black and isort
- **Security Scanning**: bandit and safety
- **Dependency Scanning**: pip-audit
- **Documentation**: Automatic API docs and type hints

## 🏭 Production Features

### Scalability & Performance

- **Async Architecture**: Full async/await implementation
- **Caching Strategy**: Redis-backed caching for evidence retrieval
- **Database Optimization**: Proper indexing and query optimization
- **Background Processing**: Celery for long-running evidence extraction
- **Load Balancing**: Nginx configuration for multi-instance deployment

### Security & Compliance

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: AES-256 for data at rest, TLS 1.3 for transit
- **Audit Trails**: Comprehensive logging of all user actions
- **Input Validation**: Strict validation and sanitization
- **Rate Limiting**: API rate limiting and DDoS protection

### Monitoring & Observability

- **Health Checks**: Comprehensive system health monitoring
- **Metrics**: Prometheus metrics for performance monitoring
- **Logging**: Structured JSON logging with correlation IDs
- **Tracing**: OpenTelemetry integration for distributed tracing
- **Alerting**: Critical system and business metric alerting

## 📈 Enterprise Integration

### Federated Network (Beta)

Connect multiple institutions while maintaining data privacy:

```yaml
# Docker Compose federated node
services:
  afarensis-node:
    image: afarensis/enterprise:latest
    environment:
      - FEDERATED_MODE=true
      - NODE_ID=institution-001
      - ALLOWED_QUERIES=evidence,constraints
```

### API Integration

RESTful API with OpenAPI 3.0 specification:

```python
# Example: Programmatic evidence review
import afarensis

client = afarensis.Client(api_key="your-key")
project = client.create_project(
    protocol_text=protocol,
    evidence_sources=["pubmed", "clinicaltrials"]
)
results = client.run_analysis(project.id)
```

## 🗺️ Roadmap

### Version 2.0 (Q2 2024)
- ✅ Complete 12-layer capability model implementation
- ✅ Enterprise security and compliance features  
- ✅ Professional regulatory review interface
- ✅ Automated bias and fragility analysis
- 🔄 Real-time collaborative review workflows
- 🔄 Advanced AI bias detection algorithms

### Version 2.1 (Q3 2024)  
- 📅 Full federated network implementation
- 📅 Multi-language support (European regulatory agencies)
- 📅 Advanced workflow automation and business rules
- 📅 Integration with major CTMS platforms
- 📅 Mobile-first responsive interface

### Version 3.0 (Q1 2025)
- 📅 Global evidence operating system
- 📅 Regulatory artifact standardization
- 📅 Machine learning bias detection
- 📅 International regulatory harmonization

## 🤝 Enterprise Support

- **Professional Services**: Implementation, validation, and training
- **24/7 Support**: Enterprise SLA with guaranteed response times  
- **Regulatory Consulting**: Expert guidance on evidence package development
- **Custom Development**: Tailored features for specific regulatory contexts
- **Compliance Documentation**: GxP validation documentation and support

## 📄 License & Legal

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Regulatory Notice**: This software is designed to support regulatory decision-making but does not replace professional judgment. Users are responsible for ensuring compliance with applicable regulatory requirements in their jurisdiction.

**Validation Notice**: This software is provided for use in regulated environments. Appropriate validation and testing should be performed before use in regulatory submissions.

For questions, enterprise licensing, or support: contact@afarensis-enterprise.com

---

> **Built for the future of evidence-based regulatory decision making**
> 
> Transforming clinical evidence review from manual, fragmented processes into structured, AI-enhanced workflows that meet the highest standards of regulatory science.

