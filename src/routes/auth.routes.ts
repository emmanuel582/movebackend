import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { register, login, verifyUserOtp, resendUserOtp, getMe } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyUserOtp);
router.post('/resend-otp', resendUserOtp);
router.get('/me', authenticate, getMe);

export default router;
