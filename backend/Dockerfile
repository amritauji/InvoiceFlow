FROM python:3.13-slim

# weasyprint runtime dependencies (pango/cairo stack)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run migrations on startup, then start the API.
# Multi-worker is disabled because the in-memory rate limiter / user cache are
# per-process; run with --workers 1 behind nginx (scaling = more containers).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
