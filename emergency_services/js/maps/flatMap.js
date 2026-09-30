class FlatMapController {
    constructor() {
        this.container = document.getElementById('flat-map-view');
        this.map2D = null;
        this.isInitialized = false;

        // Listen to the EventBus
        if (window.EventBus) {
            window.EventBus.on('switch_to_2d', this.showMap.bind(this));
            window.EventBus.on('switch_to_3d', this.hideMap.bind(this));
            window.EventBus.on('change_tile_layer', this.changeLayer.bind(this));
            window.EventBus.on('update_location', this.updateLocation.bind(this));
            window.EventBus.on('theme_changed', this.updateTheme.bind(this));
        }

        // Initialize immediately because 2D is the default view on load
        this.initMap();
    }

    // Wrap Geolocation in a Promise to await it cleanly
    async getUserLocation(defaultLat = 22.9, defaultLng = 78.2) { // Fallback to central India
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
                    () => resolve({ lat: defaultLat, lng: defaultLng }),
                    { timeout: 5000 } // Don't hang forever if location is slow
                );
            } else {
                resolve({ lat: defaultLat, lng: defaultLng });
            }
        });
    }

    async initMap() {
        if (this.isInitialized) return;

        try {
            // 1. Wait for secure API key load
            await window.mapLoader.loadGoogleMaps();

            // 2. Fetch User's Live Location
            const coords = await this.getUserLocation();

            // 3. Import standard Maps library
            const { Map } = await google.maps.importLibrary("maps");

            // 4. Create the Map
            this.map2D = new Map(this.container, {
                center: coords,
                zoom: 5, // Significantly zoomed out for a broader overview
                mapId: "DEMO_MAP_ID", // REQUIRED FOR ADVANCED MARKERS
                mapTypeId: 'roadmap',
                styles: window.tileManager.getStyleForLayer('roadmap'), 
                disableDefaultUI: true, 
                zoomControl: true,      
                mapTypeControl: false   
            });

            // 5. Setup Click Listener for Marker Placement
            this.map2D.addListener('click', (e) => {
                window.EventBus.emit('map_clicked', { lat: e.latLng.lat(), lng: e.latLng.lng() });
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

    updateTheme() {
        if (!this.isInitialized || !this.map2D) return;
        this.map2D.setOptions({
            styles: window.tileManager.getStyleForLayer(this.map2D.getMapTypeId())
        });
    }

    changeLayer(data) {
        if (!this.isInitialized || !this.map2D) return;
        
        const layerType = data.layerType;
        this.map2D.setMapTypeId(layerType);
        
        // Ensure theme is properly applied on layer change
        this.updateTheme();
    }

    updateLocation(data) {
        if (!this.isInitialized || !this.map2D) return;
        
        this.map2D.panTo({ lat: data.lat, lng: data.lng });
        this.map2D.setZoom(16); // Zoom in close when a specific emergency location is updated
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flatMapEngine = new FlatMapController();
});