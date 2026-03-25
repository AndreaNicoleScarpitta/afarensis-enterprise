#!/bin/bash
# =============================================================================
# Afarensis Enterprise — Startup Script
# Installs deps, builds frontend, starts the server
# Works on Replit, Railway, Render, or any Linux host
# =============================================================================

set -e

echo "========================================"
echo "  Afarensis Enterprise v2.2"
echo "  Starting up..."
echo "========================================"

# ── Step 1: Install Python dependencies ──────────────────────────────
cd backend

if [ ! -f ".deps_installed" ]; then
    echo "[1/4] Installing Python dependencies (first run only)..."
    pip install -q -r requirements-prod.txt 2>&1 | tail -5
    touch .deps_installed
    echo "      Done."
else
    echo "[1/4] Dependencies already installed. Skipping."
fi

cd ..

# ── Step 2: Build frontend (if dist/ doesn't exist) ─────────────────
if [ ! -d "frontend/dist" ]; then
    if command -v node &> /dev/null && [ -d "frontend" ]; then
        echo "[2/4] Building frontend..."
        cd frontend
        npm install --production=false --silent 2>&1 | tail -3
        npm run build 2>&1 | tail -5
        cd ..
        echo "      Frontend built."
    else
        echo "[2/4] Node.js not available or frontend/ missing. Skipping frontend build."
        echo "      (API-only mode — frontend must be hosted separately)"
    fi
else
    echo "[2/4] Frontend already built. Skipping."
fi

# ── Step 3: Generate .env if missing ─────────────────────────────────
cd backend

if [ ! -f ".env" ]; then
    echo "[3/4] Generating .env with secure SECRET_KEY..."
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || python -c "import secrets; print(secrets.token_hex(32))")

    # Use DATABASE_URL from environment if set (Railway/Render inject this)
    DB_URL="${DATABASE_URL:-sqlite+aiosqlite:///./afarensis.db}"

    # If DATABASE_URL is PostgreSQL, use production mode; otherwise staging
    # (production mode rejects SQLite)
    if echo "$DB_URL" | grep -q "^postgresql"; then
        ENV_MODE="production"
    else
        ENV_MODE="staging"
    fi

    cat > .env << EOF
SECRET_KEY=${SECRET}
DATABASE_URL=${DB_URL}
ENVIRONMENT=${ENV_MODE}
AUTO_CREATE_TABLES=true
FALLBACK_TO_MOCK_DATA=true
ENABLE_LLM_INTEGRATION=false
HOST=0.0.0.0
PORT=${PORT:-8000}
ALLOWED_ORIGINS=["https://syntheticascendancy.tech","https://app.syntheticascendancy.tech","http://localhost:5173","http://localhost:5174"]
EOF
    echo "      Done. SECRET_KEY generated."
else
    echo "[3/4] .env already exists. Skipping."
fi

# ── Step 4: Start the server ─────────────────────────────────────────
echo "[4/4] Starting Uvicorn on port ${PORT:-8000}..."
echo "========================================"
echo ""

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
