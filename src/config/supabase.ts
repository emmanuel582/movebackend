import { createClient } from '@supabase/supabase-js';
import { config } from './env';

const supabaseUrl = config.SUPABASE_URL;
const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'PLACEHOLDER' || supabaseKey === 'PLACEHOLDER') {
    throw new Error('Supabase URL or Key is missing. Check your .env file.');
}


// Decode the key to check if it's really service_role
try {
    const keyParts = supabaseKey.split('.');
    if (keyParts.length === 3) {
        const payload = JSON.parse(Buffer.from(keyParts[1], 'base64').toString());
        console.log(`[Supabase Config] Key Role: ${payload.role}`);
        if (payload.role !== 'service_role') {
            console.warn('⚠️ WARNING: You are using a NON-SERVICE-ROLE key (e.g. anon) for the backend!');
            console.warn('⚠️ This will cause RLS errors. Please update SUPABASE_SERVICE_ROLE_KEY in .env');
        } else {
            console.log('✅ Service Role Key confirmed.');
        }
    }
} catch (e) {
    console.error('[Supabase Config] Failed to parse key:', e);
}

// Service role client - bypasses RLS completely
// This client has full access and ignores all RLS policies
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    db: {
        schema: 'public',
    },
    global: {
        headers: {
            'x-my-custom-header': 'backend-service',
        },
    },
});

console.log('[Supabase] Initialized with service role key (RLS bypass enabled)');
