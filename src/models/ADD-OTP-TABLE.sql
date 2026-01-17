-- ============================================
-- ADD MATCH OTPS TABLE FOR DYNAMIC VERIFICATION
-- ============================================

CREATE TABLE IF NOT EXISTS match_otps (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    otp_code text NOT NULL,
    otp_type text CHECK (otp_type IN ('pickup', 'delivery')) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_match_otps_match_id ON match_otps(match_id);

-- Disable RLS if the user wants no restrictions
ALTER TABLE match_otps DISABLE ROW LEVEL SECURITY;
GRANT ALL ON match_otps TO anon, authenticated, service_role;

SELECT '✅ match_otps table created and unrestricted' as status;
