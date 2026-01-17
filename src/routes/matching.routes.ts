import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { findMatches, requestMatch, acceptMatch, confirmPickup, confirmDelivery, getMatchRequests, getMyDeliveries, requestOtp, getMatch } from '../controllers/matching.controller';

const router = Router();

router.use(authenticate);

router.get('/find', findMatches); // ?tripId=...
router.get('/trip/:tripId/requests', getMatchRequests);
router.post('/request', requestMatch); // { tripId, requestId }
router.patch('/:id/accept', acceptMatch);
router.get('/my-deliveries', getMyDeliveries);
router.get('/:id', getMatch);
router.post('/:id/request-otp', requestOtp);
router.post('/:id/confirm-pickup', confirmPickup);
router.post('/:id/confirm-delivery', confirmDelivery);

export default router;
