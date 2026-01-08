import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { findMatches, requestMatch, acceptMatch, confirmPickup, confirmDelivery } from '../controllers/matching.controller';

const router = Router();

router.use(authenticate);

router.get('/find', findMatches); // ?tripId=...
router.post('/request', requestMatch); // { tripId, requestId }
router.patch('/:id/accept', acceptMatch);
router.post('/:id/confirm-pickup', confirmPickup);
router.post('/:id/confirm-delivery', confirmDelivery);

export default router;
