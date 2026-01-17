-- Add pending_balance column to wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS pending_balance decimal(10, 2) DEFAULT 0.00;

-- Ensure RLS is disabled for wallets as well if needed (following the pattern of other fix files)
ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;
GRANT ALL ON wallets TO anon, authenticated, service_role;
