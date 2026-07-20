-- ============================================================
-- InvoiceFlow — Trigger: Auto-create user_profiles on Auth signup
-- ============================================================
-- When a user signs up via Supabase Auth, this trigger
-- automatically creates a user_profiles row.
-- Run AFTER 01_schema.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'department_user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after a new user is created in auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- NOTE: This trigger is OPTIONAL for InvoiceFlow.
--
-- We create users via the admin API (POST /api/v1/admin/users)
-- which handles BOTH Supabase Auth + user_profiles creation.
--
-- This trigger is useful if you also want Supabase Auth signup
-- page to automatically create profiles. Enable it if needed.
-- ============================================================
