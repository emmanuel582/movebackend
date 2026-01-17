import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { initializePayment, verifyPayment, confirmPayment, createCheckoutSession } from '../controllers/payment.controller';

const router = Router();

router.post('/initialize', authenticate, initializePayment);
router.post('/create-session', authenticate, createCheckoutSession);
router.get('/verify', authenticate, verifyPayment);
router.post('/confirm', authenticate, confirmPayment);

export default router;
