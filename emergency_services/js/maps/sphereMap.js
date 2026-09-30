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

    async initMap(lat = 23.3441, lng = 85.3096) { // Default starting coords
        if (this.isInitialized) return;

        try {
            // Import the new 3D Maps library from Google
            const { Map3DElement } = await google.maps.importLibrary("maps3d");

            // Create the Photorealistic 3D Sphere Element
            this.map3D = new Map3DElement({
                center: { lat: lat, lng: lng, altitude: 800 }, // altitude in meters
                tilt: 60,       // Angle the camera to see 3D buildings
                heading: 0,
                defaultLabelsDisabled: false // Keep street names visible
            });

            // Make it fill our container
            this.map3D.style.width = '100%';
            this.map3D.style.height = '100%';

            // Inject the 3D canvas into our DOM
            this.container.appendChild(this.map3D);
            this.isInitialized = true;
            
            console.log("🌍 3D Sphere Initialized");
        } catch (error) {
            console.error("Failed to load 3D Map. Check API key and Maps 3D API enablement.", error);
        }
    }

    showMap(data) {
        // Bring the 3D div to the front
        this.container.classList.remove('hidden');
        this.container.classList.add('active');
        
        // If it hasn't been built yet, build it now
        if (!this.isInitialized) {
            this.initMap(data?.lat, data?.lng);
        }
    }

    hideMap() {
        // Hide the 3D div
        this.container.classList.remove('active');
        this.container.classList.add('hidden');
    }

    updateLocation(data) {
        // If 3D map isn't active or built yet, ignore the GPS update
        if (!this.isInitialized || !this.map3D) return;
        
        // Smoothly fly the 3D camera to the new emergency location
        this.map3D.flyCameraTo({
            endCamera: {
                center: { lat: data.lat, lng: data.lng, altitude: 400 },
                tilt: 65,
                heading: data.heading || this.map3D.heading
            },
            durationMillis: 2000 // 2-second smooth flight animation
        });
    }
}

// Boot up the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.sphereMapEngine = new SphereMapController();
});