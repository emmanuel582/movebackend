import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getNotifications, markRead } from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);

export default router;
