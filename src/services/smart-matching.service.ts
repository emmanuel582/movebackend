import { supabase } from '../config/supabase';

interface TripSearchResult {
    trip: any;
    relevanceScore: number;
    matchReasons: string[];
}

export const SmartMatchingService = {
    /**
     * Calculate similarity between two strings (0-1, higher is better)
     * Uses Levenshtein distance for fuzzy matching
     */
    calculateStringSimilarity(str1: string, str2: string): number {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        // Exact match
        if (s1 === s2) return 1.0;

        // Contains match
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;

        // Common prefix
        let commonPrefix = 0;
        const minLen = Math.min(s1.length, s2.length);
        for (let i = 0; i < minLen; i++) {
            if (s1[i] === s2[i]) commonPrefix++;
            else break;
        }
        if (commonPrefix > 0) return 0.5 + (commonPrefix / Math.max(s1.length, s2.length)) * 0.3;

        // Levenshtein distance
        const matrix: number[][] = [];
        for (let i = 0; i <= s1.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s2.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= s1.length; i++) {
            for (let j = 1; j <= s2.length; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const distance = matrix[s1.length][s2.length];
        const maxLen = Math.max(s1.length, s2.length);
        return 1 - (distance / maxLen);
    },

    /**
     * Calculate date proximity score (0-1, higher is better)
     */
    calculateDateProximity(date1: string, date2: string, flexDays: number = 3): number {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 1.0;
        if (diffDays <= flexDays) return 1.0 - (diffDays / (flexDays * 2));
        return 0.1; // Still show but with low score
    },

    /**
     * Check if package size fits in available space
     */
    checkSpaceCompatibility(packageSize: string, availableSpace: string): { fits: boolean; score: number } {
        const sizeMap: Record<string, number> = { 'small': 1, 'medium': 2, 'large': 3 };
        const pkgSize = sizeMap[packageSize?.toLowerCase()] || 1;
        const space = sizeMap[availableSpace?.toLowerCase()] || 1;

        if (pkgSize <= space) {
            // Perfect fit gets higher score
            const perfectFit = pkgSize === space;
            return { fits: true, score: perfectFit ? 1.0 : 0.8 };
        }
        return { fits: false, score: 0 };
    },

    /**
     * Smart search for trips matching delivery request
     */
    async smartSearchTrips(filters: {
        origin?: string;
        destination?: string;
        date?: string;
        space?: string;
        verifiedOnly?: boolean;
    }): Promise<TripSearchResult[]> {
        // Fetch all active trips with user info
        let query = supabase
            .from('trips')
            .select(`
                *,
                users (full_name, is_verified, id)
            `)
            .eq('status', 'active');

        // Apply verified filter if requested
        if (filters.verifiedOnly) {
            query = query.eq('users.is_verified', true);
        }

        const { data: trips, error } = await query;
        if (error || !trips) return [];

        // Calculate relevance scores
        const results: TripSearchResult[] = trips.map(trip => {
            let score = 0;
            const reasons: string[] = [];
            let maxScore = 0;

            // Origin matching (weight: 30%)
            if (filters.origin) {
                maxScore += 30;
                const originSimilarity = this.calculateStringSimilarity(trip.origin, filters.origin);
                const originScore = originSimilarity * 30;
                score += originScore;
                if (originSimilarity >= 0.8) reasons.push(`Origin match: ${trip.origin}`);
            }

            // Destination matching (weight: 30%)
            if (filters.destination) {
                maxScore += 30;
                const destSimilarity = this.calculateStringSimilarity(trip.destination, filters.destination);
                const destScore = destSimilarity * 30;
                score += destScore;
                if (destSimilarity >= 0.8) reasons.push(`Destination match: ${trip.destination}`);
            }

            // Date proximity (weight: 20%)
            if (filters.date) {
                maxScore += 20;
                const dateScore = this.calculateDateProximity(trip.departure_date, filters.date) * 20;
                score += dateScore;
                if (dateScore >= 15) reasons.push('Date within range');
            }

            // Space compatibility (weight: 10%)
            if (filters.space) {
                maxScore += 10;
                const spaceCheck = this.checkSpaceCompatibility(filters.space, trip.available_space);
                if (spaceCheck.fits) {
                    score += spaceCheck.score * 10;
                    reasons.push(`Space: ${trip.available_space}`);
                }
            }

            // User verification bonus (weight: 5%)
            maxScore += 5;
            if (trip.users?.is_verified) {
                score += 5;
                reasons.push('Verified traveler');
            }

            // User rating bonus (weight: 5%) - placeholder for now
            maxScore += 5;
            // TODO: Fetch actual ratings when available
            score += 2.5; // Assume average rating

            // Normalize score to 0-100
            const normalizedScore = maxScore > 0 ? (score / maxScore) * 100 : 0;

            return {
                trip,
                relevanceScore: Math.round(normalizedScore * 10) / 10,
                matchReasons: reasons
            };
        });

        // Filter out very low scores (< 20%) and sort by relevance
        return results
            .filter(r => r.relevanceScore >= 20)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    },

    /**
     * Find potential delivery requests for a trip
     */
    async findMatchesForTrip(tripId: string): Promise<any[]> {
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();

        if (tripError || !trip) throw new Error('Trip not found');

        // Use smart search to find compatible requests
        const { data: requests, error } = await supabase
            .from('delivery_requests')
            .select(`
                *,
                users (full_name, id, is_verified)
            `)
            .eq('status', 'pending');

        if (error || !requests) return [];

        // Score each request
        const scoredRequests = requests.map(req => {
            let score = 0;
            const reasons: string[] = [];

            // Location matching
            const originSim = this.calculateStringSimilarity(req.origin, trip.origin);
            const destSim = this.calculateStringSimilarity(req.destination, trip.destination);
            score += (originSim + destSim) * 40;

            if (originSim >= 0.8) reasons.push('Origin match');
            if (destSim >= 0.8) reasons.push('Destination match');

            // Date matching
            if (req.delivery_date) {
                const dateScore = this.calculateDateProximity(req.delivery_date, trip.departure_date);
                score += dateScore * 20;
                if (dateScore >= 0.7) reasons.push('Date compatible');
            }

            // Space compatibility
            const spaceCheck = this.checkSpaceCompatibility(req.package_size, trip.available_space);
            if (spaceCheck.fits) {
                score += spaceCheck.score * 20;
                reasons.push('Package fits');
            } else {
                score = 0; // Disqualify if doesn't fit
            }

            // Verified user bonus
            if (req.users?.is_verified) {
                score += 10;
                reasons.push('Verified business');
            }

            return { ...req, relevanceScore: score, matchReasons: reasons };
        });

        return scoredRequests
            .filter(r => r.relevanceScore >= 30)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
};
