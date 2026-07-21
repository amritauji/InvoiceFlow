from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ApprovalActionRequest, BulkApprovalRequest
from app.services.approval_service import ApprovalService
from app.core.dependencies import get_current_user, require_permission, UserContext, UserRole

router = APIRouter(prefix="/invoices", tags=["Approvals"])


@router.post("/bulk-approve")
async def bulk_approve_invoices(
    body: BulkApprovalRequest,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("approval:approve")),
):
    """Approve multiple invoices at once."""
    if not body.invoice_ids:
        from app.core.exceptions import BadRequestException
        raise BadRequestException("No invoice IDs provided")

    results = []
    for invoice_id in body.invoice_ids:
        try:
            result = await ApprovalService.approve(db, invoice_id, actor=actor, comment=body.comment)
            results.append({"invoice_id": invoice_id, "success": True, "data": result})
        except Exception as e:
            results.append({"invoice_id": invoice_id, "success": False, "error": str(e)})

    approved = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])

    return {
        "success": True,
        "data": {
            "total": len(body.invoice_ids),
            "approved": approved,
            "failed": failed,
            "results": results,
        },
    }


@router.post("/{invoice_id}/approve")
async def approve_invoice(
    invoice_id: str,
    body: ApprovalActionRequest = None,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("approval:approve")),
):
    """Approve an invoice and advance the workflow to the next stage."""
    comment = body.comment if body else None
    result = await ApprovalService.approve(db, invoice_id, actor=actor, comment=comment)
    return {"success": True, "data": result}


@router.post("/{invoice_id}/reject")
async def reject_invoice(
    invoice_id: str,
    body: ApprovalActionRequest = None,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("approval:reject")),
):
    """Reject an invoice (terminal state)."""
    comment = body.comment if body else None
    result = await ApprovalService.reject(db, invoice_id, actor=actor, comment=comment)
    return {"success": True, "data": result}


@router.post("/{invoice_id}/return")
async def return_invoice(
    invoice_id: str,
    body: ApprovalActionRequest = None,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("approval:return")),
):
    """Return an invoice to the submitter for corrections."""
    comment = body.comment if body else None
    result = await ApprovalService.return_invoice(db, invoice_id, actor=actor, comment=comment)
    return {"success": True, "data": result}


@router.post("/{invoice_id}/comment")
async def add_comment(
    invoice_id: str,
    body: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("approval:comment")),
):
    """Add a comment to an invoice without changing its status."""
    if not body.comment:
        from app.core.exceptions import BadRequestException
        raise BadRequestException("Comment text is required")
    result = await ApprovalService.add_comment(db, invoice_id, actor=actor, comment=body.comment)
    return {"success": True, "data": result}


@router.get("/{invoice_id}/comments")
async def get_comments(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get all comments for an invoice."""
    comments = await ApprovalService.get_comments(db, invoice_id)
    return {"success": True, "data": comments}


@router.get("/{invoice_id}/history")
async def get_action_history(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get full action history (approve/comment) for an invoice."""
    history = await ApprovalService.get_action_history(db, invoice_id)
    return {"success": True, "data": history}
