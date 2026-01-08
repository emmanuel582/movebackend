import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getUserStats } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/stats', getUserStats);

export default router;
