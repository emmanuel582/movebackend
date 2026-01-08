import { supabase } from '../config/supabase';

export const RatingService = {
    async createRating(raterId: string, data: any) {
        const { matchId, ratedUserId, rating, comment } = data;

        // Verify match exists and rater was involved
        const { data: match } = await supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single();

        if (!match) throw new Error('Match not found');
        if (match.traveler_id !== raterId && match.business_id !== raterId) {
            throw new Error('You were not involved in this match');
        }

        const { data: newRating, error } = await supabase
            .from('ratings')
            .insert({
                match_id: matchId,
                rater_id: raterId,
                rated_id: ratedUserId,
                rating,
                comment
            })
            .select()
            .single();

        if (error) throw error;
        return newRating;
    },

    async getUserRatings(userId: string) {
        const { data, error } = await supabase
            .from('ratings')
            .select(`
        *,
        users!rater_id (full_name)
      `)
            .eq('rated_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }
};
