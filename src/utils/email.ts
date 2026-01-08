import nodemailer from 'nodemailer';
import { config } from '../config/env';

// Create generic transporter
const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT, // 587
    secure: false, // true for 465, false for other ports
    auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
    },
});

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    try {
        const info = await transporter.sendMail({
            from: config.SENDGRID_FROM_EMAIL, // Using the same env var for "From" address
            to,
            subject,
            text,
            html: html || text,
        });
        console.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error: any) {
        console.error('Error sending email:', error);
        // Log detailed error from nodemailer if available
        if (error.response) {
            console.error(error.response);
        }
        throw new Error('Failed to send email');
    }
};

export const sendOTPEmail = async (email: string, otp: string) => {
    const subject = 'Your MOVEVER Verification Code';
    const text = `Your verification code is: ${otp}. It expires in 15 minutes.`;
    const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Welcome to MOVEVER</h2>
      <p>Your verification code is:</p>
      <h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
      <p>This code expires in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;
    await sendEmail(email, subject, text, html);
};
