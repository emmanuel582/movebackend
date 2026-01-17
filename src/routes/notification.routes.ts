import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getNotifications, markRead, getUnreadCount, markAllRead } from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
