# 🔧 Complete RLS and Database Error Fix Guide

## 🎯 Problem Summary

You're experiencing multiple database errors:

1. **Registration Failure**: `Database error saving new user` (400 Bad Request)
2. **RLS Policy Violations**: `new row violates row-level security policy for table "users"`
3. **Duplicate Key Errors**: `duplicate key value violates unique constraint "users_pkey"`
4. **User Sync Issues**: Users exist in `auth.users` but not in `public.users`

## 🔍 Root Causes

### 1. **Trigger Function Failing**
The `handle_new_user()` trigger that automatically creates users in `public.users` when they sign up is being blocked by RLS policies.

### 2. **RLS Policies Too Restrictive**
The Row-Level Security policies don't allow the trigger function (which runs as `SECURITY DEFINER`) to insert users.

### 3. **Race Conditions**
Multiple concurrent requests trying to create the same user cause duplicate key errors.

## ✅ Solution Steps

### **Step 1: Run the SQL Fix Script**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor** (left sidebar)

2. **Run the Complete Fix**
   - Open the file: `src/models/COMPLETE-RLS-AND-TRIGGER-FIX.sql`
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click **Run** (or press Ctrl+Enter)

3. **Verify Success**
   - You should see output showing all policies created
   - Check for any errors in the output
   - The trigger should be recreated successfully

### **Step 2: Verify Backend Code Changes**

The following files have been updated to handle race conditions better:

✅ **`src/controllers/auth.controller.ts`**
- Changed `insert` to `upsert` in `getMe()` function
- Added retry logic for duplicate key errors
- Better error handling

✅ **`src/controllers/verification.controller.ts`**
- Changed `insert` to `upsert` in `submitIdentity()` function
- Added verification check if upsert fails
- Better error handling

These changes are already applied and will prevent duplicate key errors.

### **Step 3: Test Registration**

1. **Restart your backend server** (if not already running):
   ```bash
   cd movebackend
   npm run dev
   ```

2. **Try registering a new user** through your app

3. **Expected behavior**:
   - User should be created in `auth.users`
   - Trigger should automatically create user in `public.users`
   - Wallet should be automatically created
   - No RLS errors
   - Registration should succeed

### **Step 4: Clean Up Orphaned Users (Optional)**

If you have users in `auth.users` that don't exist in `public.users`, run this cleanup script:

```sql
-- Find orphaned users
SELECT 
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Manually sync orphaned users (run this for each orphaned user)
-- Replace the UUID with the actual user ID from the query above
DO $$
DECLARE
    auth_user RECORD;
BEGIN
    FOR auth_user IN 
        SELECT * FROM auth.users au
        LEFT JOIN public.users pu ON au.id = pu.id
        WHERE pu.id IS NULL
    LOOP
        -- Insert into users
        INSERT INTO public.users (id, email, full_name, phone, user_type, current_mode, is_verified)
        VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'full_name', auth_user.email),
            auth_user.raw_user_meta_data->>'phone',
            'traveler',
            'traveler',
            false
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert into wallets
        INSERT INTO public.wallets (user_id)
        VALUES (auth_user.id)
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Synced user: %', auth_user.email;
    END LOOP;
END $$;
```

## 🧪 Testing Checklist

After applying the fixes, test the following:

- [ ] **New User Registration**
  - Register a completely new user
  - Verify user appears in both `auth.users` and `public.users`
  - Verify wallet is created automatically

- [ ] **Login**
  - Login with existing user
  - Verify `/api/auth/me` returns user data
  - No 404 errors

- [ ] **Verification Submission**
  - Submit identity verification
  - Should not get RLS errors
  - Should not get duplicate key errors

- [ ] **Admin Dashboard**
  - Check pending verifications
  - Should load without errors

## 📊 Understanding the Fix

### What Changed in the Database?

1. **Improved Trigger Function**
   - Added `ON CONFLICT DO NOTHING` to prevent duplicate errors
   - Added exception handling to prevent auth failures
   - Better metadata extraction from `raw_user_meta_data`

2. **Service Role Policies**
   - Service role can now bypass ALL RLS policies
   - Backend operations won't be blocked

3. **Authenticated User Policies**
   - Users can insert/view/update their own data
   - Proper separation of concerns

### What Changed in the Backend?

1. **Upsert Instead of Insert**
   - Prevents duplicate key errors
   - Handles race conditions gracefully

2. **Retry Logic**
   - If upsert fails, tries to fetch existing user
   - Better error messages

3. **Wallet Creation**
   - Also uses upsert to prevent duplicates

## 🚨 Common Issues After Fix

### Issue: "Still getting RLS errors"
**Solution**: Make sure you ran the COMPLETE SQL script in Supabase SQL Editor

### Issue: "Trigger not working"
**Solution**: 
1. Check if trigger exists:
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'on_auth_user_created';
   ```
2. If not found, run the SQL script again

### Issue: "Users still not syncing"
**Solution**: Run the orphaned users cleanup script above

## 📝 Monitoring

To monitor if everything is working:

```sql
-- Check recent user registrations
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created,
    pu.created_at as public_created,
    CASE 
        WHEN pu.id IS NULL THEN '❌ Missing in public.users'
        ELSE '✅ Synced'
    END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC
LIMIT 10;

-- Check wallets
SELECT 
    u.email,
    w.balance,
    w.updated_at
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
ORDER BY u.created_at DESC
LIMIT 10;
```

## 🎉 Success Indicators

You'll know everything is working when:

1. ✅ New users can register without errors
2. ✅ Users appear in both `auth.users` and `public.users`
3. ✅ Wallets are created automatically
4. ✅ No RLS policy violation errors in logs
5. ✅ No duplicate key errors in logs
6. ✅ `/api/auth/me` works for all users
7. ✅ Verification submission works

## 🆘 Need Help?

If you're still experiencing issues:

1. Check the backend logs for specific error messages
2. Check Supabase logs in the dashboard
3. Verify all policies are created correctly
4. Ensure the trigger function exists and is enabled

---

**Last Updated**: 2026-01-08
**Status**: Ready to deploy
