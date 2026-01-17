-- ============================================
-- COMPLETE RLS FIX - Run this entire script
-- ============================================
-- This fixes ALL Row-Level Security policy issues
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. USERS TABLE - Fix INSERT policies
-- ============================================
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

CREATE POLICY "Users can insert own data" 
ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert users" 
ON users 
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- 2. WALLETS TABLE - Fix INSERT policies
-- ============================================
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;

CREATE POLICY "Users can insert own wallet" 
ON wallets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can insert wallets" 
ON wallets 
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- 3. FIX TRIGGER FUNCTION - Ensure it bypasses RLS
-- ============================================
-- The trigger function needs to run with proper privileges
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone, user_type, current_mode, is_verified)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    'traveler',
    'traveler',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.wallets (user_id, balance, total_earned)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 4. VERIFY POLICIES EXIST
-- ============================================
-- Run this to check if policies were created:
-- SELECT schemaname, tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE tablename IN ('users', 'wallets') 
-- ORDER BY tablename, policyname;

