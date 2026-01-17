import axios from 'axios';
import * as turf from '@turf/turf';

interface Coordinates {
    lat: number;
    lng: number;
}

interface PlaceResult {
    name: string;
    coords: Coordinates;
}

export const GeospatialService = {
    /**
     * Geocode an address string to coordinates using Nominatim (OpenStreetMap)
     */
    async geocode(address: string): Promise<PlaceResult | null> {
        try {
            // Respect Nominatim Usage Policy: User-Agent is required
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: address,
                    format: 'json',
                    limit: 1,
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'MoveVer-App/1.0' // Required by OSM
                }
            });

            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                return {
                    name: result.display_name,
                    coords: {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon)
                    }
                };
            }
            return null;
        } catch (error) {
            console.warn('[Geospatial] Geocoding failed:', error);
            return null;
        }
    },

    /**
     * Get route geometry between two points using OSRM
     */
    async getRoute(start: Coordinates, end: Coordinates): Promise<any> {
        try {
            // OSRM requires "lon,lat"
            const url = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

            const response = await axios.get(url);

            if (response.data && response.data.routes && response.data.routes.length > 0) {
                return response.data.routes[0].geometry; // GeoJSON LineString
            }
            return null;
        } catch (error) {
            console.warn('[Geospatial] Routing failed:', error);
            return null;
        }
    },

    /**
     * Check if a point is near a route (e.g. within 10km)
     */
    isPointNearRoute(point: Coordinates, routeGeometry: any, maxDistKm: number = 10): boolean {
        if (!routeGeometry) return false;

        const pt = turf.point([point.lng, point.lat]);
        const line = turf.lineString(routeGeometry.coordinates);

        const distance = turf.pointToLineDistance(pt, line, { units: 'kilometers' });

        return distance <= maxDistKm;
    }
};
