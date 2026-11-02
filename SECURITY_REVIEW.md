# Security Review Summary

## Verified Secure

| Area | Status | Detail |
|------|--------|--------|
| JWT verification | Strong | ES256-only via Supabase JWKS (`security.py`); `kid` matching, audience check, 1hr cache; no algorithm confusion possible |
| RBAC | Strong | Server-side `require_role()` enforced at route level; `ROLE_PERMISSIONS` map in `dependencies.py`; frontend permission check (defense-in-depth only) |
| Conflict-of-interest | Strong | Self-approval blocked server-side with dedicated `403 Self-approval not allowed` |
| Rate limiting | Good | Login: 7 attempts / 15min; configurable `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS`; nginx auth zone burst 5 / nodelay |
| SQL injection | Prevented | All queries use SQLAlchemy parameterized statements; raw SQL uses bound parameters |
| XSS | Prevented | React escapes output by default; no `dangerouslySetInnerHTML` usage; `getErrorMessage()` returns plain strings |
| CORS | Configurable | Origins from env; production warning if empty |
| File upload validation | Strong (now) | Magic bytes (`%PDF-`) + `%%EOF` marker checked at upload AND at print time; size cap (`MAX_FILE_SIZE`); rejects non-PDF content early |
| Connection pool | Corrected | `pool_size=10, max_overflow=5` matches Supabase's 15 pgBouncer sessions; `pool_timeout=30` prevents indefinite waits |
| HTTPS available | Configured | nginx TLS with certbot ACME challenge volumes; HSTS header ready |
| Secrets | Proper | Not in source; `SECRET_KEY` warns in production; Supabase creds from `.env`; Docker Compose requires `.env` |

## Known Accepted Risks

| Risk | Mitigation | Recommendation |
|------|-----------|----------------|
| Refresh token in `localStorage` | Short-lived access tokens + rotation | Migrate to httpOnly secure cookie for tighter XSS defense |
| In-memory rate limiting (single process) | Fine for 1-worker Uvicorn | Use Redis-backed limiter if scaling to N workers |
| No WAF / bot protection | Rate limiting + HTTPS | Add Cloudflare or similar for DDoS and bot defense |
| `SECRET_KEY` default fallback | Production warning logged | Always set via env; do not ship default |

## Migration History (security-relevant)

- `005_invoice_number_sequence` — Eliminates invoice number race via PostgreSQL sequence
- `006_unique_approval_index` — Prevents duplicate approvals at DB level with partial unique index
