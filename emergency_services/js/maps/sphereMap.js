class SphereMapController {
    constructor() {
        this.container = document.getElementById('sphere-map-view');
        this.map3D = null;
        this.isInitialized = false;

        // Listen to the walkie-talkie (Event Bus)
        if (window.EventBus) {
            window.EventBus.on('switch_to_3d', this.showMap.bind(this));
            window.EventBus.on('switch_to_2d', this.hideMap.bind(this));
            window.EventBus.on('update_location', this.updateLocation.bind(this));
        }
    }

    async initMap(lat = 23.3441, lng = 85.3096, isRetry = false) {
        if (this.isInitialized) return;

        try {
            // 1. Wait for the secure loader to fetch the API key and inject the script
            await window.mapLoader.loadGoogleMaps(isRetry);

            // 2. Import the new 3D Maps library
            const { Map3DElement } = await google.maps.importLibrary("maps3d");

            // 3. Create the Photorealistic 3D Sphere Element
            this.map3D = new Map3DElement({
                center: { lat: lat, lng: lng, altitude: 800 }, 
                tilt: 60,
                heading: 0,
                defaultLabelsDisabled: false 
            });

            this.map3D.style.width = '100%';
            this.map3D.style.height = '100%';

            this.container.appendChild(this.map3D);
            this.isInitialized = true;
            
            console.log("🌍 3D Sphere Initialized Securely");

        } catch (error) {
            console.error("🔥 Failed to load 3D Map.", error);
            
            // If it fails on the first try (likely a bad API key), force a refresh from the server
            if (!isRetry) {
                console.warn("Retrying with a fresh API key...");
                await this.initMap(lat, lng, true);
            }
        }
    }

    showMap(data) {
        this.container.classList.remove('hidden');
        this.container.classList.add('active');
        
        // Lazy-load the map only when the user switches to 3D
        if (!this.isInitialized) {
            this.initMap(data?.lat, data?.lng);
        }
    }

    hideMap() {
        this.container.classList.remove('active');
        this.container.classList.add('hidden');
    }

    updateLocation(data) {
        if (!this.isInitialized || !this.map3D) return;
        
        // Smoothly fly the 3D camera
        this.map3D.flyCameraTo({
            endCamera: {
                center: { lat: data.lat, lng: data.lng, altitude: 400 },
                tilt: 65,
                heading: data.heading || this.map3D.heading
            },
            durationMillis: 2000
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sphereMapEngine = new SphereMapController();
});