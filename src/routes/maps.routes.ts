import express from 'express';
import { nearbyPlaces } from '../controllers/maps.controller';

const router = express.Router();

// Matches the path structure react-native-google-places-autocomplete expects if requestUrl is set to /api/maps
// Library appends /place/autocomplete/json
router.get('/place/autocomplete/json', nearbyPlaces);

export default router;
