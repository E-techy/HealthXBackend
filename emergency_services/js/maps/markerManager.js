/**
 * MarkerManager
 * 
 * A robust, state-driven manager for Google Maps Advanced Markers.
 * Maintains detailed metadata for every marker including sequence numbering,
 * origin/destination flags, place IDs, and custom icon assets.
 * 
 * Data Structure per Marker:
 * {
 *    id: String (Unique identifier)
 *    label: String (Display name or title)
 *    iconName: String (Name of the icon)
 *    iconUrl: String (URL for the image/icon)
 *    lat: Number (Latitude)
 *    lng: Number (Longitude)
 *    address: String|null (Address from Places API)
 *    description: String (Inner details/notes)
 *    sequence: Number (Position order, mainly for checkpoints)
 *    isOrigin: Boolean (Is this the starting point?)
 *    isDestination: Boolean (Is this the ending point?)
 *    placeId: String|null (Google Place ID)
 *    gMarker: AdvancedMarkerElement (The actual Google Maps map instance)
 * }
 */
class MarkerManager {
    constructor() {
        // Map to store all active markers using their ID as the key
        this.markers = new Map();
        
        // Google Maps classes (lazy loaded)
        this.AdvancedMarkerElement = null;
        this.PinElement = null;

        // Default icon settings
        this.DEFAULT_ICON_NAME = "default_pin";
        this.DEFAULT_ICON_URL = "https://maps.gstatic.com/mapfiles/transparent.png"; // Fallback transparent/default

        // Allowed browser-supported image formats
        this.ALLOWED_IMAGE_FORMATS = /\.(jpeg|jpg|gif|png|svg|webp)$/i;
    }

    /**
     * Initializes required Google Maps libraries asynchronously.
     * Prevents UI blocking during initialization.
     */
    async initGoogleLibraries() {
        try {
            if (!this.AdvancedMarkerElement) {
                const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
                this.AdvancedMarkerElement = AdvancedMarkerElement;
                this.PinElement = PinElement;
            }
        } catch (error) {
            console.error("❌ [MarkerManager] Failed to load Google Maps libraries:", error);
        }
    }

    /**
     * Validates if the provided URL is a browser-supported image format.
     * @param {string} url - The image URL to test.
     * @returns {boolean} - True if valid, false otherwise.
     */
    isValidImageUrl(url) {
        if (!url) return false;
        // Allow base64 encoded images or standard file extensions
        if (url.startsWith('data:image/')) return true;
        
        // Strip query parameters for extension checking
        const urlWithoutQuery = url.split('?')[0]; 
        return this.ALLOWED_IMAGE_FORMATS.test(urlWithoutQuery);
    }

