import uuid
from datetime import datetime
from sqlalchemy import String, Text, Numeric, Boolean, DateTime, ForeignKey, Integer, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Statement(Base):
    __tablename__ = "statements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    statement_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    statement_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    card_last_four: Mapped[str | None] = mapped_column(String(4), nullable=True)
    card_holder_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    billing_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_amount_due: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_transactions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="submitted", index=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Ownership
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="RESTRICT"), nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted','under_review','verified','rejected')",
            name="valid_statement_status",
        ),
    )

    def __repr__(self):
        return f"<Statement {self.statement_number} [{self.status}]>"


class StatementTransaction(Base):
    __tablename__ = "statement_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    statement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("statements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transaction_date: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Invoice link is derived from invoices.statement_transaction_id (one-to-many),
    # so no invoice columns live here.

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<StatementTransaction {self.transaction_date} {self.description[:30]} {self.amount}>"


class StatementFile(Base):
    __tablename__ = "statement_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    statement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("statements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int | None] = mapped_column(nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<StatementFile {self.file_name}>"
