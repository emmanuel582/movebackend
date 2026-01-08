import { Request, Response } from 'express';
import { TripService } from '../services/trip.service';

export const createTrip = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await TripService.createTrip(userId, req.body);
        res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getMyTrips = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await TripService.getUserTrips(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getTrip = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await TripService.getTripById(id);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(404).json({ status: 'error', message: error.message });
    }
};

export const deleteTrip = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { id } = req.params;
        const result = await TripService.deleteTrip(userId, id);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const searchTrips = async (req: Request, res: Response) => {
    try {
        // Query params
        const filters = req.query;
        const result = await TripService.searchTrips(filters);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