    /**
     * Creates and adds a new marker to the map and state.
     * 
     * @param {Object} data - The marker configuration data.
     * @param {String} data.id - REQUIRED: Unique identifier.
     * @param {Number} data.lat - REQUIRED: Latitude.
     * @param {Number} data.lng - REQUIRED: Longitude.
     * @param {String} [data.label=""] - Display label.
     * @param {String} [data.iconName] - Name of the icon.
     * @param {String} [data.iconUrl] - URL of the icon.
     * @param {String} [data.address=null] - Formatted address.
     * @param {String} [data.description=""] - Detailed notes.
     * @param {Boolean} [data.isOrigin=false] - Flag for origin point.
     * @param {Boolean} [data.isDestination=false] - Flag for destination point.
     * @param {String} [data.placeId=null] - Google Maps Place ID.
     * 
     * @returns {Object|null} - The created marker data object or null if failed.
     */
    async addMarker(data) {
        try {
            if (!data.id || data.lat === undefined || data.lng === undefined) {
                throw new Error("Missing required fields: id, lat, or lng.");
            }

            await this.initGoogleLibraries();

            // Handle Icon Validation
            let finalIconUrl = this.DEFAULT_ICON_URL;
            if (data.iconUrl && this.isValidImageUrl(data.iconUrl)) {
                finalIconUrl = data.iconUrl;
            } else if (data.iconUrl) {
                console.warn(`⚠️ [MarkerManager] Invalid image format for marker ${data.id}. Using default.`);
            }

            // Create the HTML Element for the AdvancedMarker
            // (You can customize this DOM structure based on your CSS UI needs)
            const markerContent = document.createElement('div');
            markerContent.className = 'custom-map-marker';
            markerContent.innerHTML = `
                <img src="${finalIconUrl}" alt="${data.iconName || this.DEFAULT_ICON_NAME}" class="marker-icon"/>
                <div class="marker-label">${data.label || ''}</div>
            `;

            // Initialize the Google Maps Advanced Marker
            const gMarker = new this.AdvancedMarkerElement({
                map: window.flatMapEngine ? window.flatMapEngine.map2D : null, // Fallback safely if map engine isn't ready
                position: { lat: data.lat, lng: data.lng },
                content: markerContent,
                title: data.label || data.id,
                gmpDraggable: true // Allow dragging by default
            });

            // Construct the final State Object
            const markerState = {
                id: data.id,
                label: data.label || "",
                iconName: data.iconName || this.DEFAULT_ICON_NAME,
                iconUrl: finalIconUrl,
                lat: data.lat,
                lng: data.lng,
                address: data.address || null,
                description: data.description || "",
                sequence: 0, // Will be calculated below
                isOrigin: !!data.isOrigin, // Force boolean
                isDestination: !!data.isDestination, // Force boolean
                placeId: data.placeId || null,
                gMarker: gMarker
            };

            // Bind Drag Event to handle GPS changes explicitly
            gMarker.addEventListener('gmp-dragend', async () => {
                const newLat = gMarker.position.lat;
                const newLng = gMarker.position.lng;
                
                // When dragged, old address and placeId are no longer valid. Set them to null.
                await this.setMarkerLocationAndPlace(data.id, newLat, newLng, null, null);
            });

            // Store in our Map dictionary
            this.markers.set(data.id, markerState);

            // Re-calculate sequences for checkpoints
            await this.updateSequence();

            return markerState;

        } catch (error) {
            console.error(`❌ [MarkerManager] Error creating marker ${data?.id}:`, error);
            return null;
        }
    }

    /**
     * Updates the text label of a specific marker.
     * 
     * @param {String} id - The ID of the marker.
     * @param {String} newLabel - The new label text.
     */
    async setMarkerLabel(id, newLabel) {
        try {
            const marker = this.markers.get(id);
            if (!marker) throw new Error(`Marker ${id} not found.`);

            marker.label = newLabel;
            
            // Update DOM element directly
            const labelEl = marker.gMarker.content.querySelector('.marker-label');
            if (labelEl) labelEl.textContent = newLabel;
            
            // Update native tooltip
            marker.gMarker.title = newLabel;

        } catch (error) {
            console.error(`❌ [MarkerManager] Error setting label for ${id}:`, error);
        }
    }

    /**
     * Updates the icon image of a specific marker.
     * 
     * @param {String} id - The ID of the marker.
     * @param {String} iconName - The name of the icon.
     * @param {String} iconUrl - The URL of the valid image format.
     */
    async setMarkerIcon(id, iconName, iconUrl) {
        try {
            const marker = this.markers.get(id);
            if (!marker) throw new Error(`Marker ${id} not found.`);

            if (!this.isValidImageUrl(iconUrl)) {
                throw new Error("Invalid image format. Must be a browser-supported image (png, jpg, svg, etc.)");
            }

            marker.iconName = iconName;
            marker.iconUrl = iconUrl;

            // Update DOM element directly
            const imgEl = marker.gMarker.content.querySelector('.marker-icon');
            if (imgEl) {
                imgEl.src = iconUrl;
                imgEl.alt = iconName;
            }
        } catch (error) {
            console.error(`❌ [MarkerManager] Error setting icon for ${id}:`, error);
        }
    }

