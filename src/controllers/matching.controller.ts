import { Request, Response } from 'express';
import { MatchingService } from '../services/matching.service';

export const findMatches = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.query;
        const result = await MatchingService.findPotentialMatchesForTrip(tripId as string);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const requestMatch = async (req: Request, res: Response) => {
    try {
        const requesterId = req.user.sub;
        const { tripId, requestId } = req.body;
        const result = await MatchingService.requestMatch(tripId, requestId, requesterId);
        res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const acceptMatch = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { id } = req.params; // matchId
        const result = await MatchingService.acceptMatch(id, userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const confirmPickup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;
        const result = await MatchingService.confirmPickup(id, otp);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const confirmDelivery = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;
        const result = await MatchingService.confirmDelivery(id, otp);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
