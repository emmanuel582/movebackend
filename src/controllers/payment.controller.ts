import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { config } from '../config/env';
import crypto from 'crypto';

export const initializePayment = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { matchId, email } = req.body;
        const result = await PaymentService.initializePayment(userId, matchId, email);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { reference } = req.params;
        const result = await PaymentService.verifyPayment(reference);
        res.status(200).json(result);
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const paystackWebhook = async (req: Request, res: Response) => {
    // Validate signature
    const hash = crypto.createHmac('sha512', config.PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash === req.headers['x-paystack-signature']) {
        const event = req.body;
        if (event.event === 'charge.success') {
            // Handle success logic via Service if needed (e.g. if verifyPayment wasn't called manually)
            // Ideally calls PaymentService.verifyPayment logic or specialized handler
            await PaymentService.verifyPayment(event.data.reference);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(400);
    }
};
