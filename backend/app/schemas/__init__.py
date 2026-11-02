from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


# --- User ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    department_id: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Department ---
class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Invoice ---
class InvoiceCreate(BaseModel):
    vendor_name: str
    amount: float
    currency: str = "INR"
    remarks: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def _validate_currency(cls, v: str) -> str:
        if v not in ("INR", "USD"):
            raise ValueError("Currency must be INR or USD")
        return v


class InvoiceUpdate(BaseModel):
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def _validate_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("INR", "USD"):
            raise ValueError("Currency must be INR or USD")
        return v


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    vendor_name: str
    amount: float
    currency: str
    remarks: Optional[str] = None
    status: str
    submitted_by: str
    submitter_name: Optional[str] = None
    submitted_at: datetime
    current_stage_id: Optional[str] = None
    current_stage_name: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    id: str
    invoice_number: str
    vendor_name: str
    amount: float
    currency: str
    status: str
    submitted_by: str
    submitter_name: Optional[str] = None
    submitted_at: datetime
    current_stage_name: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Invoice File ---
class InvoiceFileResponse(BaseModel):
    id: str
    invoice_id: str
    file_type: str
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SignedUrlResponse(BaseModel):
    signed_url: str
    expires_in: int


# --- Approval Action ---
class ApprovalActionRequest(BaseModel):
    comment: Optional[str] = None


class BulkApprovalRequest(BaseModel):
    invoice_ids: list[str]
    comment: Optional[str] = None


class ApprovalActionResponse(BaseModel):
    id: str
    invoice_id: str
    actor_id: str
    actor_name: Optional[str] = None
    action: str
    comment: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Audit Log ---
class AuditLogResponse(BaseModel):
    id: str
    invoice_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Dashboard ---
class DashboardStats(BaseModel):
    pending_verification: int = 0
    pending_approval: int = 0
    approved: int = 0
    rejected: int = 0
    returned: int = 0
    total: int = 0


# --- Pagination ---
class PaginatedResponse(BaseModel):
    success: bool = True
    data: list = []
    meta: dict = {}


# --- Statement ---
class StatementResponse(BaseModel):
    id: str
    statement_number: str
    card_last_four: Optional[str] = None
    card_holder_name: Optional[str] = None
    billing_period: Optional[str] = None
    total_amount_due: Optional[float] = None
    total_transactions: int
    status: str
    remarks: Optional[str] = None
    submitted_by: str
    submitter_name: Optional[str] = None
    submitted_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class StatementTransactionResponse(BaseModel):
    id: str
    statement_id: str
    transaction_date: str
    description: str
    amount: float
    is_verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    row_index: int

    model_config = {"from_attributes": True}
