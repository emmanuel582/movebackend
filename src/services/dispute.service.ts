import { supabase } from '../config/supabase';

export const DisputeService = {
    async createDispute(userId: string, data: any) {
        const { matchId, againstUserId, reason } = data;

        const { data: dispute, error } = await supabase
            .from('disputes')
            .insert({
                match_id: matchId,
                raised_by: userId,
                against_user: againstUserId,
                reason,
                status: 'open'
            })
            .select()
            .single();

        if (error) throw error;
        return dispute;
    },

    async resolveDispute(disputeId: string, adminId: string, resolution: string, status: string = 'resolved') {
        const { data, error } = await supabase
            .from('disputes')
            .update({
                resolution,
                status,
                resolved_by: adminId
            })
            .eq('id', disputeId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
