-- ============================================================
-- InvoiceFlow — Add Accountant 1 & Accountant 2 Roles
-- Run this ONCE to update the role CHECK constraint
-- ============================================================

-- 1. Drop the existing CHECK constraint on user_profiles.role
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 2. Add new CHECK constraint with all roles including accountant_1 and accountant_2
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (
    role IN (
        'department_user', 'accountant_1', 'accountant_2',
        'accounts_team', 'accounts_head',
        'ceo', 'manager', 'admin'
    )
);

-- 3. Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass
AND conname = 'user_profiles_role_check';
