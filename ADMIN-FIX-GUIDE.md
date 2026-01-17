# 🔧 Admin Dashboard Fix Guide

## 🎯 Problem

The admin dashboard is not showing:
- Total users count
- Pending verifications
- Admin cannot approve/reject verifications

## 🔍 Root Causes

1. **RLS Policies Blocking Admin**: The service role doesn't have SELECT policies to view all users/verifications
2. **Mixed Data Sources**: Some endpoints use Firestore, others use Supabase
3. **Missing Permissions**: Admin endpoints need proper RLS bypass

## ✅ Solution

### **Step 1: Run Admin RLS Fix SQL**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor**

2. **Run the Admin Fix**
   - Open file: `src/models/ADMIN-RLS-FIX.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**

3. **Verify Success**
   - You should see a list of policies created
   - Check for "service_role" policies on all tables

### **Step 2: Test Admin Endpoints**

After running the SQL, test these endpoints:

```bash
# Get admin stats (should show total users and pending verifications)
GET /api/admin/stats

# Get all users
GET /api/admin/users

# Get pending verifications
GET /api/admin/pending

# Get all verifications
GET /api/admin/verifications
```

## 📊 What Each Endpoint Returns

### `/api/admin/stats`
```json
{
  "status": "success",
  "data": {
    "stats": {
      "totalUsers": 10,
      "activeTrips": 5,
      "deliveries": 3,
      "revenue": 50000,
      "pendingVerifications": 2
    },
    "activity": [...]
  }
}
```

### `/api/admin/pending`
```json
{
  "status": "success",
  "data": [
    {
      "id": "...",
      "user_id": "...",
      "status": "pending",
      "verification_type": "identity",
      ...
    }
  ]
}
```

## 🚨 Common Issues

### Issue: "Still getting 400 errors"
**Solution**: 
1. Make sure you ran BOTH SQL scripts:
   - `FINAL-COMPLETE-FIX.sql` (for registration)
   - `ADMIN-RLS-FIX.sql` (for admin dashboard)

### Issue: "Pending verifications showing 0"
**Solution**:
- Check if verifications exist in database
- Run this query in Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM verifications WHERE status = 'pending';
```

### Issue: "Cannot approve verifications"
**Solution**:
- The service role needs UPDATE permission
- This is included in `ADMIN-RLS-FIX.sql`

## 🔍 Debugging

### Check if policies exist:
```sql
SELECT tablename, policyname, roles
FROM pg_policies 
WHERE roles @> ARRAY['service_role']
ORDER BY tablename;
```

### Check total users:
```sql
SELECT COUNT(*) as total_users FROM users;
```

### Check pending verifications:
```sql
SELECT 
    v.id,
    v.status,
    v.verification_type,
    u.full_name,
    u.email
FROM verifications v
LEFT JOIN users u ON v.user_id = u.id
WHERE v.status = 'pending';
```

## ✅ Success Indicators

You'll know it's working when:

1. ✅ `/api/admin/stats` returns actual numbers (not 0)
2. ✅ `/api/admin/users` returns list of all users
3. ✅ `/api/admin/pending` returns pending verifications
4. ✅ Admin can approve/reject verifications
5. ✅ No 400 or 403 errors in console

---

**Next Step**: Run `ADMIN-RLS-FIX.sql` in Supabase SQL Editor now!
