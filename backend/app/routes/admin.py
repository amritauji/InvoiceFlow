from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import UserCreate, UserUpdate, UserResponse, DepartmentCreate, DepartmentUpdate, DepartmentResponse
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user, require_role, UserContext, UserRole
from app.models.department import Department
from sqlalchemy import select
import uuid

router = APIRouter(prefix="/admin", tags=["Admin - Users & Departments"])


# --- Department Endpoints ---

@router.get("/departments")
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
):
    result = await db.execute(
        select(Department).order_by(Department.name)
    )
    departments = result.scalars().all()
    return {
        "success": True,
        "data": [
            {
                "id": str(d.id),
                "name": d.name,
                "code": d.code,
                "description": d.description,
                "is_active": d.is_active,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in departments
        ],
    }


@router.post("/departments")
async def create_department(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    department = Department(
        name=body.name,
        code=body.code.upper(),
        description=body.description,
    )
    db.add(department)
    await db.flush()

    return {
        "success": True,
        "data": {
            "id": str(department.id),
            "name": department.name,
            "code": department.code,
            "description": department.description,
            "is_active": department.is_active,
            "created_at": department.created_at.isoformat() if department.created_at else None,
        },
    }


@router.patch("/departments/{department_id}")
async def update_department(
    department_id: str,
    body: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    result = await db.execute(
        select(Department).where(Department.id == uuid.UUID(department_id))
    )
    dept = result.scalar_one_or_none()
    if not dept:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Department", department_id)

    if body.name is not None:
        dept.name = body.name
    if body.description is not None:
        dept.description = body.description
    if body.is_active is not None:
        dept.is_active = body.is_active

    return {
        "success": True,
        "data": {
            "id": str(dept.id),
            "name": dept.name,
            "code": dept.code,
            "description": dept.description,
            "is_active": dept.is_active,
        },
    }


# --- User Endpoints ---

@router.get("/users")
async def list_users(
    role: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    users, total = await AuthService.list_users(
        db, role=role, department_id=department_id,
        is_active=is_active, limit=limit, offset=offset,
    )

    # Fetch department names
    dept_names = {}
    if users:
        dept_ids = [u.department_id for u in users if u.department_id]
        if dept_ids:
            dept_result = await db.execute(
                select(Department).where(Department.id.in_(dept_ids))
            )
            dept_names = {str(d.id): d.name for d in dept_result.scalars().all()}

    return {
        "success": True,
        "data": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "department_id": str(u.department_id) if u.department_id else None,
                "department_name": dept_names.get(str(u.department_id)) if u.department_id else None,
                "phone": u.phone,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.post("/users")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    profile = await AuthService.create_user(
        db,
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        role=body.role,
        department_id=body.department_id,
        phone=body.phone,
    )

    return {
        "success": True,
        "data": {
            "id": str(profile.id),
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "department_id": str(profile.department_id) if profile.department_id else None,
            "is_active": profile.is_active,
        },
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    profile = await AuthService.get_profile(db, user_id)

    dept_name = None
    if profile.department_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == profile.department_id)
        )
        dept = dept_result.scalar_one_or_none()
        dept_name = dept.name if dept else None

    return {
        "success": True,
        "data": {
            "id": str(profile.id),
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "department_id": str(profile.department_id) if profile.department_id else None,
            "department_name": dept_name,
            "phone": profile.phone,
            "is_active": profile.is_active,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        },
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    profile = await AuthService.update_user(
        db, user_id,
        full_name=body.full_name,
        role=body.role,
        department_id=body.department_id,
        phone=body.phone,
        is_active=body.is_active,
    )

    return {
        "success": True,
        "data": {
            "id": str(profile.id),
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "department_id": str(profile.department_id) if profile.department_id else None,
            "is_active": profile.is_active,
        },
    }
