FROM python:3.10-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy backend
COPY backend/ backend/

# Copy pre-built frontend
COPY frontend/dist/ frontend/dist/

# Generate secret key if not provided
ENV PORT=8000
ENV HOST=0.0.0.0

WORKDIR /app/backend

CMD ["sh", "-c", "\
  if [ -z \"$SECRET_KEY\" ]; then \
    export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))'); \
  fi && \
  uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
