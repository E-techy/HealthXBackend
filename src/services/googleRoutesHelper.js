const axios = require('axios');

/**
 * Formats a location object from the client into the structure required by Google Routes API.
 * Supports Place ID, Coordinates (lat/lng), or Address Strings.
 */
const formatLocation = (loc) => {
    if (loc.placeId) {
        return { placeId: loc.placeId };
    }
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
    if (loc.address) {
        return { address: loc.address };
    }
    throw new Error("Invalid location format provided.");
};

/**
 * Builds the comprehensive X-Goog-FieldMask based on the requested features.
 */
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

    // Add transit specific fields if requested
    if (options.travelMode === 'TRANSIT') {
        baseFields.push('routes.legs.steps.transitDetails');
    }

    // Add fuel consumption fields if eco-friendly routing is requested
    if (options.extraComputations && options.extraComputations.includes('FUEL_CONSUMPTION')) {
        baseFields.push('routes.travelAdvisory.fuelConsumptionMicroliters');
    }

    return baseFields.join(',');
};

/**
 * Core function to communicate with Google Routes API.
 */
const fetchGoogleRoute = async (clientData) => {
    const apiKey = process.env.MAPS_ROUTES_API_KEY;
    if (!apiKey) throw new Error("Maps API key is not configured on the server.");

    const {
        origin,
        destination,
        travelMode = 'DRIVE',
        routingPreference = 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes = false,
        routeModifiers = {},
        languageCode = 'en-US',
        units = 'METRIC',
        requestedReferenceRoutes,
        extraComputations,
        trafficModel,
        transitPreferences
    } = clientData;

    // 1. Build Payload
    const payload = {
        origin: formatLocation(origin),
        destination: formatLocation(destination),
        travelMode,
        routingPreference,
        computeAlternativeRoutes,
        routeModifiers,
        languageCode,
        units
    };

    // Add optional advanced features if provided by the client
    if (requestedReferenceRoutes) payload.requestedReferenceRoutes = requestedReferenceRoutes;
    if (extraComputations) payload.extraComputations = extraComputations;
    if (trafficModel && routingPreference === 'TRAFFIC_AWARE_OPTIMAL') payload.trafficModel = trafficModel;
    if (transitPreferences && travelMode === 'TRANSIT') payload.transitPreferences = transitPreferences;

    // 2. Build FieldMask
    const fieldMask = buildFieldMask(clientData);

    // 3. Execute Request
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
};

module.exports = {
    fetchGoogleRoute
};