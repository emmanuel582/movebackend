import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getBalance, withdraw } from '../controllers/wallet.controller';

const router = Router();

router.use(authenticate);

router.get('/balance', getBalance);
router.post('/withdraw', withdraw);

export default router;
