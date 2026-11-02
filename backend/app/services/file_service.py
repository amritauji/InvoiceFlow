import uuid
import os
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.invoice import InvoiceFile, Invoice
from app.core.security import get_supabase_client
from app.core.dependencies import UserContext, UserRole
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.config import get_settings
from app.services.invoice_service import resolve_invoice_id, InvoiceService

settings = get_settings()


class FileService:
    """Handles file upload/download via Supabase Storage."""

    ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    PDF_MAGIC = b"%PDF-"

    @staticmethod
    def validate_pdf_content(file_bytes: bytes) -> None:
        """Reject files that claim to be PDFs but are not (or are corrupt).

        Checks the PDF header magic bytes and confirms a matching EOF marker
        exists so downstream parsing (e.g. pypdf) never crashes on junk.
        """
        stripped = file_bytes.lstrip()
        if not stripped.startswith(FileService.PDF_MAGIC):
            raise BadRequestException("File is not a valid PDF (missing %PDF- header)")
        if b"%%EOF" not in file_bytes[-2048:]:
            raise BadRequestException("File is a corrupt or truncated PDF (missing %%EOF marker)")

    @staticmethod
    def _get_storage_client():
        return get_supabase_client().storage

    @staticmethod
    def _build_path(invoice_id: str, filename: str, file_type: str = "original") -> str:
        timestamp = int(datetime.utcnow().timestamp())
        safe_filename = filename.replace(" ", "_").replace("/", "_")
        return f"{invoice_id}/{file_type}_{timestamp}_{safe_filename}"

    @staticmethod
    async def upload_file(
        db: AsyncSession,
        *,
        invoice_id: str,
        file_bytes: bytes,
        file_name: str,
        file_size: int,
        mime_type: str,
        actor: UserContext,
    ) -> InvoiceFile:
        """Upload a file to Supabase Storage and create DB record."""
        # Validate
        if mime_type not in FileService.ALLOWED_TYPES:
            raise BadRequestException(f"File type '{mime_type}' not allowed. Use PDF, PNG, or JPEG.")
        if file_size > FileService.MAX_SIZE:
            raise BadRequestException("File exceeds 10MB limit")
        if mime_type == "application/pdf":
            FileService.validate_pdf_content(file_bytes)

        # Build storage path
        storage_path = FileService._build_path(invoice_id, file_name, "original")
        bucket = settings.STORAGE_BUCKET_ORIGINALS

        # Upload to Supabase Storage
        storage = FileService._get_storage_client()
        storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": mime_type, "upsert": "false"},
        )

        # Resolve invoice_id (supports UUID or invoice_number)
        inv_uuid = await resolve_invoice_id(db, invoice_id)

        # Create DB record
        file_record = InvoiceFile(
            invoice_id=inv_uuid,
            file_type="original",
            storage_path=storage_path,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=uuid.UUID(actor.id),
        )
        db.add(file_record)
        await db.flush()

        return file_record

    @staticmethod
    async def get_signed_url(
        db: AsyncSession,
        file_id: str,
        *,
        actor: UserContext,
    ) -> str:
        """Generate a signed URL for file download."""
        result = await db.execute(
            select(InvoiceFile).where(InvoiceFile.id == uuid.UUID(file_id))
        )
        file_record = result.scalar_one_or_none()
        if not file_record:
            raise NotFoundException("File", file_id)

        # Enforce view permission on the file's invoice
        inv_result = await db.execute(
            select(Invoice).where(Invoice.id == file_record.invoice_id)
        )
        invoice = inv_result.scalar_one_or_none()
        if invoice:
            InvoiceService.assert_can_view(actor, invoice)

        # Determine bucket based on file type
        if file_record.file_type == "original":
            bucket = settings.STORAGE_BUCKET_ORIGINALS
        else:
            bucket = settings.STORAGE_BUCKET_APPROVED

        storage = FileService._get_storage_client()
        signed_url = storage.from_(bucket).create_signed_url(
            path=file_record.storage_path,
            expires_in=3600,  # 1 hour
        )

        return signed_url.get("signedURL", "")

    @staticmethod
    async def list_files_for_invoice(
        db: AsyncSession,
        invoice_id: str,
    ) -> list[InvoiceFile]:
        """List all files for an invoice."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(InvoiceFile)
            .where(InvoiceFile.invoice_id == inv_uuid)
            .order_by(InvoiceFile.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def upload_approved_pdf(
        db: AsyncSession,
        *,
        invoice_id: str,
        file_bytes: bytes,
        filename: str,
    ) -> InvoiceFile:
        """Upload a generated approved PDF."""
        storage_path = f"{invoice_id}/approved_{filename}"
        bucket = settings.STORAGE_BUCKET_APPROVED

        storage = FileService._get_storage_client()
        storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )

        inv_uuid = await resolve_invoice_id(db, invoice_id)

        file_record = InvoiceFile(
            invoice_id=inv_uuid,
            file_type="approved",
            storage_path=storage_path,
            file_name=filename,
            file_size=len(file_bytes),
            mime_type="application/pdf",
        )
        db.add(file_record)
        return file_record

    @staticmethod
    async def download_file_bytes(
        db: AsyncSession,
        file_id: str,
    ) -> tuple[bytes, str]:
        """Download raw file bytes from Supabase Storage. Returns (bytes, mime_type)."""
        result = await db.execute(
            select(InvoiceFile).where(InvoiceFile.id == uuid.UUID(file_id))
        )
        file_record = result.scalar_one_or_none()
        if not file_record:
            raise NotFoundException("File", file_id)

        if file_record.file_type == "original":
            bucket = settings.STORAGE_BUCKET_ORIGINALS
        else:
            bucket = settings.STORAGE_BUCKET_APPROVED

        storage = FileService._get_storage_client()
        file_data = storage.from_(bucket).download(file_record.storage_path)

        return file_data, file_record.mime_type or "application/pdf"

    @staticmethod
    async def get_original_file_for_invoice(
        db: AsyncSession,
        invoice_id: str,
    ) -> tuple[bytes, str] | None:
        """Get the first original file bytes for an invoice. Returns (bytes, mime_type) or None."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(InvoiceFile)
            .where(InvoiceFile.invoice_id == inv_uuid, InvoiceFile.file_type == "original")
            .order_by(InvoiceFile.created_at.asc())
            .limit(1)
        )
        file_record = result.scalar_one_or_none()
        if not file_record:
            return None

        storage = FileService._get_storage_client()
        bucket = settings.STORAGE_BUCKET_ORIGINALS
        file_data = storage.from_(bucket).download(file_record.storage_path)

        return file_data, file_record.mime_type or "application/pdf"
