/**
 * ApiConfigService
 * 
 * Centralized service to manage authentication tokens and fetch API keys 
 * securely from the backend. Uses sessionStorage to minimize network calls.
 */
class ApiConfigService {
    constructor() {
        this.MAPS_KEY_STORAGE_ID = 'mapsApiKey';
        this.AUTH_COOKIE_NAME = 'healthx_auth';
    }

    // Helper to get the JWT token from cookies
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Securely fetch the Maps API key from the backend
    async getMapsApiKey(forceRefresh = false) {
        let key = sessionStorage.getItem(this.MAPS_KEY_STORAGE_ID);
        
        // Return cached key if it exists and we aren't forcing a refresh
        if (key && !forceRefresh) {
            return key;
        }

        const token = this.getCookie(this.AUTH_COOKIE_NAME);
        if (!token) {
            throw new Error("Authentication required to fetch Maps API key.");
        }

        console.log("🔐 [ApiConfig] Fetching new Maps API Key from server...");
        
        try {
            const response = await fetch('/api/config/maps-key', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success && data.data.mapsApiKey) {
                // Cache it for the session
                sessionStorage.setItem(this.MAPS_KEY_STORAGE_ID, data.data.mapsApiKey);
                return data.data.mapsApiKey;
            } else {
                throw new Error(data.message || "Failed to fetch Maps API key from backend.");
            }
        } catch (error) {
            console.error("❌ [ApiConfig] Network/Auth error while fetching key:", error);
            throw error;
        }
    }
}

// Make it globally available for mapLoader (and any other future services)
window.apiConfigService = new ApiConfigService();
