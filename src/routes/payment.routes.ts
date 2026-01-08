import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { initializePayment, verifyPayment, paystackWebhook } from '../controllers/payment.controller';

const router = Router();

router.post('/webhook', paystackWebhook); // No auth, signature verification

router.post('/initialize', authenticate, initializePayment);
router.get('/verify/:reference', authenticate, verifyPayment);

export default router;
