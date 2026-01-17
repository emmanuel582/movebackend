-- ============================================
-- FIX STORAGE RLS AND PERMISSIONS
-- ============================================
-- Run this in Supabase SQL Editor to fix the "new row violates row-level security policy" error.
-- ============================================

-- 1. Create the 'verifications' bucket if it doesn't exist (Public for getPublicUrl to work)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies that might be blocking access
DROP POLICY IF EXISTS "Service role key has full access to objects" ON storage.objects;
DROP POLICY IF EXISTS "Service role key has full access to buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Users can upload verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to verifications" ON storage.objects;

-- 3. Allow Service Role FULL ACCESS to everything (Critical for Backend Uploads)
CREATE POLICY "Service role key has full access to objects"
ON storage.objects FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role key has full access to buckets"
ON storage.buckets FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 4. Allow Authenticated Users to Upload Scoped to their User ID
-- Matches path: userId/folder/filename
CREATE POLICY "Users can upload verification documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Allow Authenticated Users to View their own files
CREATE POLICY "Users can view own verification documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Allow Public Read Access (Required for getPublicUrl)
CREATE POLICY "Give public access to verifications"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'verifications');

-- ============================================
-- CHECK: STORAGE SCHEMA PERMISSIONS
-- ============================================
GRANT ALL ON SCHEMA storage TO service_role;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.buckets TO service_role;

-- ============================================
-- NOTE ON FIRESTORE ERROR
-- ============================================
-- If you see "PERMISSION_DENIED: Cloud Firestore API ... is disabled",
-- you MUST go to Google Cloud Console > APIs & Services > Enabled APIs
-- and enable "Cloud Firestore API" for your project 'movevers'.
