import { supabase } from '../config/supabase';

async function checkCounts() {
    const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: tripCount, error: tripError } = await supabase.from('trips').select('*', { count: 'exact', head: true });
    const { count: deliveryCount, error: deliveryError } = await supabase.from('delivery_requests').select('*', { count: 'exact', head: true });

    console.log('--- DB COUNTS ---');
    console.log('Users:', userCount, userError || '');
    console.log('Trips:', tripCount, tripError || '');
    console.log('Deliveries:', deliveryCount, deliveryError || '');
}

checkCounts();
