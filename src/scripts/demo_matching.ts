
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SmartMatchingService } from '../services/smart-matching.service';

// Load env vars
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDemo() {
    console.log('\n🔵 --- STARTING SMART MATCHING DEMO ---\n');

    // 1. Setup: Get a user ID to be the traveler
    const { data: users } = await supabase.from('users').select('id').limit(1);
    const travelerId = users?.[0]?.id;

    if (!travelerId) {
        console.error('❌ No users found in DB to act as traveler. Please sign up a user first.');
        return;
    }

    // 2. Traveler Action: Post a Trip
    // Route: Abuja -> Jos (This passes through Keffi, Akwanga, etc.)
    console.log('🚗 Step 1: Traveler posts a trip: "Abuja" -> "Jos"');
    const { data: trip, error } = await supabase.from('trips').insert({
        traveler_id: travelerId,
        origin: 'Abuja',
        destination: 'Jos',
        departure_date: new Date().toISOString().split('T')[0], // Today
        departure_time: '10:00',
        available_space: 'large',
        status: 'active',
        description: 'Demo trip for smart matching'
    }).select().single();

    if (error) {
        console.error('❌ Failed to create demo trip:', error.message);
        return;
    }
    console.log(`   ✅ Trip Created! ID: ${trip.id}`);


    // 3. Business Action: Search for a traveler in "Keffi"
    // Keffi is NOT "Abuja" or "Jos", but it is ON THE ROUTE.
    // A simple text match would fail. Our smart algorithm should pass.
    console.log('\n🏢 Step 2: Customer/Business searches for a traveler in: "Keffi"');
    console.log('   (Note: Keffi is a town on the road between Abuja and Jos)');

    try {
        const results = await SmartMatchingService.smartSearchTrips({
            origin: 'Keffi',
            // We only care if the pickup (Keffi) is on the traveler's route.
            // Destination can be anything (or "Jos").
        });

        // 4. Analyze Results
        const matchedTrip = results.find(r => r.trip.id === trip.id);

        if (matchedTrip) {
            console.log('\n🟢 SUCCESS: Match Found!');
            console.log(`   Relevance Score: ${matchedTrip.relevanceScore}%`);
            console.log('   Match Reasons:', matchedTrip.matchReasons);

            const hasRouteMatch = matchedTrip.matchReasons.some(r => r.includes('Pickup point on route'));
            if (hasRouteMatch) {
                console.log('   ✨ Smart Geospatial Algorithm worked! It detected Keffi is on the route.');
            } else {
                console.log('   ⚠️ Match found but maybe due to other factors (Date/Time).');
            }
        } else {
            console.log('\n🔴 FAILED: The trip was not found. Algorithm needs tuning.');
        }

    } catch (err) {
        console.error('Error during search:', err);
    }

    // 5. Cleanup
    console.log('\n🧹 Cleanup: Deleting demo trip...');
    await supabase.from('trips').delete().eq('id', trip.id);
    console.log('   ✅ Done.');
    console.log('\n🔵 --- DEMO FINISHED ---');
}

runDemo();
