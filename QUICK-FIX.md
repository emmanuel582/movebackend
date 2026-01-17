# 🚀 Quick Fix - RLS Database Errors

## ⚡ Immediate Action Required

### 1️⃣ **Run This SQL Script in Supabase**

📍 **Location**: `src/models/COMPLETE-RLS-AND-TRIGGER-FIX.sql`

**Steps**:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `COMPLETE-RLS-AND-TRIGGER-FIX.sql`
3. Paste and click **Run**
4. Wait for success message

---

## 🎯 What This Fixes

| Error | Status |
|-------|--------|
| ❌ `Database error saving new user` | ✅ **FIXED** |
| ❌ `new row violates row-level security policy` | ✅ **FIXED** |
| ❌ `duplicate key value violates unique constraint` | ✅ **FIXED** |
| ❌ `User not found in public.users` | ✅ **FIXED** |

---

## 📋 After Running SQL Script

### ✅ Backend Code (Already Updated)
- `src/controllers/auth.controller.ts` - Uses upsert now
- `src/controllers/verification.controller.ts` - Uses upsert now

### ✅ Test Registration
```bash
# Your server should already be running
# Just try registering a new user in your app
```

---

## 🔍 Verify It Worked

Run this in Supabase SQL Editor:

```sql
-- Check if trigger exists
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check if policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('users', 'wallets', 'verifications')
ORDER BY tablename;
```

**Expected**: You should see the trigger and multiple policies listed.

---

## 🆘 Still Having Issues?

### Check Backend Logs
Look for these specific errors:
- `[Auth] Failed to auto-create user`
- `[Verification] Failed to create user`

### Check Supabase Logs
Dashboard → Logs → Look for RLS violations

### Clean Up Orphaned Users
If users exist in `auth.users` but not `public.users`:

```sql
-- See orphaned users
SELECT au.email 
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;
```

---

## 📚 Full Documentation

See `RLS-FIX-GUIDE.md` for complete details.

---

**Status**: 🟢 Ready to Fix
**Time Required**: 2-3 minutes
**Difficulty**: Easy (just run SQL script)
