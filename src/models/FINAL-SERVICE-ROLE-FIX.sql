-- ============================================
-- FINAL SERVICE ROLE RLS FIX
-- ============================================
-- This script ensures the service role can bypass ALL RLS policies
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. DROP ALL EXISTING POLICIES
-- ============================================

-- Users table policies
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert users" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;

-- Wallets table policies
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;
DROP POLICY IF EXISTS "Allow trigger to insert wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON wallets;

-- Verifications table policies
DROP POLICY IF EXISTS "Users can submit own verification" ON verifications;
DROP POLICY IF EXISTS "Service role can insert verifications" ON verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can manage verifications" ON verifications;

-- ============================================
-- 2. CREATE SERVICE ROLE BYPASS POLICIES (HIGHEST PRIORITY)
-- ============================================

-- Service role has FULL access to users table
CREATE POLICY "Service role can manage users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Service role has FULL access to wallets table
CREATE POLICY "Service role can manage wallets"
ON wallets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Service role has FULL access to verifications table
CREATE POLICY "Service role can manage verifications"
ON verifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. CREATE AUTHENTICATED USER POLICIES
-- ============================================

-- Users table - authenticated users
CREATE POLICY "Users can insert own data"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Wallets table - authenticated users
CREATE POLICY "Users can insert own wallet"
ON wallets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own wallet"
ON wallets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
ON wallets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Verifications table - authenticated users
CREATE POLICY "Users can submit own verification"
ON verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own verifications"
ON verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 4. VERIFY RLS IS ENABLED
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. VERIFY POLICIES WERE CREATED
-- ============================================
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('users', 'wallets', 'verifications')
ORDER BY tablename, policyname;
