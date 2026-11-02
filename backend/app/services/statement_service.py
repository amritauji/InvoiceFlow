import re
import uuid
from datetime import datetime
from pypdf import PdfReader
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.statement import Statement, StatementTransaction, StatementFile
from app.models.user import UserProfile
from app.core.exceptions import NotFoundException, BadRequestException


class StatementService:
    # Regex patterns for transaction lines
    # Pattern 1: "DD/MM/YYYY| HH:MM DESCRIPTION  C  AMOUNT  l" (HDFC multi-page)
    _RE_HDFC_FULL = re.compile(
        r"(\d{2}/\d{2}/\d{4})\s*\|\s*\d{2}:\d{2}\s+(.+?)\s+C\s+([\d,]+\.\d{2})\s*[l+]?"
    )
    # Pattern 2: "DD/MM/YYYY DESCRIPTION  AMOUNT" (HDFC single-page / simple)
    _RE_HDFC_SIMPLE = re.compile(
        r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr)?"
    )
    # Card number pattern
    _RE_CARD = re.compile(r"4718\s*65XX\s*XXXX\s*(\d{4})")
    # Total amount due pattern
    _RE_TOTAL_DUE = re.compile(r"TOTAL AMOUNT DUE.*?([\d,]+\.\d{2})", re.IGNORECASE)
    _RE_TOTAL_DUE_ALT = re.compile(r"Total Dues?\s*([\d,]+\.\d{2})", re.IGNORECASE)
    # Billing period pattern
    _RE_BILLING = re.compile(r"(\d{2}\s+\w+,\s+\d{4})\s*-\s*(\d{2}\s+\w+,\s+\d{4})")
    # Statement date pattern
    _RE_STMT_DATE = re.compile(r"Statement\s*Date[:\s]*(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
    # Card holder name pattern
    _RE_HOLDER = re.compile(r"Name\s*:\s*(.+)", re.IGNORECASE)

    @staticmethod
    def extract_text(file_path: str) -> str:
        reader = PdfReader(file_path)
        pages_text = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages_text.append(text)
        return "\n".join(pages_text)

    # Lines that are NOT transactions — skip these
    _SKIP_KEYWORDS = re.compile(
        r"(Payment\s+Due|Total\s+Dues?|Minimum\s+Amount|Credit\s+Limit|Available\s+"
        r"Credit|Available\s+Cash|Opening\s+Balance|Payment/\s*Credits?|Purchase/\s*Debits?|"
        r"Finance\s+Charges|Past\s+Dues?|Overlimit|Current\s+Dues|Minimum\s+Dues?|"
        r"Domestic\s+Transactions|International\s+Transactions|Page\s+\d+\s+of\s+\d+|"
        r"Visa\s+Purchase|HSN\s+Code|GSTIN|Credit\s+Card\s+No|Alternate\s+Account|"
        r"Statement\s+Date|Billing\s+Period|CKYC\s+ID|GST\s+Summary|Reward\s+Points|"
        r"Account\s+Summary|IMPORTANT|CARD\s+CONTROL|MODIFY|ENABLED|Purchase\s+Indicator|"
        r"Benefits|DUPLICATE\s+STATEMENT|Corporate\s+Registered|HDFC\s+Bank\s+Registered|"
        r"Place\s+of\s+Supply|State\s+of\s+Supply|Whether\s+Tax|Corporate\s+GSTN|"
        r"Name\s+:|Address\s+:|Email\s+:|Card\s+No|AAN|Opening\s*Balance|"
        r"Points\s+expiring|Note\s+:|For\s+HDFC|ManojGogoi)",
        re.IGNORECASE,
    )

    # Description must contain at least one letter — filters out pure-number header artefacts
    _DESC_HAS_LETTER = re.compile(r"[A-Za-z]")

    @classmethod
    def _is_valid_transaction(cls, desc: str, amount: float) -> bool:
        if len(desc) < 4:
            return False
        if not cls._DESC_HAS_LETTER.search(desc):
            return False
        return True

    @classmethod
    def parse_transactions(cls, text: str) -> list[dict]:
        seen = set()
        transactions = []
        lines = text.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip header / summary / metadata lines
            if cls._SKIP_KEYWORDS.search(line):
                continue

            m = cls._RE_HDFC_FULL.search(line)
            if m:
                date_str, desc, amount_str = m.group(1), m.group(2).strip(), m.group(3)
                amount = float(amount_str.replace(",", ""))
                desc = re.sub(r"\s{2,}", " ", desc).strip()
                if not cls._is_valid_transaction(desc, amount):
                    continue
                key = (date_str, desc, amount)
                if key not in seen:
                    seen.add(key)
                    transactions.append({
                        "date": date_str,
                        "description": desc,
                        "amount": amount,
                    })
                continue

            m = cls._RE_HDFC_SIMPLE.search(line)
            if m:
                date_str, desc, amount_str = m.group(1), m.group(2).strip(), m.group(3)
                amount = float(amount_str.replace(",", ""))
                desc = re.sub(r"\s{2,}", " ", desc).strip()
                if not cls._is_valid_transaction(desc, amount):
                    continue
                key = (date_str, desc, amount)
                if key not in seen:
                    seen.add(key)
                    transactions.append({
                        "date": date_str,
                        "description": desc,
                        "amount": amount,
                    })

        return transactions

    @classmethod
    def parse_metadata(cls, text: str) -> dict:
        meta = {}

        m = cls._RE_CARD.search(text)
        if m:
            meta["card_last_four"] = m.group(1)

        m = cls._RE_TOTAL_DUE.search(text)
        if m:
            meta["total_amount_due"] = float(m.group(1).replace(",", ""))
        else:
            m = cls._RE_TOTAL_DUE_ALT.search(text)
            if m:
                meta["total_amount_due"] = float(m.group(1).replace(",", ""))

        m = cls._RE_BILLING.search(text)
        if m:
            meta["billing_period"] = f"{m.group(1)} - {m.group(2)}"

        m = cls._RE_HOLDER.search(text)
        if m:
            name = m.group(1).strip()
            # Truncate to field length
            meta["card_holder_name"] = name[:200]

        return meta

    @staticmethod
    def generate_statement_number() -> str:
        year = datetime.utcnow().year
        return f"STMT-{year}-0001"  # Placeholder; overridden with sequence

    @classmethod
    async def create(cls, db: AsyncSession, user_id: str, text: str,
                     file_path: str, file_name: str, file_size: int,
                     mime_type: str, statement_name: str | None = None,
                     remarks: str | None = None) -> Statement:
        transactions = cls.parse_transactions(text)
        if not transactions:
            raise BadRequestException("No transactions found in the uploaded statement.")

        meta = cls.parse_metadata(text)

        # Generate statement number via sequence
        from sqlalchemy import text
        result = await db.execute(text("SELECT nextval('statement_number_seq')"))
        seq_val = result.scalar()
        stmt_number = f"STMT-{datetime.utcnow().year}-{seq_val:04d}"

        statement = Statement(
            statement_number=stmt_number,
            statement_name=statement_name,
            card_last_four=meta.get("card_last_four"),
            card_holder_name=meta.get("card_holder_name"),
            billing_period=meta.get("billing_period"),
            total_amount_due=meta.get("total_amount_due"),
            total_transactions=len(transactions),
            status="submitted",
            remarks=remarks,
            submitted_by=uuid.UUID(user_id),
        )
        db.add(statement)
        await db.flush()

        for idx, txn in enumerate(transactions):
            db.add(StatementTransaction(
                statement_id=statement.id,
                transaction_date=txn["date"],
                description=txn["description"],
                amount=txn["amount"],
                is_verified=False,
                row_index=idx,
            ))

        db.add(StatementFile(
            statement_id=statement.id,
            storage_path=file_path,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=uuid.UUID(user_id),
        ))

        await db.flush()
        await db.refresh(statement)
        return statement

    @staticmethod
    async def get(db: AsyncSession, statement_id: str) -> Statement:
        result = await db.execute(
            select(Statement).where(Statement.id == uuid.UUID(statement_id))
        )
        stmt = result.scalar_one_or_none()
        if not stmt:
            raise NotFoundException("Statement not found")
        return stmt

    @staticmethod
    async def get_with_transactions(db: AsyncSession, statement_id: str) -> tuple[Statement, list[StatementTransaction]]:
        stmt = await StatementService.get(db, statement_id)
        result = await db.execute(
            select(StatementTransaction)
            .where(StatementTransaction.statement_id == stmt.id)
            .order_by(StatementTransaction.row_index)
        )
        txns = list(result.scalars().all())
        return stmt, txns

    @staticmethod
    async def list_all(db: AsyncSession, limit: int = 50, offset: int = 0,
                       user_id: str | None = None) -> tuple[list[Statement], int]:
        q = select(Statement)
        count_q = select(func.count(Statement.id))
        if user_id:
            q = q.where(Statement.submitted_by == uuid.UUID(user_id))
            count_q = count_q.where(Statement.submitted_by == uuid.UUID(user_id))

        total_result = await db.execute(count_q)
        total = total_result.scalar()

        q = q.order_by(Statement.submitted_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        stmts = list(result.scalars().all())
        return stmts, total

    @staticmethod
    async def list_all_with_counts(db: AsyncSession, limit: int = 50, offset: int = 0):
        """List all statements with unverified/invoiced transaction counts."""
        from dataclasses import dataclass
        from app.models.invoice import Invoice

        @dataclass
        class StatementWithCounts:
            stmt: Statement
            unverified_count: int
            invoiced_count: int

        count_q = select(func.count(Statement.id))
        total_result = await db.execute(count_q)
        total = total_result.scalar()

        q = select(Statement).order_by(Statement.submitted_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        stmts = list(result.scalars().all())

        out = []
        for s in stmts:
            uc_result = await db.execute(
                select(func.count(StatementTransaction.id)).where(
                    StatementTransaction.statement_id == s.id,
                    StatementTransaction.is_verified.is_(False),
                )
            )
            ic_result = await db.execute(
                select(func.count(Invoice.id)).where(
                    Invoice.statement_transaction_id.isnot(None),
                    Invoice.statement_transaction_id.in_(
                        select(StatementTransaction.id).where(StatementTransaction.statement_id == s.id)
                    ),
                )
            )
            out.append(StatementWithCounts(
                stmt=s,
                unverified_count=uc_result.scalar() or 0,
                invoiced_count=ic_result.scalar() or 0,
            ))
        return out, total

    @staticmethod
    async def toggle_verified(db: AsyncSession, transaction_id: str, user_id: str) -> StatementTransaction:
        result = await db.execute(
            select(StatementTransaction).where(StatementTransaction.id == uuid.UUID(transaction_id))
        )
        txn = result.scalar_one_or_none()
        if not txn:
            raise NotFoundException("Transaction not found")

        txn.is_verified = not txn.is_verified
        if txn.is_verified:
            txn.verified_by = uuid.UUID(user_id)
            txn.verified_at = datetime.utcnow()
        else:
            txn.verified_by = None
            txn.verified_at = None

        await db.commit()
        await db.refresh(txn)
        return txn

    @staticmethod
    async def verify_all(db: AsyncSession, statement_id: str, user_id: str) -> int:
        result = await db.execute(
            select(StatementTransaction)
            .where(StatementTransaction.statement_id == uuid.UUID(statement_id))
        )
        txns = list(result.scalars().all())
        count = 0
        for txn in txns:
            if not txn.is_verified:
                txn.is_verified = True
                txn.verified_by = uuid.UUID(user_id)
                txn.verified_at = datetime.utcnow()
                count += 1

        if count > 0:
            await db.commit()
        return count

    @staticmethod
    async def update_status(db: AsyncSession, statement_id: str, status: str) -> Statement:
        stmt = await StatementService.get(db, statement_id)
        stmt.status = status
        await db.commit()
        await db.refresh(stmt)
        return stmt
