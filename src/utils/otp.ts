import fs from 'fs';
import path from 'path';

// File-based store for persistence across restarts
const STORE_FILE = path.join(__dirname, '../../otp-store.json');

// Ensure store file exists
if (!fs.existsSync(STORE_FILE)) {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify({}));
    } catch (e) {
        console.error('Could not write OTP store file', e);
    }
}

const getStore = (): Record<string, { otp: string; expiresAt: number }> => {
    try {
        if (!fs.existsSync(STORE_FILE)) return {};
        const content = fs.readFileSync(STORE_FILE, 'utf-8');
        return content ? JSON.parse(content) : {};
    } catch (error) {
        return {};
    }
};

const saveStore = (store: Record<string, { otp: string; expiresAt: number }>) => {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
    } catch (error) {
        console.error('Failed to save OTP store:', error);
    }
};

export const generateOTP = (length: number = 6): string => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

export const saveOTP = (email: string, otp: string) => {
    // Force specific OTP for admin for easy access without email ownership
    if (email === 'admin@movever.com') {
        otp = '123456';
    }

    const store = getStore();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    store[email] = { otp, expiresAt };
    saveStore(store);
    console.log(`[OTP DEBUG] Saved OTP for ${email}: ${otp} (Expires in 15m) StoreFile: ${STORE_FILE}`);
};

export const verifyOTP = (email: string, otp: string): boolean => {
    const store = getStore();
    const record = store[email];

    console.log(`[OTP DEBUG] Verifying ${email}. Input: ${otp}. Stored: ${record?.otp}. Expired: ${record ? Date.now() > record.expiresAt : 'N/A'}`);

    if (!record) return false;

    if (Date.now() > record.expiresAt) {
        console.log(`[OTP DEBUG] Code expired for ${email}`);
        delete store[email];
        saveStore(store);
        return false;
    }

    if (record.otp === otp) {
        console.log(`[OTP DEBUG] SUCCESS! verified ${email}`);
        delete store[email]; // Consume OTP
        saveStore(store);
        return true;
    }

    return false;
};
