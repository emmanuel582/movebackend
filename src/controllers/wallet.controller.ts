import { Request, Response } from 'express';
import { WalletService } from '../services/wallet.service';

export const getBalance = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const result = await WalletService.getBalance(userId);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const withdraw = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { amount, bankDetails } = req.body;
        const result = await WalletService.requestWithdrawal(userId, amount, bankDetails);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
