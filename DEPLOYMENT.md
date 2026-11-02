# InvoiceFlow — Company Server Deployment

Self-hosted deployment for a multi-user company server using Docker Compose.

## Architecture

```
                  ┌──────────────────────────────────────────┐
 Internet ──► 80/443  nginx (TLS, rate-limit, reverse proxy) │
                  │    ├─ /api/      ──► backend:8000         │
                  │    └─ everything ──► frontend:80 (static) │
                  └──────────────────────────────────────────┘
                              │
                  ┌───────────┴────────────┐
                  │  backend (FastAPI)     │
                  │  └── alembic migrations│
                  └───────────┬────────────┘
                              │ postgres:5432
                        ┌─────▼─────┐
                        │ postgres  │
                        └───────────┘

  Auth (Supabase Auth) and Storage (Supabase Storage) remain cloud-hosted.
  The application's data lives in the local PostgreSQL container.
```

## Prerequisites

- A Linux server (Ubuntu/Debian) with Docker + Docker Compose plugin installed
- A domain name (A record pointing at the server) for HTTPS
- A Supabase project (Auth + Storage) with the buckets `invoice-originals` and `invoice-approved`

## Quick start

```bash
# 1. Prepare the environment
cp .env.example .env
nano .env                     # fill in POSTGRES_PASSWORD, SUPABASE_*, SECRET_KEY, CORS_ORIGINS

# 2. Build and start (first build takes a few minutes)
docker compose up -d --build

# 3. Verify
docker compose ps             # all services "running"/"healthy"
curl http://localhost/health  # {"status":"ok",...}
```

The API is reachable at `http://<server>/api/v1` and the app at `http://<server>/`.

## HTTPS (Let's Encrypt)

1. Set `CORS_ORIGINS` and `SUPABASE_URL` to the real domain.
2. Run nginx in HTTP-only mode first, then issue a cert:

```bash
docker compose run --rm --entrypoint sh certbot -c \
  "certbot certonly --webroot -w /var/www/certbot -d invoiceflow.example.com --email admin@example.com --agree-tos -n"
```

3. The existing `nginx/invoiceflow.conf` is the TLS-ready template (place it in
   `nginx/invoiceflow.docker.conf` after adjusting `server_name` and mounting
   your certificate paths).
4. Restart nginx: `docker compose restart nginx`.

> The compose `nginx` container only listens on HTTP by default. For production
> TLS, replace `nginx/invoiceflow.docker.conf` with the HTTPS variant and mount
> `/etc/letsencrypt` (see the commented `certbot` volume in `docker-compose.yml`).

## Database migrations

Migrations run automatically on backend startup (`alembic upgrade head`).
The initial schema (001–006) creates all tables and the invoice-number sequence.

## Scaling / workers

The backend runs a single uvicorn worker because the in-memory rate limiter and
user cache are per-process. To scale for more users, run multiple backend
containers behind nginx (adjust the `upstream backend` block to include
`backend:8000 backend:8001 ...`), not multiple uvicorn workers in one container.

## Backups

```bash
# Daily at 02:00 (crontab):
docker compose exec -T postgres pg_dump -U invoiceflow invoiceflow | gzip > ~/backups/invoiceflow_$(date +%F).sql.gz
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` | backend not up yet | `docker compose logs backend` |
| `InternalServerError: EMAXCONNSESSION` | Supabase pgBouncer client cap | only happens against Supabase-hosted DB; the compose `postgres` service has no such limit |
| `401` on login | wrong `SUPABASE_*` keys | check `.env` |
| CORS errors | `CORS_ORIGINS` missing your domain | set it to the full https origin |
