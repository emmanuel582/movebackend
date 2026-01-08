import { supabase } from '../config/supabase';

export const NotificationService = {
    async createNotification(userId: string, type: string, title: string, message: string, metadata?: any) {
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
    }
};
