# InvoiceFlow

Enterprise invoice approval and workflow management system built with FastAPI, React, and Supabase. Streamline financial approvals with automated routing, multi-stage verification, and an immutable audit trail.

## Features

- **Multi-Stage Approval Workflow** — Configurable approval chains (Accountant 1 → Accountant 2 → Manager → CEO)
- **Role-Based Access Control** — Granular permissions per role (admin, department_user, accountant_1/2, manager, ceo)
- **Document Management** — Upload and preview invoice PDFs/JPEGs with Supabase Storage
- **Interactive Document Viewer** — In-browser PDF/image preview with file tab switching
- **Approval Queue** — Smart queue that surfaces invoices pending your role's action
- **Reject / Return with Comments** — Return invoices to submitter for corrections or reject outright
- **Audit Trail** — Immutable append-only log of every action taken on every invoice
- **Print-Ready Approval Summary** — Overlays approval chain directly onto the original invoice PDF
- **Dashboard Analytics** — Real-time stats (pending, approved, rejected counts, avg approval time)
- **Optimistic Locking** — Version-based concurrency control prevents conflicting updates
- **Supabase Auth Integration** — JWT-based authentication with automatic token refresh

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| **Frontend** | React 19, Vite, Tailwind CSS, React Router 7, Axios |
| **Database** | PostgreSQL 16 (local dev) / Supabase PostgreSQL (production) |
| **Auth** | Supabase Auth (JWT) |
| **Storage** | Supabase Storage (invoice PDFs/images) |
| **PDF** | fpdf2, PyPDF2 |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   React SPA  │────▶│  FastAPI REST │────▶│  PostgreSQL    │
│  (Vite dev)  │     │  (uvicorn)    │     │  (Docker/Cloud)│
└─────────────┘     └──────┬───────┘     └────────────────┘
                           │
                    ┌──────▼───────┐     ┌────────────────┐
                    │ Supabase Auth │     │ Supabase Store │
                    │ (JWT verify)  │     │ (PDF/Image)    │
                    └──────────────┘     └────────────────┘
```

### Workflow Stages

```
Submitted  ──▶  Accountant 1  ──▶  Accountant 2  ──▶  Manager  ──▶  CEO  ──▶  Approved
                    │                    │                   │              │
                    └── Return/Reject ───┴───────────────────┴──────────────┘
                                                │
                                                ▼
                                           Returned (submitter can resubmit)
```

## Prerequisites

- Python 3.13+
- Node.js 18+
- Docker Desktop (for local PostgreSQL)
- Supabase account (free tier works)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/amritauji/InvoiceFlow.git
cd InvoiceFlow
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

**Start local PostgreSQL:**

```bash
docker run -d --name invoiceflow-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=invoiceflow \
  -p 5432:5432 \
  postgres:16
```

**Configure environment:**

```bash
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `.env` with your Supabase credentials and database URL:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/invoiceflow
```

**Run migrations and seed data:**

```bash
alembic upgrade head
python -m app.seed
```

**Start the backend:**

```bash
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000/api/v1` | Docs at `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

**Configure environment:**

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

**Start the frontend:**

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## User Credentials

Seeded users (all passwords in the table below):

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| `admin@invoiceflow.com` | `Admin@12345` | **Admin** | Full access — manage users, departments, all invoices |
| `user@invoiceflow.com` | `User@12345` | **Department User** | Submit invoices, view own submissions |
| `accountant1@invoiceflow.com` | `Account1@123` | **Accountant 1** | Verify submitted invoices, approve/reject/return |
| `accountant2@invoiceflow.com` | `Account2@123` | **Accountant 2** | Verify stage 1 approvals, approve/reject/return |
| `manager@invoiceflow.com` | `Manager@123` | **Manager** | Stage 2 approval authority |
| `ceo@invoiceflow.com` | `Ceo@12345` | **CEO** | Final approval authority |

## API Overview

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/login` | Login with email/password | No |
| POST | `/api/v1/auth/refresh` | Refresh JWT token | No |
| GET | `/api/v1/auth/me` | Current user profile | Yes |
| POST | `/api/v1/invoices` | Create invoice with file upload | Yes |
| GET | `/api/v1/invoices` | List invoices (filtered by role) | Yes |
| GET | `/api/v1/invoices/queue/pending` | Pending approval queue | Yes |
| GET | `/api/v1/invoices/{id}` | Invoice details with files | Yes |
| POST | `/api/v1/invoices/{id}/approve` | Approve invoice | Yes |
| POST | `/api/v1/invoices/{id}/reject` | Reject invoice (terminal) | Yes |
| POST | `/api/v1/invoices/{id}/return` | Return for corrections | Yes |
| POST | `/api/v1/invoices/{id}/comment` | Add comment | Yes |
| GET | `/api/v1/invoices/{id}/history` | Full action history | Yes |
| GET | `/api/v1/invoices/{id}/print-pdf` | Download approved PDF with overlay | Yes |
| GET | `/api/v1/dashboard/stats` | Dashboard statistics | Yes |
| GET | `/api/v1/admin/departments` | List departments | Yes |
| GET | `/api/v1/admin/users` | List all users (admin only) | Admin |
| GET | `/api/v1/audit/logs` | Audit trail (restricted roles) | Yes |

## Project Structure

```
InvoiceFlow/
├── backend/
│   ├── alembic/                 # Database migrations
│   │   └── versions/
│   ├── app/
│   │   ├── core/               # Auth, security, exceptions
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── routes/             # FastAPI route handlers
│   │   ├── services/           # Business logic layer
│   │   └── schemas/            # Pydantic request/response schemas
│   ├── supabase/               # Raw SQL scripts for Supabase
│   ├── .env.example
│   ├── seed.py                 # Database seeder
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React context providers
│   │   ├── pages/              # Route page components
│   │   └── services/           # API client (Axios)
│   ├── public/
│   └── vite.config.js
└── README.md
```

## Key Design Decisions

- **Permission-based access control** — Each endpoint checks specific permissions (`approval:approve`, `invoice:create`, etc.) rather than hardcoded role checks, making the system extensible
- **Service layer abstraction** — Business logic lives in `services/` not routes, keeping handlers thin and testable
- **Optimistic locking** — Version column on invoices prevents lost updates when multiple actors interact concurrently
- **Append-only audit** — `audit_logs` table is never updated or deleted, providing a legally defensible trail
- **Supabase for auth + storage only** — All relational data lives in application-managed PostgreSQL, giving full control over schema and migrations

## Troubleshooting

**Login fails with "Invalid email or password"** — Ensure the user exists in Supabase Auth and the profile exists in the local `user_profiles` table. Re-run `python -m app.seed`.

**Departments not showing in dropdown** — Ensure you're logged in. The `/admin/departments` endpoint is available to all authenticated users.

**Invoice upload fails** — Check that `department_id` column exists on the `invoices` table. Run `alembic upgrade head` and verify the migration is current.

**Time displayed incorrectly** — Times are stored in UTC. The API and PDF service convert to IST (Indian Standard Time, UTC+5:30) for display.
