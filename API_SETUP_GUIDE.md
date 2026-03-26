# 🔗 API Integration & Setup Guide for Afarensis Enterprise

This guide walks you through connecting all LLM and external APIs to unlock the full power of Afarensis Enterprise.

## 🎯 Overview

Afarensis Enterprise integrates with multiple AI and data services to provide comprehensive clinical evidence review:

- **LLM APIs**: Claude, OpenAI, Google AI for advanced analysis
- **Literature APIs**: PubMed for biomedical research
- **Trial APIs**: ClinicalTrials.gov for clinical trial data
- **Regulatory APIs**: FDA and EMA guidance documents

## 🔑 API Key Setup

### 1. Claude/Anthropic API (Recommended Primary LLM)

Claude excels at clinical evidence analysis and regulatory reasoning.

**How to get the API key:**
1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in to your account
3. Go to "API Keys" section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

**Configuration:**
```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Cost considerations:**
- Input: ~$3 per million tokens
- Output: ~$15 per million tokens
- Typical evidence review: $0.50-$2.00

### 2. OpenAI API (Recommended Fallback)

Provides redundancy and alternative analysis approaches.

**How to get the API key:**
1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to "API Keys"
4. Create new secret key
5. Copy the key (starts with `sk-`)

**Configuration:**
```bash
OPENAI_API_KEY=sk-your-actual-openai-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

**Cost considerations:**
- Input: ~$10 per million tokens
- Output: ~$30 per million tokens
- Typical evidence review: $1.00-$4.00

### 3. Google AI/Gemini API (Optional)

Alternative LLM provider for additional perspectives.

