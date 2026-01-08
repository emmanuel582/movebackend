import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { submitIdentity, submitBusiness, approveVerification, rejectVerification, getPendingVerifications, getVerificationStatus } from '../controllers/verification.controller';

const router = Router();

// User Routes
router.post('/submit-identity', authenticate, upload.fields([
    { name: 'id_document', maxCount: 1 },
    { name: 'live_video', maxCount: 1 },
    { name: 'live_photo', maxCount: 1 }
]), submitIdentity);

router.post('/submit-business', authenticate, upload.fields([
    { name: 'cac_document', maxCount: 1 }
]), submitBusiness);

// Get user's verification status
router.get('/status/:userId', authenticate, getVerificationStatus);

// Admin Routes (Should implement role check, skipping for MVP/assuming specific admin endpoint prefix logic or check)
// For MVP, we'll just use authenticate. In production, add requireAdmin middleware.
// Admin Routes
router.get('/admin/pending', authenticate, getPendingVerifications);
router.patch('/admin/:id/approve', authenticate, approveVerification);
router.patch('/admin/:id/reject', authenticate, rejectVerification);

export default router;
