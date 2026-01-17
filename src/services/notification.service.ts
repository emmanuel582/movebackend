import { supabase } from '../config/supabase';

// Helper: Send Expo Push Notification
async function sendPushNotification(expoPushToken: string, title: string, body: string, data?: any) {
    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
    };

    try {
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
}

export const NotificationService = {
    async createNotification(userId: string, type: string, title: string, message: string, metadata?: any) {
        // 1. Save to DB (In-App)
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type,
                title,
                message,
                metadata,
                is_read: false
            });

        if (error) console.error('Failed to create notification:', error);

        // 2. Send Push Notification (Mobile)
        try {
            // Authenticate and get user metadata to find user's push token
            const { data: { user } } = await supabase.auth.admin.getUserById(userId);

            // Check for token in metadata (our robust storage) or potentially public table
            const pushToken = user?.user_metadata?.push_token; // || user?.data?.push_token?

            if (pushToken && (pushToken.startsWith('ExponentPushToken') || pushToken.startsWith('BxponentPushToken'))) {
                await sendPushNotification(pushToken, title, message, { type, ...metadata });
            }
        } catch (pushError) {
            console.error('Failed to send push notification:', pushError);
        }
    },

    async getUserNotifications(userId: string) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async markAsRead(notificationId: string, userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', userId);

        if (error) throw error;
        return { message: 'Marked as read' };
    },

    async getUnreadCount(userId: string) {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) throw error;
        return { count: count || 0 };
    },

    async markAllAsRead(userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) throw error;
        return { message: 'All marked as read' };
    }
};
