import { supabase } from '../config/supabase';

export const TripService = {
    async createTrip(userId: string, data: any) {
        const { origin, destination, departure_date, departure_time, available_space, description } = data;

        const { data: trip, error } = await supabase
            .from('trips')
            .insert({
                traveler_id: userId,
                origin,
                destination,
                departure_date,
                departure_time,
                available_space,
                description,
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;

        // Send Confirmation Email
        const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
        if (user?.email) {
            const { sendEmail } = require('../utils/email');
            await sendEmail(
                user.email,
                'Trip Posted Successfully',
                `Your trip from ${origin} to ${destination} on ${departure_date} has been posted.`
            );
        }

        return trip;
    },

    async getUserTrips(userId: string) {
        const { data: trips, error } = await supabase
            .from('trips')
            .select(`
        *,
        matches (count)
      `)
            .eq('traveler_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map to Frontend Structure
        return trips.map(trip => ({
            id: trip.id,
            origin: trip.origin,
            destination: trip.destination,
            date: trip.departure_date, // Format if needed, ideally frontend handles ISO
            request_count: trip.matches?.[0]?.count || 0, // Approximate pending matches count if matches returns array of aggregation
            status: trip.status
        }));
    },

    async getTripById(tripId: string) {
        // Also fetch traveler info if needed by others
        const { data: trip, error } = await supabase
            .from('trips')
            .select(`
        *,
        users (full_name, id, is_verified)
      `)
            .eq('id', tripId)
            .single();

        if (error) throw error;
        return trip;
    },

    async deleteTrip(userId: string, tripId: string) {
        const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', tripId)
            .eq('traveler_id', userId); // Ensure ownership

        if (error) throw error;
        return { message: 'Trip deleted successfully' };
    },

    async searchTrips(filters: any) {
        // Use smart matching service for intelligent search
        const { SmartMatchingService } = require('./smart-matching.service');

        const results = await SmartMatchingService.smartSearchTrips({
            origin: filters.origin,
            destination: filters.destination,
            date: filters.date,
            space: filters.space,
            verifiedOnly: filters.verifiedOnly === 'true' || filters.verifiedOnly === true
        });

        // Return trips with relevance scores
        return results.map((result: any) => ({
            ...result.trip,
            relevanceScore: result.relevanceScore,
            matchReasons: result.matchReasons
        }));
    }
};
