-- ============================================
-- FIX STORAGE BUCKET RLS POLICIES
-- ============================================
-- This fixes the "new row violates row-level security policy" error for file uploads

-- Step 1: Create the verifications bucket if it doesn't exist (run this in Supabase Dashboard Storage section first, or use the setup script)
-- The bucket should be created as public with RLS enabled

-- Step 2: Add storage policies for the verifications bucket
-- These policies allow users to upload files to their own folder

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read files" ON storage.objects;

-- Policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow service role to do anything (for backend operations)
-- This is critical - the backend uses service role key
CREATE POLICY "Service role can manage all files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'verifications')
WITH CHECK (bucket_id = 'verifications');

-- Policy: Allow public read access (if bucket is public)
CREATE POLICY "Public can read files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'verifications');

-- Verify policies were created
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

