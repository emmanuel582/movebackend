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

export const getMatchRequests = async (req: Request, res: Response) => {
    try {
        const { tripId } = req.params;
        const result = await MatchingService.getMatchRequestsForTrip(tripId);
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

export const getMyDeliveries = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await MatchingService.getMyDeliveries(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const requestOtp = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { id } = req.params; // matchId
        const { type } = req.body; // 'pickup' | 'delivery'
        const result = await MatchingService.requestOTP(id, type, userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
export const getMatch = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await MatchingService.getMatch(id);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(404).json({ status: 'error', message: error.message });
    }
};
