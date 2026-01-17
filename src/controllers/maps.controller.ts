import { Request, Response } from 'express';
import axios from 'axios';

export const nearbyPlaces = async (req: Request, res: Response) => {
    try {
        const { input, types } = req.query;
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ status: 'error', message: 'Google Maps API Key not configured' });
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input,
                key: apiKey,
                types: types || '(cities)', // Default to cities
                language: 'en'
            }
        });

        res.json(response.data);
    } catch (error: any) {
        console.error('Google Maps API Error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch places' });
    }
};
