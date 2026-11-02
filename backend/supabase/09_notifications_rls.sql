-- ============================================================
-- InvoiceFlow — RLS policies for the notifications table
-- Run ONCE on the existing Supabase database. Idempotent, safe to re-run.
--
-- The app backend inserts notifications as the DB owner (RLS bypassed).
-- These policies let the owning user read / mark-read their own
-- notifications through any authenticated API path.
--
-- Also creates the notifications table if it does not yet exist,
-- so this file works on databases created before the table was added.
-- ============================================================

-- 0. Create table + indexes if missing (idempotent)
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    invoice_id  UUID REFERENCES invoices(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_invoice_id ON notifications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 1. Enable RLS (idempotent)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop any stale policies on this table
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. Policies: owners may only read / update / delete their own notifications
CREATE POLICY "notifications_select_own" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- 4. Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY policyname;
