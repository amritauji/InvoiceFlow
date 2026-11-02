"""Tests for Pydantic schemas — validation and serialization."""
import pytest
from pydantic import ValidationError
from app.schemas import (
    LoginRequest, RefreshRequest, UserCreate, UserUpdate,
    InvoiceCreate, InvoiceUpdate, DepartmentCreate, DepartmentUpdate,
)


class TestLoginRequest:
    def test_valid_login(self):
        req = LoginRequest(email="user@test.com", password="pass123")
        assert req.email == "user@test.com"

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(password="pass123")


class TestUserCreate:
    def test_valid_user(self):
        user = UserCreate(
            email="new@test.com",
            password="StrongPass1",
            full_name="New User",
            role="department_user",
        )
        assert user.email == "new@test.com"
        assert user.role == "department_user"

    def test_optional_fields_default_none(self):
        user = UserCreate(
            email="new@test.com",
            password="StrongPass1",
            full_name="New User",
            role="admin",
        )
        assert user.department_id is None
        assert user.phone is None

    def test_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(
                email="not-an-email",
                password="StrongPass1",
                full_name="Test",
                role="admin",
            )


class TestUserUpdate:
    def test_all_optional(self):
        update = UserUpdate()
        assert update.full_name is None
        assert update.role is None
        assert update.is_active is None
        assert update.email is None
        assert update.password is None

    def test_partial_update(self):
        update = UserUpdate(full_name="Updated Name", is_active=False)
        assert update.full_name == "Updated Name"
        assert update.is_active is False
        assert update.role is None
        assert update.email is None
        assert update.password is None

    def test_email_update(self):
        update = UserUpdate(email="new@example.com")
        assert update.email == "new@example.com"

    def test_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            UserUpdate(email="not-an-email")

    def test_password_update(self):
        update = UserUpdate(password="NewPass123")
        assert update.password == "NewPass123"

    def test_weak_password_rejected(self):
        with pytest.raises(ValidationError, match="at least 8 characters"):
            UserUpdate(password="weak")

    def test_no_uppercase_password_rejected(self):
        with pytest.raises(ValidationError, match="uppercase"):
            UserUpdate(password="nouppercase1")

    def test_no_digit_password_rejected(self):
        with pytest.raises(ValidationError, match="digit"):
            UserUpdate(password="NoDigitHere")


class TestInvoiceCreate:
    def test_valid_invoice(self):
        inv = InvoiceCreate(vendor_name="ACME Corp", amount=1500.00)
        assert inv.vendor_name == "ACME Corp"
        assert inv.amount == 1500.00

    def test_remarks_optional(self):
        inv = InvoiceCreate(vendor_name="ACME", amount=100)
        assert inv.remarks is None


class TestDepartmentCreate:
    def test_valid_department(self):
        dept = DepartmentCreate(name="Engineering", code="ENG")
        assert dept.code == "ENG"
        assert dept.description is None
