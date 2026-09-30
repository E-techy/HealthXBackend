class MarkerManager {
    constructor() {
        this.pickingForId = null; 
        this.checkpointCount = 0;
        this.markers = new Map(); 
        this.markerTimeouts = {}; 
        
        this.AdvancedMarkerElement = null;

        this.mapContainer = document.getElementById('map-container');
        this.checkpointsList = document.getElementById('checkpoints-list');
        this.btnAddCheckpoint = document.getElementById('btn-add-checkpoint');

        this.bindEvents();

        // Initialize Google Autocomplete instantly for Origin & Destination on load
        setTimeout(() => {
            this.attachAutocomplete('origin');
            this.attachAutocomplete('destination');
        }, 100);
    }

    async initGoogleLibraries() {
        if (!this.AdvancedMarkerElement) {
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
            this.AdvancedMarkerElement = AdvancedMarkerElement;
        }
    }

    formatGPS(lat, lng) {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
    }

    bindEvents() {
        this.btnAddCheckpoint.addEventListener('click', () => this.addCheckpointRow());

        document.getElementById('route-points-container').addEventListener('click', (e) => {
            const row = e.target.closest('.route-node');
            if (!row) return;

            const pointId = row.getAttribute('data-id');

            if (e.target.closest('.btn-map')) {
                this.startPickingMode(pointId);
            } else if (e.target.closest('.btn-loc')) {
                this.getDeviceLocation(pointId);
            } else if (e.target.closest('.btn-edit-address')) {
                // Now used to CLEAR the selection and re-enable typing
                this.clearPointData(pointId);
            } else if (e.target.closest('.btn-remove-cp')) {
                this.deletePoint(pointId);
            }
        });

        if (window.EventBus) {
            window.EventBus.on('map_clicked', this.handleMapClick.bind(this));
        }
    }

    // --- INSTANT AUTOCOMPLETE ATTACHMENT ---
    async attachAutocomplete(pointId) {
        let input = document.getElementById(`input-${pointId}`);
        if (!input) return;

        // Change the text of the edit button to a pencil (in case HTML had 🔍)
        const row = document.querySelector(`.route-node[data-id="${pointId}"]`);
        const editBtn = row?.querySelector('.btn-edit-address');
        if (editBtn) editBtn.textContent = '✏️';

        if (window.placesAutocompleteService) {
            // Replaces standard <input> with <gmp-place-autocomplete> instantly
            input = await window.placesAutocompleteService.attachToInput(input, (placeData) => {
                this.setPointData(pointId, placeData.lat, placeData.lng, placeData.displayName);
                if (window.EventBus) {
                    window.EventBus.emit('update_location', { lat: placeData.lat, lng: placeData.lng });
                }
            });
            input.id = `input-${pointId}`; // Ensure ID persists after swap
        }

        // Make sure it starts in an editable state (Direct typing)
        input.removeAttribute('readonly');
        input.readOnly = false;
        if (row) row.classList.remove('has-data');
    }

    // Clears the selected point and re-enables typing
    clearPointData(pointId) {
        if (this.markers.has(pointId)) {
            this.markers.get(pointId).map = null;
            this.markers.delete(pointId);
        }
        
        const row = document.querySelector(`.route-node[data-id="${pointId}"]`);
        if (row) row.classList.remove('has-data');

        const input = document.getElementById(`input-${pointId}`);
        if (input) {
            input.value = '';
            input.removeAttribute('readonly');
            input.readOnly = false;
            setTimeout(() => input.focus(), 50);
        }
        
        if (pointId === 'origin') {
            this.btnAddCheckpoint.style.display = 'none';
        }
    }

    startPickingMode(pointId) {
        this.pickingForId = pointId;
        this.mapContainer.style.cursor = 'crosshair';
    }

    handleMapClick(data) {
        if (!this.pickingForId) return; 
        this.setPointData(this.pickingForId, data.lat, data.lng);
        this.pickingForId = null;
        this.mapContainer.style.cursor = 'default';
    }

    getDeviceLocation(pointId) {
        if (!navigator.geolocation) return alert("Geolocation not supported.");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const data = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                this.setPointData(pointId, data.lat, data.lng, "Device Location");
                if (window.EventBus) window.EventBus.emit('update_location', data);
            },
            () => alert("Error getting location.")
        );
    }

    async setPointData(pointId, lat, lng, customString = null) {
        await this.initGoogleLibraries();
        const input = document.getElementById(`input-${pointId}`);
        const row = document.querySelector(`.route-node[data-id="${pointId}"]`);
        
        const formattedCoords = this.formatGPS(lat, lng);
        const displayValue = customString ? `${customString} (${formattedCoords})` : formattedCoords;

        if (input) {
            input.value = displayValue;
            input.setAttribute('readonly', 'true'); // Lock it
            input.readOnly = true;
        }

        if (row) {
            row.classList.add('has-data'); // Triggers CSS to show edit button, hide GPS/Map buttons
        }

        if (pointId === 'origin') {
            this.btnAddCheckpoint.style.display = 'flex';
        }

        let typeClass = 'checkpoint';
        let visualLabel = '';
        
        if (pointId === 'origin') { 
            typeClass = 'origin'; 
        } else if (pointId === 'destination') { 
            typeClass = 'destination'; 
        } else if (row) { 
            visualLabel = `<div class="seq-num">${row.getAttribute('data-seq')}</div>`; 
        }

        if (this.markers.has(pointId)) {
            this.markers.get(pointId).map = null;
            this.markers.delete(pointId);
        }

        const el = document.createElement('div');
        el.className = `tactical-marker ${typeClass}`;
        el.innerHTML = `
            ${visualLabel}
            <span class="icon-display">📍</span>
            <div class="coords-tooltip">${customString ? customString : formattedCoords}</div>
            <div class="marker-controls">
                <button class="marker-btn btn-delete" title="Remove">✖</button>
                <button class="marker-btn btn-edit" title="Change Icon">✏️</button>
            </div>
            <div class="marker-edit-panel">
                <button class="icon-option">⛽</button>
                <button class="icon-option">⚕️</button>
                <button class="icon-option">💥</button>
                <button class="icon-option">🚓</button>
                <button class="icon-option">📍</button>
            </div>
        `;

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tactical-marker').forEach(m => m.classList.remove('show-controls'));
            el.classList.add('show-controls');
            clearTimeout(this.markerTimeouts[pointId]);
            this.markerTimeouts[pointId] = setTimeout(() => {
                el.classList.remove('show-controls');
                el.querySelector('.marker-edit-panel').classList.remove('show');
            }, 10000);
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

        if (window.flatMapEngine && window.flatMapEngine.map2D) {
            const gMarker = new this.AdvancedMarkerElement({
                map: window.flatMapEngine.map2D,
                position: { lat, lng },
                content: el,
                title: pointId,
                gmpDraggable: true
            });

            gMarker.addEventListener('gmp-dragend', () => {
                const newLat = gMarker.position.lat;
                const newLng = gMarker.position.lng;
                const newFmt = this.formatGPS(newLat, newLng);
                
                if (input) input.value = newFmt;
                el.querySelector('.coords-tooltip').textContent = newFmt;
            });

            this.markers.set(pointId, gMarker);
        }
    }

    updateCheckpointSequences() {
        let seq = 1;
        const checkpointRows = document.querySelectorAll('#checkpoints-list .route-node');
        
        checkpointRows.forEach(row => {
            const id = row.getAttribute('data-id');
            row.setAttribute('data-seq', seq);
            
            const input = document.getElementById(`input-${id}`);
            if (input && !input.value.trim()) {
                input.placeholder = `Checkpoint ${seq}...`;
            }

            const marker = this.markers.get(id);
            if (marker) {
                const el = marker.content;
                const numBubble = el.querySelector('.seq-num');
                if (numBubble) numBubble.textContent = seq;
            }
            seq++;
        });
    }

    deletePoint(pointId) {
        this.clearPointData(pointId);

        if (pointId.startsWith('cp_')) {
            document.querySelector(`.route-node[data-id="${pointId}"]`)?.remove();
            this.updateCheckpointSequences();
        }
    }

    addCheckpointRow() {
        this.checkpointCount++;
        const cpId = `cp_${this.checkpointCount}`;
        
        const rowHTML = `
            <div class="route-node" data-id="${cpId}" data-seq="${this.checkpointCount}">
                <div class="node-connector">
                    <div class="dot cp-dot"></div>
                    <div class="line"></div>
                </div>
                <div class="node-content">
                    <div class="input-wrapper">
                        <input type="text" id="input-${cpId}" placeholder="Checkpoint ${this.checkpointCount}...">
                        <button class="action-icon btn-edit-address" title="Edit/Clear">✏️</button>
                        <button class="action-icon btn-loc" title="GPS">📍</button>
                        <button class="action-icon btn-map" title="Map">🎯</button>
                        <button class="action-icon btn-remove-cp" title="Remove">✖</button>
                    </div>
                </div>
            </div>
        `;
        this.checkpointsList.insertAdjacentHTML('beforeend', rowHTML);
        this.attachAutocomplete(cpId); // Immediately bind the web component to the new node
        this.updateCheckpointSequences();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.markerManager = new MarkerManager();
});