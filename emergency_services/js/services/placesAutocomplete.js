class PlacesAutocompleteService {
    constructor() {
        this.PlaceAutocompleteElement = null;
        this.activeInstances = new Map();
    }

    // Lazy load the Places API (New)
    async initLibrary() {
        if (!this.PlaceAutocompleteElement) {
            try {
                // Request the new PlaceAutocompleteElement from the places library
                const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
                this.PlaceAutocompleteElement = PlaceAutocompleteElement;
                console.log("🏙️ Google Places API (New) Loaded - Web Component Ready");
            } catch (error) {
                console.error("Failed to load Google Places API.", error);
            }
        }
    }

    /**
     * Attaches the new Google Places Autocomplete API to a specific input field.
     * Replaces the legacy <input> with the new <gmp-place-autocomplete> web component.
     * @param {HTMLElement} inputElement - The HTML input to replace.
     * @param {Function} onPlaceSelected - Callback function(lat, lng, displayName)
     * @returns {HTMLElement} The new autocomplete element.
     */
    async attachToInput(inputElement, onPlaceSelected) {
        await this.initLibrary();

        // Fallback if library didn't load
        if (!this.PlaceAutocompleteElement) return inputElement;

        const inputId = inputElement.id;

        // Prevent attaching multiple listeners and replacing multiple times
        if (this.activeInstances.has(inputId)) {
            return document.getElementById(inputId);
        }

        // Create the new Places Autocomplete Element (Web Component)
        const autocompleteElement = new this.PlaceAutocompleteElement();
        
        // Migrate attributes and styling from the old element
        autocompleteElement.id = inputId;
        autocompleteElement.className = inputElement.className;
        
        if (inputElement.placeholder) {
            autocompleteElement.placeholder = inputElement.placeholder;
        }

        if (inputElement.hasAttribute('readonly')) {
            autocompleteElement.setAttribute('readonly', 'true');
        }

        // Replace the legacy input in the DOM with the New API Web Component
        inputElement.replaceWith(autocompleteElement);

        // The New API fires a 'gmp-select' event instead of 'place_changed'
        autocompleteElement.addEventListener('gmp-select', async ({ placePrediction }) => {
            if (!placePrediction) return;

            // Convert the raw prediction directly to a New Place object
            const place = placePrediction.toPlace();
            
            // 💰 NEW API BILLING FEATURE: Explicitly fetch only the fields you need
            await place.fetchFields({
                fields: ['displayName', 'formattedAddress', 'location']
            });
            
            if (place.location) {
                const lat = place.location.lat();
                const lng = place.location.lng();
                const displayName = place.displayName || place.formattedAddress;
                
                // Fire the callback with the cleanly extracted data
                onPlaceSelected({ lat, lng, displayName });
            }
        });

        // Store the instance using the ID
        this.activeInstances.set(inputId, autocompleteElement);
        
        return autocompleteElement; // Return the new DOM element
    }
}

// Make globally available for markerManager to use
window.placesAutocompleteService = new PlacesAutocompleteService();