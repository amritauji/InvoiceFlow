import logging
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.exceptions import AppException

logger = logging.getLogger("app.errors")


# ---------------------------------------------------------------------------
# HTTPS enforcement (for production behind reverse proxy)
# ---------------------------------------------------------------------------
class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Redirect HTTP requests to HTTPS in production.

    Expects the reverse proxy (nginx/ALB) to set X-Forwarded-Proto.
    """

    async def dispatch(self, request: Request, call_next):
        forwarded_proto = request.headers.get("x-forwarded-proto")
        if forwarded_proto == "http":
            url = str(request.url).replace("http://", "https://", 1)
            return RedirectResponse(url=url, status_code=301)
        return await call_next(request)


# ---------------------------------------------------------------------------
# Rate limiter (in-memory, per-IP, sliding window)
# ---------------------------------------------------------------------------
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter.  Configurable per-route via _routes dict."""

    # Default: 60 requests per 60 s window
    DEFAULT_LIMIT = 60
    DEFAULT_WINDOW = 60

    # Per-route overrides: path prefix -> (limit, window_seconds)
    _routes: dict[str, tuple[int, int]] = {
        "/api/v1/auth/login": (100, 900),       # 100 attempts / 15 min
        "/api/v1/auth/refresh": (100, 900),    # 100 attempts / 15 min
    }

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _get_limit(self, path: str) -> tuple[int, int]:
        for prefix, (limit, window) in self._routes.items():
            if path.startswith(prefix):
                return limit, window
        return self.DEFAULT_LIMIT, self.DEFAULT_WINDOW

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        limit, window = self._get_limit(request.url.path)
        now = time.time()

        # Prune old entries
        self._hits[key] = [t for t in self._hits[key] if now - t < window]

        if len(self._hits[key]) >= limit:
            retry_after = int(window - (now - self._hits[key][0]))
            logger.warning("Rate limit exceeded for %s from %s", request.url.path, client_ip)
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Too many requests. Try again in {retry_after}s.",
                    },
                },
                headers={"Retry-After": str(retry_after)},
            )

        self._hits[key].append(now)
        return await call_next(request)


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.detail,
            },
        },
    )


async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
            },
        },
    )


async def integrity_exception_handler(request: Request, exc: Exception):
    """Translate DB constraint violations (e.g. duplicate approval from a
    concurrent request) into a clean 409 instead of a 500."""
    logger.warning("Integrity error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=409,
        content={
            "success": False,
            "error": {
                "code": "CONFLICT",
                "message": "The operation conflicts with existing data. Please refresh and retry.",
            },
        },
    )
