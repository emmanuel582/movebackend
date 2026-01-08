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

            // Create user in public.users table
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
                    phone: authUser.user_metadata?.phone || null,
                    user_type: 'traveler', // Default type
                    current_mode: 'traveler',
                    is_verified: false
                })
                .select()
                .single();

            if (insertError) {
                console.error('[Auth] Failed to auto-create user:', insertError);
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }

            // Also create wallet
            await supabase.from('wallets').insert({ user_id: userId });
            console.log('[Auth] User synced successfully');
            user = newUser;
        }

        res.status(200).json({ status: 'success', data: user });
    } catch (error: any) {
        console.error('[Auth] getMe error:', error);
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
};
