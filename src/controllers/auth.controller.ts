import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { supabase } from '../config/supabase';

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, full_name, phone_number } = req.body;

        if (!email || !password || !full_name || !phone_number) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters long'
            });
        }

        const result = await AuthService.register(email, password, full_name, phone_number);
        res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
        let message = 'Registration failed';
        let statusCode = 400;

        if (error.message.includes('already registered') || error.message.includes('already exists')) {
            message = 'An account with this email already exists';
        } else if (error.message.includes('invalid email')) {
            message = 'Please provide a valid email address';
        } else if (error.message) {
            message = error.message;
        }

        res.status(statusCode).json({ status: 'error', message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required'
            });
        }

        const result = await AuthService.login(email, password);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        // Provide more specific error messages
        let message = 'Invalid login credentials';
        let statusCode = 401;

        if (error.message.includes('Invalid login credentials')) {
            message = 'Invalid login credentials';
        } else if (error.message.includes('Email not confirmed')) {
            message = 'Please verify your email before logging in';
            statusCode = 403;
        } else if (error.message) {
            message = error.message;
        }

        res.status(statusCode).json({ status: 'error', message });
    }
};

export const verifyUserOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and OTP are required'
            });
        }

        const result = await AuthService.verifyOtp(email, otp);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        let message = 'Invalid or expired verification code';

        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            message = 'Invalid or expired verification code';
        } else if (error.message) {
            message = error.message;
        }

        res.status(400).json({ status: 'error', message });
    }
};

export const resendUserOtp = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
            });
        }

        const result = await AuthService.resendOtp(email);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message || 'Failed to resend verification code' });
    }
};
// ... existing exports ...

export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        let { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            console.log('[Auth] User found in JWT but not in public.users, attempting sync...');
            // Try to sync from Auth to Public
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1] || '');

            if (authError || !authUser) {
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }

            // Use upsert to handle race conditions and duplicate key errors
            let phoneNumber = authUser.user_metadata?.phone || null;
            // Clean phone number - set to null if empty string
            if (phoneNumber && phoneNumber.trim() === '') {
                phoneNumber = null;
            }

            const { data: newUser, error: upsertError } = await supabase
                .from('users')
                .upsert({
                    id: userId,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                    phone: phoneNumber,
                    user_type: 'traveler', // Default type
                    current_mode: 'traveler',
                    is_verified: false
                }, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            if (upsertError) {
                console.error('[Auth] Failed to auto-create user with Service Role:', {
                    code: upsertError.code,
                    message: upsertError.message,
                    details: upsertError.details,
                    hint: upsertError.hint
                });

                // If it's a phone number conflict, try again without phone
                if (upsertError.code === '23505' && upsertError.message.includes('phone')) {
                    console.log('[Auth] Phone conflict detected, retrying without phone number');
                    const { data: retryUser, error: retryError } = await supabase
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
                        })
                        .select()
                        .single();

                    if (!retryError && retryUser) {
                        user = retryUser;
                        console.log('[Auth] User created successfully without phone number');
                    } else {
                        // Final fallback - try to fetch existing user
                        const { data: existingUser, error: fetchError } = await supabase
                            .from('users')
                            .select('*')
                            .eq('id', userId)
                            .single();

                        if (!fetchError && existingUser) {
                            console.log('[Auth] User already exists, using existing record');
                            user = existingUser;
                        } else {
                            return res.status(404).json({ status: 'error', message: 'User not found' });
                        }
                    }
                } else {
                    // If upsert failed for other reasons, try to fetch the user
                    const { data: retryUser, error: retryError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', userId)
                        .single();

                    if (!retryError && retryUser) {
                        console.log('[Auth] User was created by another request, using existing record');
                        user = retryUser;
                    } else {
                        return res.status(404).json({ status: 'error', message: 'User not found' });
                    }
                }
            } else {
                user = newUser;
                console.log('[Auth] User synced successfully');
            }

            // Also create wallet (use upsert to avoid duplicate errors)
            await supabase.from('wallets').upsert(
                { user_id: userId },
                { onConflict: 'user_id', ignoreDuplicates: true }
            );
        }

        // Fetch Auth Metadata to backfill missing columns (Bank Details Fix)
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const { data: { user: authUser } } = await supabase.auth.getUser(token);
            if (authUser?.user_metadata) {
                user.bank_name = user.bank_name || authUser.user_metadata.bank_name;
                user.account_number = user.account_number || authUser.user_metadata.account_number;
                user.account_name = user.account_name || authUser.user_metadata.account_name;
            }
        }

        res.status(200).json({ status: 'success', data: user });
    } catch (error: any) {
        console.error('[Auth] getMe error:', error);
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
};
