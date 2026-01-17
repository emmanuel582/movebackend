import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getUserStats = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;

        // 1. Get Wallet (Earnings)
        const { data: wallet } = await supabase.from('wallets').select('balance, pending_balance, total_earned').eq('user_id', userId).single();

        // 2. Counts
        // Trips
        const { count: completedTrips } = await supabase.from('trips')
            .select('*', { count: 'exact', head: true })
            .eq('traveler_id', userId)
            .eq('status', 'completed');

        // Active Deliveries (For Business Mode)
        const { count: activeDeliveries } = await supabase.from('delivery_requests')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', userId)
            .neq('status', 'delivered')
            .neq('status', 'cancelled');

        // Total Spent (For Business Mode) - sum payments where business_id is user
        const { data: payments } = await supabase.from('payments')
            .select('amount')
            .eq('business_id', userId);

        const totalSpent = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        // Ratings
        const { data: ratings } = await supabase.from('ratings').select('rating').eq('rated_id', userId);
        const ratingCount = ratings?.length || 0;
        const avgRating = ratingCount > 0
            ? ratings!.reduce((sum, r) => sum + r.rating, 0) / ratingCount
            : 0;

        res.status(200).json({
            status: 'success',
            data: {
                wallet: wallet || { balance: 0, pending_balance: 0, total_earned: 0 },
                counts: {
                    completedTrips: completedTrips || 0,
                    activeDeliveries: activeDeliveries || 0,
                    totalSpent
                },
                rating: {
                    average: avgRating.toFixed(1),
                    count: ratingCount
                }
            }
        });
    } catch (error: any) {
        console.error('User Stats Error:', error);
        res.status(400).json({ status: 'error', message: 'Failed to fetch user stats' });
    }
};

export const updateBankDetails = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { bank_name, account_number, account_name } = req.body;

        if (!bank_name || !account_number || !account_name) {
            return res.status(400).json({ status: 'error', message: 'Bank name, account name, and account number required' });
        }

        // 1. Try updating Public Table (Preferred)
        // We catch the error here to fallback to metadata if columns are missing
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    bank_name,
                    account_number,
                })
                .eq('id', userId);

            if (error) throw error;
        } catch (dbError: any) {
            console.warn('[Update Bank] Public table update failed (likely missing columns or schema mismatch):', dbError.message);
        }

        // 2. Always Update Auth Metadata as a backup/source of truth for these dynamic fields
        const { error: metaError } = await supabase.auth.admin.updateUserById(
            userId,
            { user_metadata: { bank_name, account_number, account_name } }
        );

        if (metaError) throw metaError;

        res.status(200).json({ status: 'success', message: 'Bank details updated' });
    } catch (error: any) {
        console.error('Update Bank Error:', error);
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const updatePushToken = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { push_token } = req.body;

        if (!push_token) {
            return res.status(400).json({ status: 'error', message: 'Push token required' });
        }

        // Save to Auth Metadata (Safe storage for tokens)
        const { error } = await supabase.auth.admin.updateUserById(
            userId,
            { user_metadata: { push_token } }
        );

        if (error) throw error;

        // Try silently updating public table just in case column exists
        try {
            await supabase.from('users').update({ push_token }).eq('id', userId);
        } catch (e) {
            // Ignore
        }

        res.status(200).json({ status: 'success', message: 'Push token updated' });
    } catch (error: any) {
        console.error('Update Push Token Error:', error);
        res.status(400).json({ status: 'error', message: error.message });
    }
};
