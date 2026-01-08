import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getUserStats = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;

        // 1. Get Wallet (Earnings)
        const { data: wallet } = await supabase.from('wallets').select('balance, total_earned').eq('user_id', userId).single();

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
                wallet: wallet || { balance: 0, total_earned: 0 },
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
