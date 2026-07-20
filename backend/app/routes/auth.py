from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import async_session_factory
from app.schemas import LoginRequest, RefreshRequest
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user, UserContext

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate user and return JWT tokens."""
    result = await AuthService.login(body.email, body.password)

    async with async_session_factory() as db:
        from app.models.user import UserProfile
        from sqlalchemy import select
        resp = await db.execute(
            select(UserProfile).where(UserProfile.id == uuid.UUID(result["user_id"]))
        )
        profile = resp.scalar_one_or_none()

    return {
        "success": True,
        "data": {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "user": {
                "id": result["user_id"],
                "email": result["email"],
                "full_name": profile.full_name if profile else "",
                "role": profile.role if profile else "",
                "department_id": str(profile.department_id) if profile and profile.department_id else None,
            },
        },
    }


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """Refresh an expired access token."""
    result = await AuthService.refresh_session(body.refresh_token)
    return {
        "success": True,
        "data": {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
        },
    }


@router.get("/me")
async def get_me(current_user: UserContext = Depends(get_current_user)):
    """Get current authenticated user profile."""
    from sqlalchemy import select
    import uuid
    async with async_session_factory() as db:
        from app.models.user import UserProfile
        from app.models.department import Department
        result = await db.execute(
            select(UserProfile, Department.name)
            .outerjoin(Department, UserProfile.department_id == Department.id)
            .where(UserProfile.id == uuid.UUID(current_user.id))
        )
        row = result.first()
        profile = row[0] if row else None
        dept_name = row[1] if row else None

    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": profile.full_name if profile else "",
            "role": current_user.role.value,
            "department_id": current_user.department_id,
            "department_name": dept_name,
            "is_active": profile.is_active if profile else True,
        },
    }
