import { Router } from 'express';
import { authenticate, requireVerification } from '../middleware/auth.middleware';
import { createRequest, getMyRequests, getRequest, searchRequests } from '../controllers/delivery.controller';

const router = Router();

// Public/Traveler Search
router.get('/search', authenticate, searchRequests);

// Protected routes
router.use(authenticate);

router.post('/', requireVerification, createRequest); // Verification Required
router.get('/', getMyRequests);
router.get('/:id', getRequest);

export default router;
