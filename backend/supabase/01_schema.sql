-- ============================================================
-- InvoiceFlow — Supabase Schema Setup
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE departments IS 'Organizational departments';

-- ============================================================
-- 2. USER PROFILES (linked to Supabase Auth)
-- ============================================================
CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(200) NOT NULL,
    role            VARCHAR(30) NOT NULL CHECK (role IN (
                        'department_user', 'accountant_1', 'accountant_2',
                        'accounts_team', 'accounts_head',
                        'ceo', 'manager', 'admin'
                    )),
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    phone           VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Application user profiles. id references auth.users(id).';

-- ============================================================
-- 3. INVOICES
-- ============================================================
CREATE TABLE invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number    VARCHAR(30) NOT NULL UNIQUE,
    vendor_name       VARCHAR(200) NOT NULL,
    amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    remarks           TEXT,
    status            VARCHAR(30) NOT NULL DEFAULT 'submitted'
                        CHECK (status IN (
                            'draft', 'submitted', 'under_review',
                            'returned', 'approved', 'rejected'
                        )),
    workflow_id       UUID,
    current_stage_id  UUID,
    submitted_by      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version           INTEGER NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE invoices IS 'Core invoice records. Status follows: draft→submitted→under_review→approved/rejected/returned';

-- ============================================================
-- 4. INVOICE FILES
-- ============================================================
CREATE TABLE invoice_files (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    file_type     VARCHAR(20) NOT NULL CHECK (file_type IN ('original', 'approved', 'summary')),
    storage_path  TEXT NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_size     BIGINT,
    mime_type     VARCHAR(50),
    uploaded_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE invoice_files IS 'File attachments for invoices (stored in Supabase Storage)';

-- ============================================================
-- 5. APPROVAL ACTIONS
-- ============================================================
CREATE TABLE approval_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    stage_id        UUID,
    actor_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    action          VARCHAR(20) NOT NULL CHECK (action IN ('approve', 'reject', 'return', 'comment')),
    comment         TEXT,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30),
    from_stage_id   UUID,
    to_stage_id     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE approval_actions IS 'Records every approval/reject/return/comment action on invoices';

-- ============================================================
-- 6. AUDIT LOGS (immutable)
-- ============================================================
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
    actor_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    actor_email     VARCHAR(255),
    actor_role      VARCHAR(30),
    action          VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(50) NOT NULL,
    resource_id     VARCHAR(100),
    details         JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail. Every system action is logged here.';
