import uuid
import logging
from typing import Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.security import get_auth_client
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException
from app.core.dependencies import UserRole
from app.models.user import UserProfile
from app.config import get_settings

logger = logging.getLogger("app.auth")

settings = get_settings()

VALID_ROLES = [r.value for r in UserRole]

# Reusable httpx client for admin API calls (bypasses supabase SDK quirks)
_admin_http = httpx.Client(timeout=15)


def _admin_headers():
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def _admin_base():
    return f"{settings.SUPABASE_URL}/auth/v1/admin"


class AuthService:
    """Handles Supabase Auth operations and user profile management."""

    @staticmethod
    def _get_auth_client():
        return get_auth_client().auth

    @staticmethod
    async def login(email: str, password: str) -> dict:
        """Authenticate user via Supabase Auth."""
        auth = AuthService._get_auth_client()
        response = auth.sign_in_with_password({"email": email, "password": password})
        if not response or not response.session:
            raise BadRequestException("Invalid email or password")

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user_id": response.user.id,
            "email": response.user.email,
        }

    @staticmethod
    async def refresh_session(refresh_token: str) -> dict:
        """Refresh an expired access token."""
        auth = AuthService._get_auth_client()
        response = auth.refresh_session(refresh_token)
        if not response or not response.session:
            raise BadRequestException("Invalid or expired refresh token")

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user_id": response.user.id,
            "email": response.user.email,
        }

    @staticmethod
    async def create_user(
        db: AsyncSession,
        *,
        email: str,
        password: str,
        full_name: str,
        role: str,
        department_id: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> UserProfile:
        """Create a Supabase Auth user + user_profiles record."""
        if role not in VALID_ROLES:
            raise BadRequestException(f"Invalid role: {role}")

        # Check duplicate email
        existing = await db.execute(
            select(UserProfile).where(UserProfile.email == email)
        )
        if existing.scalar_one_or_none():
            raise ConflictException(f"User with email '{email}' already exists")

        # Create in Supabase Auth via direct HTTP (avoids SDK issues)
        try:
            resp = _admin_http.post(
                f"{_admin_base()}/users",
                headers=_admin_headers(),
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            supabase_user_id = data["id"]
        except httpx.HTTPStatusError as exc:
            logger.error("Supabase create_user failed: %s %s", exc.response.status_code, exc.response.text[:300])
            raise BadRequestException(
                f"Failed to create user in authentication system: "
                f"Supabase returned {exc.response.status_code}"
            )
        except Exception as exc:
            logger.error("Supabase create_user error: %s", exc)
            raise BadRequestException(f"Failed to create user in authentication system: {exc}")

        # Create profile
        profile = UserProfile(
            id=uuid.UUID(supabase_user_id),
            email=email,
            full_name=full_name,
            role=role,
            department_id=uuid.UUID(department_id) if department_id else None,
            phone=phone,
            is_active=True,
        )
        db.add(profile)
        await db.flush()

        return profile

    @staticmethod
    async def get_profile(db: AsyncSession, user_id: str) -> UserProfile:
        """Get user profile by ID."""
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == uuid.UUID(user_id))
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise NotFoundException("User profile", user_id)
        return profile

    @staticmethod
    async def list_users(
        db: AsyncSession,
        *,
        role: Optional[str] = None,
        department_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[UserProfile], int]:
        """List user profiles with filters."""
        query = select(UserProfile)

        if role:
            query = query.where(UserProfile.role == role)
        if department_id:
            query = query.where(UserProfile.department_id == uuid.UUID(department_id))
        if is_active is not None:
            query = query.where(UserProfile.is_active == is_active)

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        result = await db.execute(
            query.order_by(UserProfile.full_name).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

    @staticmethod
    async def update_user(
        db: AsyncSession,
        user_id: str,
        *,
        full_name: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        role: Optional[str] = None,
        department_id: Optional[str] = None,
        phone: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> UserProfile:
        """Update a user profile. If email or password changes, syncs to Supabase Auth."""
        profile = await AuthService.get_profile(db, user_id)

        if full_name is not None:
            profile.full_name = full_name
        if role is not None:
            if role not in VALID_ROLES:
                raise BadRequestException(f"Invalid role: {role}")
            profile.role = role
        if department_id is not None:
            profile.department_id = uuid.UUID(department_id) if department_id else None
        if phone is not None:
            profile.phone = phone
        if is_active is not None:
            profile.is_active = is_active

        # Sync email change to Supabase Auth via direct HTTP
        if email is not None and email != profile.email:
            try:
                resp = _admin_http.put(
                    f"{_admin_base()}/users/{user_id}",
                    headers=_admin_headers(),
                    json={"email": email, "email_confirm": True},
                )
                resp.raise_for_status()
                profile.email = email
            except Exception as exc:
                logger.warning("Could not update Supabase Auth email for %s: %s", user_id, exc)
                raise BadRequestException(f"Failed to update email in authentication system: {exc}")

        # Sync password change to Supabase Auth via direct HTTP
        if password is not None:
            try:
                resp = _admin_http.put(
                    f"{_admin_base()}/users/{user_id}",
                    headers=_admin_headers(),
                    json={"password": password},
                )
                resp.raise_for_status()
            except Exception as exc:
                logger.warning("Could not update Supabase Auth password for %s: %s", user_id, exc)
                raise BadRequestException(f"Failed to update password in authentication system: {exc}")

        return profile

    @staticmethod
    async def delete_user(db: AsyncSession, user_id: str) -> dict:
        """Delete or soft-delete a user.

        Tries hard delete. If FK violation occurs, falls back to
        deactivating the user via raw SQL (avoids broken session state).

        Returns a dict with the result.
        """
        from sqlalchemy.exc import IntegrityError

        profile = await AuthService.get_profile(db, user_id)

        # Attempt to delete from Supabase Auth via direct HTTP
        try:
            resp = _admin_http.delete(
                f"{_admin_base()}/users/{user_id}",
                headers=_admin_headers(),
            )
            if resp.status_code not in (200, 404):
                logger.warning("Supabase delete_user returned %s: %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.warning("Could not delete Supabase Auth user %s: %s", user_id, exc)

        # Try hard delete — if FK violation, soft delete via raw SQL
        try:
            await db.delete(profile)
            await db.flush()
            return {"action": "deleted", "message": "User deleted successfully"}
        except IntegrityError:
            await db.rollback()
            await db.execute(
                text("UPDATE user_profiles SET is_active = false WHERE id = :uid"),
                {"uid": user_id},
            )
            await db.commit()
            return {"action": "deactivated", "message": "User deactivated (has existing invoices)"}
