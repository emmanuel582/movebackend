import { supabase } from '../config/supabase';
import { generateOTP } from '../utils/otp';
import { sendEmail } from '../utils/email';

export const MatchingService = {
    async findPotentialMatchesForTrip(tripId: string) {
        // Use smart matching service
        const { SmartMatchingService } = require('./smart-matching.service');
        return await SmartMatchingService.findMatchesForTrip(tripId);
    },

    async getMatchRequestsForTrip(tripId: string) {
        const { data, error } = await supabase
            .from('matches')
            .select(`
                *,
                delivery_requests (
                    *,
                    users (full_name, id, is_verified, phone)
                ),
                payments (*)
            `)
            .eq('trip_id', tripId);

        if (error) throw error;
        return data;
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

        // Notify traveler
        const { NotificationService } = require('./notification.service');
        await NotificationService.createNotification(
            trip.traveler_id,
            'match_requested',
            'New Match Request!',
            'A business wants you to deliver a package on your trip.',
            {
                matchId: match.id,
                tripId,
                requestId,
                type: 'match_requested',
                status: 'pending'
            }
        );

        // Send Email to Traveler
        const { data: traveler } = await supabase.from('users').select('email').eq('id', trip.traveler_id).single();
        if (traveler?.email) {
            await sendEmail(
                traveler.email,
                'New Delivery Request!',
                'A business has requested you to deliver a package on your upcoming trip. Log in to MOVEVER to accept or decline.'
            );
        }

        return match;
    },

    async acceptMatch(matchId: string, userId: string) {
        const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        // Verify user is the one receiving the request. 
        // If requester was traveler, business accepts. 
        // For now, we assume whoever calls this is authorized if they are in the match.
        if (match.status !== 'pending') throw new Error('Match is not pending');

        // Update Match
        const { data: updated, error } = await supabase
            .from('matches')
            .update({
                status: 'accepted'
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
            await sendEmail(business.email, 'Delivery Match Accepted', `Match confirmed! \n\nYou can now request a pickup OTP in the app when the traveler arrives.`);
        }

        // Notify Business
        try {
            const { NotificationService } = require('./notification.service');
            const { data: travelerData } = await supabase.from('users').select('full_name').eq('id', userId).single();

            await NotificationService.createNotification(
                match.business_id,
                'match_accepted',
                'Match Accepted!',
                `${travelerData?.full_name || 'The traveler'} has accepted your delivery request. Please proceed to payment to secure the delivery.`,
                {
                    matchId,
                    tripId: match.trip_id,
                    requestId: match.delivery_request_id,
                    type: 'match_accepted',
                    status: 'accepted'
                }
            );
        } catch (e) {
            console.error('Notification failed:', e);
        }

        return updated;
    },

    async confirmPickup(matchId: string, otp: string) {
        const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        // Verify dynamic OTP
        const { data: otpRecord, error: otpError } = await supabase
            .from('match_otps')
            .select('*')
            .eq('match_id', matchId)
            .eq('otp_code', otp)
            .eq('otp_type', 'pickup')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) throw new Error('Invalid or expired Pickup OTP');

        // Final check for payment before allowing pickup confirmation in backend
        const { data: payments } = await supabase.from('payments').select('payment_status').eq('match_id', matchId).eq('payment_status', 'paid');
        if (!payments || payments.length === 0) {
            throw new Error('Payment must be completed before pickup can be confirmed.');
        }

        const { data: updated, error } = await supabase
            .from('matches')
            .update({
                status: 'pickup_confirmed',
                pickup_confirmed_at: new Date().toISOString()
            })
            .eq('id', matchId)
            .select()
            .single();

        if (error) throw error;

        // Update request status
        await supabase.from('delivery_requests').update({ status: 'in_transit' }).eq('id', match.delivery_request_id);

        // Notify Business
        try {
            const { NotificationService } = require('./notification.service');
            await NotificationService.createNotification(
                match.business_id,
                'package_in_transit',
                'Package Picked Up!',
                'The traveler has confirmed pickup. Your package is now in transit.',
                { matchId, requestId: match.delivery_request_id }
            );
        } catch (e) {
            console.error('Notification failed:', e);
        }

        return updated;
    },

    async confirmDelivery(matchId: string, otp: string) {
        const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        // Verify dynamic OTP
        const { data: otpRecord, error: otpError } = await supabase
            .from('match_otps')
            .select('*')
            .eq('match_id', matchId)
            .eq('otp_code', otp)
            .eq('otp_type', 'delivery')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) throw new Error('Invalid or expired Delivery OTP');

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

        // Notify Business
        try {
            const { NotificationService } = require('./notification.service');
            await NotificationService.createNotification(
                match.business_id,
                'package_delivered',
                'Package Delivered!',
                'Your package has been successfully delivered and confirmed.',
                { matchId, requestId: match.delivery_request_id }
            );
        } catch (e) {
            console.error('Notification failed:', e);
        }

        // Trigger Payment Release
        try {
            const { PaymentService } = require('./payment.service');
            await PaymentService.releaseEscrow(matchId);
        } catch (e) {
            console.error('Escrow release failed:', e);
        }

        return updated;
    },

    async getMyDeliveries(userId: string) {
        const { data, error } = await supabase
            .from('matches')
            .select(`
                *,
                delivery_requests (
                    *,
                    users (full_name, id, is_verified, phone)
                ),
                trips (
                    origin,
                    destination,
                    departure_date,
                    departure_time
                )
            `)
            .eq('traveler_id', userId)
            .neq('status', 'pending')
            .neq('status', 'declined');

        if (error) throw error;
        return data;
    },

    async requestOTP(matchId: string, type: 'pickup' | 'delivery', userId: string) {
        const { data: match } = await supabase.from('matches').select('*, delivery_requests(*)').eq('id', matchId).single();
        if (!match) throw new Error('Match not found');

        // Verify user is part of the match
        if (match.traveler_id !== userId && match.business_id !== userId) {
            throw new Error('Not authorized to request OTP for this match');
        }

        // Check for 5-minute cooldown
        const { data: lastOtp } = await supabase
            .from('match_otps')
            .select('created_at')
            .eq('match_id', matchId)
            .eq('otp_type', type)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastOtp) {
            const lastTime = new Date(lastOtp.created_at).getTime();
            const now = Date.now();
            const diff = now - lastTime;
            const cooldown = 5 * 60 * 1000; // 5 minutes
            if (diff < cooldown) {
                const remaining = Math.ceil((cooldown - diff) / 60000);
                throw new Error(`Please wait ${remaining} minute(s) before requesting another code.`);
            }
        }

        // Ensure payment is made before allowing OTP request for pickup
        const { data: payments } = await supabase.from('payments').select('payment_status').eq('match_id', matchId).eq('payment_status', 'paid');
        const isPaid = (payments && payments.length > 0);

        if (type === 'pickup' && !isPaid) {
            throw new Error('Payment required before requesting pickup code. Please ask the business to complete payment.');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        const { error: insertError } = await supabase
            .from('match_otps')
            .insert({
                match_id: matchId,
                otp_code: otp,
                otp_type: type,
                expires_at: expiresAt
            });

        if (insertError) throw insertError;

        // Cache OTP in matches table for frontend display
        await supabase
            .from('matches')
            .update({
                [type === 'pickup' ? 'pickup_otp' : 'delivery_otp']: otp
            })
            .eq('id', matchId);

        // Determine recipient: Send to the OTHER person or both?
        // User says: "sent as notification to their app and gmail"
        // Let's send to both for maximum delivery success, or specifically to the person who needs to share it.
        // Usually: Business has the package, so OTP for pickup should go to Business? 
        // User says: "when they meet we should first request for otp... then the traveler put it".
        // This means OTP goes to Business (or is requested by traveler), Business gives it to Traveler.

        const { data: business } = await supabase.from('users').select('email, id, phone').eq('id', match.business_id).single();
        const { data: traveler } = await supabase.from('users').select('email, id, full_name').eq('id', match.traveler_id).single();

        const { NotificationService } = require('./notification.service');

        if (business && business.phone) {
            console.log(`[SMS] Sending OTP ${otp} to business phone: ${business.phone}`);
            // In a real app, you'd use a service like Twilio here:
            // await smsService.send(business.phone, `Your MOVEVER verification code is: ${otp}`);
        }

        if (type === 'pickup') {
            // Send to Business (who gives it to Traveler)
            if (business) {
                if (business.email) {
                    await sendEmail(
                        business.email,
                        'Pickup Verification Code',
                        `A traveler (${traveler?.full_name || 'User'}) has requested the pickup verification code.\n\nYour code is: ${otp}\n\nValid for 10 minutes. Share this with the traveler once they arrive.`
                    );
                }
                await NotificationService.createNotification(
                    business.id,
                    'otp_received',
                    'Pickup Code Requested',
                    `${traveler?.full_name || 'Traveler'} is ready for pickup. Give them this code: ${otp}`,
                    { matchId, type, otp, requestId: match.delivery_request_id }
                );
            }
        } else {
            // Send to Business (who gives it to Traveler upon delivery)
            if (business) {
                if (business.email) {
                    await sendEmail(
                        business.email,
                        'Delivery Verification Code',
                        `A traveler (${traveler?.full_name || 'User'}) has requested the delivery completion code.\n\nYour code is: ${otp}\n\nValid for 10 minutes. Share this with the traveler upon receiving the package.`
                    );
                }
                await NotificationService.createNotification(
                    business.id,
                    'otp_received',
                    'Delivery Code Requested',
                    `${traveler?.full_name || 'Traveler'} is at the destination. Give them this code to complete delivery: ${otp}`,
                    { matchId, type, otp, requestId: match.delivery_request_id }
                );
            }
        }

        return { message: 'OTP sent successfully', expiresAt };
    },

    async getMatch(matchId: string) {
        const { data, error } = await supabase
            .from('matches')
            .select(`
                *,
                delivery_requests (*),
                payments (*),
                business:users!business_id (id, full_name, email, phone, is_verified),
                traveler:users!traveler_id (id, full_name, email, phone, is_verified)
            `)
            .eq('id', matchId)
            .single();

        if (error) throw error;
        return data;
    }
};
