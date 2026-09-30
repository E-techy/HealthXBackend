class MarkerManager {
    constructor() {
        this.pickingForId = null; // Holds the ID of the row we are picking a spot for
        this.checkpointCount = 0;
        this.markers = new Map(); // Google Marker instances
        this.markerTimeouts = {}; // 10-second toolbar timeouts
        this.AdvancedMarkerElement = null;

        this.mapContainer = document.getElementById('map-container');
        this.checkpointsList = document.getElementById('checkpoints-list');

        this.bindEvents();
    }

    async initGoogleLibraries() {
        if (!this.AdvancedMarkerElement) {
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
            this.AdvancedMarkerElement = AdvancedMarkerElement;
        }
    }

    bindEvents() {
        // Add Checkpoint Button
        document.getElementById('btn-add-checkpoint').addEventListener('click', () => this.addCheckpointRow());

        // Delegate clicks for dynamic UI rows (Origin, Dest, and Checkpoints)
        document.getElementById('route-points-container').addEventListener('click', (e) => {
            const row = e.target.closest('.point-row');
            if (!row) return;

            const pointId = row.getAttribute('data-id');

            if (e.target.closest('.btn-map')) {
                this.startPickingMode(pointId);
            } else if (e.target.closest('.btn-loc')) {
                this.getDeviceLocation(pointId);
            } else if (e.target.closest('.btn-remove-cp')) {
                this.removeCheckpoint(pointId);
            } else if (e.target.closest('.btn-swap-org')) {
                this.swapPoints(pointId, 'origin');
            } else if (e.target.closest('.btn-swap-dest')) {
                this.swapPoints(pointId, 'destination');
            }
        });

        // Listen for Map Clicks from the EventBus
        if (window.EventBus) {
            window.EventBus.on('map_clicked', this.handleMapClick.bind(this));
        }
    }

    // --- 1. CROSSHAIR PICKING MODE ---
    startPickingMode(pointId) {
        this.pickingForId = pointId;
        this.mapContainer.style.cursor = 'crosshair'; // Change cursor
        console.log(`Waiting for click on map to place: ${pointId}...`);
    }

    handleMapClick(data) {
        // Ignore clicks if we didn't press the target button first
        if (!this.pickingForId) return; 

        this.setPointData(this.pickingForId, data.lat, data.lng);

        // Reset picking mode
        this.pickingForId = null;
        this.mapContainer.style.cursor = 'default';
    }

    // --- 2. GPS LOCATION ---
    getDeviceLocation(pointId) {
        if (!navigator.geolocation) return alert("Geolocation not supported.");
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const data = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                this.setPointData(pointId, data.lat, data.lng);
                if (window.EventBus) window.EventBus.emit('update_location', data);
            },
            () => alert("Error getting location.")
        );
    }

    // --- 3. CREATE & UPDATE MARKERS ---
    async setPointData(pointId, lat, lng) {
        // 1. Update the UI Input box
        const input = document.getElementById(`input-${pointId}`);
        if (input) input.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        // 2. Determine Marker Style
        let typeClass = 'checkpoint';
        let label = '';
        if (pointId === 'origin') { typeClass = 'origin'; }
        else if (pointId === 'destination') { typeClass = 'destination'; }
        else { label = `<div class="seq-num">${pointId.replace('cp_', '')}</div>`; } // e.g., "1", "2"

        // 3. Remove old marker if it exists
        if (this.markers.has(pointId)) {
            this.markers.get(pointId).map = null;
            this.markers.delete(pointId);
        }

        await this.initGoogleLibraries();

        // 4. Create Custom HTML Marker
        const el = document.createElement('div');
        el.className = `tactical-marker ${typeClass}`;
        el.innerHTML = `
            ${label}
            <span class="icon-display">📍</span>
            <div class="coords-tooltip">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
            
            <div class="marker-controls">
                <button class="marker-btn btn-delete" title="Remove">✖</button>
                <button class="marker-btn btn-edit" title="Change Icon">✏️</button>
            </div>
            
            <div class="marker-edit-panel">
                <button class="icon-option">⛽</button>
                <button class="icon-option">⚕️</button>
                <button class="icon-option">💥</button>
                <button class="icon-option">🚓</button>
            </div>
        `;

        // 5. Marker Interactions (Click to show toolbar, Auto-hide after 10s)
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Hide controls on all other markers first
            document.querySelectorAll('.tactical-marker').forEach(m => m.classList.remove('show-controls'));
            
            // Show this one
            el.classList.add('show-controls');
            
            clearTimeout(this.markerTimeouts[pointId]);
            this.markerTimeouts[pointId] = setTimeout(() => {
                el.classList.remove('show-controls');
                el.querySelector('.marker-edit-panel').classList.remove('show');
            }, 10000); // 10 seconds auto-hide
        });

        el.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deletePoint(pointId);
        });

        el.querySelector('.btn-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            el.querySelector('.marker-edit-panel').classList.toggle('show');
        });

        el.querySelectorAll('.icon-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.querySelector('.icon-display').textContent = btn.textContent;
                el.querySelector('.marker-edit-panel').classList.remove('show');
            });
        });

        // 6. Attach to Google Maps (with Drag & Drop enabled)
        if (window.flatMapEngine && window.flatMapEngine.map2D) {
            const gMarker = new this.AdvancedMarkerElement({
                map: window.flatMapEngine.map2D,
                position: { lat, lng },
                content: el,
                title: pointId,
                gmpDraggable: true // EXTREMELY IMPORTANT: Enables Dragging
            });

            // Listen for the Drop Event to update coordinates
            gMarker.addEventListener('gmp-dragend', () => {
                const newLat = gMarker.position.lat;
                const newLng = gMarker.position.lng;
                // Sync the input box and internal tooltip
                if (input) input.value = `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;
                el.querySelector('.coords-tooltip').textContent = `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;
            });

            this.markers.set(pointId, gMarker);
        }
    }

    deletePoint(pointId) {
        if (this.markers.has(pointId)) {
            this.markers.get(pointId).map = null;
            this.markers.delete(pointId);
        }
        const input = document.getElementById(`input-${pointId}`);
        if (input) input.value = '';
        
        // If it was a dynamic checkpoint, remove its HTML row entirely
        if (pointId.startsWith('cp_')) {
            document.querySelector(`.point-row[data-id="${pointId}"]`)?.remove();
        }
    }

    // --- 4. CHECKPOINT LOGIC ---
    addCheckpointRow() {
        this.checkpointCount++;
        const cpId = `cp_${this.checkpointCount}`;
        
        const rowHTML = `
            <div class="point-row" data-id="${cpId}">
                <div class="control-group" style="margin-bottom:0;">
                    <label>Checkpoint ${this.checkpointCount}</label>
                    <div class="input-with-actions">
                        <input type="text" id="input-${cpId}" placeholder="Select on map..." readonly>
                        <button class="action-icon btn-loc" title="Use Device GPS">📍</button>
                        <button class="action-icon btn-map" title="Pick from Map">🎯</button>
                    </div>
                </div>
                <div class="checkpoint-actions">
                    <button class="btn-swap-org">Swap Origin</button>
                    <button class="btn-swap-dest">Swap Dest</button>
                    <button class="btn-remove-cp">✖ Remove</button>
                </div>
            </div>
        `;
        this.checkpointsList.insertAdjacentHTML('beforeend', rowHTML);
    }

    swapPoints(id1, id2) {
        const marker1 = this.markers.get(id1);
        const marker2 = this.markers.get(id2);
        
        // Grab coordinates before removing
        const pos1 = marker1 ? { lat: marker1.position.lat, lng: marker1.position.lng } : null;
        const pos2 = marker2 ? { lat: marker2.position.lat, lng: marker2.position.lng } : null;

        // Wipe them out
        this.deletePoint(id1);
        this.deletePoint(id2);

        // Recreate them inverted (only if they existed)
        if (pos1) this.setPointData(id2, pos1.lat, pos1.lng);
        if (pos2) this.setPointData(id1, pos2.lat, pos2.lng);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.markerManager = new MarkerManager();
});