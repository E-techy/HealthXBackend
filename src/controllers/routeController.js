const { fetchGoogleRoute } = require('../services/googleRoutesHelper');

exports.calculateRoute = async (req, res) => {
    try {
        const { origin, destination, mapType } = req.body;

        // Basic validation
        if (!origin || !destination) {
            return res.status(400).json({
                success: false,
                dataType: 'ERROR',
                message: "Origin and destination are required."
            });
        }

        // Call the helper service to fetch the route
        const routeData = await fetchGoogleRoute(req.body);

        // Determine the type of data being sent back so the client can parse it properly
        let dataType = 'UNKNOWN';
        if (!routeData.routes || routeData.routes.length === 0) {
            dataType = 'NO_ROUTE_FOUND';
        } else if (routeData.routes.length === 1) {
            dataType = 'SUCCESS_SINGLE_ROUTE';
        } else if (routeData.routes.length > 1) {
            dataType = 'SUCCESS_MULTIPLE_ROUTES';
        }

        // Check for Fallback info (e.g., API couldn't use live traffic and fell back to static)
        if (routeData.fallbackInfo) {
            dataType = 'SUCCESS_FALLBACK_ROUTE';
        }

        // Send successful response
        res.status(200).json({
            success: true,
            dataType: dataType,
            clientMapType: mapType || 'DEFAULT', // Pass map type back to client for UI rendering logic
            data: routeData
        });

    } catch (error) {
        // Log the actual error internally for debugging
        console.error("🔥 Route API Error:", error.response?.data || error.message);

        // Send a sanitized, uniform error message to the client
        res.status(500).json({
            success: false,
            dataType: 'ERROR',
            message: "Unable to calculate route at this time. Please try again later."
        });
    }
};