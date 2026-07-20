from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.core.exceptions import AppException
from app.core.middleware import app_exception_handler, generic_exception_handler

settings = get_settings()
logger = logging.getLogger("app.middleware")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print(f"Starting {settings.APP_NAME} ({settings.APP_ENV})")
    yield
    print(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=f"{settings.APP_NAME} API",
    version="1.0.0",
    description="Enterprise Invoice Approval & Workflow Management System",
    lifespan=lifespan,
)

# CORS
_cors_origins = (
    [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    if settings.CORS_ORIGINS
    else [
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_auth_header(request: Request, call_next):
    auth = request.headers.get("authorization", "NONE")
    logger.info("REQ %s %s | Auth: %s", request.method, request.url.path, auth[:50] if auth != "NONE" else "NONE")
    response = await call_next(request)
    if response.status_code >= 400:
        logger.info("RES %s %s -> %s", request.method, request.url.path, response.status_code)
    return response

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Register routes
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.invoices import router as invoices_router
from app.routes.approvals import router as approvals_router
from app.routes.audit import router as audit_router
from app.routes.dashboard import router as dashboard_router

app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_router, prefix=settings.API_V1_PREFIX)
app.include_router(invoices_router, prefix=settings.API_V1_PREFIX)
app.include_router(approvals_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}


@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
    }
