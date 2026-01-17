import { config } from '../config/env';
import { NotificationService } from './notification.service';
import { supabase } from '../config/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

export const PaymentService = {
    async initializeStripePayment(userId: string, matchId: string, email: string) {
        // 1. Get Match details to know amount
        const { data: match, error } = await supabase
            .from('matches')
            .select('*, delivery_requests(estimated_cost)')
            .eq('id', matchId)
            .single();

        if (error || !match) throw new Error('Match not found');

        const amount = match.delivery_requests.estimated_cost;

        // 2. Create actual Stripe PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe uses cents/smallest unit
            currency: 'ngn', // Adjusted to NGN as per local usage
            payment_method_types: ['card'],
            receipt_email: email,
            metadata: {
                matchId,
                businessId: userId,
                travelerId: match.traveler_id
            }
        });

        const client_secret = paymentIntent.client_secret;
        const reference = paymentIntent.id;

        // Create Payment Record (Pending Payment)
        await supabase.from('payments').insert({
            match_id: matchId,
            business_id: userId,
            traveler_id: match.traveler_id,
            amount: amount,
            commission: amount * 0.05,
            traveler_earnings: amount * 0.95,
            payment_reference: reference, // Using Stripe PI ID as reference
            payment_status: 'pending'
        });

        return {
            client_secret,
            reference,
            amount
        };
    },

    async createStripeCheckoutSession(userId: string, matchId: string, email: string) {
        const { data: match, error } = await supabase
            .from('matches')
            .select('*, delivery_requests(estimated_cost)')
            .eq('id', matchId)
            .single();

        if (error || !match) throw new Error('Match not found');

        const amount = match.delivery_requests.estimated_cost;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'ngn',
                        product_data: {
                            name: 'Delivery Security Payment',
                            description: `Payment for delivery match: ${matchId}`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            customer_email: email,
            success_url: `${config.FRONTEND_URL}/business/delivery-detail?id=${match.delivery_request_id}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.FRONTEND_URL}/business/delivery-detail?id=${match.delivery_request_id}&payment=cancel`,
            metadata: {
                matchId,
                businessId: userId,
                travelerId: match.traveler_id
            }
        });

        // Create Payment Record (Pending Payment)
        await supabase.from('payments').insert({
            match_id: matchId,
            business_id: userId,
            traveler_id: match.traveler_id,
            amount: amount,
            commission: amount * 0.05,
            traveler_earnings: amount * 0.95,
            payment_reference: session.id, // Using Session ID for tracking
            payment_status: 'pending'
        });

        return {
            url: session.url,
            id: session.id
        };
    },

    async confirmStripePayment(reference: string, forceSuccess: boolean = false) {
        // Find payment
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('payment_reference', reference)
            .single();

        if (error || !payment) throw new Error('Payment record not found');
        if (payment.payment_status === 'paid') return { status: 'already_paid' };

        // Real check: Verify with Stripe
        let isSucceeded = false;

        if (reference.startsWith('cs_')) {
            // Checkout Session
            const session = await stripe.checkout.sessions.retrieve(reference);
            isSucceeded = session.payment_status === 'paid';
        } else if (reference.startsWith('pi_')) {
            // Payment Intent
            const paymentIntent = await stripe.paymentIntents.retrieve(reference);
            isSucceeded = paymentIntent.status === 'succeeded';
        } else {
            // If we don't know the type, try as payment intent
            const paymentIntent = await stripe.paymentIntents.retrieve(reference);
            isSucceeded = paymentIntent.status === 'succeeded';
        }

        if (!isSucceeded && !forceSuccess) {
            throw new Error(`Payment verification failed for ${reference}`);
        }

        // 1. Mark payment as paid
        await supabase
            .from('payments')
            .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
            .eq('payment_reference', reference);

        // 2. Reflect on traveler balance but as PENDING (indicator)
        const { traveler_id, traveler_earnings } = payment;

        // Get or create wallet
        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', traveler_id).single();
        if (wallet) {
            await supabase
                .from('wallets')
                .update({
                    pending_balance: (wallet.pending_balance || 0) + traveler_earnings
                })
                .eq('id', wallet.id);
        } else {
            await supabase.from('wallets').insert({
                user_id: traveler_id,
                balance: 0,
                pending_balance: traveler_earnings,
                total_earned: 0
            });
        }

        // Send notifications
        try {
            const { data: payInfo } = await supabase
                .from('payments')
                .select('*, matches(traveler_id, business_id, delivery_request_id)')
                .eq('payment_reference', reference)
                .single();

            if (payInfo && payInfo.matches) {
                const match = payInfo.matches;
                // Notify Business
                await NotificationService.createNotification(
                    match.business_id,
                    'payment_success',
                    'Payment Confirmed',
                    'Your payment was successful. You can now coordinate with the traveler for pickup.',
                    { matchId: payInfo.match_id, requestId: match.delivery_request_id }
                );
                // Notify Traveler
                await NotificationService.createNotification(
                    match.traveler_id,
                    'payment_received',
                    'Delivery Paid',
                    'The business has paid for the delivery. You can now proceed to pickup.',
                    { matchId: payInfo.match_id }
                );
            }
        } catch (e) {
            console.error('Error sending payment notifications:', e);
        }

        return { status: 'success' };
    },

    async releaseEscrow(matchId: string) {
        // 1. Find the payment for this match
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('match_id', matchId)
            .eq('payment_status', 'paid')
            .single();

        if (error || !payment) {
            console.log('No paid payment found to release for match:', matchId);
            return;
        }

        const { traveler_id, traveler_earnings } = payment;

        // 2. Move from pending_balance to available balance
        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', traveler_id).single();
        if (wallet) {
            const newPending = Math.max(0, (wallet.pending_balance || 0) - traveler_earnings);
            const newBalance = (wallet.balance || 0) + traveler_earnings;
            const newTotal = (wallet.total_earned || 0) + traveler_earnings;

            await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    pending_balance: newPending,
                    total_earned: newTotal
                })
                .eq('id', wallet.id);
        }
    },

    async handleStripeWebhook(signature: string, payload: Buffer) {
        if (!config.STRIPE_WEBHOOK_SECRET) {
            console.warn('[Stripe Webhook] Warning: STRIPE_WEBHOOK_SECRET is not configured. Signature verification will fail.');
        }

        let event;
        try {
            event = stripe.webhooks.constructEvent(payload, signature, config.STRIPE_WEBHOOK_SECRET);
        } catch (err: any) {
            console.error(`[Stripe Webhook] Error: ${err.message}`);
            throw new Error(`Webhook Error: ${err.message}`);
        }

        console.log(`[Stripe Webhook] Received event type: ${event.type}`);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as any;
            const reference = session.id;

            console.log('[Stripe Webhook] Received Checkout session completion:', reference);

            // Confirm the payment in our system
            try {
                await this.confirmStripePayment(reference);
            } catch (confirmErr: any) {
                console.error('[Stripe Webhook] Error confirming payment:', confirmErr.message);
            }
        } else if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object as any;
            const reference = paymentIntent.id;

            console.log('[Stripe Webhook] Received Payment Intent success:', reference);

            try {
                await this.confirmStripePayment(reference);
            } catch (confirmErr: any) {
                console.error('[Stripe Webhook] Error confirming payment intent:', confirmErr.message);
            }
        }
    }
};
