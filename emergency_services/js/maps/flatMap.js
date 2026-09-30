class FlatMapController {
    constructor() {
        this.container = document.getElementById('flat-map-view');
        this.map2D = null;
        this.isInitialized = false;

        // Listen to the walkie-talkie
        if (window.EventBus) {
            window.EventBus.on('switch_to_2d', this.showMap.bind(this));
            window.EventBus.on('switch_to_3d', this.hideMap.bind(this));
            window.EventBus.on('change_tile_layer', this.changeLayer.bind(this));
            window.EventBus.on('update_location', this.updateLocation.bind(this));
        }

        // Initialize immediately because 2D is the default view on load
        this.initMap();
    }

    async initMap(lat = 23.3441, lng = 85.3096) { // Defaulting to Ranchi region
        if (this.isInitialized) return;

        try {
            // 1. Wait for secure API key load
            await window.mapLoader.loadGoogleMaps();

            // 2. Import standard Maps library
            const { Map } = await google.maps.importLibrary("maps");

            // 3. Create the Map
            this.map2D = new Map(this.container, {
                center: { lat: lat, lng: lng },
                zoom: 13,
                mapTypeId: 'roadmap',
                styles: window.tileManager.getStyleForLayer('roadmap'), // Apply tactical theme
                disableDefaultUI: true, // Hides Google's default buttons for a cleaner UI
                zoomControl: true,      // Keep zoom buttons
                mapTypeControl: false   // We use our custom UI for this
            });

            this.isInitialized = true;
            console.log("🗺️ 2D Flat Map Initialized");

        } catch (error) {
            console.error("🔥 Failed to init 2D map. Are we authenticated?", error);
        }
    }

    showMap() {
        this.container.classList.remove('hidden');
        this.container.classList.add('active');
    }

    hideMap() {
        this.container.classList.remove('active');
        this.container.classList.add('hidden');
    }

    changeLayer(data) {
        if (!this.isInitialized || !this.map2D) return;
        
        const layerType = data.layerType; // 'roadmap', 'satellite', 'terrain', 'hybrid'
        
        // Change the base imagery type
        this.map2D.setMapTypeId(layerType);
        
        // Re-apply styles (removes dark mode if satellite, adds it back if roadmap)
        this.map2D.setOptions({
            styles: window.tileManager.getStyleForLayer(layerType)
        });
    }

    updateLocation(data) {
        if (!this.isInitialized || !this.map2D) return;
        
        // Smoothly pan the 2D map to the new emergency coordinates
        this.map2D.panTo({ lat: data.lat, lng: data.lng });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flatMapEngine = new FlatMapController();
});