/**
 * GPS Tracker Service
 * Handles fetching device location with race-condition safeguards.
 */
class GpsTracker {
    constructor() {
        console.log("📡 [GpsTracker] Service ready.");
        this.activeRequests = new Map(); // Track active requests to prevent sync issues
    }

    /**
     * Fetches current GPS location.
     * @param {String} requesterId - The ID of the UI element requesting GPS (e.g., 'origin')
     * @returns {Promise<{lat: Number, lng: Number}>}
     */
    async getCurrentLocation(requesterId) {
        // Generate a unique token for this specific request
        const requestToken = Date.now();
        this.activeRequests.set(requesterId, requestToken);

        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser."));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // RACE CONDITION CHECK: 
                    // If the token has changed (e.g. user typed or clicked clear), discard this result.
                    if (this.activeRequests.get(requesterId) !== requestToken) {
                        console.warn(`[GpsTracker] Stale GPS request for ${requesterId} discarded.`);
                        reject(new Error("ABORTED_BY_USER"));
                        return;
                    }

                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }

    /**
     * Cancels any pending GPS request for a specific UI node.
     * Call this when the user types in the input or clears the field.
     * @param {String} requesterId 
     */
    cancelRequest(requesterId) {
        if (this.activeRequests.has(requesterId)) {
            this.activeRequests.delete(requesterId);
        }
    }
}

window.gpsTracker = new GpsTracker();
