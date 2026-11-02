-- ============================================================
-- InvoiceFlow — Fix RLS infinite recursion (error 42P17) + reset all policies
-- Run ONCE on the existing Supabase database. Idempotent, safe to re-run.
-- ============================================================
--
-- PROBLEM:
--   RLS policies previously checked the caller's role with self-referencing
--   subqueries, e.g. on user_profiles:
--     EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
--   PostgreSQL rejects this with error 42P17 "infinite recursion detected".
--
--   Additionally, older permissive policies (e.g. approval_actions_insert_auth,
--   invoice_files_insert_auth) may still exist from earlier schema versions and
--   would let any authenticated user bypass the intended restrictions.
--
-- FIX:
--   1. Create a SECURITY DEFINER helper (public.is_in_roles) that reads the
--      caller's own profile with the owner's privileges (no RLS -> no recursion).
--   2. ENABLE RLS on all six tables (idempotent).
--   3. DROP EVERY policy on those tables (handles leftover/stale policy names).
--   4. Recreate the complete, intended policy set using is_in_roles().
-- ============================================================

-- 1. Helper function (SECURITY DEFINER runs as owner -> no RLS -> no recursion)
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

-- 2. Enable RLS on all tables (idempotent)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Drop EVERY policy on these tables (including stale *_auth policies)
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

-- 4. Recreate the complete intended policy set
-- DEPARTMENTS
CREATE POLICY "departments_select_auth" ON departments
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "departments_insert_admin" ON departments
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['admin']));
CREATE POLICY "departments_update_admin" ON departments
    FOR UPDATE USING (public.is_in_roles(ARRAY['admin']));
CREATE POLICY "departments_delete_admin" ON departments
    FOR DELETE USING (public.is_in_roles(ARRAY['admin']));

-- USER PROFILES
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

-- INVOICES
CREATE POLICY "invoices_select_own" ON invoices
    FOR SELECT USING (submitted_by = auth.uid());
CREATE POLICY "invoices_select_approvers" ON invoices
    FOR SELECT USING (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));
CREATE POLICY "invoices_insert_dept_user" ON invoices
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['department_user', 'admin']));
CREATE POLICY "invoices_update_own" ON invoices
    FOR UPDATE USING (submitted_by = auth.uid() AND status IN ('draft', 'returned'));
CREATE POLICY "invoices_update_admin" ON invoices
    FOR UPDATE USING (public.is_in_roles(ARRAY['admin']));
CREATE POLICY "invoices_delete_admin" ON invoices
    FOR DELETE USING (public.is_in_roles(ARRAY['admin', 'accountant_1']));

-- INVOICE FILES
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

-- APPROVAL ACTIONS
CREATE POLICY "approval_actions_select" ON approval_actions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid())
    );
CREATE POLICY "approval_actions_insert_restricted" ON approval_actions
    FOR INSERT WITH CHECK (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));

-- AUDIT LOGS
CREATE POLICY "audit_logs_select_approvers" ON audit_logs
    FOR SELECT USING (public.is_in_roles(ARRAY['admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager']));
CREATE POLICY "audit_logs_select_own_invoice" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND submitted_by = auth.uid())
    );

-- 5. Verify: full policy inventory (no self-referencing subqueries, no *_auth leftovers)
SELECT tablename, policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('departments', 'user_profiles', 'invoices', 'invoice_files', 'approval_actions', 'audit_logs')
ORDER BY tablename, policyname;