    /**
     * Updates the GPS coordinates, Place ID, and Address simultaneously.
     * Because a new location represents a new place, they must update together.
     * 
     * @param {String} id - The ID of the marker.
     * @param {Number} lat - New Latitude.
     * @param {Number} lng - New Longitude.
     * @param {String|null} [placeId=null] - New Google Place ID (null if dragged/unknown).
     * @param {String|null} [address=null] - New formatted address (null if dragged/unknown).
     */
    async setMarkerLocationAndPlace(id, lat, lng, placeId = null, address = null) {
        try {
            const marker = this.markers.get(id);
            if (!marker) throw new Error(`Marker ${id} not found.`);

            // Update State
            marker.lat = lat;
            marker.lng = lng;
            marker.placeId = placeId;
            marker.address = address;

            // Update Map Instance Position
            marker.gMarker.position = { lat, lng };

            // Emit an event so other UI components (like the address bar) can react to the cleared address
            if (window.EventBus) {
                window.EventBus.emit('marker_location_changed', {
                    id: marker.id,
                    lat: marker.lat,
                    lng: marker.lng,
                    placeId: marker.placeId,
                    address: marker.address
                });
            }
            
        } catch (error) {
            console.error(`❌ [MarkerManager] Error setting location for ${id}:`, error);
        }
    }

    /**
     * Updates the internal detailed description of a marker.
     * 
     * @param {String} id - The ID of the marker.
     * @param {String} description - The detailed notes.
     */
    async setMarkerDescription(id, description) {
        try {
            const marker = this.markers.get(id);
            if (!marker) throw new Error(`Marker ${id} not found.`);

            marker.description = description;
        } catch (error) {
            console.error(`❌ [MarkerManager] Error setting description for ${id}:`, error);
        }
    }

    /**
     * Deletes a marker from the map, removes its state, 
     * and automatically triggers a sequence recalculation.
     * 
     * @param {String} id - The ID of the marker to delete.
     */
    async deleteMarker(id) {
        try {
            const marker = this.markers.get(id);
            if (!marker) return; // Silent fail if already gone

            // Remove from Google Maps UI
            if (marker.gMarker) {
                marker.gMarker.map = null;
            }

            // Remove from internal state Dictionary
            this.markers.delete(id);

            // Recalculate numbering for remaining checkpoints
            await this.updateSequence();

        } catch (error) {
            console.error(`❌ [MarkerManager] Error deleting marker ${id}:`, error);
        }
    }

    /**
     * Recalculates the sequence numbering for all markers.
     * Ignores Origins and Destinations. Only increments for standard checkpoints.
     * This is called automatically on add and delete.
     */
    async updateSequence() {
        try {
            let currentSequence = 1;

            for (let [id, marker] of this.markers.entries()) {
                // Skip Origin and Destination from sequential numbering
                if (marker.isOrigin || marker.isDestination) {
                    marker.sequence = 0;
                    continue;
                }

                // Assign sequence and increment
                marker.sequence = currentSequence;
                
                // Optionally update a DOM bubble inside the marker to show the number visually
                const seqBubble = marker.gMarker.content.querySelector('.seq-num-bubble');
                if (seqBubble) {
                    seqBubble.textContent = currentSequence;
                }

                currentSequence++;
            }
        } catch (error) {
            console.error(`❌ [MarkerManager] Error updating sequences:`, error);
        }
    }

    /**
     * Retrieves a marker's full data object by ID.
     * @param {String} id 
     * @returns {Object|null}
     */
    getMarker(id) {
        return this.markers.get(id) || null;
    }

    /**
     * Returns an array of all active marker data objects.
     * Useful for sending data to the routing engine.
     * @returns {Array<Object>}
     */
    getAllMarkers() {
        return Array.from(this.markers.values());
    }

    /**
     * Wipes all markers from the map and state.
     */
    async clearAllMarkers() {
        try {
            for (let id of this.markers.keys()) {
                await this.deleteMarker(id);
            }
        } catch (error) {
            console.error(`❌ [MarkerManager] Error clearing all markers:`, error);
        }
    }
}

// Ensure the class can be instantiated safely in the window scope
window.MarkerManager = MarkerManager;
