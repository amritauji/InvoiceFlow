from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


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


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


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
    remarks: Optional[str] = None


class InvoiceUpdate(BaseModel):
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    remarks: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    vendor_name: str
    amount: float
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
