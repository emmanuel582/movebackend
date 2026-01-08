import { supabase } from '../config/supabase';
import { db } from '../config/firebase'; // Firestore
import { v4 as uuidv4 } from 'uuid';

export const VerificationService = {
    async uploadFile(userId: string, file: Express.Multer.File, folder: string) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${userId}/${folder}/${uuidv4()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('verifications')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('verifications')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    async submitIdentity(userId: string, data: any, files: { [fieldname: string]: Express.Multer.File[] }) {
        // 1. Upload files
        const idDocUrl = files['id_document'] ? await this.uploadFile(userId, files['id_document'][0], 'id_docs') : null;
        const liveVideoUrl = files['live_video'] ? await this.uploadFile(userId, files['live_video'][0], 'videos') : null;
        const livePhotoUrl = files['live_photo'] ? await this.uploadFile(userId, files['live_photo'][0], 'photos') : null;

        if (!idDocUrl || !liveVideoUrl || !livePhotoUrl) {
            throw new Error('All identity documents (ID, Video, Photo) are required');
        }

        // 2. Insert into PostgreSQL
        const { data: verification, error } = await supabase
            .from('verifications')
            .insert({
                user_id: userId,
                verification_type: 'identity',
                nin_bvn: data.nin_bvn,
                id_document_url: idDocUrl,
                live_video_url: liveVideoUrl,
                live_photo_url: livePhotoUrl,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // 3. Sync to Firestore for Real-time Admin Queue
        await this.syncToFirestore(verification);

        // 4. Update User Status in Firestore (Real-time Feedback)
        await this.updateUserFirestoreStatus(userId, 'pending');

        return verification;
    },

    async submitBusiness(userId: string, data: any, files: { [fieldname: string]: Express.Multer.File[] }) {
        // Upload Business Docs (Assuming 1 doc for now called cac_document)
        // Note: Schema has cac_number and business_address, but maybe a file too? 
        // Frontend 'cac.tsx' says "Upload CAC documents".
        // I'll assume they upload a file named 'cac_document'.

        const cacDocUrl = files['cac_document'] ? await this.uploadFile(userId, files['cac_document'][0], 'business_docs') : null;

        const { data: verification, error } = await supabase
            .from('verifications')
            .insert({
                user_id: userId,
                verification_type: 'business',
                cac_number: data.cac_number,
                business_address: data.business_address,
                id_document_url: cacDocUrl, // Using id_document_url to store the generic doc url for now logic reuse
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        await this.syncToFirestore(verification);
        await this.updateUserFirestoreStatus(userId, 'pending'); // Or 'business_pending' if distinct

        return verification;
    },

    async syncToFirestore(verification: any, retries = 3) {
        // Shape for AdminVerificationsScreen: { id, name, type, method, submittedAt, status }
        // Need user name.
        const { data: user } = await supabase.from('users').select('full_name').eq('id', verification.user_id).single();

        const firestoreData = {
            id: verification.id,
            userId: verification.user_id,
            name: user?.full_name || 'Unknown User',
            type: verification.verification_type === 'identity' ? 'Identity Verification' : 'Business Verification',
            method: verification.verification_type === 'identity' ? 'Live Video/Photo' : 'CAC Documents',
            submittedAt: verification.submitted_at,
            status: verification.status,
            details: {
                id_document_url: verification.id_document_url,
                live_video_url: verification.live_video_url,
                live_photo_url: verification.live_photo_url,
                cac_number: verification.cac_number,
                business_address: verification.business_address
            }
        };

        // Retry logic for Firestore sync
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await db.collection('verification_queue').doc(verification.id).set(firestoreData);
                console.log(`[Firestore] Synced verification ${verification.id} to queue`);
                return; // Success, exit
            } catch (error) {
                console.error(`[Firestore] Sync attempt ${attempt}/${retries} failed:`, error);
                if (attempt === retries) {
                    throw new Error(`Failed to sync verification to Firestore after ${retries} attempts`);
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    },

    async updateUserFirestoreStatus(userId: string, status: string, isVerified: boolean = false, retries = 3) {
        const firestoreData = {
            verificationStatus: status,
            is_verified: isVerified,
            updatedAt: new Date().toISOString()
        };

        // Retry logic for Firestore user status update
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await db.collection('users').doc(userId).set(firestoreData, { merge: true });
                console.log(`[Firestore] Updated user ${userId} status to ${status}, verified: ${isVerified}`);
                return; // Success, exit
            } catch (error) {
                console.error(`[Firestore] User status update attempt ${attempt}/${retries} failed:`, error);
                if (attempt === retries) {
                    throw new Error(`Failed to update user status in Firestore after ${retries} attempts`);
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    },

    async approveVerification(verificationId: string, adminId: string) {
        // 1. Get verification record
        const { data: verification, error: fetchError } = await supabase
            .from('verifications')
            .select('*')
            .eq('id', verificationId)
            .single();

        if (fetchError || !verification) throw new Error('Verification not found');

        // 2. Update Verification Status in DB
        const { error: updateError } = await supabase
            .from('verifications')
            .update({
                status: 'approved',
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', verificationId);

        if (updateError) throw updateError;

        // 3. Update User Status in DB (Critical for middleware)
        await supabase.from('users').update({ is_verified: true }).eq('id', verification.user_id);

        // 4. Update Firestore Queue
        try {
            await db.collection('verification_queue').doc(verificationId).update({ status: 'approved' });
        } catch (error) {
            console.error('[Firestore] Failed to update verification queue:', error);
            // Continue even if queue update fails
        }

        // 5. Update Firestore User Status (Real-time for App) - CRITICAL for frontend sync
        await this.updateUserFirestoreStatus(verification.user_id, 'approved', true);

        // 6. Send Email
        // Fetch user email first
        const { data: user } = await supabase.from('users').select('email').eq('id', verification.user_id).single();
        if (user?.email) {
            // Import dynamically to avoid circular dependency if any, or just import at top if clean
            const { sendEmail } = require('../utils/email');
            await sendEmail(user.email, 'Verification Approved', 'Your MOVEVER verification has been approved! You can now post trips and requests.');
        }
    },

    async rejectVerification(verificationId: string, adminId: string, reason: string) {
        const { data: verification, error: fetchError } = await supabase
            .from('verifications')
            .select('*')
            .eq('id', verificationId)
            .single();

        if (fetchError || !verification) throw new Error('Verification not found');

        // Update DB
        await supabase
            .from('verifications')
            .update({
                status: 'rejected',
                admin_notes: reason,
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', verificationId);

        // Update Firestore
        try {
            await db.collection('verification_queue').doc(verificationId).update({ status: 'rejected' });
        } catch (error) {
            console.error('[Firestore] Failed to update verification queue:', error);
        }
        await this.updateUserFirestoreStatus(verification.user_id, 'rejected', false);

        // Send Email
        const { data: user } = await supabase.from('users').select('email').eq('id', verification.user_id).single();
        if (user?.email) {
            const { sendEmail } = require('../utils/email');
            await sendEmail(user.email, 'Verification Rejected', `Your verification was rejected. Reason: ${reason}`);
        }
    },
    async getPendingVerifications() {
        const snapshot = await db.collection('verification_queue')
            .where('status', '==', 'pending')
            .orderBy('submittedAt', 'desc')
            .get();

        const verifications: any[] = [];
        snapshot.forEach(doc => {
            verifications.push(doc.data());
        });

        return verifications;
    },

    async getUserVerificationStatus(userId: string) {
        // Get the most recent verification record for this user
        const { data, error } = await supabase
            .from('verifications')
            .select('status, verification_type, submitted_at')
            .eq('user_id', userId)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // No verification record found
            return { status: null, hasSubmitted: false };
        }

        return {
            status: data.status,
            verificationType: data.verification_type,
            submittedAt: data.submitted_at,
            hasSubmitted: true
        };
    }
};
