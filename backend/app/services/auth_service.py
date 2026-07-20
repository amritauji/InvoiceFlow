import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.security import get_supabase_client
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException
from app.core.dependencies import UserRole
from app.models.user import UserProfile
from app.config import get_settings

settings = get_settings()

VALID_ROLES = [r.value for r in UserRole]


class AuthService:
    """Handles Supabase Auth operations and user profile management."""

    @staticmethod
    def _get_auth_client():
        return get_supabase_client().auth

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

        # Create in Supabase Auth
        auth = AuthService._get_auth_client()
        response = auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,  # Skip email verification for internal app
        })

        if not response or not response.user:
            raise BadRequestException("Failed to create user in authentication system")

        supabase_user_id = response.user.id

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
        role: Optional[str] = None,
        department_id: Optional[str] = None,
        phone: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> UserProfile:
        """Update a user profile."""
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

        return profile
