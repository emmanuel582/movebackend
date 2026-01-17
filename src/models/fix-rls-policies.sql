-- Fix RLS Policies for Users and Wallets Tables
-- This adds the missing INSERT policies that are causing "new row violates row-level security policy" errors
-- 
-- IMPORTANT: Run this SQL in your Supabase SQL Editor
-- The service role key should bypass RLS, but these policies ensure the trigger function works correctly

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

-- Policy: Allow users to insert their own record (for registration trigger)
-- This works with the trigger function handle_new_user()
CREATE POLICY "Users can insert own data" 
ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Policy: Allow service role/backend to insert users
-- This ensures backend operations work even if service role has issues
CREATE POLICY "Service role can insert users" 
ON users 
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- WALLETS TABLE POLICIES  
-- ============================================

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;

-- Policy: Allow users to insert their own wallet (for registration trigger)
CREATE POLICY "Users can insert own wallet" 
ON wallets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow service role/backend to insert wallets
CREATE POLICY "Service role can insert wallets" 
ON wallets 
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this, verify the policies exist:
-- SELECT * FROM pg_policies WHERE tablename IN ('users', 'wallets') AND policyname LIKE '%insert%';

