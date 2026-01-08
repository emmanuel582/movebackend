import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getUsers, getVerifications, getTrips, getDeliveries, getPayments, getDisputes, getDashboardStats } from '../controllers/admin.controller';
import { getPendingVerifications, approveVerification, rejectVerification } from '../controllers/verification.controller';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/users', getUsers);
router.get('/verifications', getVerifications);
router.get('/trips', getTrips);
router.get('/deliveries', getDeliveries);
router.get('/payments', getPayments);
router.get('/disputes', getDisputes);

// Verification Management (Matches frontend /api/admin/...)
router.get('/pending', getPendingVerifications);
router.patch('/:id/approve', approveVerification);
router.patch('/:id/reject', rejectVerification);

export default router;
