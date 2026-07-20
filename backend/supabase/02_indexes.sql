-- ============================================================
-- InvoiceFlow — Database Indexes
-- Run AFTER 01_schema.sql
-- ============================================================

-- user_profiles
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_department ON user_profiles(department_id);

-- invoices
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_submitted_by ON invoices(submitted_by);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX idx_invoices_status_submitted ON invoices(status, created_at DESC);

-- invoice_files
CREATE INDEX idx_invoice_files_invoice_id ON invoice_files(invoice_id);

-- approval_actions
CREATE INDEX idx_approval_actions_invoice_id ON approval_actions(invoice_id);
CREATE INDEX idx_approval_actions_actor_id ON approval_actions(actor_id);
CREATE INDEX idx_approval_actions_created ON approval_actions(created_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_invoice_id ON audit_logs(invoice_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
