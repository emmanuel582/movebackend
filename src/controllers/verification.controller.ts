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

            // Get user details from auth middleware directly (avoids extra network call)
            const authUser = req.user;

            if (authUser) {
                // Clean phone number - set to null if empty string
                let phoneNumber = authUser.user_metadata?.phone || null;
                if (phoneNumber && phoneNumber.trim() === '') {
                    phoneNumber = null;
                }

                // Use upsert to handle race conditions and duplicate key errors
                const { error: upsertError } = await supabase
                    .from('users')
                    .upsert({
                        id: userId,
                        email: authUser.email,
                        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                        phone: phoneNumber,
                        user_type: 'traveler',
                        current_mode: 'traveler',
                        is_verified: false
                    }, {
                        onConflict: 'id',
                        ignoreDuplicates: false
                    });

                if (upsertError) {
                    console.error('[Verification] Failed to create user with Service Role:', {
                        code: upsertError.code,
                        message: upsertError.message,
                        details: upsertError.details,
                        hint: upsertError.hint
                    });

                    // If it's a phone number conflict, try again without phone
                    if (upsertError.code === '23505' && upsertError.message.includes('phone')) {
                        console.log('[Verification] Phone conflict detected, retrying without phone number');
                        const { error: retryError } = await supabase
                            .from('users')
                            .upsert({
                                id: userId,
                                email: authUser.email,
                                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                                phone: null, // Set to null to avoid conflict
                                user_type: 'traveler',
                                current_mode: 'traveler',
                                is_verified: false
                            }, {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            });

                        if (retryError) {
                            // Final verification - check if user exists
                            const { data: verifyUser, error: verifyError } = await supabase
                                .from('users')
                                .select('id')
                                .eq('id', userId)
                                .single();

                            if (verifyError || !verifyUser) {
                                throw new Error('Failed to create user record');
                            }
                            console.log('[Verification] User already exists, continuing...');
                        } else {
                            console.log('[Verification] User created successfully without phone number');
                        }
                    } else {
                        // For other errors, verify user exists
                        const { data: verifyUser, error: verifyError } = await supabase
                            .from('users')
                            .select('id')
                            .eq('id', userId)
                            .single();

                        if (verifyError || !verifyUser) {
                            throw new Error('Failed to create user record');
                        }
                        console.log('[Verification] User already exists, continuing...');
                    }
                } else {
                    console.log('[Verification] User created successfully');
                }

                // Also create wallet (use upsert to avoid duplicate errors)
                await supabase.from('wallets').upsert(
                    { user_id: userId },
                    { onConflict: 'user_id', ignoreDuplicates: true }
                );
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
