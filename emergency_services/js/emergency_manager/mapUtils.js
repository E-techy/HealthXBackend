/**
 * mapUtils.js
 * Handles draggable map pickers, marker syncing, and deletions.
 */
(() => {
    "use strict";

    class EmergencyMapUtils {
        constructor() {
            this.activePickers = new Map(); // Stores active AdvancedMarkerElements
        }

        async getCurrentLocation(requesterId) {
            try {
                return await window.gpsTracker.getCurrentLocation(requesterId);
            } catch (err) {
                if (err.message !== "ABORTED_BY_USER") console.error("GPS Error:", err);
                return null;
            }
        }

        /**
         * Creates a draggable marker on the 2D map.
         * @param {string} id - Unique identifier (e.g., 'main_emergency', 'victim_1')
         * @param {number} lat 
         * @param {number} lng 
         * @param {string} label 
         * @param {function} onDragCallback - Called with {lat, lng} when dragging stops
         * @param {function} onDeleteCallback - Called when user clicks the X on the marker
         */
        async createDraggablePicker(id, lat, lng, label, onDragCallback, onDeleteCallback) {
            if (!window.flatMapEngine || !window.flatMapEngine.map2D) return;
            const map2D = window.flatMapEngine.map2D;

            // Ensure Google Library is loaded
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

            // Remove existing if any
            this.clearPicker(id);

            // Create custom DOM for the marker
            const markerDOM = document.createElement('div');
            markerDOM.className = 'custom-map-marker expanded'; // Auto-expand for visibility
            markerDOM.style.zIndex = 1000;
            markerDOM.innerHTML = `
                <div class="marker-role-badge cp" style="background: var(--accent); color: white;">${label}</div>
                <div class="marker-pin-wrapper">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E" alt="marker" class="marker-icon" style="border-color: var(--accent);"/>
                </div>
                <div class="marker-popup" style="opacity: 1; visibility: visible; transform: none; width: auto; min-width: 120px; text-align: center;">
                    <div class="marker-popup-label" style="margin-bottom: 4px;">Drag to adjust</div>
                    <button class="marker-delete-btn">Remove Marker</button>
                </div>
            `;

            // Bind Delete Button inside marker
            markerDOM.querySelector('.marker-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearPicker(id);
                if (onDeleteCallback) onDeleteCallback();
            });

            // Instantiate Marker
            const marker = new AdvancedMarkerElement({
                map: map2D,
                position: { lat, lng },
                content: markerDOM,
                gmpDraggable: true
            });

            // Bind Drag End
            marker.addEventListener('gmp-dragend', () => {
                const newLat = marker.position.lat;
                const newLng = marker.position.lng;
                if (onDragCallback) onDragCallback({ lat: newLat, lng: newLng });
            });

            this.activePickers.set(id, marker);

            // Pan and Zoom
            map2D.panTo({ lat, lng });
            map2D.setZoom(16);
        }

        clearPicker(id) {
            if (this.activePickers.has(id)) {
                const marker = this.activePickers.get(id);
                marker.map = null;
                this.activePickers.delete(id);
            }
        }

        /**
         * Allows user to click anywhere on map to spawn the draggable marker.
         */
        async pickFromMap(id, label, onDragCallback, onDeleteCallback, onPlacedCallback) {
            if (!window.flatMapEngine || !window.flatMapEngine.map2D) {
                alert("Map is not fully loaded yet."); return;
            }

            alert("Click anywhere on the map to place the initial pin.");
            window.flatMapEngine.map2D.setOptions({ draggableCursor: 'crosshair' });

            google.maps.event.addListenerOnce(window.flatMapEngine.map2D, 'click', async (e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                
                window.flatMapEngine.map2D.setOptions({ draggableCursor: '' }); // Reset cursor
                
                await this.createDraggablePicker(id, lat, lng, label, onDragCallback, onDeleteCallback);
                
                if (onPlacedCallback) onPlacedCallback({ lat, lng });
            });
        }
    }

    window.EmMapUtils = new EmergencyMapUtils();
})();
