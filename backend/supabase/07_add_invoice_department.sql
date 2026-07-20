-- Migration 07: Add department_id to invoices table
-- Run this on the existing Supabase database

-- Add department_id column (nullable, so existing rows are unaffected)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Index for filtering invoices by department
CREATE INDEX IF NOT EXISTS idx_invoices_department_id ON invoices(department_id);
