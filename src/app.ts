import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';

// Import Routes
import authRoutes from './routes/auth.routes';
import verificationRoutes from './routes/verification.routes';
import tripRoutes from './routes/trip.routes';
import deliveryRoutes from './routes/delivery.routes';
import matchingRoutes from './routes/matching.routes';
import paymentRoutes from './routes/payment.routes';
import walletRoutes from './routes/wallet.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import { ratingRoutes, disputeRoutes } from './routes/rating_dispute.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/', (req, res) => {
    res.status(200).json({ status: 'success', message: 'MOVEVER Backend API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/delivery-requests', deliveryRoutes);
app.use('/api/matches', matchingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/disputes', disputeRoutes);

// Error Handling Middleware (Placeholder)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
});

export default app;
