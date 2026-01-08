import { Request, Response } from 'express';
import { DeliveryService } from '../services/delivery.service';

export const createRequest = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await DeliveryService.createRequest(userId, req.body);
        res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getMyRequests = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await DeliveryService.getUserRequests(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const getRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await DeliveryService.getRequestById(id);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(404).json({ status: 'error', message: error.message });
    }
};

export const searchRequests = async (req: Request, res: Response) => {
    try {
        const filters = req.query;
        const result = await DeliveryService.searchRequests(filters);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
