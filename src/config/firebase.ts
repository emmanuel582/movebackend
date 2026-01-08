import admin from 'firebase-admin';
import { config } from './env';

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: config.FIREBASE_PRIVATE_KEY,
    }),
});
console.log('Firebase Admin Initialized');

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
