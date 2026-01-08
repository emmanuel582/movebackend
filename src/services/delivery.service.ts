import { supabase } from '../config/supabase';

export const DeliveryService = {
    async createRequest(userId: string, data: any) {
        const { origin, destination, package_size, delivery_date, item_description, estimated_cost } = data;

        const { data: request, error } = await supabase
            .from('delivery_requests')
            .insert({
                business_id: userId,
                origin,
                destination,
                package_size,
                delivery_date,
                item_description,
                estimated_cost,
                status: 'pending'
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
                'Order Received',
                `Your delivery request from ${origin} to ${destination} has been received and is now pending matching.`
            );
        }

        return request;
    },

    async getUserRequests(userId: string) {
        const { data: requests, error } = await supabase
            .from('delivery_requests')
            .select(`
        *,
        matches (
            traveler_id,
            users:traveler_id (full_name)
        )
      `)
            .eq('business_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map to Frontend Structure
        return requests.map(req => {
            // Find confirmed/active match traveler
            const activeMatch = req.matches?.find((m: any) => m.users);
            const travelerName = activeMatch ? activeMatch.users.full_name : 'Pending';

            return {
                id: req.id,
                origin: req.origin,
                destination: req.destination,
                traveler_name: travelerName,
                delivery_date: req.delivery_date,
                status: req.status
            };
        });
    },

    async getRequestById(requestId: string) {
        const { data: request, error } = await supabase
            .from('delivery_requests')
            .select(`
        *,
        users (full_name, is_verified)
      `)
            .eq('id', requestId)
            .single();

        if (error) throw error;
        return request;
    },

    async searchRequests(filters: any) {
        // For travelers to find deliveries
        let query = supabase
            .from('delivery_requests')
            .select(`
        *,
        users (full_name, is_verified)
      `)
            .eq('status', 'pending');

        if (filters.origin) {
            query = query.ilike('origin', `%${filters.origin}%`);
        }
        if (filters.destination) {
            query = query.ilike('destination', `%${filters.destination}%`);
        }
        if (filters.date) {
            query = query.eq('delivery_date', filters.date);
        }
        if (filters.space) {
            // Simple logic: if traveler has 'medium' space, they can take 'small' or 'medium' packages?
            // For now exact match or logic handled in SQL if needed. Let's do exact match for MVP or handle in frontend.
            query = query.eq('package_size', filters.space);
        }

        const { data: requests, error } = await query;
        if (error) throw error;
        return requests;
    }
};
