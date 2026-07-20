    -- ============================================================
    -- InvoiceFlow — Row Level Security Policies
    -- Run AFTER 01_schema.sql and 02_indexes.sql
    --
    -- These are defense-in-depth. The primary access control is in
    -- FastAPI middleware. RLS protects against direct DB access.
    -- ============================================================

    -- Enable RLS on all tables
    ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoice_files ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

    -- ============================================================
    -- DEPARTMENTS — readable by all authenticated users
    -- ============================================================
    CREATE POLICY "departments_select_auth" ON departments
        FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "departments_insert_admin" ON departments
        FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    CREATE POLICY "departments_update_admin" ON departments
        FOR UPDATE USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    -- ============================================================
    -- USER PROFILES
    -- ============================================================
    -- Everyone can read their own profile
    CREATE POLICY "user_profiles_select_own" ON user_profiles
        FOR SELECT USING (auth.uid() = id);

    -- Admins can read all profiles
    CREATE POLICY "user_profiles_select_admin" ON user_profiles
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    -- Accounts team can read profiles (for approval queue context)
    CREATE POLICY "user_profiles_select_accounts" ON user_profiles
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
                    AND role IN ('accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager'))
        );

    -- Only admins can insert/update user profiles
    CREATE POLICY "user_profiles_insert_admin" ON user_profiles
        FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    CREATE POLICY "user_profiles_update_admin" ON user_profiles
        FOR UPDATE USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    -- ============================================================
    -- INVOICES
    -- ============================================================
    -- Submitters can read their own invoices
    CREATE POLICY "invoices_select_own" ON invoices
        FOR SELECT USING (submitted_by = auth.uid());

    -- Accounts/management can read all invoices
    CREATE POLICY "invoices_select_approvers" ON invoices
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
                    AND role IN ('admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager'))
        );

    -- Department users can create invoices
    CREATE POLICY "invoices_insert_dept_user" ON invoices
        FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
                    AND role IN ('department_user', 'admin'))
        );

    -- Submitters can update their own draft/returned invoices
    CREATE POLICY "invoices_update_own" ON invoices
        FOR UPDATE USING (
            submitted_by = auth.uid()
            AND status IN ('draft', 'returned')
        );

    -- Admins can update any invoice
    CREATE POLICY "invoices_update_admin" ON invoices
        FOR UPDATE USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    -- Only admins can delete invoices
    CREATE POLICY "invoices_delete_admin" ON invoices
        FOR DELETE USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        );

    -- ============================================================
    -- INVOICE FILES
    -- ============================================================
    -- Users can read files for invoices they own
    CREATE POLICY "invoice_files_select_own" ON invoice_files
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND submitted_by = auth.uid())
        );

    -- Approvers can read all invoice files
    CREATE POLICY "invoice_files_select_approvers" ON invoice_files
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
                    AND role IN ('admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager'))
        );

    -- Authenticated users can upload files
    CREATE POLICY "invoice_files_insert_auth" ON invoice_files
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- ============================================================
    -- APPROVAL ACTIONS
    -- ============================================================
    -- Readable by anyone who can see the associated invoice
    CREATE POLICY "approval_actions_select" ON approval_actions
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid())
        );

    -- Authenticated users can insert approval actions
    CREATE POLICY "approval_actions_insert_auth" ON approval_actions
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- ============================================================
    -- AUDIT LOGS
    -- ============================================================
    -- Readable by accounts team and above
    CREATE POLICY "audit_logs_select_approvers" ON audit_logs
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
                    AND role IN ('admin', 'accountant_1', 'accountant_2', 'accounts_team', 'accounts_head', 'ceo', 'manager'))
        );

    -- Submitters can read audit logs for their own invoices
    CREATE POLICY "audit_logs_select_own_invoice" ON audit_logs
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM invoices WHERE id = invoice_id AND submitted_by = auth.uid())
        );

    -- Service role handles all audit inserts (via FastAPI backend)
    -- No direct INSERT policy for regular users — prevents tampering
