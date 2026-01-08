import { Router } from 'express';
import { authenticate, requireVerification } from '../middleware/auth.middleware';
import { createTrip, getMyTrips, getTrip, deleteTrip, searchTrips } from '../controllers/trip.controller';

const router = Router();

// Public/Business Search (Authenticated user)
router.get('/search', authenticate, searchTrips);

// Protected routes
router.use(authenticate);

router.post('/', requireVerification, createTrip); // Verification Required
router.get('/', getMyTrips);
router.get('/:id', getTrip);
router.delete('/:id', deleteTrip);

export default router;
