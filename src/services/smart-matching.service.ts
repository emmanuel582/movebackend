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
        return 0.1;
    },

    /**
     * Calculate time proximity score (0-1) for same-day matches
     * Prioritizes trips close to the requested time
     */
    calculateTimeProximity(time1: string, time2: string): number {
        if (!time1 || !time2) return 0.5; // Neutral if no time specified

        try {
            // Parse "HH:MM" or "HH:MM:SS"
            const [h1, m1] = time1.split(':').map(Number);
            const [h2, m2] = time2.split(':').map(Number);

            const minutes1 = h1 * 60 + m1;
            const minutes2 = h2 * 60 + m2;

            const diffMinutes = Math.abs(minutes1 - minutes2);

            // Perfect match or very close (< 30 mins)
            if (diffMinutes <= 30) return 1.0;

            // Within 2 hours (120 mins) -> High relevance
            if (diffMinutes <= 120) return 0.9;

            // Within 4 hours -> Medium relevance
            if (diffMinutes <= 240) return 0.7;

            // Rest of the day -> Lower relevance but still shown
            return Math.max(0.3, 1.0 - (diffMinutes / (24 * 60)));
        } catch (e) {
            return 0.5;
        }
    },

    /**
     * Check if package size fits in available space
     */
    checkSpaceCompatibility(packageSize: string, availableSpace: string): { fits: boolean; score: number } {
        const sizeMap: Record<string, number> = { 'small': 1, 'medium': 2, 'large': 3 };
        const pkgSize = sizeMap[packageSize?.toLowerCase()] || 1;
        const space = sizeMap[availableSpace?.toLowerCase()] || 1;

        if (pkgSize <= space) {
            // Perfect fit gets highest score (1.0)
            // Larger spaces get slightly lower scores to prioritize "tightest fit" or "exact match"
            // e.g., Small in Small (1.0) > Small in Large (0.8)
            const diff = space - pkgSize; // 0, 1, or 2
            return { fits: true, score: 1.0 - (diff * 0.1) };
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
        time?: string;
        space?: string;
        verifiedOnly?: boolean;
    }): Promise<TripSearchResult[]> {
        // Cache for geocoding to avoid rate limits during loop
        console.log('[Matching] smartSearchTrips called with filters:', JSON.stringify(filters));
        const geoCache: Record<string, any> = {};
        const { GeospatialService } = require('./geospatial.service');

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
        console.log(`[Matching] Found ${trips?.length || 0} active trips`);
        if (error || !trips) return [];

        // Pre-geocode user query if provided
        let searchOriginCoords: any = null;
        let searchDestCoords: any = null;

        if (filters.origin) {
            searchOriginCoords = await GeospatialService.geocode(filters.origin);
            console.log(`[Matching] Search Origin (${filters.origin}) coords:`, searchOriginCoords?.coords);
        }
        if (filters.destination) {
            searchDestCoords = await GeospatialService.geocode(filters.destination);
            console.log(`[Matching] Search Destination (${filters.destination}) coords:`, searchDestCoords?.coords);
        }

        // Calculate relevance scores
        const scoredTrips = await Promise.all(trips.map(async (trip) => {
            let score = 0;
            const reasons: string[] = [];
            let maxScore = 0;

            // --- 1. String Matching (Basic) ---
            let stringMatchScore = 0;
            if (filters.origin) {
                const originSim = this.calculateStringSimilarity(trip.origin, filters.origin);
                stringMatchScore += originSim * 30;
                if (originSim >= 0.8) reasons.push(`Origin match: ${trip.origin}`);
            }
            if (filters.destination) {
                const destSim = this.calculateStringSimilarity(trip.destination, filters.destination);
                stringMatchScore += destSim * 30;
                if (destSim >= 0.8) reasons.push(`Destination match: ${trip.destination}`);
            }
            score += stringMatchScore;
            maxScore += 60; // Max possible for location strings

            // --- 2. Geospatial Route Matching (Advanced) ---
            // Only perform if string match wasn't perfect (i.e. stopover case)
            if ((filters.origin || filters.destination) && (searchOriginCoords || searchDestCoords)) {
                try {
                    // Geocode trip endpoints (Use cache if possible)
                    let tripOriginCoords = geoCache[trip.origin];
                    if (!tripOriginCoords) {
                        tripOriginCoords = await GeospatialService.geocode(trip.origin);
                        geoCache[trip.origin] = tripOriginCoords;
                    }

                    let tripDestCoords = geoCache[trip.destination];
                    if (!tripDestCoords) {
                        tripDestCoords = await GeospatialService.geocode(trip.destination);
                        geoCache[trip.destination] = tripDestCoords;
                    }

                    if (tripOriginCoords && tripDestCoords) {
                        // Get Trip Route
                        const routeGeometry = await GeospatialService.getRoute(tripOriginCoords.coords, tripDestCoords.coords);
                        console.log(`[Matching] Trip ${trip.id} route found:`, !!routeGeometry);

                        if (routeGeometry) {
                            // Check Origin Proximity
                            if (searchOriginCoords) {
                                const pt = require('@turf/turf').point([searchOriginCoords.coords.lng, searchOriginCoords.coords.lat]);
                                const line = require('@turf/turf').lineString(routeGeometry.coordinates);
                                const dist = require('@turf/turf').pointToLineDistance(pt, line, { units: 'kilometers' });
                                console.log(`[Matching] Dist from search origin (${filters.origin}) to route: ${dist.toFixed(2)}km`);

                                const isOriginOnRoute = dist <= 25; // Increase to 25km buffer for better flexibility
                                if (isOriginOnRoute) {
                                    const boost = 40; // High boost for route match
                                    if (!reasons.some(r => r.includes('Origin match'))) {
                                        score += boost;
                                        reasons.push(`Pickup point on route (${filters.origin})`);
                                    }
                                }
                            }

                            // Check Destination Proximity
                            if (searchDestCoords) {
                                const pt = require('@turf/turf').point([searchDestCoords.coords.lng, searchDestCoords.coords.lat]);
                                const line = require('@turf/turf').lineString(routeGeometry.coordinates);
                                const dist = require('@turf/turf').pointToLineDistance(pt, line, { units: 'kilometers' });
                                console.log(`[Matching] Dist from search dest (${filters.destination}) to route: ${dist.toFixed(2)}km`);

                                const isDestOnRoute = dist <= 25;
                                if (isDestOnRoute) {
                                    const boost = 40;
                                    if (!reasons.some(r => r.includes('Destination match'))) {
                                        score += boost;
                                        reasons.push(`Dropoff point on route (${filters.destination})`);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Geospatial check failed for trip', trip.id);
                }
            }


            // Date proximity (weight: 20%)
            if (filters.date) {
                maxScore += 20;
                const dateScoreVal = this.calculateDateProximity(trip.departure_date, filters.date);
                const dateScore = dateScoreVal * 20;
                score += dateScore;

                if (dateScore >= 15) reasons.push('Date within range');

                // Time proximity (weight: 20%) - Only relevant if date is close/same
                if (filters.time && dateScoreVal > 0.8) {
                    maxScore += 20;
                    const timeScoreVal = this.calculateTimeProximity(filters.time, trip.departure_time);
                    score += timeScoreVal * 20;
                    if (timeScoreVal >= 0.9) reasons.push('Success: Time match');
                }
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
            if (trip.users?.is_verified) {
                score += 5;
                reasons.push('Verified traveler');
            }

            // Normalize score? Since we add arbitrary boosts, let's cap it or just sort raw.
            // Let's normalize loosely to 100 for UI.
            // If Geospatial hit, score can go high.
            const totalMax = 100 + 80; // Rough max with boosts
            const normalizedScore = Math.min(100, Math.round((score / 100) * 100)); // Simply cap at 100%

            return {
                trip,
                relevanceScore: score > 30 ? Math.min(99, score) : score, // Raw score for sorting
                matchReasons: reasons
            };
        }));

        // Filter out very low scores (< 20%) and sort by relevance
        return scoredTrips
            .filter(r => r.relevanceScore >= 20 || r.matchReasons.length > 0)
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
