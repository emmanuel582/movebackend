-- ============================================
-- COMPLETE RLS AND TRIGGER FIX
-- ============================================
-- This script fixes ALL Row-Level Security issues AND the trigger function
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================

-- Users table policies
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert users" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;

-- Wallets table policies
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;
DROP POLICY IF EXISTS "Allow trigger to insert wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON wallets;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON wallets;

-- Verifications table policies
DROP POLICY IF EXISTS "Users can submit own verification" ON verifications;
DROP POLICY IF EXISTS "Service role can insert verifications" ON verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can manage verifications" ON verifications;

-- ============================================
-- STEP 2: FIX THE TRIGGER FUNCTION
-- ============================================

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
AS $$
BEGIN
  -- Insert into public.users table
  INSERT INTO public.users (id, email, full_name, phone, user_type, current_mode, is_verified)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    'traveler', -- Default user type
    'traveler', -- Default mode
    false -- Not verified by default
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate key errors
  
  -- Insert into wallets table
  INSERT INTO public.wallets (user_id, balance, total_earned, total_withdrawn)
  VALUES (NEW.id, 0.00, 0.00, 0.00)
  ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicate key errors
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth.users insert
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 3: CREATE SERVICE ROLE BYPASS POLICIES (HIGHEST PRIORITY)
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
-- STEP 4: CREATE AUTHENTICATED USER POLICIES
-- ============================================

-- Users table - authenticated users can insert their own data
CREATE POLICY "Enable insert for authenticated users only"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users table - users can view their own data
CREATE POLICY "Users can view own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users table - users can update their own data
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Wallets table - authenticated users can insert their own wallet
CREATE POLICY "Enable insert for authenticated users only"
ON wallets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Wallets table - users can view their own wallet
CREATE POLICY "Users can view own wallet"
ON wallets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Wallets table - users can update their own wallet
CREATE POLICY "Users can update own wallet"
ON wallets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Verifications table - authenticated users can submit their own verification
CREATE POLICY "Users can submit own verification"
ON verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Verifications table - users can view their own verifications
CREATE POLICY "Users can view own verifications"
ON verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: ENSURE RLS IS ENABLED
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: GRANT NECESSARY PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Grant permissions on tables
GRANT ALL ON users TO service_role;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;

GRANT ALL ON wallets TO service_role;
GRANT SELECT, INSERT, UPDATE ON wallets TO authenticated;

GRANT ALL ON verifications TO service_role;
GRANT SELECT, INSERT ON verifications TO authenticated;

-- ============================================
-- STEP 7: TEST THE TRIGGER (Optional - for verification)
-- ============================================

-- You can test by creating a test user in Supabase Auth dashboard
-- or by running a registration through your app

-- ============================================
-- STEP 8: VERIFY POLICIES WERE CREATED
-- ============================================
SELECT 
    '=== DATABASE POLICIES ===' as info;

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies 
WHERE tablename IN ('users', 'wallets', 'verifications')
ORDER BY tablename, policyname;

SELECT 
    '=== TRIGGER VERIFICATION ===' as info;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

SELECT 
    '=== SETUP COMPLETE ===' as info;
