class SphereMapController {
    constructor() {
        this.container = document.getElementById('sphere-map-view');
        this.map3D = null;
        this.isInitialized = false;

        if (window.EventBus) {
            window.EventBus.on('switch_to_3d', this.showMap.bind(this));
            window.EventBus.on('switch_to_2d', this.hideMap.bind(this));
            window.EventBus.on('update_location', this.updateLocation.bind(this));
            window.EventBus.on('change_tile_layer', this.changeLayer.bind(this));
        }
    }

    async getUserLocation(defaultLat = 22.9, defaultLng = 78.2) {
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
                    () => resolve({ lat: defaultLat, lng: defaultLng }),
                    { timeout: 5000 }
                );
            } else {
                resolve({ lat: defaultLat, lng: defaultLng });
            }
        });
    }

    async initMap(lat = null, lng = null, isRetry = false) {
        if (this.isInitialized) return;

        try {
            await window.mapLoader.loadGoogleMaps(isRetry);

            // Fetch live location if specific coordinates weren't passed
            let centerCoords = { lat, lng };
            if (lat === null || lng === null) {
                centerCoords = await this.getUserLocation();
            }

            const { Map3DElement } = await google.maps.importLibrary("maps3d");

            this.map3D = new Map3DElement({
                center: { lat: centerCoords.lat, lng: centerCoords.lng, altitude: 2500000 }, // 2,500km up for continent-level view
                tilt: 0, // Look straight down on load for a map-like feel
                heading: 0,
                mode: "HYBRID" 
            });

            this.map3D.style.width = '100%';
            this.map3D.style.height = '100%';

            this.container.appendChild(this.map3D);
            this.isInitialized = true;
            
            console.log("🌍 3D Sphere Initialized Securely");
            
            // Enable 3D Marker Placement Clicks
            this.map3D.addEventListener('gmp-click', (e) => {
                if(e.position) {
                    window.EventBus.emit('map_clicked', { lat: e.position.lat, lng: e.position.lng });
                }
            });               

        } catch (error) {
            console.error("🔥 Failed to load 3D Map.", error);
            
            if (!isRetry) {
                console.warn("Retrying with a fresh API key...");
                await this.initMap(lat, lng, true);
            }
        }
    }

    showMap(data) {
        this.container.classList.remove('hidden');
        this.container.classList.add('active');
        
        if (!this.isInitialized) {
            this.initMap(data?.lat, data?.lng);
        }
    }

    hideMap() {
        this.container.classList.remove('active');
        this.container.classList.add('hidden');
    }

    changeLayer(data) {
        if (!this.isInitialized || !this.map3D) return;
        
        // 3D Maps only support HYBRID and SATELLITE modes
        if (data.layerType === 'satellite') {
            this.map3D.mode = "SATELLITE";
        } else {
            this.map3D.mode = "HYBRID";
        }
    }

    updateLocation(data) {
        if (!this.isInitialized || !this.map3D) return;
        
        // Swoop in closely and tilt to see 3D buildings at the target location
        this.map3D.flyCameraTo({
            endCamera: {
                center: { lat: data.lat, lng: data.lng, altitude: 2500 }, // 2.5km altitude
                tilt: 60, // Heavy tilt to view structures
                heading: data.heading || this.map3D.heading
            },
            durationMillis: 3000
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sphereMapEngine = new SphereMapController();
});