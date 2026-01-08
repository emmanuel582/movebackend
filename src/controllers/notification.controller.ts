import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await NotificationService.getUserNotifications(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const markRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { id } = req.params;
        const result = await NotificationService.markAsRead(id, userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
