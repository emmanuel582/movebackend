-- ============================================
-- COMPLETE RLS FIX - ALL TABLES AND STORAGE
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- This fixes ALL Row-Level Security issues

-- ============================================
-- 1. USERS TABLE - Fix INSERT policies
-- ============================================
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert users" ON users;

CREATE POLICY "Users can insert own data" 
ON users 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert users" 
ON users 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Allow trigger to insert users" 
ON users 
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- 2. WALLETS TABLE - Fix INSERT policies
-- ============================================
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;
DROP POLICY IF EXISTS "Allow trigger to insert wallets" ON wallets;

CREATE POLICY "Users can insert own wallet" 
ON wallets 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert wallets" 
ON wallets 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Allow trigger to insert wallets" 
ON wallets 
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- 3. VERIFICATIONS TABLE - Fix INSERT and SELECT policies
-- ============================================
DROP POLICY IF EXISTS "Users can submit own verification" ON verifications;
DROP POLICY IF EXISTS "Service role can insert verifications" ON verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON verifications;

CREATE POLICY "Users can submit own verification" 
ON verifications 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert verifications" 
ON verifications 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can view own verifications" 
ON verifications 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 4. STORAGE BUCKET POLICIES - verifications bucket
-- ============================================
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read files" ON storage.objects;

-- Policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow service role to do anything (for backend operations)
CREATE POLICY "Service role can manage all files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'verifications')
WITH CHECK (bucket_id = 'verifications');

-- Policy: Allow public read access (if bucket is public)
CREATE POLICY "Public can read files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'verifications');

-- ============================================
-- 5. VERIFY POLICIES WERE CREATED
-- ============================================
SELECT 'Database Policies:' as section;
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename IN ('users', 'wallets', 'verifications')
ORDER BY tablename, policyname;

SELECT 'Storage Policies:' as section;
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

