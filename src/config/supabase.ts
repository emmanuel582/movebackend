import { createClient } from '@supabase/supabase-js';
import { config } from './env';

const supabaseUrl = config.SUPABASE_URL;
const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'PLACEHOLDER' || supabaseKey === 'PLACEHOLDER') {
    throw new Error('Supabase URL or Key is missing. Check your .env file.');
}

// Service role client - bypasses RLS
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
