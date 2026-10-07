/**
 * mapUtils.js
 * Handles rich, color-coded draggable map pickers, marker syncing, and deletions.
 */
(() => {
    "use strict";

    class EmergencyMapUtils {
        constructor() {
            this.activePickers = new Map();
            
            // Default SVGs for fallback
            this.icons = {
                origin: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
                victim: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
                culprit: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E"
            };
        }

        async getCurrentLocation(requesterId) {
            try {
                console.log(`📍 [MapUtils] Requesting GPS for ${requesterId}...`);
                return await window.gpsTracker.getCurrentLocation(requesterId);
            } catch (err) {
                if (err.message !== "ABORTED_BY_USER") console.error("❌ GPS Error:", err);
                return null;
            }
        }

        async createDraggablePicker(id, lat, lng, type, name, badgeText, imgUrl, onDragCallback, onDeleteCallback) {
            if (!window.flatMapEngine || !window.flatMapEngine.map2D) return;
            const map2D = window.flatMapEngine.map2D;
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

            this.clearPicker(id);

            // Styling logic based on Type
            let color = 'var(--accent)';
            let roleClass = 'cp';
            if (type === 'victim') { color = 'var(--success)'; roleClass = 'origin'; }
            if (type === 'culprit') { color = 'var(--danger)'; roleClass = 'dest'; }

            const finalImg = imgUrl || this.icons[type] || this.icons.origin;

            // Build Marker DOM
            const markerDOM = document.createElement('div');
            markerDOM.className = 'custom-map-marker'; // Starts collapsed
            markerDOM.style.zIndex = 1000;
            markerDOM.innerHTML = `
                <div class="marker-role-badge ${roleClass}">${badgeText}</div>
                <div class="marker-pin-wrapper">
                    <img src="${finalImg}" alt="${name}" class="marker-icon" style="border-color: ${color}; background: #fff;"/>
                </div>
                <div class="marker-permanent-label">${name}</div>
                
                <!-- Popup inside marker (Visible only when expanded) -->
                <div class="marker-popup">
                    <div class="marker-popup-label">${name}</div>
                    <div class="marker-popup-desc">Drag marker to adjust location.</div>
                    <button class="marker-delete-btn" style="background:${color}">Remove Marker</button>
                </div>
            `;

            // Interaction: Expand on Click
            markerDOM.addEventListener('click', (e) => {
                e.stopPropagation();
                // Collapse all others first
                document.querySelectorAll('.custom-map-marker').forEach(m => m.classList.remove('expanded'));
                markerDOM.classList.add('expanded');
            });

            // Interaction: Delete Button inside Popup
            markerDOM.querySelector('.marker-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`🗑️ [MapUtils] Marker ${id} deleted by user.`);
                this.clearPicker(id);
                if (onDeleteCallback) onDeleteCallback();
            });

            // Instantiate
            const marker = new AdvancedMarkerElement({
                map: map2D,
                position: { lat, lng },
                content: markerDOM,
                gmpDraggable: true
            });

            marker.addEventListener('gmp-dragend', () => {
                console.log(`🔄 [MapUtils] Marker ${id} dragged to ${marker.position.lat}, ${marker.position.lng}`);
                if (onDragCallback) onDragCallback({ lat: marker.position.lat, lng: marker.position.lng });
            });

            this.activePickers.set(id, marker);

            map2D.panTo({ lat, lng });
            map2D.setZoom(16);
            console.log(`✅ [MapUtils] Marker ${id} plotted at ${lat}, ${lng}`);
        }

        clearPicker(id) {
            if (this.activePickers.has(id)) {
                this.activePickers.get(id).map = null;
                this.activePickers.delete(id);
            }
        }

        async pickFromMap(id, type, name, badgeText, imgUrl, onDragCallback, onDeleteCallback, onPlacedCallback) {
            if (!window.flatMapEngine || !window.flatMapEngine.map2D) {
                alert("Map is not fully loaded yet."); return;
            }

            console.log(`🗺️ [MapUtils] Entering Map Pick Mode for ${id}`);
            window.flatMapEngine.map2D.setOptions({ draggableCursor: 'crosshair' });

            google.maps.event.addListenerOnce(window.flatMapEngine.map2D, 'click', async (e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                
                window.flatMapEngine.map2D.setOptions({ draggableCursor: '' });
                
                await this.createDraggablePicker(id, lat, lng, type, name, badgeText, imgUrl, onDragCallback, onDeleteCallback);
                if (onPlacedCallback) onPlacedCallback({ lat, lng });
            });
        }
    }

    window.EmMapUtils = new EmergencyMapUtils();
})();
