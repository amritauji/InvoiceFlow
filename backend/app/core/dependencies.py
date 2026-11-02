import logging
import time
from enum import Enum
from dataclasses import dataclass
from typing import Optional
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.security import decode_jwt_token
from app.core.exceptions import UnauthorizedException, ForbiddenException

logger = logging.getLogger("app.auth")

# In-memory user profile cache (TTL: 5 min)
_user_cache: dict[str, tuple[dict, float]] = {}
_USER_CACHE_TTL = 300


def _get_cached_user(user_id: str) -> Optional[dict]:
    entry = _user_cache.get(user_id)
    if entry and (time.time() - entry[1]) < _USER_CACHE_TTL:
        return entry[0]
    return None


def _set_cached_user(user_id: str, data: dict):
    _user_cache[user_id] = (data, time.time())


def invalidate_user_cache(user_id: str):
    """Remove a user from the in-memory cache. Call after role/status changes."""
    _user_cache.pop(user_id, None)


class UserRole(str, Enum):
    DEPARTMENT_USER = "department_user"
    ACCOUNTANT_1 = "accountant_1"
    ACCOUNTANT_2 = "accountant_2"
    ACCOUNTS_TEAM = "accounts_team"
    ACCOUNTS_HEAD = "accounts_head"
    CEO = "ceo"
    MANAGER = "manager"
    ADMIN = "admin"


@dataclass
class UserContext:
    id: str
    email: str
    role: UserRole
    full_name: str
    department_id: Optional[str] = None
    is_active: bool = True


# Role permission mapping
ROLE_PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.ADMIN: {
        "invoice:create", "invoice:read_own", "invoice:read_all",
        "invoice:update_own",
        "approval:verify", "approval:approve", "approval:reject",
        "approval:return", "approval:comment",
        "user:manage", "department:manage", "workflow:configure",
        "audit:read", "dashboard:stats_all", "file:upload", "file:download",
    },
    UserRole.ACCOUNTS_TEAM: {
        "invoice:read_all", "approval:verify", "approval:approve",
        "approval:reject", "approval:return", "approval:comment",
        "audit:read", "dashboard:stats_all", "file:download",
    },
    UserRole.ACCOUNTS_HEAD: {
        "invoice:read_all", "approval:approve", "approval:reject",
        "approval:return", "approval:comment",
        "audit:read", "dashboard:stats_all", "file:download",
    },
    UserRole.CEO: {
        "invoice:read_all", "approval:approve", "approval:reject",
        "approval:return", "approval:comment",
        "audit:read", "dashboard:stats_all", "file:download",
    },
    UserRole.MANAGER: {
        "invoice:read_all", "approval:approve", "approval:reject",
        "approval:return", "approval:comment",
        "audit:read", "dashboard:stats_all", "file:download",
    },
    UserRole.ACCOUNTANT_1: {
        "invoice:create", "invoice:read_all", "invoice:delete", "approval:verify", "approval:approve",
        "approval:reject", "approval:return", "approval:comment",
        "audit:read", "dashboard:stats_all", "file:download",
    },
    UserRole.ACCOUNTANT_2: {
        "invoice:create", "invoice:read_all", "approval:verify", "approval:approve",
        "approval:reject", "approval:return", "approval:comment",
        "audit:read", "dashboard:stats_all", "file:download",
    },
    UserRole.DEPARTMENT_USER: {
        "invoice:create", "invoice:read_own",
        "file:upload", "file:download", "dashboard:stats_own",
    },
}

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserContext:
    """Extract and verify JWT token, return authenticated user context."""
    if not credentials:
        raise UnauthorizedException("Missing authorization header")

    token = credentials.credentials
    try:
        payload = decode_jwt_token(token)
    except ValueError as e:
        raise UnauthorizedException(str(e))

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token: missing user ID")

    cached = _get_cached_user(user_id)
    if cached:
        return UserContext(**cached)

    from app.models.user import UserProfile

    result = await db.execute(
        select(UserProfile).where(UserProfile.id == user_id)
    )
    user_profile = result.scalar_one_or_none()

    if not user_profile:
        raise UnauthorizedException("User profile not found. Please contact admin.")
    if not user_profile.is_active:
        raise ForbiddenException("Account has been deactivated")

    user_data = {
        "id": str(user_profile.id),
        "email": user_profile.email,
        "role": UserRole(user_profile.role),
        "full_name": user_profile.full_name,
        "department_id": str(user_profile.department_id) if user_profile.department_id else None,
        "is_active": user_profile.is_active,
    }
    _set_cached_user(user_id, user_data)
    return UserContext(**user_data)


def require_role(*allowed_roles: UserRole):
    """Dependency factory that restricts access to specific roles."""

    async def _check_role(current_user: UserContext = Depends(get_current_user)) -> UserContext:
        if current_user.role not in allowed_roles:
            raise ForbiddenException(
                f"Required role: {', '.join(r.value for r in allowed_roles)}. "
                f"Your role: {current_user.role.value}"
            )
        return current_user

    return _check_role


def require_permission(permission: str):
    """Dependency factory that checks a specific permission."""

    async def _check_perm(current_user: UserContext = Depends(get_current_user)) -> UserContext:
        user_perms = ROLE_PERMISSIONS.get(current_user.role, set())
        if permission not in user_perms:
            raise ForbiddenException(f"Missing permission: {permission}")
        return current_user

    return _check_perm
