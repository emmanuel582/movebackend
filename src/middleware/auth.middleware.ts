import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { supabase } from '../config/supabase';

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
        return res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Use Supabase to verify the token
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid token' });
        }

        // Attach user info to request (sub is the userId)
        req.user = {
            ...user,
            sub: user.id
        };
        next();
    } catch (error) {
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
            return res.status(500).json({ status: 'error', message: 'Failed to check verification status' });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied: User is not verified. Please complete identity verification.'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};
