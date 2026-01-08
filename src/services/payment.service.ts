import axios from 'axios';
import { config } from '../config/env';
import { supabase } from '../config/supabase';

export const PaymentService = {
    async initializePayment(userId: string, matchId: string, email: string) {
        // 1. Get Match details to know amount
        const { data: match, error } = await supabase
            .from('matches')
            .select('*, delivery_requests(estimated_cost)')
            .eq('id', matchId)
            .single();

        if (error || !match) throw new Error('Match not found');

        const amount = match.delivery_requests.estimated_cost;
        // Paystack takes amount in kobo
        const amountInKobo = Math.round(amount * 100);

        // 2. Call Paystack (or Mock)
        if (config.PAYSTACK_SECRET_KEY === 'mock_paystack_secret') {
            console.log('Using Mock Payment for Match:', matchId);

            // Create Payment Record (Pending)
            const reference = `MOCK_${Date.now()}`;
            await supabase.from('payments').insert({
                match_id: matchId,
                business_id: userId,
                traveler_id: match.traveler_id,
                amount: amount,
                commission: amount * 0.05,
                traveler_earnings: amount * 0.95,
                payment_reference: reference,
                payment_status: 'pending' // User still needs to 'verify' effectively
            });

            return {
                authorization_url: 'https://standard.paystack.co/close', // Dummy URL or local success page
                access_code: 'mock_code',
                reference: reference
            };
        }

        try {
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    email,
                    amount: amountInKobo,
                    metadata: {
                        match_id: matchId,
                        business_id: userId,
                        traveler_id: match.traveler_id,
                        custom_fields: [
                            { display_name: "Match ID", variable_name: "match_id", value: matchId }
                        ]
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // 3. Create Payment Record (Pending)
            await supabase.from('payments').insert({
                match_id: matchId,
                business_id: userId,
                traveler_id: match.traveler_id,
                amount: amount,
                commission: amount * 0.05,
                traveler_earnings: amount * 0.95,
                payment_reference: response.data.data.reference,
                payment_status: 'pending'
            });

            return response.data.data; // authorization_url, access_code, reference
        } catch (error: any) {
            console.error('Paystack Error:', error.response?.data || error.message);
            throw new Error('Payment initialization failed');
        }
    },

    async verifyPayment(reference: string) {
        if (config.PAYSTACK_SECRET_KEY === 'mock_paystack_secret' && reference.startsWith('MOCK_')) {
            // Mock Success
            await supabase
                .from('payments')
                .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
                .eq('payment_reference', reference);
            return { status: 'success', data: { status: 'success', reference, amount: 0, gateway_response: 'Successful' } };
        }

        try {
            const response = await axios.get(
                `https://api.paystack.co/transaction/verify/${reference}`,
                {
                    headers: { Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}` }
                }
            );

            const data = response.data.data;
            if (data.status === 'success') {
                // Update Payment Record
                await supabase
                    .from('payments')
                    .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
                    .eq('payment_reference', reference);

                return { status: 'success', data };
            }
            return { status: 'failed', data };
        } catch (error: any) {
            throw new Error('Payment verification failed');
        }
    }
};
