import dotenv from 'dotenv';

dotenv.config();

interface Config {
    PORT: number;
    NODE_ENV: string;
    SUPABASE_URL: string;
    SUPABASE_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_CLIENT_EMAIL: string;
    FIREBASE_PRIVATE_KEY: string;
    SMTP_HOST: string;
    SMTP_PORT: number;
    SMTP_USER: string;
    SMTP_PASS: string;
    SENDGRID_FROM_EMAIL: string;
    PAYSTACK_SECRET_KEY: string;
    PAYSTACK_PUBLIC_KEY: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_PUBLIC_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    FRONTEND_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
}

const getEnvParam = (name: string): string => {
    const value = process.env[name];
    if (!value && process.env.NODE_ENV === 'production') {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value || '';
};

export const config: Config = {
    PORT: parseInt(process.env.PORT || '5000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    SUPABASE_URL: getEnvParam('SUPABASE_URL'),
    SUPABASE_KEY: getEnvParam('SUPABASE_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: getEnvParam('SUPABASE_SERVICE_ROLE_KEY'),
    FIREBASE_PROJECT_ID: getEnvParam('FIREBASE_PROJECT_ID'),
    FIREBASE_CLIENT_EMAIL: getEnvParam('FIREBASE_CLIENT_EMAIL'),
    FIREBASE_PRIVATE_KEY: getEnvParam('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    // SMTP (SendGrid)
    SMTP_HOST: getEnvParam('SMTP_HOST'),
    SMTP_PORT: parseInt(getEnvParam('SMTP_PORT'), 10),
    SMTP_USER: getEnvParam('SMTP_USER'),
    SMTP_PASS: getEnvParam('SMTP_PASS'),
    SENDGRID_FROM_EMAIL: getEnvParam('SENDGRID_FROM_EMAIL'), // Keep for 'from' address or use a new generic one

    PAYSTACK_SECRET_KEY: (process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_SECRET_KEY !== 'PLACEHOLDER') ? process.env.PAYSTACK_SECRET_KEY : 'mock_paystack_secret',
    PAYSTACK_PUBLIC_KEY: (process.env.PAYSTACK_PUBLIC_KEY && process.env.PAYSTACK_PUBLIC_KEY !== 'PLACEHOLDER') ? process.env.PAYSTACK_PUBLIC_KEY : 'mock_paystack_public',
    STRIPE_SECRET_KEY: getEnvParam('STRIPE_SECRET_KEY'),
    STRIPE_PUBLIC_KEY: getEnvParam('STRIPE_PUBLIC_KEY'),
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8081',
    JWT_SECRET: getEnvParam('JWT_SECRET'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
};
