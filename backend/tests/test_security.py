"""Tests for security module — JWT handling and token verification."""
import pytest
from unittest.mock import patch, MagicMock
from jose import jwt as jose_jwt


class TestJWTSecurity:
    """Tests for JWT token decode and verification."""

    def test_allowed_algorithms_constant_exists(self):
        """ES256 should be the only allowed algorithm."""
        from app.core.security import ALLOWED_ALGORITHMS
        assert ALLOWED_ALGORITHMS == ["ES256"]

    def test_decode_rejects_garbage_token(self):
        """Completely invalid token should raise ValueError."""
        from app.core.security import decode_jwt_token
        with pytest.raises(ValueError, match="Invalid token"):
            decode_jwt_token("not.a.jwt")

    def test_get_signing_key_rejects_missing_kid(self):
        """Token without kid header should be rejected."""
        from app.core.security import _get_signing_key

        # A token with no kid will fail
        with pytest.raises((ValueError, Exception)):
            _get_signing_key("eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0.")

    def test_jwks_cache_ttl(self):
        """JWKS cache should have 1-hour TTL."""
        from app.core.security import _JWKS_TTL
        assert _JWKS_TTL == 3600


class TestPasswordValidation:
    """Tests for password strength validator."""

    def test_valid_password_accepted(self):
        """Strong password should pass validation."""
        from app.schemas import UserCreate
        user = UserCreate(
            email="test@example.com",
            password="StrongPass1",
            full_name="Test User",
            role="department_user",
        )
        assert user.password == "StrongPass1"

    def test_short_password_rejected(self):
        """Password shorter than 8 chars should fail."""
        from app.schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="at least 8 characters"):
            UserCreate(
                email="test@example.com",
                password="Ab1",
                full_name="Test User",
                role="department_user",
            )

    def test_no_uppercase_rejected(self):
        """Password without uppercase should fail."""
        from app.schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="uppercase"):
            UserCreate(
                email="test@example.com",
                password="lowercase1",
                full_name="Test User",
                role="department_user",
            )

    def test_no_lowercase_rejected(self):
        """Password without lowercase should fail."""
        from app.schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="lowercase"):
            UserCreate(
                email="test@example.com",
                password="UPPERCASE1",
                full_name="Test User",
                role="department_user",
            )

    def test_no_digit_rejected(self):
        """Password without digit should fail."""
        from app.schemas import UserCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="digit"):
            UserCreate(
                email="test@example.com",
                password="NoDigitHere",
                full_name="Test User",
                role="department_user",
            )
