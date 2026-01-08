import { supabase } from '../config/supabase';
import { generateOTP } from '../utils/otp';
import { sendEmail } from '../utils/email';

export const MatchingService = {
    async findPotentialMatchesForTrip(tripId: string) {
        // Use smart matching service
        const { SmartMatchingService } = require('./smart-matching.service');
        return await SmartMatchingService.findMatchesForTrip(tripId);
    },

    async requestMatch(tripId: string, requestId: string, requesterId: string) {
        // Check if match exists
        const { data: existing } = await supabase
            .from('matches')
            .select('*')
            .eq('trip_id', tripId)
            .eq('delivery_request_id', requestId)
            .single();

        if (existing) throw new Error('Match request already exists');

        // Get IDs
        const { data: trip } = await supabase.from('trips').select('traveler_id').eq('id', tripId).single();
        const { data: request } = await supabase.from('delivery_requests').select('business_id').eq('id', requestId).single();

        if (!trip || !request) throw new Error('Trip or Request not found');

        const { data: match, error } = await supabase
            .from('matches')
            .insert({
                trip_id: tripId,
                delivery_request_id: requestId,
                traveler_id: trip.traveler_id,
                business_id: request.business_id,
                status: 'pending' // Pending acceptance
            })
            .select()
            .single();

        if (error) throw error;

        // Notify other party
        // ... notification logic (Email/Push)
        return match;
    },

    async acceptMatch(matchId: string, userId: string) {
        const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        // Verify user is the one receiving the request. 
        // If requester was traveler, business accepts. 
        // For now, we assume whoever calls this is authorized if they are in the match.
        if (match.status !== 'pending') throw new Error('Match is not pending');

        // Generate OTPs
        const pickupOtp = generateOTP(6); // Email OTP
        const deliveryOtp = generateOTP(6);

        // Update Match
        const { data: updated, error } = await supabase
            .from('matches')
            .update({
                status: 'accepted',
                pickup_otp: pickupOtp,
                delivery_otp: deliveryOtp
            })
            .eq('id', matchId)
            .select()
            .single();

        if (error) throw error;

        // Update Trip and Request status
        await supabase.from('delivery_requests').update({ status: 'matched' }).eq('id', match.delivery_request_id);

        // Send OTPs via Email
        // Pickup OTP goes to Traveler? No, Business gives package to Traveler. 
        // So Business needs to verify Traveler. 
        // Strategy: Traveler arrives. Traveler shows QR/Code? Or Business gives Code to Traveler?
        // Standard: 
        // Pickup: Business gives package. Business needs to confirm Traveler taken it. 
        // Traveler provides OTP to Business? Or Business provides OTP to Traveler?
        // Let's use: 
        // Pickup OTP: Sent to Business. Traveler asks Business for code to enter in app. (Or vice versa).
        // "Generate 6-digit OTP for pickup confirmation" -> "Validate OTP on entry".
        // Usually: Receiver (User App) enters code provided by Provider (Opposite).
        // Pickup: Traveler picks up. Business verifies Traveler. 
        // App Flow: Traveler taps "Confirm Pickup". App asks for OTP. Business has OTP.
        // So Pickup OTP sent to Business.
        // Delivery: Traveler delivers. Recipient (Business contact) verifies.
        // Delivery OTP sent to Business (or recipient email).

        // Fetch Emails
        const { data: business } = await supabase.from('users').select('email').eq('id', match.business_id).single();
        const { data: traveler } = await supabase.from('users').select('email').eq('id', match.traveler_id).single();

        if (business?.email) {
            await sendEmail(business.email, 'Delivery Match Accepted', `Match confirmed! \n\nPICKUP OTP: ${pickupOtp} (Share this with traveler when they pick up)\nDELIVERY OTP: ${deliveryOtp} (Share this with recipient/traveler upon delivery)`);
        }

        return updated;
    },

    async confirmPickup(matchId: string, otp: string) {
        const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        if (match.pickup_otp !== otp) throw new Error('Invalid Pickup OTP');

        const { data: updated, error } = await supabase
            .from('matches')
            .update({
                status: 'in_transit', // Custom status mapping if schema allows
                // Schema has: pickup_confirmed check status in ('pending', 'accepted', 'pickup_confirmed', ...)
                pickup_confirmed_at: new Date().toISOString()
            })
            .eq('id', matchId)
            .select()
            .single();

        if (error) throw error;

        // Update request status
        await supabase.from('delivery_requests').update({ status: 'in_transit' }).eq('id', match.delivery_request_id);

        return updated;
    },

    async confirmDelivery(matchId: string, otp: string) {
        const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        if (match.delivery_otp !== otp) throw new Error('Invalid Delivery OTP');

        const { data: updated, error } = await supabase
            .from('matches')
            .update({
                status: 'completed',
                delivery_confirmed_at: new Date().toISOString()
            })
            .eq('id', matchId)
            .select()
            .single();

        if (error) throw error;

        // Update request and trip
        await supabase.from('delivery_requests').update({ status: 'delivered' }).eq('id', match.delivery_request_id);
        await supabase.from('trips').update({ status: 'completed' }).eq('id', match.trip_id); // Assuming 1 trip = 1 delivery for MVP or partial logic

        // Trigger Payment Release (Task 9)
        // await PaymentService.releasePayment(matchId);

        return updated;
    }
};
