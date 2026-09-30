class MarkerManager {
    constructor() {
        this.pickingMode = null; // 'origin' or 'dest'
        this.sequenceCount = 0;
        this.markers = new Map(); // Store active markers by ID
        this.AdvancedMarkerElement = null;

        // UI Inputs
        this.originInput = document.getElementById('route-origin');
        this.destInput = document.getElementById('route-dest');
        this.mapContainer = document.getElementById('map-container');

        this.bindEvents();
    }

    async initGoogleLibraries() {
        if (!this.AdvancedMarkerElement) {
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
            this.AdvancedMarkerElement = AdvancedMarkerElement;
        }
    }

    bindEvents() {
        // "Current Location" Buttons
        document.getElementById('btn-loc-origin').addEventListener('click', () => this.getDeviceLocation('origin'));
        document.getElementById('btn-loc-dest').addEventListener('click', () => this.getDeviceLocation('dest'));

        // "Pick from Map" Buttons
        document.getElementById('btn-map-origin').addEventListener('click', () => this.startPickingMode('origin'));
        document.getElementById('btn-map-dest').addEventListener('click', () => this.startPickingMode('dest'));

        // Listen for Map Clicks from flatMap.js and sphereMap.js
        if (window.EventBus) {
            window.EventBus.on('map_clicked', this.handleMapClick.bind(this));
        }
    }

    startPickingMode(type) {
        this.pickingMode = type;
        // Turn cursor to crosshair so the user knows they are picking
        this.mapContainer.style.cursor = 'crosshair';
        console.log(`Select ${type} on the map...`);
    }

    handleMapClick(data) {
        if (!this.pickingMode) return; // Ignore clicks if not in picking mode

        const latLngStr = `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
        
        if (this.pickingMode === 'origin') {
            this.originInput.value = latLngStr;
            this.createTacticalMarker(data.lat, data.lng, 'origin');
        } else {
            this.destInput.value = latLngStr;
            this.createTacticalMarker(data.lat, data.lng, 'destination');
        }

        // Reset picking mode
        this.pickingMode = null;
        this.mapContainer.style.cursor = 'default';
    }

    getDeviceLocation(type) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const data = { lat: position.coords.latitude, lng: position.coords.longitude };
                    const latLngStr = `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
                    
                    if (type === 'origin') {
                        this.originInput.value = latLngStr;
                        this.createTacticalMarker(data.lat, data.lng, 'origin');
                    } else {
                        this.destInput.value = latLngStr;
                        this.createTacticalMarker(data.lat, data.lng, 'destination');
                    }
                    
                    // Center the map on the user
                    if (window.EventBus) window.EventBus.emit('update_location', data);
                },
                (error) => alert("Error getting location. Ensure location permissions are granted.")
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    }

    async createTacticalMarker(lat, lng, type) {
        await this.initGoogleLibraries();
        this.sequenceCount++;
        const markerId = `marker_${this.sequenceCount}`;

        // 1. Create the Custom HTML for the Marker
        const el = document.createElement('div');
        el.className = `tactical-marker ${type}`;
        el.innerHTML = `
            <div class="seq-num">${this.sequenceCount}</div>
            <span class="icon-display">📍</span>
            <div class="coords-tooltip">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
            
            <div class="marker-controls">
                <button class="marker-btn btn-delete">✖</button>
                <button class="marker-btn btn-edit">✏️</button>
            </div>
            
            <div class="marker-edit-panel">
                <button class="icon-option">⛽</button>
                <button class="icon-option">⚕️</button>
                <button class="icon-option">💥</button>
                <button class="icon-option">🚓</button>
            </div>
        `;

        // 2. Attach DOM Event Listeners for the Marker UI
        const btnDelete = el.querySelector('.btn-delete');
        const btnEdit = el.querySelector('.btn-edit');
        const editPanel = el.querySelector('.marker-edit-panel');
        const iconDisplay = el.querySelector('.icon-display');
        const iconOptions = el.querySelectorAll('.icon-option');

        // Delete Marker
        btnDelete.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop map click
            this.removeMarker(markerId, type);
        });

        // Toggle Edit Panel
        btnEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            editPanel.classList.toggle('show');
        });

        // Change Icon
        iconOptions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                iconDisplay.textContent = btn.textContent;
                editPanel.classList.remove('show');
            });
        });

        // 3. Attach it to the 2D Map Engine via AdvancedMarkerElement
        if (window.flatMapEngine && window.flatMapEngine.map2D) {
            const gMarker = new this.AdvancedMarkerElement({
                map: window.flatMapEngine.map2D,
                position: { lat, lng },
                content: el,
                title: `${type.toUpperCase()} - ${markerId}`
            });

            this.markers.set(markerId, gMarker);
        }
    }

    removeMarker(markerId, type) {
        const marker = this.markers.get(markerId);
        if (marker) {
            marker.map = null; // Removes from Google Map
            this.markers.delete(markerId);
            
            // Clear the corresponding input field
            if (type === 'origin') this.originInput.value = '';
            if (type === 'destination') this.destInput.value = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.markerManager = new MarkerManager();
});