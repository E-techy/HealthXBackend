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
            const row = e.target.closest('.point-row');
            if (!row) return;

            const pointId = row.getAttribute('data-id');

            if (e.target.closest('.row-header')) {
                row.classList.toggle('expanded');
                return;
            }

            if (e.target.closest('.btn-map')) {
                this.startPickingMode(pointId);
            } else if (e.target.closest('.btn-loc')) {
                this.getDeviceLocation(pointId);
            } else if (e.target.closest('.btn-edit-address')) {
                this.enableAddressEdit(pointId);
            } else if (e.target.closest('.btn-remove-cp')) {
                this.deletePoint(pointId);
            } else if (e.target.closest('.btn-swap-org')) {
                this.swapPoints(pointId, 'origin');
            } else if (e.target.closest('.btn-swap-dest')) {
                this.swapPoints(pointId, 'destination');
            }
        });

        document.getElementById('route-points-container').addEventListener('input', (e) => {
            if (e.target.classList.contains('custom-name-input')) {
                const row = e.target.closest('.point-row');
                const titleEl = row.querySelector('.row-title');
                if (row.getAttribute('data-id').startsWith('cp_')) {
                    const defaultName = `Checkpoint ${row.getAttribute('data-seq')}`;
                    titleEl.textContent = e.target.value.trim() || defaultName;
                }
            }
        });

        if (window.EventBus) {
            window.EventBus.on('map_clicked', this.handleMapClick.bind(this));
        }
    }

    // --- REFACTORED FOR PLACES API (NEW) ---
    async enableAddressEdit(pointId) {
        let input = document.getElementById(`input-${pointId}`);

        if (window.placesAutocompleteService) {
            // Wait for the service to attach and potentially swap the DOM node
            input = await window.placesAutocompleteService.attachToInput(input, (placeData) => {
                
                // Plot marker, set data, and re-lock the input
                this.setPointData(pointId, placeData.lat, placeData.lng, placeData.displayName).then(() => {
                    const currentInput = document.getElementById(`input-${pointId}`);
                    if (currentInput) {
                        currentInput.setAttribute('readonly', 'true');
                        currentInput.readOnly = true;
                    }
                });
                
                // Pan map to the searched location
                if (window.EventBus) {
                    window.EventBus.emit('update_location', { lat: placeData.lat, lng: placeData.lng });
                }
            });
        }

        // Standardize properties to account for custom web components
        input.removeAttribute('readonly');
        input.readOnly = false;
        input.value = ''; 
        
        // Timeout ensures the shadow DOM is fully painted before requesting focus
        setTimeout(() => input.focus(), 50);
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
        const row = document.querySelector(`.point-row[data-id="${pointId}"]`);
        const input = document.getElementById(`input-${pointId}`);
        const summary = row.querySelector('.row-summary');
        
        const formattedCoords = this.formatGPS(lat, lng);
        const displayValue = customString ? `${customString} (${formattedCoords})` : formattedCoords;

        if (input) input.value = displayValue;
        if (summary) summary.textContent = displayValue;
        
        row.classList.remove('expanded');

        if (pointId === 'origin') {
            this.btnAddCheckpoint.style.display = 'block';
        }

        let typeClass = 'checkpoint';
        let visualLabel = '';
        if (pointId === 'origin') { typeClass = 'origin'; }
        else if (pointId === 'destination') { typeClass = 'destination'; }
        else { visualLabel = `<div class="seq-num">${row.getAttribute('data-seq')}</div>`; }

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
                <button class="icon-option">⚕️️</button>
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
                if (summary) summary.textContent = newFmt;
                el.querySelector('.coords-tooltip').textContent = newFmt;
            });

            this.markers.set(pointId, gMarker);
        }
    }

    updateCheckpointSequences() {
        let seq = 1;
        const checkpointRows = document.querySelectorAll('#checkpoints-list .point-row');
        
        checkpointRows.forEach(row => {
            const id = row.getAttribute('data-id');
            row.setAttribute('data-seq', seq);
            
            const nameInput = row.querySelector('.custom-name-input');
            const titleEl = row.querySelector('.row-title');
            if (!nameInput.value.trim()) {
                titleEl.textContent = `Checkpoint ${seq}`;
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
        if (this.markers.has(pointId)) {
            this.markers.get(pointId).map = null;
            this.markers.delete(pointId);
        }
        const input = document.getElementById(`input-${pointId}`);
        const summary = document.querySelector(`.point-row[data-id="${pointId}"] .row-summary`);
        
        if (input) {
            input.value = '';
            input.setAttribute('readonly', 'true');
            input.readOnly = true;
        }
        if (summary) summary.textContent = 'Select location...';
        
        if (pointId === 'origin') {
            this.btnAddCheckpoint.style.display = 'none';
        }

        if (pointId.startsWith('cp_')) {
            document.querySelector(`.point-row[data-id="${pointId}"]`)?.remove();
            this.updateCheckpointSequences();
        }
    }

    addCheckpointRow() {
        this.checkpointCount++;
        const cpId = `cp_${this.checkpointCount}`;
        
        const rowHTML = `
            <div class="point-row expanded" data-id="${cpId}" data-seq="">
                <div class="row-header">
                    <div class="row-title">Checkpoint</div>
                    <div class="row-summary">Select location...</div>
                    <button class="btn-toggle-row">▼</button>
                </div>
                <div class="row-body">
                    <input type="text" class="custom-name-input" placeholder="Custom Name (e.g., Base Camp)">
                    <div class="input-with-actions">
                        <input type="text" id="input-${cpId}" placeholder="Search address or Pick..." readonly>
                        <button class="action-icon btn-edit-address" title="Type Address">✏️</button>
                        <button class="action-icon btn-loc" title="Use Device GPS">📍</button>
                        <button class="action-icon btn-map" title="Pick from Map">🎯</button>
                    </div>
                    <div class="checkpoint-actions">
                        <button class="btn-swap-org">Swap Origin</button>
                        <button class="btn-swap-dest">Swap Dest</button>
                        <button class="btn-remove-cp">✖ Remove</button>
                    </div>
                </div>
            </div>
        `;
        this.checkpointsList.insertAdjacentHTML('beforeend', rowHTML);
        this.updateCheckpointSequences();
    }

    swapPoints(id1, id2) {
        const marker1 = this.markers.get(id1);
        const marker2 = this.markers.get(id2);
        
        const pos1 = marker1 ? { lat: marker1.position.lat, lng: marker1.position.lng } : null;
        const pos2 = marker2 ? { lat: marker2.position.lat, lng: marker2.position.lng } : null;

        this.deletePoint(id1);
        this.deletePoint(id2);

        if (pos1) this.setPointData(id2, pos1.lat, pos1.lng);
        if (pos2) this.setPointData(id1, pos2.lat, pos2.lng);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.markerManager = new MarkerManager();
});