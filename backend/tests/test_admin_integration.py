"""Integration-style tests for admin user CRUD operations.

These tests mock the database and Supabase client to verify the full
request → service → response pipeline without requiring a live database.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from pydantic import ValidationError

from app.schemas import UserUpdate, UserCreate


class TestAdminUserUpdateSchema:
    """Tests for the expanded UserUpdate schema with email/password."""

    def test_email_change_accepted(self):
        """Email field should be accepted in update payload."""
        update = UserUpdate(email="newemail@test.com")
        assert update.email == "newemail@test.com"

    def test_password_change_accepted(self):
        """Password field should be accepted in update payload."""
        update = UserUpdate(password="NewStrong1Pass")
        assert update.password == "NewStrong1Pass"

    def test_all_fields_optional(self):
        """Every field should be optional for partial updates."""
        update = UserUpdate()
        assert update.full_name is None
        assert update.email is None
        assert update.password is None
        assert update.role is None
        assert update.department_id is None
        assert update.phone is None
        assert update.is_active is None

    def test_combined_update(self):
        """Multiple fields can be updated simultaneously."""
        update = UserUpdate(
            full_name="Jane Doe",
            email="jane@company.com",
            password="Secure1234",
            role="manager",
            phone="555-0100",
            is_active=True,
        )
        assert update.full_name == "Jane Doe"
        assert update.email == "jane@company.com"
        assert update.password == "Secure1234"
        assert update.role == "manager"

    def test_password_validation_enforced(self):
        """Password validation should apply on update too."""
        with pytest.raises(ValidationError):
            UserUpdate(password="weak")

    def test_email_validation_enforced(self):
        """Email validation should apply on update too."""
        with pytest.raises(ValidationError):
            UserUpdate(email="not-valid")


class TestAdminUserCreateSchema:
    """Tests for UserCreate with password validation."""

    def test_strong_password_accepted(self):
        user = UserCreate(
            email="user@test.com",
            password="Strong1Pass",
            full_name="Test",
            role="admin",
        )
        assert user.password == "Strong1Pass"

    def test_weak_password_rejected(self):
        with pytest.raises(ValidationError, match="at least 8 characters"):
            UserCreate(
                email="user@test.com",
                password="Ab1",
                full_name="Test",
                role="admin",
            )

    def test_missing_uppercase_rejected(self):
        with pytest.raises(ValidationError, match="uppercase"):
            UserCreate(
                email="user@test.com",
                password="lowercase1",
                full_name="Test",
                role="admin",
            )

    def test_missing_digit_rejected(self):
        with pytest.raises(ValidationError, match="digit"):
            UserCreate(
                email="user@test.com",
                password="NoDigitHere",
                full_name="Test",
                role="admin",
            )


class TestAuthServiceUpdateUser:
    """Tests for AuthService.update_user with email/password sync."""

    @pytest.mark.anyio
    async def test_update_full_name_only(self):
        """Updating only full_name should not touch Supabase Auth."""
        mock_db = AsyncMock()
        mock_profile = MagicMock()
        mock_profile.full_name = "Old Name"
        mock_profile.email = "test@test.com"
        mock_profile.role = "admin"

        with patch("app.services.auth_service.AuthService.get_profile", return_value=mock_profile):
            from app.services.auth_service import AuthService
            result = await AuthService.update_user(
                mock_db, "user-123", full_name="New Name"
            )
            assert result.full_name == "New Name"
            assert result.email == "test@test.com"

    @pytest.mark.anyio
    async def test_update_email_triggers_supabase(self):
        """Changing email should call Supabase admin API."""
        mock_db = AsyncMock()
        mock_profile = MagicMock()
        mock_profile.email = "old@test.com"
        mock_profile.role = "admin"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.auth_service.AuthService.get_profile", return_value=mock_profile), \
             patch("app.services.auth_service._admin_http") as mock_http:
            mock_http.put.return_value = mock_resp
            from app.services.auth_service import AuthService
            result = await AuthService.update_user(
                mock_db, "user-123", email="new@test.com"
            )
            mock_http.put.assert_called_once()
            assert result.email == "new@test.com"

    @pytest.mark.anyio
    async def test_update_password_triggers_supabase(self):
        """Setting password should call Supabase admin API."""
        mock_db = AsyncMock()
        mock_profile = MagicMock()
        mock_profile.email = "test@test.com"
        mock_profile.role = "admin"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.auth_service.AuthService.get_profile", return_value=mock_profile), \
             patch("app.services.auth_service._admin_http") as mock_http:
            mock_http.put.return_value = mock_resp
            from app.services.auth_service import AuthService
            result = await AuthService.update_user(
                mock_db, "user-123", password="NewPass123"
            )
            mock_http.put.assert_called_once()

    @pytest.mark.anyio
    async def test_same_email_no_supabase_call(self):
        """If email hasn't changed, Supabase Auth should not be called."""
        mock_db = AsyncMock()
        mock_profile = MagicMock()
        mock_profile.email = "same@test.com"
        mock_profile.role = "admin"

        with patch("app.services.auth_service.AuthService.get_profile", return_value=mock_profile), \
             patch("app.services.auth_service._admin_http") as mock_http:
            from app.services.auth_service import AuthService
            await AuthService.update_user(
                mock_db, "user-123", email="same@test.com"
            )
            mock_http.put.assert_not_called()
