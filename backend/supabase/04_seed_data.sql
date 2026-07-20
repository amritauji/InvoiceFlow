-- ============================================================
-- InvoiceFlow — Seed Data
-- Run AFTER 01_schema.sql
-- ============================================================

-- Default Departments
INSERT INTO departments (name, code, description) VALUES
    ('CPNM',                'CPNM',     'CPNM Department'),
    ('CONTENT',             'CONTENT',  'Content Department'),
    ('NUVERSE',             'NUVERSE',  'Nuverse Department'),
    ('MULTIA',              'MULTIA',   'Multia Department'),
    ('PEOPLE AND CULTURE',  'PNC',      'People and Culture Department'),
    ('ACCOUNTS',            'ACCOUNTS', 'Accounts Department'),
    ('SYSTEM ADMIN',        'SYSADMIN', 'System Administration')
ON CONFLICT (name) DO NOTHING;

-- Note: Admin user is created via Supabase Auth (see setup guide).
-- The user_profiles record is created by the backend API when
-- POST /api/v1/admin/users is called with role='admin'.
--
-- Alternatively, create admin via Supabase Dashboard:
-- 1. Go to Authentication → Users → Add User
-- 2. Email: admin@invoiceflow.com
-- 3. Password: Admin@12345
-- 4. Then INSERT the profile:
