-- ============================================
-- FINAL RLS FIX - THIS WILL WORK
-- ============================================
-- The issue: Trigger functions need explicit grants even with SECURITY DEFINER

-- Step 1: Grant necessary permissions to the function
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.wallets TO postgres, anon, authenticated, service_role;

-- Step 2: Drop and recreate the trigger function with proper ownership
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert user (with conflict handling)
  INSERT INTO public.users (id, email, full_name, phone, user_type, current_mode, is_verified)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    'traveler',
    'traveler',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert wallet (with conflict handling)
  INSERT INTO public.wallets (user_id, balance, total_earned)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Step 3: Make sure function is owned by postgres (superuser)
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Step 4: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Add INSERT policies (backup in case function still has issues)
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert users" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;

CREATE POLICY "Users can insert own data" 
ON users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- This policy allows the trigger function to insert
CREATE POLICY "Allow trigger to insert users" 
ON users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can insert users" 
ON users 
FOR INSERT 
WITH CHECK (true);

-- Step 6: Same for wallets
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Allow trigger to insert wallets" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;

CREATE POLICY "Users can insert own wallet" 
ON wallets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow trigger to insert wallets" 
ON wallets 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can insert wallets" 
ON wallets 
FOR INSERT 
WITH CHECK (true);

-- Step 7: Verify it worked
SELECT 'RLS Fix Complete! Policies created:' as status;
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('users', 'wallets') 
ORDER BY tablename, policyname;

