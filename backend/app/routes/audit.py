from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.audit_service import AuditService
from app.services.invoice_service import resolve_invoice_id
from app.core.dependencies import get_current_user, require_role, UserContext, UserRole

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get("")
async def list_audit_logs(
    action: str = Query(None),
    resource_type: str = Query(None),
    actor_id: str = Query(None),
    invoice_id: str = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.ADMIN, UserRole.ACCOUNTANT_1, UserRole.ACCOUNTANT_2,
        UserRole.ACCOUNTS_TEAM, UserRole.ACCOUNTS_HEAD,
        UserRole.CEO, UserRole.MANAGER,
    )),
):
    """List audit logs with optional filters."""
    logs, total = await AuditService.get_all(
        db,
        action=action,
        resource_type=resource_type,
        actor_id=actor_id,
        invoice_id=invoice_id,
        limit=limit,
        offset=offset,
    )

    return {
        "success": True,
        "data": [
            {
                "id": str(log.id),
                "invoice_id": str(log.invoice_id) if log.invoice_id else None,
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_email": log.actor_email,
                "actor_role": log.actor_role,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.get("/invoice/{invoice_id}")
async def get_invoice_audit_trail(
    invoice_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get complete audit trail for a specific invoice."""
    inv_uuid = await resolve_invoice_id(db, invoice_id)
    logs = await AuditService.get_for_invoice(
        db, invoice_id=inv_uuid, limit=limit, offset=offset,
    )

    return {
        "success": True,
        "data": [
            {
                "id": str(log.id),
                "actor_email": log.actor_email,
                "actor_role": log.actor_role,
                "action": log.action,
                "resource_type": log.resource_type,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
