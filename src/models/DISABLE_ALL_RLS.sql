-- ============================================
-- NUCLEAR OPTION: DISABLE ALL RLS & OPEN STORAGE
-- ============================================
-- Run this in Supabase SQL Editor
-- This completely REMOVES Row Level Security checks.
-- ============================================

-- 1. DISABLE RLS ON ALL DATA TABLES
-- This creates a standard database environment with no per-row checks.
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS disputes DISABLE ROW LEVEL SECURITY;

-- 2. OPEN UP STORAGE (ALLOW EVERYTHING)
-- Storage requires RLS on the system tables, so we use a "Permit All" policy.

-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop ALL existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Service role key has full access to objects" ON storage.objects;
DROP POLICY IF EXISTS "Service role key has full access to buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to verifications" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Buckets" ON storage.buckets;

-- Create "ALLOW EVERYTHING" Policies for Storage
-- This allows SELECT, INSERT, UPDATE, DELETE for everyone (Public/Anon/Auth)
CREATE POLICY "Allow All Storage"
ON storage.objects FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow All Buckets"
ON storage.buckets FOR ALL
USING (true)
WITH CHECK (true);

-- 3. GRANT PERMISSIONS
-- Ensure the 'anon' and 'service_role' (and 'authenticated') roles can access the schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Storage Schema Permissions
GRANT ALL ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.objects TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.buckets TO anon, authenticated, service_role;

SELECT '✅ RLS DISABLED and Storage is OPEN TO ALL' as status;
