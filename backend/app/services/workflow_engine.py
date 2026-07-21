"""
Fixed 4-stage MVP workflow engine.

Workflow stages (in order):
  1. Accountant 1 Verification (accountant_1)
  2. Accountant 2 Verification (accountant_2)
  3. Manager Approval          (manager)
  4. CEO Final Approval        (ceo)

Status transitions:
  submitted  → under_review    (when accountant_1 verifies)
  under_review → under_review  (when intermediate approver approves)
  under_review → approved      (when final approver approves)
  submitted/under_review → returned  (returned to submitter for corrections)
  submitted/under_review → rejected  (rejected, terminal state)

Admin users can act at any stage (superuser bypass).
"""

from app.core.exceptions import BadRequestException, ForbiddenException
from app.core.dependencies import UserRole


# Ordered workflow stages
WORKFLOW_STAGES = [
    {"order": 1, "name": "Accountant 1 Verification", "role": UserRole.ACCOUNTANT_1, "status": "under_review"},
    {"order": 2, "name": "Accountant 2 Verification", "role": UserRole.ACCOUNTANT_2, "status": "under_review"},
    {"order": 3, "name": "Manager Approval", "role": UserRole.MANAGER, "status": "under_review"},
    {"order": 4, "name": "CEO Final Approval", "role": UserRole.CEO, "status": "approved"},
]

STAGE_ORDER_TO_ROLE = {s["order"]: s["role"] for s in WORKFLOW_STAGES}
ROLE_TO_STAGE_ORDER = {s["role"]: s["order"] for s in WORKFLOW_STAGES}

ROLE_DISPLAY_NAMES = {
    UserRole.ACCOUNTANT_1: "Accountant 1",
    UserRole.ACCOUNTANT_2: "Accountant 2",
    UserRole.ACCOUNTS_TEAM: "Accounts Team",
    UserRole.ACCOUNTS_HEAD: "Accounts Head",
    UserRole.CEO: "CEO",
    UserRole.MANAGER: "Manager",
    UserRole.ADMIN: "Admin",
    UserRole.DEPARTMENT_USER: "Department User",
}


def get_stage_by_order(order: int) -> dict:
    """Get workflow stage definition by order number."""
    for stage in WORKFLOW_STAGES:
        if stage["order"] == order:
            return stage
    raise BadRequestException(f"Invalid stage order: {order}")


def get_role_for_stage(order: int) -> UserRole:
    """Get the role allowed at a given stage order."""
    return STAGE_ORDER_TO_ROLE.get(order)


def can_role_act_at_stage(role: UserRole, stage_order: int) -> bool:
    """Check if a user's role is allowed to act at the given stage."""
    if role == UserRole.ADMIN:
        return True
    expected_role = get_role_for_stage(stage_order)
    return expected_role is not None and role == expected_role


def get_next_stage(current_stage_order: int) -> dict | None:
    """Get the next workflow stage, or None if this is the last stage."""
    next_order = current_stage_order + 1
    if next_order > len(WORKFLOW_STAGES):
        return None
    return get_stage_by_order(next_order)


def get_first_stage() -> dict:
    """Get the first workflow stage (Accounts Verification)."""
    return WORKFLOW_STAGES[0]


def get_next_approver_info(current_stage_order: int | None, invoice_status: str) -> dict | None:
    """Get info about who the invoice goes to next."""
    if invoice_status in ("approved", "rejected", "returned"):
        return None
    if invoice_status == "submitted":
        return {"role": "accountant_1", "role_display": "Accountant 1", "stage": "Accountant 1 Verification"}

    if current_stage_order is not None:
        next_stage = get_next_stage(current_stage_order)
        if next_stage:
            return {
                "role": next_stage["role"].value if hasattr(next_stage["role"], "value") else str(next_stage["role"]),
                "role_display": ROLE_DISPLAY_NAMES.get(next_stage["role"], str(next_stage["role"])),
                "stage": next_stage["name"],
            }
    return None


