import { Request, Response } from 'express';
import { VerificationService } from '../services/verification.service';
import { supabase } from '../config/supabase';

export const submitIdentity = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub; // From JWT
        const data = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        console.log('[Verification] Submitting identity for user:', userId);
        console.log('[Verification] Data:', data);
        console.log('[Verification] Files received:', Object.keys(files || {}));

        // Check if user exists in public.users table
        const { data: existingUser, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();

        if (userCheckError || !existingUser) {
            console.log('[Verification] User not found in public.users, creating...');

            // Get user details from auth
            const { data: { user: authUser } } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1] || '');

            if (authUser) {
                // Create user in public.users table
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: userId,
                        email: authUser.email,
                        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                        phone: authUser.user_metadata?.phone || null,
                        user_type: 'traveler',
                        current_mode: 'traveler',
                        is_verified: false
                    });

                if (insertError) {
                    console.error('[Verification] Failed to create user:', insertError);
                    throw new Error('Failed to create user record');
                }

                // Also create wallet
                await supabase.from('wallets').insert({ user_id: userId });

                console.log('[Verification] User created successfully');
            }
        }

        const result = await VerificationService.submitIdentity(userId, data, files);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        console.error('[Verification] Error:', error);
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const submitBusiness = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const data = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        const result = await VerificationService.submitBusiness(userId, data, files);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const approveVerification = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = req.user.sub;
        await VerificationService.approveVerification(id, adminId);
        res.status(200).json({ status: 'success', message: 'Verification approved' });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getPendingVerifications = async (req: Request, res: Response) => {
    try {
        const result = await VerificationService.getPendingVerifications();
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const rejectVerification = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user.sub;
        await VerificationService.rejectVerification(id, adminId, reason);
        res.status(200).json({ status: 'success', message: 'Verification rejected' });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getVerificationStatus = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await VerificationService.getUserVerificationStatus(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(404).json({ status: 'error', message: error.message });
    }
};
