# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# ── Stage 2: Python backend + compiled frontend ─────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy backend
COPY backend/ backend/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist frontend/dist/

# Runtime config
ENV PORT=8000
ENV HOST=0.0.0.0

WORKDIR /app/backend

CMD ["sh", "-c", "\
  if [ -z \"$SECRET_KEY\" ]; then \
    export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))'); \
  fi && \
  uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
