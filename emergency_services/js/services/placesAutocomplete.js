/**
 * PlacesAutocompleteService
 * 
 * Upgraded to use the Google Maps Places API (New) Web Components.
 * This service directly interfaces with the MarkerManager.
 * 
 * Logic Flow:
 * 1. Attaches <gmp-place-autocomplete> to the DOM.
 * 2. On Selection: Fetches coordinates, address, and placeId.
 * 3. Checks for `data-marker-id` on the element.
 *    -> If missing: Creates a new marker via MarkerManager & saves the ID.
 *    -> If present: Updates the existing marker's location, address, and label.
 * 4. On Clear: If the input is emptied, it reads the ID and deletes the marker.
 */
class PlacesAutocompleteService {
    constructor() {
        this.PlaceAutocompleteElement = null;
        this.instances = new Map(); // Store active UI instances to prevent duplicate bindings
    }

    /**
     * Initializes the new Places library asynchronously.
     */
    async initLibrary() {
        if (!this.PlaceAutocompleteElement) {
            try {
                const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
                this.PlaceAutocompleteElement = PlaceAutocompleteElement;
                console.log("🏙️ [PlacesService] Google Places API (New) Loaded.");
            } catch (error) {
                console.error("❌ [PlacesService] Failed to load Google Places API:", error);
            }
        }
    }

    /**
     * Transforms a standard text input into a Google Places Autocomplete component,
     * and binds the automated marker creation/updating logic.
     * 
     * @param {HTMLElement} inputElement - The base HTML input element to replace.
     * @returns {HTMLElement|null} - The newly created Web Component.
     */
    async attachToInput(inputElement) {
        if (!inputElement || !inputElement.id) return null;

        await this.initLibrary();
        if (!this.PlaceAutocompleteElement) return null;

        const id = inputElement.id;
        
        // Derive the logical point type (e.g., 'origin', 'destination', 'cp_1') from the input ID
        const pointType = id.replace('input-', ''); 

        // Prevent attaching multiple times to the same element
        if (this.instances.has(id)) {
            return this.instances.get(id);
        }

        // 1. Create the New API Web Component
        const autocompleteEl = new this.PlaceAutocompleteElement();
        autocompleteEl.id = id;
        autocompleteEl.className = inputElement.className;
        
        // Port the placeholder text over
        if (inputElement.placeholder) {
            autocompleteEl.setAttribute('placeholder', inputElement.placeholder);
        }

        // 2. Replace the old input in the DOM
        inputElement.replaceWith(autocompleteEl);
        this.instances.set(id, autocompleteEl);

        // ==========================================
        // 3. EVENT: USER SELECTS A PLACE FROM DROPDOWN
        // ==========================================
        autocompleteEl.addEventListener('gmp-select', async (event) => {
            const prediction = event.placePrediction;
            if (!prediction) return;

            try {
                // Convert prediction to a Place object
                const place = prediction.toPlace();
                
                // 💰 Fetch only the data we strictly need (Saves API costs)
                await place.fetchFields({
                    fields: ['id', 'displayName', 'formattedAddress', 'location']
                });

                if (!place.location) return;

                // Extract cleaned data
                const lat = place.location.lat();
                const lng = place.location.lng();
                const address = place.formattedAddress || place.displayName;
                const placeId = place.id;
                const name = place.displayName || "Selected Location";

                // Check if this UI element already has an attached Marker ID
                let markerId = autocompleteEl.getAttribute('data-marker-id');

                if (!markerId) {
                    // --- SCENARIO A: NO MARKER EXISTS ---
                    // Use the pointType (e.g. 'origin') as the unique marker ID
                    markerId = pointType; 
                    
                    // Create it using the MarkerManager
                    await window.markerManager.addMarker({
                        id: markerId,
                        lat: lat,
                        lng: lng,
                        label: name,
                        address: address,
                        placeId: placeId,
                        isOrigin: markerId === 'origin',
                        isDestination: markerId === 'destination'
                    });

                    // Tag the UI element so we know a marker exists for it now
                    autocompleteEl.setAttribute('data-marker-id', markerId);
                    
                } else {
                    // --- SCENARIO B: MARKER ALREADY EXISTS ---
                    // Update GPS, Address, and Place ID simultaneously
                    await window.markerManager.setMarkerLocationAndPlace(markerId, lat, lng, placeId, address);
                    
                    // Update the visual label
                    await window.markerManager.setMarkerLabel(markerId, name);
                }

                // Pan the map camera to the new location (listened to by 2D/3D map engines)
                if (window.EventBus) {
                    window.EventBus.emit('update_location', { lat, lng });
                }

            } catch (error) {
                console.error("❌ [PlacesService] Error processing place selection:", error);
            }
        });

        // ==========================================
        // 4. EVENT: USER CLEARS THE INPUT BOX
        // ==========================================
        autocompleteEl.addEventListener('input', async (e) => {
            // If the text is completely deleted
            if (e.target.value === '') {
                
                const markerId = autocompleteEl.getAttribute('data-marker-id');
                
                if (markerId) {
                    // Tell MarkerManager to delete the marker and recalculate sequences
                    await window.markerManager.deleteMarker(markerId);
                    
                    // Remove the tracking attribute so a fresh marker will be created next time
                    autocompleteEl.removeAttribute('data-marker-id');
                }
            }
        });

        return autocompleteEl;
    }

    /**
     * Completely destroys an instance (useful if UI rows are deleted dynamically)
     * @param {String} id - The ID of the input wrapper (e.g. 'input-cp_1')
     */
    destroy(id) {
        if (this.instances.has(id)) {
            const el = this.instances.get(id);
            el.remove();
            this.instances.delete(id);
        }
    }
}

// Ensure globally accessible for the rest of the application
window.placesAutocompleteService = new PlacesAutocompleteService();
