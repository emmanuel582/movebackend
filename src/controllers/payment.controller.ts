import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';

export const initializePayment = async (req: Request, res: Response) => {
    try {
        const userId = req.user.sub;
        const { matchId, email } = req.body;
        const result = await PaymentService.initializeStripePayment(userId, matchId, email);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
    try {
        const { matchId, email } = req.body;
        const result = await PaymentService.createStripeCheckoutSession(req.user.sub, matchId, email);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { reference } = req.query; // It might be in query or param
        const result = await PaymentService.confirmStripePayment(reference as string);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const stripeWebhook = async (req: Request, res: Response) => {
    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            console.error('[Stripe Webhook] Error: No stripe-signature header found');
            return res.status(400).send('No signature');
        }

        await PaymentService.handleStripeWebhook(sig as string, req.body);
        res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('[Stripe Webhook] Controller Error:', error.message);
        res.status(400).json({ status: 'error', message: error.message });
    }
};

export const confirmPayment = async (req: Request, res: Response) => {
    try {
        const { reference, forceSuccess } = req.body;
        const result = await PaymentService.confirmStripePayment(reference, forceSuccess);
        res.status(200).json({ status: 'success', data: result });
    } catch (error: any) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};
