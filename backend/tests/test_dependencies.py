"""Tests for dependencies — UserRole enum and ROLE_PERMISSIONS mapping."""
import pytest
from app.core.dependencies import UserRole, ROLE_PERMISSIONS, UserContext


class TestUserRole:
    """Tests for UserRole enum."""

    def test_all_roles_defined(self):
        """All 8 expected roles should exist."""
        expected = {
            "department_user", "accountant_1", "accountant_2",
            "accounts_team", "accounts_head", "ceo", "manager", "admin",
        }
        actual = {r.value for r in UserRole}
        assert actual == expected

    def test_role_count(self):
        """Should have exactly 8 roles."""
        assert len(UserRole) == 8

    def test_admin_is_string(self):
        """UserRole values should be strings."""
        assert isinstance(UserRole.ADMIN.value, str)
        assert UserRole.ADMIN.value == "admin"


class TestRolePermissions:
    """Tests for ROLE_PERMISSIONS mapping."""

    def test_all_roles_have_permissions(self):
        """Every role should have at least one permission."""
        for role in UserRole:
            assert role in ROLE_PERMISSIONS, f"{role.value} missing from ROLE_PERMISSIONS"
            assert len(ROLE_PERMISSIONS[role]) > 0, f"{role.value} has no permissions"

    def test_admin_has_all_critical_permissions(self):
        """Admin should have user management and delete permissions."""
        admin_perms = ROLE_PERMISSIONS[UserRole.ADMIN]
        assert "user:manage" in admin_perms
        assert "department:manage" in admin_perms
        assert "workflow:configure" in admin_perms

    def test_admin_cannot_delete_invoices(self):
        """Only Accountant 1 can delete invoices; admin cannot."""
        assert "invoice:delete" not in ROLE_PERMISSIONS[UserRole.ADMIN]

    def test_department_user_limited_permissions(self):
        """Department users should only have create/read_own/upload."""
        dept_perms = ROLE_PERMISSIONS[UserRole.DEPARTMENT_USER]
        assert "invoice:create" in dept_perms
        assert "invoice:read_own" in dept_perms
        assert "file:upload" in dept_perms
        # Should NOT have admin-level permissions
        assert "user:manage" not in dept_perms
        assert "invoice:delete" not in dept_perms
        assert "approval:approve" not in dept_perms

    def test_accountant_1_can_delete(self):
        """Accountant 1 should be able to delete invoices."""
        assert "invoice:delete" in ROLE_PERMISSIONS[UserRole.ACCOUNTANT_1]

    def test_accountant_2_cannot_delete(self):
        """Accountant 2 should NOT be able to delete invoices."""
        assert "invoice:delete" not in ROLE_PERMISSIONS[UserRole.ACCOUNTANT_2]

    def test_ceo_can_approve(self):
        """CEO should have approval permissions."""
        ceo_perms = ROLE_PERMISSIONS[UserRole.CEO]
        assert "approval:approve" in ceo_perms
        assert "approval:reject" in ceo_perms

    def test_accounts_team_has_verify(self):
        """Accounts team should be able to verify."""
        assert "approval:verify" in ROLE_PERMISSIONS[UserRole.ACCOUNTS_TEAM]


class TestUserContext:
    """Tests for UserContext dataclass."""

    def test_create_user_context(self):
        ctx = UserContext(
            id="test-id",
            email="test@test.com",
            role=UserRole.ADMIN,
            full_name="Test Admin",
        )
        assert ctx.id == "test-id"
        assert ctx.is_active is True  # default
        assert ctx.department_id is None  # default

    def test_user_context_with_department(self):
        ctx = UserContext(
            id="test-id",
            email="test@test.com",
            role=UserRole.DEPARTMENT_USER,
            full_name="Test User",
            department_id="dept-123",
        )
        assert ctx.department_id == "dept-123"
