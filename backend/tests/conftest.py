"""Shared test fixtures for InvoiceFlow backend.

Mocks heavy third-party dependencies at sys.modules level so unit tests
don't require supabase, asyncpg, or a live database.
"""
import os
import sys
import types
import pytest
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Mock third-party modules that require network/native libs
# ---------------------------------------------------------------------------
_MOCK_MODULES = [
    "supabase",
    "supabase_auth",
    "realtime",
    "storage3",
    "postgrest",
    "gotrue",
    "gotrue.errors",
    "asyncpg",
]

for mod_name in _MOCK_MODULES:
    if mod_name not in sys.modules:
        mock_mod = types.ModuleType(mod_name)
        # Make all attribute access return MagicMock
        mock_mod.__dict__.update({k: MagicMock() for k in dir(mock_mod)})
        sys.modules[mod_name] = mock_mod

# Provide create_client / Client on the supabase mock
sys.modules["supabase"].create_client = MagicMock()
sys.modules["supabase"].Client = MagicMock()

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
os.environ["APP_ENV"] = "testing"
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"
os.environ["SUPABASE_SERVICE_KEY"] = "test-service-key"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/test_db"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(params=["asyncio"])
def anyio_backend(request):
    """Restrict anyio tests to asyncio only (trio not installed)."""
    return request.param


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for unit tests."""
    with MagicMock() as client:
        yield client


@pytest.fixture
def mock_db():
    """Mock async database session."""
    db = MagicMock()
    db.execute = MagicMock()
    db.add = MagicMock()
    db.flush = MagicMock()
    db.delete = MagicMock()
    db.commit = MagicMock()
    return db


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "test@example.com",
        "full_name": "Test User",
        "role": "department_user",
        "department_id": None,
        "is_active": True,
    }


@pytest.fixture
def sample_admin_data():
    """Sample admin data for testing."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "email": "admin@example.com",
        "full_name": "Admin User",
        "role": "admin",
        "department_id": None,
        "is_active": True,
    }
