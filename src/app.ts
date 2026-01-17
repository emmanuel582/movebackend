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
import mapsRoutes from './routes/maps.routes';

const app = express();

// Middleware
app.use(helmet());

// CORS Configuration
const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // In production, only allow specific domains
        const allowedOrigins = config.NODE_ENV === 'production'
            ? [config.FRONTEND_URL, 'https://yourdomain.com'] // Add your actual domains
            : ['http://localhost:8081', 'http://localhost:19006', config.FRONTEND_URL];

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Stripe Webhook needs RAW body
import { stripeWebhook } from './controllers/payment.controller';
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), stripeWebhook);

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
app.use('/api/maps', mapsRoutes);

// Error Handling Middleware (Placeholder)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
});

export default app;
