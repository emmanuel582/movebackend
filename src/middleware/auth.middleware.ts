import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { config } from '../config/env';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Only warn if it's not a health check or public endpoint (though middleware usually only applied to protected)
        console.warn('[Auth Middleware] 401 - No Bearer token found in headers');
        return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Method 1: Try using anon key client to verify token (ONLINE CHECK)
        try {
            const userClient = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
            const { data: { user }, error } = await userClient.auth.getUser(token);

            if (!error && user) {
                req.user = {
                    ...user,
                    sub: user.id,
                    id: user.id
                };
                return next();
            }

            console.warn('[Auth] Online verification failed/refused:', error?.message);
        } catch (onlineError: any) {
            console.warn('[Auth] Online verification threw error (Network?):', onlineError.message);
        }

        // Method 2: Offline Fallback
        console.log(`[Auth] Attempting fallback. NODE_ENV=${config.NODE_ENV}`);

        try {
            if (!config.JWT_SECRET) {
                // If we don't have a secret, we can't properly verify HS256.
                throw new Error('No JWT_SECRET configured');
            }

            // Debug: Log token details
            const decodedFull = jwt.decode(token, { complete: true });
            if (decodedFull && decodedFull.header) {
                console.log(`[Auth] Token Alg: ${decodedFull.header.alg}`);
            }

            // Attempt strict verification first (only works if Secret matches Algo & Key)
            const decoded = jwt.verify(token, config.JWT_SECRET) as any;

            if (decoded && decoded.sub) {
                console.log('[Auth] Offline JWT verification successful.');
                req.user = {
                    id: decoded.sub,
                    sub: decoded.sub,
                    email: decoded.email,
                    role: decoded.role || 'authenticated',
                    app_metadata: decoded.app_metadata || {},
                    user_metadata: decoded.user_metadata || {},
                    aud: decoded.aud,
                    created_at: decoded.created_at || new Date().toISOString()
                };
                return next();
            }
        } catch (jwtError: any) {
            console.error('[Auth] Offline JWT verification failed:', jwtError.message);

            // EMERGENCY DEV FALLBACK for ES256 or Mismatched Secrets
            if (config.NODE_ENV?.trim() === 'development') {
                console.warn('[Auth] ⚠️ DEVELOPMENT MODE: Bypassing signature verification. INSECURE.');

                const decodedUnsafe = jwt.decode(token) as any;
                if (decodedUnsafe && (decodedUnsafe.sub || decodedUnsafe.id)) {
                    req.user = {
                        id: decodedUnsafe.sub || decodedUnsafe.id,
                        sub: decodedUnsafe.sub || decodedUnsafe.id,
                        email: decodedUnsafe.email,
                        role: decodedUnsafe.role || 'authenticated',
                        app_metadata: decodedUnsafe.app_metadata || {},
                        user_metadata: decodedUnsafe.user_metadata || {},
                        aud: decodedUnsafe.aud,
                        created_at: decodedUnsafe.created_at || new Date().toISOString()
                    };
                    return next();
                }
            }
        }

        // If all methods fail
        console.error('[Auth Middleware] 401 - Final token validation failed');
        return res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid token' });
    } catch (error: any) {
        console.error('[Auth] Authentication error:', error.message);
        return res.status(401).json({ status: 'error', message: 'Unauthorized: Authentication failed' });
    }
};

export const requireVerification = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.sub) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('is_verified')
            .eq('id', req.user.sub)
            .single();

        if (error || !user) {
            console.error('[Auth] Verification check failed:', error?.message);

            // DEV BYPASS for Verification Check (DB Unreachable)
            if (config.NODE_ENV?.trim() === 'development') {
                console.warn('[Auth] ⚠️ DEV MODE: Assuming user is verified due to DB error.');
                return next();
            }

            return res.status(500).json({ status: 'error', message: 'Failed to check verification status' });
        }

        if (!user.is_verified) {
            // In dev, maybe you want to bypass this too? Optional.
            return res.status(403).json({
                status: 'error',
                message: 'Access denied: User is not verified. Please complete identity verification.'
            });
        }

        next();
    } catch (error) {
        // Dev bypass here too
        if (config.NODE_ENV?.trim() === 'development') {
            console.warn('[Auth] ⚠️ DEV MODE: Assuming user is verified due to exception.');
            return next();
        }
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};
