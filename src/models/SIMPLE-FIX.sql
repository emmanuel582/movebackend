-- ============================================
-- SIMPLE FIX - NO VERIFICATION QUERIES
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: DROP ALL EXISTING POLICIES
-- ============================================

-- Users
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Allow trigger to insert users" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Service role can view all users" ON users;

-- Wallets
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can insert wallets" ON wallets;
DROP POLICY IF EXISTS "Allow trigger to insert wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON wallets;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON wallets;
DROP POLICY IF EXISTS "Service role can view all wallets" ON wallets;

-- Verifications
DROP POLICY IF EXISTS "Users can submit own verification" ON verifications;
DROP POLICY IF EXISTS "Service role can insert verifications" ON verifications;
DROP POLICY IF EXISTS "Users can view own verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can manage verifications" ON verifications;
DROP POLICY IF EXISTS "Admins can view all verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can view all verifications" ON verifications;
DROP POLICY IF EXISTS "Admins can update verifications" ON verifications;
DROP POLICY IF EXISTS "Service role can update verifications" ON verifications;

-- Other tables
DROP POLICY IF EXISTS "Service role can view all trips" ON trips;
DROP POLICY IF EXISTS "Service role can view all deliveries" ON delivery_requests;
DROP POLICY IF EXISTS "Service role can view all payments" ON payments;
DROP POLICY IF EXISTS "Service role can view all disputes" ON disputes;

-- ============================================
-- PART 2: FIX PHONE UNIQUE CONSTRAINT
-- ============================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx 
ON users (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- ============================================
-- PART 3: FIX TRIGGER FUNCTION
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_phone TEXT;
    user_full_name TEXT;
BEGIN
    user_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');
    user_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        SPLIT_PART(NEW.email, '@', 1)
    );
    
    INSERT INTO public.users (id, email, full_name, phone, user_type, current_mode, is_verified)
    VALUES (
        NEW.id, 
        NEW.email, 
        user_full_name,
        user_phone,
        'traveler',
        'traveler',
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        phone = COALESCE(EXCLUDED.phone, users.phone);
    
    INSERT INTO public.wallets (user_id, balance, total_earned, total_withdrawn)
    VALUES (NEW.id, 0.00, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO public.users (id, email, full_name, phone, user_type, current_mode, is_verified)
        VALUES (
            NEW.id, 
            NEW.email, 
            user_full_name,
            NULL,
            'traveler',
            'traveler',
            false
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, users.full_name);
        
        INSERT INTO public.wallets (user_id, balance, total_earned, total_withdrawn)
        VALUES (NEW.id, 0.00, 0.00, 0.00)
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE WARNING 'Phone conflict for %, set to NULL', NEW.email;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PART 4: CREATE SERVICE ROLE POLICIES (FULL ACCESS)
-- ============================================

-- Users - Service role has FULL access
CREATE POLICY "Service role can manage users"
ON users FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Wallets - Service role has FULL access
CREATE POLICY "Service role can manage wallets"
ON wallets FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Verifications - Service role has FULL access
CREATE POLICY "Service role can manage verifications"
ON verifications FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Trips - Service role can view all
CREATE POLICY "Service role can view all trips"
ON trips FOR SELECT TO service_role
USING (true);

-- Delivery Requests - Service role can view all
CREATE POLICY "Service role can view all deliveries"
ON delivery_requests FOR SELECT TO service_role
USING (true);

-- Payments - Service role can view all
CREATE POLICY "Service role can view all payments"
ON payments FOR SELECT TO service_role
USING (true);

-- Disputes - Service role can view all
CREATE POLICY "Service role can view all disputes"
ON disputes FOR SELECT TO service_role
USING (true);

-- ============================================
-- PART 5: CREATE AUTHENTICATED USER POLICIES
-- ============================================

-- Users
CREATE POLICY "Enable insert for authenticated users only"
ON users FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own data"
ON users FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
ON users FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Wallets
CREATE POLICY "Enable insert for authenticated users only"
ON wallets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own wallet"
ON wallets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
ON wallets FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Verifications
CREATE POLICY "Users can submit own verification"
ON verifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own verifications"
ON verifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- PART 6: ENABLE RLS
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 7: GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON users TO service_role;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT ALL ON wallets TO service_role;
GRANT SELECT, INSERT, UPDATE ON wallets TO authenticated;
GRANT ALL ON verifications TO service_role;
GRANT SELECT, INSERT ON verifications TO authenticated;

-- ============================================
-- PART 8: CLEAN UP DUPLICATE PHONE NUMBERS
-- ============================================
WITH duplicate_phones AS (
    SELECT phone, MIN(created_at) as first_created
    FROM users
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY phone
    HAVING COUNT(*) > 1
)
UPDATE users u
SET phone = NULL
WHERE u.phone IN (SELECT phone FROM duplicate_phones)
  AND u.created_at > (
      SELECT first_created 
      FROM duplicate_phones dp 
      WHERE dp.phone = u.phone
  );

-- ============================================
-- DONE! NO VERIFICATION QUERIES
-- ============================================

SELECT '🎉 SETUP COMPLETE!' as status;
