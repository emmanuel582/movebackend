import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getUserStats, updateBankDetails, updatePushToken } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/stats', getUserStats);
router.post('/update-bank', updateBankDetails);
router.post('/push-token', updatePushToken);

export default router;