def validate_approval(actor_role: UserRole, invoice_status: str, invoice_stage_order: int | None) -> dict:
    """
    Validate whether the actor can approve and determine the outcome.
    Returns the new status and stage info.
    Admin users can act at any stage.
    Only forward progression is allowed — no return/reject.
    """
    if invoice_status in ("approved", "rejected", "returned"):
        raise BadRequestException(f"Cannot act on invoice with status '{invoice_status}'")

    if invoice_status == "draft":
        raise BadRequestException("Cannot approve a draft invoice. Submit it first.")

    if invoice_status == "submitted":
        if actor_role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
            raise ForbiddenException("Only Accountant 1 (or Admin) can verify newly submitted invoices")
        stage_order = 1
    elif invoice_status == "under_review":
        if invoice_stage_order is None:
            raise BadRequestException("Invoice has no current stage assigned")
        if not can_role_act_at_stage(actor_role, invoice_stage_order):
            expected = get_role_for_stage(invoice_stage_order)
            raise ForbiddenException(
                f"This invoice is at stage {invoice_stage_order} "
                f"(requires {ROLE_DISPLAY_NAMES.get(expected, expected.value if expected else 'unknown')}), "
                f"but your role is {ROLE_DISPLAY_NAMES.get(actor_role, actor_role.value)}"
            )
        stage_order = invoice_stage_order
    else:
        raise BadRequestException(f"Cannot approve invoice in '{invoice_status}' status")

    current_stage = get_stage_by_order(stage_order)
    next_stage = get_next_stage(stage_order)

    if next_stage is None:
        return {
            "new_status": "approved",
            "new_stage_order": None,
            "new_stage_name": None,
            "is_final": True,
        }
    else:
        return {
            "new_status": "under_review",
            "new_stage_order": next_stage["order"],
            "new_stage_name": next_stage["name"],
            "next_approver": {
                "role": next_stage["role"].value if hasattr(next_stage["role"], "value") else str(next_stage["role"]),
                "role_display": ROLE_DISPLAY_NAMES.get(next_stage["role"], str(next_stage["role"])),
            },
            "is_final": False,
        }


def validate_rejection(actor_role: UserRole, invoice_status: str, invoice_stage_order: int | None) -> None:
    """
    Validate whether the actor can reject the invoice.
    Any approver at the current stage (or Admin) can reject.
    Rejection is terminal — the invoice goes to 'rejected' status.
    """
    if invoice_status in ("approved", "rejected", "returned"):
        raise BadRequestException(f"Cannot reject invoice with status '{invoice_status}'")

    if invoice_status == "draft":
        raise BadRequestException("Cannot reject a draft invoice.")

    if invoice_status == "submitted":
        if actor_role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
            raise ForbiddenException("Only Accountant 1 (or Admin) can reject newly submitted invoices")
    elif invoice_status == "under_review":
        if invoice_stage_order is None:
            raise BadRequestException("Invoice has no current stage assigned")
        if not can_role_act_at_stage(actor_role, invoice_stage_order):
            expected = get_role_for_stage(invoice_stage_order)
            raise ForbiddenException(
                f"This invoice is at stage {invoice_stage_order} "
                f"(requires {ROLE_DISPLAY_NAMES.get(expected, expected.value if expected else 'unknown')}), "
                f"but your role is {ROLE_DISPLAY_NAMES.get(actor_role, actor_role.value)}"
            )
    else:
        raise BadRequestException(f"Cannot reject invoice in '{invoice_status}' status")


def validate_return(actor_role: UserRole, invoice_status: str, invoice_stage_order: int | None) -> None:
    """
    Validate whether the actor can return the invoice to the submitter.
    Any approver at the current stage (or Admin) can return.
    Return sends the invoice back to 'returned' status so the submitter can fix and resubmit.
    """
    if invoice_status in ("approved", "rejected", "returned"):
        raise BadRequestException(f"Cannot return invoice with status '{invoice_status}'")

    if invoice_status == "draft":
        raise BadRequestException("Cannot return a draft invoice.")

    if invoice_status == "submitted":
        if actor_role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
            raise ForbiddenException("Only Accountant 1 (or Admin) can return newly submitted invoices")
    elif invoice_status == "under_review":
        if invoice_stage_order is None:
            raise BadRequestException("Invoice has no current stage assigned")
        if not can_role_act_at_stage(actor_role, invoice_stage_order):
            expected = get_role_for_stage(invoice_stage_order)
            raise ForbiddenException(
                f"This invoice is at stage {invoice_stage_order} "
                f"(requires {ROLE_DISPLAY_NAMES.get(expected, expected.value if expected else 'unknown')}), "
                f"but your role is {ROLE_DISPLAY_NAMES.get(actor_role, actor_role.value)}"
            )
    else:
        raise BadRequestException(f"Cannot return invoice in '{invoice_status}' status")
