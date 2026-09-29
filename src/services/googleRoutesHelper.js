const axios = require('axios');

const formatLocation = (loc) => {
    if (loc.placeId) return { placeId: loc.placeId };
    if (loc.latitude && loc.longitude) {
        return {
            location: {
                latLng: {
                    latitude: parseFloat(loc.latitude),
                    longitude: parseFloat(loc.longitude)
                }
            }
        };
    }
    if (loc.address) return { address: loc.address };
    throw new Error("Invalid location format provided.");
};

const buildFieldMask = (options) => {
    const baseFields = [
        'routes.distanceMeters',
        'routes.duration',
        'routes.staticDuration',
        'routes.polyline.encodedPolyline',
        'routes.routeLabels',
        'routes.warnings',
        'routes.description',
        'routes.legs.distanceMeters',
        'routes.legs.duration',
        'routes.legs.steps.navigationInstruction',
        'routes.legs.steps.polyline.encodedPolyline',
        'routes.legs.steps.distanceMeters',
        'routes.legs.steps.travelMode'
    ];

    if (options.travelMode === 'TRANSIT') {
        baseFields.push('routes.legs.steps.transitDetails');
    }
    if (options.extraComputations && options.extraComputations.includes('FUEL_CONSUMPTION')) {
        baseFields.push('routes.travelAdvisory.fuelConsumptionMicroliters');
    }

    return baseFields.join(',');
};

const fetchGoogleRoute = async (clientData) => {
    const apiKey = process.env.MAPS_ROUTES_API_KEY;
    if (!apiKey) throw new Error("MAPS_ROUTES_API_KEY is not configured in .env");

    const {
        origin, destination, travelMode = 'DRIVE', routingPreference,
        computeAlternativeRoutes = false, routeModifiers, languageCode = 'en-US',
        units = 'METRIC', requestedReferenceRoutes, extraComputations,
        trafficModel, transitPreferences
    } = clientData;

    // Base payload required for all requests
    const payload = {
        origin: formatLocation(origin),
        destination: formatLocation(destination),
        travelMode,
        computeAlternativeRoutes,
        languageCode,
        units
    };

    // STRICT GOOGLE API RULES: TRANSIT mode rejects certain properties
    if (travelMode === 'TRANSIT') {
        if (transitPreferences) payload.transitPreferences = transitPreferences;
    } else {
        // Safe to add for DRIVE, TWO_WHEELER, BICYCLE, WALK
        if (routingPreference) payload.routingPreference = routingPreference;
        if (routeModifiers && Object.keys(routeModifiers).length > 0) payload.routeModifiers = routeModifiers;
        if (trafficModel && routingPreference === 'TRAFFIC_AWARE_OPTIMAL') payload.trafficModel = trafficModel;
        if (requestedReferenceRoutes) payload.requestedReferenceRoutes = requestedReferenceRoutes;
        if (extraComputations) payload.extraComputations = extraComputations;
    }

    const fieldMask = buildFieldMask(clientData);

    try {
        const response = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': fieldMask
                }
            }
        );
        return response.data;
    } catch (error) {
        // Deep error extraction so we can actually see Google's complaints
        if (error.response && error.response.data) {
            console.error("❌ GOOGLE API REJECTED REQUEST:", JSON.stringify(error.response.data, null, 2));
            throw new Error(`Google API Error: ${error.response.data.error?.message || 'Check Server Logs'}`);
        }
        throw error; // Throw standard network errors
    }
};

module.exports = { fetchGoogleRoute };