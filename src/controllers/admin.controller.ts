import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to check admin role (Mock for MVP, or check userMetadata)
const checkAdmin = async (userId: string) => {
    // In production, check a separate 'admin_users' table or metadata
    return true;
};

export const getUsers = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });

    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) return res.status(400).json(error);
    res.status(200).json({ status: 'success', data });
};

export const getVerifications = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });

    // Returning shape matching 'AdminVerificationsScreen' requirements
    const { data, error } = await supabase
        .from('verifications')
        .select(`
        *,
        users:user_id (full_name)
    `)
        .order('submitted_at', { ascending: false });

    if (error) return res.status(400).json(error);

    // Transform to frontend shape if needed, but returning full object is fine
    res.status(200).json({ status: 'success', data });
};

export const getTrips = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const { data, error } = await supabase.from('trips').select('*, users(full_name)');
    if (error) return res.status(400).json(error);
    res.status(200).json({ status: 'success', data });
};

export const getDeliveries = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const { data, error } = await supabase.from('delivery_requests').select('*, users(full_name)');
    if (error) return res.status(400).json(error);
    res.status(200).json({ status: 'success', data });
};

export const getPayments = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const { data, error } = await supabase.from('payments').select('*').order('paid_at', { ascending: false });
    if (error) return res.status(400).json(error);
    res.status(200).json({ status: 'success', data });
};

export const getDashboardStats = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });

    try {
        // Parallel queries
        const [users, trips, deliveries, payments, verifications] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('trips').select('*', { count: 'exact', head: true }), // Total trips
            supabase.from('delivery_requests').select('*', { count: 'exact', head: true }), // Total deliveries
            supabase.from('payments').select('amount'),
            supabase.from('verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending')
        ]);

        const revenue = (payments.data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const stats = {
            totalUsers: users.count || 0,
            activeTrips: trips.count || 0,
            deliveries: deliveries.count || 0,
            revenue: revenue,
            pendingVerifications: verifications.count || 0
        };

        // Construct Recent Activity (Simple 5 latest items from each, then sort)
        // For MVP, just getting latest 5 users
        const recentUsers = await supabase.from('users').select('full_name, created_at').order('created_at', { ascending: false }).limit(3);
        const recentTrips = await supabase.from('trips').select('origin, destination, created_at').order('created_at', { ascending: false }).limit(3);

        const activity = [
            ...(recentUsers.data || []).map(u => ({
                id: `u-${u.created_at}`,
                type: 'user',
                message: `New user: ${u.full_name || 'User'}`,
                time: u.created_at
            })),
            ...(recentTrips.data || []).map(t => ({
                id: `t-${t.created_at}`,
                type: 'trip',
                message: `Trip: ${t.origin} -> ${t.destination}`,
                time: t.created_at
            }))
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

        res.status(200).json({ status: 'success', data: { stats, activity } });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(400).json({ message: 'Failed to fetch stats' });
    }
};

export const getDisputes = async (req: Request, res: Response) => {
    if (!await checkAdmin(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const { data, error } = await supabase.from('disputes').select('*');
    if (error) return res.status(400).json(error);
    res.status(200).json({ status: 'success', data });
};
