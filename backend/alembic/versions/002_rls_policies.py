"""Add Row Level Security policies for all tables.

Revision ID: 002_rls_policies
Revises: 001_initial
Create Date: 2025-07-22
"""
from typing import Sequence, Union
from alembic import op

revision: str = "002_rls_policies"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Combined SQL: auth schema stubs + RLS helper + RLS policies
#
# - On Supabase the auth schema already exists (real auth.uid()/auth.role()),
#   so the local stubs are only created when the schema is missing.
# - Role checks MUST go through public.is_in_roles() (SECURITY DEFINER).
#   Inline `EXISTS (SELECT 1 FROM user_profiles WHERE ...)` subqueries inside
#   policies cause Postgres error 42P17 "infinite recursion detected in policy
#   for relation user_profiles" (see backend/supabase/08_fix_rls_recursion.sql).
# - All policies are dropped first (stale + legacy names) then recreated.
_COMBINED_SQL = """
-- ============================================================
-- AUTH SCHEMA STUBS (local PostgreSQL only; skipped on Supabase)
-- ============================================================
DO $$
BEGIN
    IF to_regnamespace('auth') IS NULL THEN
        CREATE SCHEMA auth;

        CREATE OR REPLACE FUNCTION auth.uid()
        RETURNS uuid
        LANGUAGE sql
        STABLE
        AS $$
            SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$;

        CREATE OR REPLACE FUNCTION auth.role()
        RETURNS text
        LANGUAGE sql
        STABLE
        AS $$
            SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
        $$;
    END IF;
END $$;

-- ============================================================
-- RLS HELPER (SECURITY DEFINER -> runs as owner -> no RLS -> no recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_in_roles(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = ANY(required_roles)
    );
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DROP ALL EXISTING POLICIES (stale + legacy names)
-- ============================================================
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('departments', 'user_profiles', 'invoices', 'invoice_files', 'approval_actions', 'audit_logs')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE POLICY "departments_select_auth" ON departments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "departments_insert_admin" ON departments
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['admin']));

CREATE POLICY "departments_update_admin" ON departments
    FOR UPDATE USING (public.is_in_roles(ARRAY['admin']));

CREATE POLICY "departments_delete_admin" ON departments
    FOR DELETE USING (public.is_in_roles(ARRAY['admin']));

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE POLICY "user_profiles_select_own" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "user_profiles_select_admin" ON user_profiles
    FOR SELECT USING (public.is_in_roles(ARRAY['admin']));

CREATE POLICY "user_profiles_select_accounts" ON user_profiles
    FOR SELECT USING (public.is_in_roles(ARRAY['accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));

CREATE POLICY "user_profiles_insert_admin" ON user_profiles
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['admin']));

CREATE POLICY "user_profiles_update_admin" ON user_profiles
    FOR UPDATE USING (public.is_in_roles(ARRAY['admin']));

CREATE POLICY "user_profiles_delete_admin" ON user_profiles
    FOR DELETE USING (public.is_in_roles(ARRAY['admin']));

-- ============================================================
-- INVOICES
-- ============================================================
CREATE POLICY "invoices_select_own" ON invoices
    FOR SELECT USING (submitted_by = auth.uid());

CREATE POLICY "invoices_select_approvers" ON invoices
    FOR SELECT USING (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));

CREATE POLICY "invoices_insert_dept_user" ON invoices
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['department_user', 'admin']));

CREATE POLICY "invoices_update_own" ON invoices
    FOR UPDATE USING (
        submitted_by = auth.uid()
        AND status IN ('draft', 'returned')
    );

CREATE POLICY "invoices_update_admin" ON invoices
    FOR UPDATE USING (public.is_in_roles(ARRAY['admin']));

CREATE POLICY "invoices_delete_admin" ON invoices
    FOR DELETE USING (public.is_in_roles(ARRAY['admin', 'accountant_1']));

-- ============================================================
-- INVOICE FILES
-- ============================================================
CREATE POLICY "invoice_files_select_own" ON invoice_files
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND submitted_by = auth.uid())
    );

CREATE POLICY "invoice_files_select_approvers" ON invoice_files
    FOR SELECT USING (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));

CREATE POLICY "invoice_files_insert_restricted" ON invoice_files
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND submitted_by = auth.uid())
        OR public.is_in_roles(ARRAY['admin'])
    );

CREATE POLICY "invoice_files_delete_admin" ON invoice_files
    FOR DELETE USING (public.is_in_roles(ARRAY['admin']));

-- ============================================================
-- APPROVAL ACTIONS
-- ============================================================
CREATE POLICY "approval_actions_select" ON approval_actions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "approval_actions_insert_restricted" ON approval_actions
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE POLICY "audit_logs_select_approvers" ON audit_logs
    FOR SELECT USING (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));

CREATE POLICY "audit_logs_select_own_invoice" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND submitted_by = auth.uid())
    );
"""


def upgrade() -> None:
    op.execute(_COMBINED_SQL)


def downgrade() -> None:
    # Drop all policies
    op.execute(
        """
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN
                SELECT tablename, policyname
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename IN ('departments', 'user_profiles', 'invoices', 'invoice_files', 'approval_actions', 'audit_logs')
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
            END LOOP;
        END $$;
        """
    )

    # Disable RLS
    for table in [
        "departments", "user_profiles", "invoices",
        "invoice_files", "approval_actions", "audit_logs",
    ]:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Drop the RLS helper
    op.execute("DROP FUNCTION IF EXISTS public.is_in_roles(TEXT[])")

    # Drop auth stubs only if the auth schema does not own them as Supabase does
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regnamespace('auth') IS NOT NULL THEN
                PERFORM pg_proc.oid FROM pg_proc WHERE proname = 'uid';
            END IF;
        END $$;
        """
    )
