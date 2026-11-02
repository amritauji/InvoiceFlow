from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import UserCreate, UserUpdate, DepartmentCreate, DepartmentUpdate
from app.services.auth_service import AuthService
from app.core.dependencies import (
    get_current_user, require_role, invalidate_user_cache,
    UserContext, UserRole, ROLE_PERMISSIONS,
)
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
        email=body.email,
        password=body.password,
        role=body.role,
        department_id=body.department_id,
        phone=body.phone,
        is_active=body.is_active,
    )

    invalidate_user_cache(user_id)

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


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    if current_user.id == user_id:
        from app.core.exceptions import BadRequestException
        raise BadRequestException("Cannot delete your own account")

    result = await AuthService.delete_user(db, user_id)
    invalidate_user_cache(user_id)
    return {"success": True, "message": result["message"]}


# --- Roles & Permissions Endpoint ---

ROLE_LABELS = {
    "admin": "Admin",
    "accounts_team": "Accounts Team",
    "accounts_head": "Accounts Head",
    "ceo": "CEO",
    "manager": "Manager",
    "accountant_1": "Accountant 1",
    "accountant_2": "Accountant 2",
    "department_user": "Department User",
}

PERMISSION_LABELS = {
    "invoice:create": "Create Invoices",
    "invoice:read_own": "View Own Invoices",
    "invoice:read_all": "View All Invoices",
    "invoice:update_own": "Update Own Invoices",
    "invoice:delete": "Delete Invoices",
    "approval:verify": "Verify Invoices",
    "approval:approve": "Approve Invoices",
    "approval:reject": "Reject Invoices",
    "approval:return": "Return Invoices",
    "approval:comment": "Comment on Invoices",
    "user:manage": "Manage Users",
    "department:manage": "Manage Departments",
    "workflow:configure": "Configure Workflow",
    "audit:read": "View Audit Trail",
    "dashboard:stats_all": "View All Dashboard Stats",
    "dashboard:stats_own": "View Own Dashboard Stats",
    "file:upload": "Upload Files",
    "file:download": "Download Files",
}


@router.get("/roles")
async def list_roles(
    current_user: UserContext = Depends(require_role(UserRole.ADMIN)),
):
    roles = []
    for role_enum in UserRole:
        perms = ROLE_PERMISSIONS.get(role_enum, set())
        roles.append({
            "value": role_enum.value,
            "label": ROLE_LABELS.get(role_enum.value, role_enum.value),
            "permissions": [
                {"key": p, "label": PERMISSION_LABELS.get(p, p)}
                for p in sorted(perms)
            ],
        })
    return {"success": True, "data": roles}
