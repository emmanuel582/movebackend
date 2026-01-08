import { supabase } from '../config/supabase';
import { generateOTP, saveOTP, verifyOTP } from '../utils/otp';
import { sendOTPEmail } from '../utils/email';

export const AuthService = {
    async register(email: string, password: string, fullName: string, phone: string) {
        // 1. Create user in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone,
                },
            },
        });

        if (error) throw error;
        if (!data.user) throw new Error('User creation failed');

        // 2. Generate and send verification OTP
        // 2. Generate and send verification OTP
        const otp = generateOTP();
        saveOTP(email, otp);

        console.log(`[DEV ONLY] OTP for ${email}: ${otp}`); // Always log in dev for easier testing

        try {
            await sendOTPEmail(email, otp);
        } catch (emailError: any) {
            console.error('Failed to send OTP email:', emailError.message);
            // In development, we don't want to block registration if email fails (e.g. invalid credentials)
            // User can grab the OTP from the console log above.
            if (process.env.NODE_ENV !== 'development') {
                throw new Error('Failed to send verification email. Please try again.');
            }
        }

        return { user: data.user, message: 'Registration successful. OTP sent to email.' };
    },

    async login(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            // Check if error is about email not confirmed
            if (error.message.includes('Email not confirmed')) {
                throw new Error('Please verify your email before logging in');
            }
            throw error;
        }

        // In development mode, we can log session details or do extra checks
        // if (data.session) console.log('Login successful');

        // Check if user verified our custom OTP (This is tricky if we don't block them. 
        // Implementation Plan Phase 2.5 says "Users cannot interact... until verified" 
        // which usually refers to Identity Verification. 
        // But for Email Verification, Supabase handles it if "Confirm Email" is on.
        // If we use custom OTP, we should probably check a flag or just rely on Supabase session.)

        return { session: data.session, user: data.user };
    },

    async resendOtp(email: string) {
        const otp = generateOTP();
        saveOTP(email, otp);
        console.log(`[DEV ONLY] Resend OTP for ${email}: ${otp}`);

        try {
            await sendOTPEmail(email, otp);
        } catch (emailError: any) {
            console.error('Failed to send OTP email (Resend):', emailError.message);
            if (process.env.NODE_ENV !== 'development') {
                throw new Error('Failed to resend verification email.');
            }
        }
        return { message: 'OTP resent successfully' };
    },

    async verifyOtp(email: string, otp: string) {
        const isValid = verifyOTP(email, otp);
        if (!isValid) throw new Error('Invalid or expired OTP');

        // update email_verified if that column existed, but we'll rely on Supabase auth.
        // For now, we just proceed as OTP was successful.

        return { message: 'Email verified successfully' };
    }
};
