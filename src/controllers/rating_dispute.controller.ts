import { Request, Response } from 'express';
import { RatingService } from '../services/rating.service';
import { DisputeService } from '../services/dispute.service';

// Ratings
export const createRating = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await RatingService.createRating(userId, req.body);
        res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getUserRatings = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await RatingService.getUserRatings(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

// Disputes
export const createDispute = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await DisputeService.createDispute(userId, req.body);
        res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const resolveDispute = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = req.user.sub;
        const { resolution, status } = req.body;
        const result = await DisputeService.resolveDispute(id, adminId, resolution, status);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
