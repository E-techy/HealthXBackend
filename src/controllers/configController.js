exports.getMapsApiKey = (req, res) => {
    try {
        const mapsApiKey = process.env.MAPS_JAVASCRIPT_API_KEY;

        if (!mapsApiKey) {
            console.error("⚠️ Maps API key is missing from environment variables.");
            return res.status(500).json({ 
                success: false, 
                message: "Configuration error on server." 
            });
        }

        res.status(200).json({
            success: true,
            data: {
                mapsApiKey: mapsApiKey
            }
        });
    } catch (error) {
        console.error("🔥 Error fetching Maps API key:", error.message);
        res.status(500).json({ 
            success: false, 
            message: "Server error while fetching configuration." 
        });
    }
};