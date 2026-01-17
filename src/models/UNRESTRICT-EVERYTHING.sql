-- ============================================
-- GLOBAL NUCLEAR OPTION: UNRESTRICT EVERYTHING
-- ============================================
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- This script disables RLS on ALL tables and grants full permissions to everyone.
-- ============================================

-- 1. DISABLE RLS ON ALL TABLES
-- This removes any per-row restrictions on these tables.
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS disputes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS withdrawals DISABLE ROW LEVEL SECURITY;

-- 2. OPEN UP STORAGE BUCKETS (ALLOW EVERYTHING)
-- Storage needs active policies on system tables, so we use a "Permit All" logic.

-- Standardize 'verifications' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop all existing storage policies to ensure a clean slate
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'buckets' AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.buckets', pol.policyname);
    END LOOP;
END $$;

-- Create "TOTAL PASS-THROUGH" Policies for Storage
CREATE POLICY "Total Access Objects" ON storage.objects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Total Access Buckets" ON storage.buckets FOR ALL USING (true) WITH CHECK (true);

-- 3. GRANT MASTER PERMISSIONS
-- This ensures the Database password connection (Postgres), Anon key, Auth key, and Service Role all have full power.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Storage Schema Master Permissions
GRANT ALL ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.objects TO anon, authenticated, service_role;
GRANT ALL ON TABLE storage.buckets TO anon, authenticated, service_role;

-- 4. FIX TRIGGER PERMISSIONS (Ensure it can run without RLS blocks)
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;

SELECT '🚀 DATABASE IS NOW FULLY UNRESTRICTED: RLS Disabled on all tables, Storage Open to All.' as status;