**How to get the API key:**
1. Visit [ai.google.dev](https://ai.google.dev)
2. Get started with Gemini API
3. Create a new project
4. Generate API key
5. Copy the key (starts with `AIza`)

**Configuration:**
```bash
GOOGLE_AI_API_KEY=your-actual-google-ai-key-here
GOOGLE_AI_MODEL=gemini-pro
```

### 4. PubMed/NCBI API (Recommended for Literature)

Enhances PubMed search rate limits and access.

**How to get the API key:**
1. Create NCBI account at [ncbi.nlm.nih.gov](https://www.ncbi.nlm.nih.gov/account/)
2. Go to Account Settings
3. Navigate to API Key Management
4. Generate a new API key
5. Copy the key

**Configuration:**
```bash
PUBMED_API_KEY=your-actual-pubmed-api-key-here
PUBMED_EMAIL=your-email@organization.com
```

**Rate limits:**
- Without API key: 3 requests/second
- With API key: 10 requests/second

## 🔧 Quick Configuration Methods

### Method 1: Interactive Configuration Wizard

Run the full configuration wizard:

**Windows:**
```cmd
configure.bat
```

**Linux/Mac:**
```bash
./configure.sh
```

**PowerShell:**
```powershell
.\configure.ps1
```

**Python (all platforms):**
```bash
python scripts/configure_environment.py
```

### Method 2: Quick Development Setup

For rapid development setup with minimal prompts:

```bash
python scripts/configure_environment.py quick
```

This will prompt only for essential API keys and use development defaults.

### Method 3: Manual Configuration

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your favorite editor and fill in API keys

3. Generate secure secrets:
   ```bash
   python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"
   python -c "import secrets; print('ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"
   ```

## 🧪 Testing Your API Connections

After configuration, test all APIs:

```bash
python scripts/test_apis.py
```

This will:
- Test each LLM API with a simple request
- Verify external API connectivity
- Check database and Redis connections
- Provide detailed diagnostics

**Sample output:**
```
🧪 API TEST REPORT
==================
🟢 Overall Status: HEALTHY
✅ Success Rate: 100% (6/6)
⏱️  Total Test Time: 2.3s

📋 Individual Test Results:
  ✅ ANTHROPIC: Success (1.2s, claude-3-5-sonnet-20241022)
  ✅ OPENAI: Success (0.8s, gpt-4-turbo-preview)  
  ✅ PUBMED: Success (0.9s, 3 results found)
  ✅ CLINICALTRIALS: Success (1.1s, 3 results found)
  ✅ DATABASE: Success (0.2s, 14 tables found)
  ✅ REDIS: Success (0.1s, redis v7.0)
```

## 🎛️ Advanced Configuration

### LLM Provider Priorities

Configure which LLM to use for different tasks:

```bash
# Primary LLM for bias analysis (Claude recommended)
ANTHROPIC_API_KEY=sk-ant-...

# Fallback LLM for redundancy  
OPENAI_API_KEY=sk-...

# Enable intelligent fallback
LLM_FALLBACK_ENABLED=true
LLM_RETRY_ATTEMPTS=3
```

### Rate Limiting Configuration

Adjust API call rates to match your quotas:

```bash
# PubMed rate limiting
PUBMED_RATE_LIMIT_PER_SECOND=3  # 10 with API key
EXTERNAL_API_TIMEOUT_SECONDS=30
EXTERNAL_API_RETRY_ATTEMPTS=3

# LLM rate limiting
LLM_RATE_LIMIT_PER_MINUTE=60
LLM_TIMEOUT_SECONDS=30
```

### Feature Toggles

Enable/disable specific integrations:

```bash
# Core AI features
ENABLE_LLM_INTEGRATION=true
ENABLE_BIAS_ANALYSIS=true
ENABLE_EVIDENCE_EXTRACTION=true

# External data sources
ENABLE_PUBMED_INTEGRATION=true
ENABLE_CLINICAL_TRIALS_INTEGRATION=true

# Fallback behavior when APIs unavailable
FALLBACK_TO_MOCK_DATA=true
```

## 🚀 Starting the System

Once APIs are configured:

1. **Start Docker services:**
   ```bash
   docker-compose up -d
   ```

2. **Run database migrations:**
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Start the application:**
   ```bash
   cd backend
   python -m app.main
   ```

4. **Access the UI:**
   - Frontend: http://localhost:3000
   - API docs: http://localhost:8000/docs
   - Admin login: `admin@afarensis.com` / `admin123`

## 💡 Cost Optimization Tips

### For Development
- Use Claude (lower cost) as primary LLM
- Set conservative rate limits
- Enable mock data fallback
- Use smaller result limits

### For Production
- Configure both Claude and OpenAI for redundancy
- Monitor token usage with built-in metrics
- Set appropriate rate limits for your usage
- Consider batch processing for large evidence sets

### Sample Monthly Costs

**Light usage** (10 evidence reviews/month):
- Claude: ~$20/month
- OpenAI: ~$40/month  
- PubMed: Free
- Total: ~$20-60/month

**Heavy usage** (100+ evidence reviews/month):
- Claude: ~$200/month
- OpenAI: ~$400/month
- PubMed: Free
- Total: ~$200-600/month

## 🛟 Troubleshooting

### Common Issues

**API key not working:**
```bash
# Test individual APIs
python scripts/test_apis.py

# Check key format
echo $ANTHROPIC_API_KEY  # Should start with sk-ant-
echo $OPENAI_API_KEY     # Should start with sk-
```

**Rate limit errors:**
```bash
# Reduce rate limits in .env
PUBMED_RATE_LIMIT_PER_SECOND=1
LLM_RATE_LIMIT_PER_MINUTE=30
```

**Connection timeouts:**
```bash
# Increase timeout values
EXTERNAL_API_TIMEOUT_SECONDS=60
LLM_TIMEOUT_SECONDS=45
```

**Mock data fallback:**
If APIs fail, the system automatically uses mock data when `FALLBACK_TO_MOCK_DATA=true`. This allows full UI testing even without API access.

### Support Resources

1. **Built-in diagnostics:** `python scripts/test_apis.py`
2. **Environment validation:** `python scripts/validate_environment.py`
3. **Configuration wizard:** `python scripts/configure_environment.py`
4. **API documentation:** http://localhost:8000/docs (when running)

## 🔒 Security Best Practices

1. **Keep API keys secure:**
   - Never commit `.env` to version control
   - Use different keys for dev/staging/production
   - Rotate keys periodically

2. **Monitor usage:**
   - Set up billing alerts on API providers
   - Monitor token usage in application metrics
   - Review access logs regularly

3. **Rate limiting:**
   - Configure conservative rate limits initially
   - Monitor for 429 (rate limit) errors
   - Implement exponential backoff

## ✅ Configuration Checklist

- [ ] At least one LLM API key configured (Claude recommended)
- [ ] PubMed API key for enhanced literature access
- [ ] Environment file secured (not in version control)
- [ ] APIs tested successfully
- [ ] Database and Redis connections working
- [ ] Rate limits appropriate for your usage
- [ ] Feature flags set correctly
- [ ] Security keys generated and unique
- [ ] Backup and monitoring configured

## 🎉 Next Steps

With APIs configured, you can now:

1. **Create your first project** in the UI
2. **Upload documents** for evidence extraction
3. **Run bias analysis** on clinical studies
4. **Generate regulatory artifacts** for submissions
5. **Explore the federated network** features (beta)

**Happy evidence reviewing! 🔬📊**
