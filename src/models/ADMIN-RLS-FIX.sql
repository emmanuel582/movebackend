-- ============================================
-- ADMIN RLS POLICIES FIX
-- ============================================
-- This adds policies so admins can see all users and verifications
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: ADD ADMIN SELECT POLICIES FOR USERS
-- ============================================

-- Drop existing admin policies if any
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Service role can view all users" ON users;

-- Allow service role to view all users (for admin dashboard)
CREATE POLICY "Service role can view all users"
ON users
FOR SELECT
TO service_role
USING (true);

-- ============================================
-- STEP 2: ADD ADMIN SELECT POLICIES FOR VERIFICATIONS
-- ============================================

-- Drop existing admin policies if any
DROP POLICY IF EXISTS "Admins can view all verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can view all verifications" ON verifications;
DROP POLICY IF EXISTS "Admins can update verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can update verifications" ON verifications;

-- Allow service role to view all verifications
CREATE POLICY "Service role can view all verifications"
ON verifications
FOR SELECT
TO service_role
USING (true);

-- Allow service role to update verifications (for approve/reject)
CREATE POLICY "Service role can update verifications"
ON verifications
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- STEP 3: ADD ADMIN POLICIES FOR OTHER TABLES
-- ============================================

-- Trips
DROP POLICY IF EXISTS "Service role can view all trips" ON trips;
CREATE POLICY "Service role can view all trips"
ON trips
FOR SELECT
TO service_role
USING (true);

-- Delivery Requests
DROP POLICY IF EXISTS "Service role can view all deliveries" ON delivery_requests;
CREATE POLICY "Service role can view all deliveries"
ON delivery_requests
FOR SELECT
TO service_role
USING (true);

-- Payments
DROP POLICY IF EXISTS "Service role can view all payments" ON payments;
CREATE POLICY "Service role can view all payments"
ON payments
FOR SELECT
TO service_role
USING (true);

-- Disputes
DROP POLICY IF EXISTS "Service role can view all disputes" ON disputes;
CREATE POLICY "Service role can view all disputes"
ON disputes
FOR SELECT
TO service_role
USING (true);

-- Wallets
DROP POLICY IF EXISTS "Service role can view all wallets" ON wallets;
CREATE POLICY "Service role can view all wallets"
ON wallets
FOR SELECT
TO service_role
USING (true);

-- ============================================
-- STEP 4: VERIFY POLICIES
-- ============================================

SELECT '=== ADMIN POLICIES CREATED ===' as info;

SELECT 
    tablename, 
    policyname,
    cmd as command,
    roles
FROM pg_policies 
WHERE roles @> ARRAY['service_role']
ORDER BY tablename, policyname;

SELECT '=== SETUP COMPLETE ===' as info;
