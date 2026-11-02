# InvoiceFlow — Final Report

## Bugs Found & Fixed

| # | Bug | Severity | Root Cause | Fix |
|---|-----|----------|-----------|-----|
| 1 | Invoice number race condition — concurrent creates produce duplicate `INV-YYYY-NNNN` | CRITICAL | Read-then-increment TOCTOU on MAX(number) query | PostgreSQL sequence `invoice_number_seq` + `nextval()` (migration 005) |
| 2 | Approval race condition — concurrent same-actor approvals all succeed, bypassing stage logic | CRITICAL | No row-level serialization on approval status transitions | `SELECT ... FOR UPDATE` row locks on `approve()`, `reject()`, `return()`, resubmit route |
| 3 | Duplicate approval records at DB level | HIGH | No unique constraint on actor+action per invoice | Partial unique index `uq_approval_actions_actor_approve` on `(invoice_id, actor_id) WHERE action = 'approve'` (migration 006); dedup of pre-existing duplicates |
| 4 | Database connection pool exhaustion under load | HIGH | App pool allowed 30 connections but Supabase pgBouncer caps at 15 (`EMAXCONNSESSION`) | Capped to `pool_size=10, max_overflow=5` (total 15); `pool_timeout=30` |
| 5 | Corrupt PDF causes 500 on print-pdf | MEDIUM | `PdfReader` crashes on junk content with `%PDF-` MIME | `validate_pdf_content()` (magic bytes + EOF check) at upload AND print time; `PyPdfError` catch → clean 400 |
| 6 | Bulk approve uses role names instead of permissions | MEDIUM | Hardcoded `['ceo','manager']` role list; accountant permission not discoverable | Backend `/auth/me` + login now return `permissions` array; frontend gates on `approval:approve` permission |
| 7 | 422 responses crash React rendering | MEDIUM | FastAPI `detail: [...]` array rendered directly as React child | New `utils/error.js` with `getErrorMessage()` normalizer; updated 7 call sites |
| 8 | Modal refetch loop (15s poll re-fetches on every render) | LOW | Inline `onClose` in `useEffect` dependency array triggers re-fetch | `useRef` for `onClose`; stable dependency arrays in `InvoicePreviewModal.jsx` |
| 9 | Search pagination broken — no offset, no real total | LOW | Search returned 10 results regardless of page; `total` was capped at 10 | Added `offset` parameter to backend search; frontend `SearchResults.jsx` uses offset-based page controls; real `meta.total` displayed |
| 10 | ApprovalQueue pagination only shows pages 1–5 | LOW | Always rendered 5 page buttons from page 1 | Windowed page numbers centered on current page with first/last ellipsis |
| 11 | Resubmit endpoint lacks serialization | LOW | Missing `FOR UPDATE` lock — concurrent resubmits could race | Added `SELECT ... FOR UPDATE` in resubmit route; replaced `get_invoice` with direct query using `resolve_invoice_id` |

## Concurrency Test Results

| Test | Result |
|------|--------|
| A) 10 concurrent invoice creates | **10/10 succeed**, all numbers unique |
| B) 10 concurrent same-actor approvals | **1/10 succeeds**, 9 blocked (400 "already voted") |
| C) 4-role concurrent approval | Acc1+Acc2+Mgr+Ceo in one batch — **all 4 succeed**, each advances exactly one stage; stage ownership enforced |
| D) 30 concurrent dashboard reads | **30/30 return 200**; pool exhaustion eliminated |
| E) Search pagination | Offset-based, `total=42`, 10/page, page controls correct |

## Backend & Frontend Tests

- Backend pytest: **58/58 pass**
- Frontend vitest: **12/12 pass**
- Frontend production build: **clean**

## Security Summary

- **Verified strong**: ES256 JWKS JWT; RBAC enforced server-side; self-approval blocked; login rate-limited (7/15min); parameterized SQL; upload validation (magic bytes + EOF); connection pool capped; HTTPS configurable
- **Accepted risks**: Refresh token in `localStorage` (XSS-exposable, mitigated by rotation); in-memory rate limiter (single-process); no WAF

## Deployment Plan (Docker Compose)

### Files created

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Python 3.13-slim, weasyprint deps, alembic on boot, uvicorn |
| `frontend/Dockerfile` | Node 22 build → nginx:1.27-alpine static serving |
| `frontend/nginx.conf` | SPA fallback + 30d asset caching |
| `nginx/Dockerfile` | nginx:1.27-alpine with reverse proxy config |
| `nginx/invoiceflow.docker.conf` | Reverse proxy (backend:8000, frontend:80), auth rate-limit, 12M upload, TLS-ready |
| `docker-compose.yml` | postgres:16 + backend + frontend + nginx; healthchecks; pgdata volume |
| `.env.example` | All required env vars documented |
| `SECURITY_REVIEW.md` | Security review findings |

### Deploy steps

```bash
# 1. Copy project to server
scp -r . user@server:/opt/invoiceflow

# 2. Configure environment
cp .env.example .env
nano .env   # fill in Supabase credentials + SECRET_KEY

# 3. Build & start
docker compose up -d --build

# 4. Verify
docker compose ps          # all healthy
curl http://localhost/api/v1/health
```

### Redeploying after code changes

```bash
git pull
docker compose up -d --build   # rebuilds only changed services
```

Database data persists in the `pgdata` volume. Alembic migrations auto-run on backend startup.

### HTTPS (optional)

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

See `DEPLOYMENT.md` for full instructions including certbot setup, backups, and scaling.
