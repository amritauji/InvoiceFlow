"""Tests for rate limiter middleware."""
import time
import pytest
from unittest.mock import MagicMock, AsyncMock
from app.core.middleware import RateLimitMiddleware


class TestRateLimitMiddleware:
    """Tests for the in-memory rate limiter."""

    def _make_middleware(self):
        """Create a rate limit middleware instance."""
        mock_app = MagicMock()
        return RateLimitMiddleware(mock_app)

    def test_default_limits(self):
        """Default limit should be 60 requests per 60 seconds."""
        mw = self._make_middleware()
        assert mw.DEFAULT_LIMIT == 60
        assert mw.DEFAULT_WINDOW == 60

    def test_auth_login_limit(self):
        """Login endpoint should have 7 requests per 15 minutes."""
        mw = self._make_middleware()
        limit, window = mw._get_limit("/api/v1/auth/login")
        assert limit == 7
        assert window == 900

    def test_auth_refresh_limit(self):
        """Refresh endpoint should have 10 requests per 15 minutes."""
        mw = self._make_middleware()
        limit, window = mw._get_limit("/api/v1/auth/refresh")
        assert limit == 10
        assert window == 900

    def test_unknown_path_uses_default(self):
        """Unknown paths should use default limits."""
        mw = self._make_middleware()
        limit, window = mw._get_limit("/api/v1/invoices")
        assert limit == 60
        assert window == 60

    def test_hits_tracking(self):
        """Hits should be tracked per key."""
        mw = self._make_middleware()
        key = "test:127.0.0.1"
        mw._hits[key].append(time.time())
        assert len(mw._hits[key]) == 1

    def test_old_hits_pruned(self):
        """Old hits outside the window should be pruned."""
        mw = self._make_middleware()
        key = "test:127.0.0.1"
        # Add a hit from 2 hours ago
        mw._hits[key].append(time.time() - 7200)
        # Add a recent hit
        mw._hits[key].append(time.time())
        # Prune should remove the old one
        now = time.time()
        mw._hits[key] = [t for t in mw._hits[key] if now - t < 60]
        assert len(mw._hits[key]) == 1
