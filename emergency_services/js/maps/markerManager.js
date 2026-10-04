/**
 * MarkerManager
 * A robust, state-driven manager for Google Maps Advanced Markers.
 * Automatically synchronizes Custom HTML Markers across BOTH 2D and 3D Maps.
 */
class MarkerManager {
    constructor() {
        this.markers = new Map();
        this.AdvancedMarkerElement = null;
        this.Marker3DElement = null; 
        
        this.DEFAULT_ICON_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ea4335'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E";
        this.DEFAULT_ICON_NAME = "default_pin";
        this.ALLOWED_IMAGE_FORMATS = /\.(jpeg|jpg|gif|png|svg|webp)$/i;
    }

    async initGoogleLibraries() {
        try {
            // Load 2D Map Libraries
            if (!this.AdvancedMarkerElement) {
                const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
                this.AdvancedMarkerElement = AdvancedMarkerElement;
            }
            // Load 3D Map Libraries
            if (!this.Marker3DElement) {
                try {
                    const maps3d = await google.maps.importLibrary("maps3d");
                    // 🌟 CRITICAL FIX: Use MarkerInteractiveElement for Custom HTML on 3D Maps
                    // (Marker3DInteractiveElement is strictly for single images/SVGs)
                    this.Marker3DElement = maps3d.MarkerInteractiveElement || maps3d.MarkerElement;
                } catch (e) {
                    console.warn("⚠️️ [MarkerManager] 3D Maps library not available yet.");
                }
            }
        } catch (error) {
            console.error("❌ [MarkerManager] Failed to load Google Maps libraries:", error);
        }
    }

    isValidImageUrl(url) {
        if (!url) return false;
        if (url.startsWith('data:image/') || url.startsWith('blob:')) return true;
        const urlWithoutQuery = url.split('?')[0]; 
        return this.ALLOWED_IMAGE_FORMATS.test(urlWithoutQuery);
    }

    /**
     * Helper: Creates identical DOM elements so we can safely append 
     * custom HTML to both the 2D and 3D maps simultaneously.
     */
    createMarkerDOM(id, iconUrl) {
        const markerContent = document.createElement('div');
        markerContent.className = 'custom-map-marker collapsed';
        markerContent.setAttribute('data-marker-id', id);
        
        markerContent.innerHTML = `
            <div class="marker-role-badge"></div>
            <div class="marker-pin-wrapper">
                <img src="${iconUrl}" alt="marker" class="marker-icon"/>
            </div>
            <div class="marker-permanent-label"></div>
            <div class="marker-popup">
                <div class="marker-popup-label"></div>
                <div class="marker-popup-address"></div>
                <div class="marker-popup-desc"></div>
            </div>
        `;
        return markerContent;
    }

    async addMarker(data) {
        try {
            if (!data.id || data.lat === undefined || data.lng === undefined) {
                throw new Error("Missing required fields: id, lat, or lng.");
            }

            await this.initGoogleLibraries();

            let finalIconUrl = this.DEFAULT_ICON_URL;
            if (data.iconUrl && this.isValidImageUrl(data.iconUrl)) {
                finalIconUrl = data.iconUrl;
            }

            // =====================================
            // 1. Create 2D Marker HTML (Raw DOM)
            // =====================================
            const markerContent2D = this.createMarkerDOM(data.id, finalIconUrl);

            markerContent2D.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMarkerExpansion(data.id);
            });

            const gMarker2D = new this.AdvancedMarkerElement({
                map: window.flatMapEngine ? window.flatMapEngine.map2D : null,
                position: { lat: data.lat, lng: data.lng },
                content: markerContent2D,
                title: data.label || data.id,
                gmpDraggable: true
            });

            gMarker2D.addEventListener('gmp-dragend', async () => {
                const newLat = gMarker2D.position.lat;
                const newLng = gMarker2D.position.lng;
                await this.setMarkerLocationAndPlace(data.id, newLat, newLng, null, null);
            });

            // =====================================
            // 2. Create 3D Marker HTML (Raw DOM)
            // =====================================
            const markerContent3D = this.createMarkerDOM(data.id, finalIconUrl);
            let gMarker3D = null;

            if (this.Marker3DElement) {
                gMarker3D = new this.Marker3DElement({
                    position: { lat: data.lat, lng: data.lng, altitude: 0 }
                });
                
                try { gMarker3D.altitudeMode = 'CLAMP_TO_GROUND'; } catch(e){}

                // Because we use MarkerInteractiveElement, we can just append standard HTML!
                gMarker3D.append(markerContent3D);

                // 3D Maps broadcast native clicks
                gMarker3D.addEventListener('gmp-click', () => {
                    this.toggleMarkerExpansion(data.id);
                });

                const map3D = window.sphereMapEngine?.map3D || document.querySelector('gmp-map-3d');
                if (map3D) {
                    map3D.append(gMarker3D);
                }
            }

            // Save State
            const markerState = {
                id: data.id,
                label: data.label || "",
                iconName: data.iconName || this.DEFAULT_ICON_NAME,
                iconUrl: finalIconUrl,
                lat: data.lat,
                lng: data.lng,
                address: data.address || null,
                description: data.description || "",
                sequence: 0,
                isOrigin: !!data.isOrigin,
                isDestination: !!data.isDestination,
                placeId: data.placeId || null,
                gMarker2D: gMarker2D,
                gMarker3D: gMarker3D
            };

            this.markers.set(data.id, markerState);
            await this.updateSequence(); // Auto-triggers visual updates

            return markerState;
        } catch (error) {
            console.error(`❌ [MarkerManager] Error creating marker ${data?.id}:`, error);
            return null;
        }
    }

    // =====================================
    // EXPANSION / CLICK CONTROLS
    // =====================================

    collapseAllMarkers() {
        // Visually collapse all 2D and 3D instances
        document.querySelectorAll('.custom-map-marker').forEach(el => el.classList.remove('expanded'));
    }

    toggleMarkerExpansion(id) {
        // Find both the 2D and 3D DOM instances of this specific marker
        const markerEls = document.querySelectorAll(`.custom-map-marker[data-marker-id="${id}"]`);
        if (!markerEls.length) return;
        
        const isCurrentlyExpanded = markerEls[0].classList.contains('expanded');
        this.collapseAllMarkers(); // Close everything first

        if (!isCurrentlyExpanded) {
            // Expand both instances simultaneously!
            markerEls.forEach(el => el.classList.add('expanded'));
        }
    }

    // =====================================
    // VISUAL RENDER ENGINE
    // =====================================

    updateMarkerVisuals(id) {
        const marker = this.markers.get(id);
        if (!marker) return;

        // 1. Role Logic
        let roleText = marker.isOrigin ? "ORIGIN" : (marker.isDestination ? "DEST" : `CP ${marker.sequence}`);
        let roleClass = marker.isOrigin ? "origin" : (marker.isDestination ? "dest" : "cp");

        // 2. Display Name Priority (Custom > Address > GPS)
        let primaryText = marker.label?.trim() || marker.address?.split(',')[0] || `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;

        // 3. Update both 2D and 3D HTML seamlessly
        const instances = document.querySelectorAll(`.custom-map-marker[data-marker-id="${id}"]`);
        instances.forEach(el => {
            const badgeEl = el.querySelector('.marker-role-badge');
            if (badgeEl) { badgeEl.textContent = roleText; badgeEl.className = `marker-role-badge ${roleClass}`; }

            const permLabelEl = el.querySelector('.marker-permanent-label');
            if (permLabelEl) permLabelEl.textContent = primaryText;

            const popLabel = el.querySelector('.marker-popup-label');
            if (popLabel) popLabel.textContent = marker.label || 'Location';

            const popAddress = el.querySelector('.marker-popup-address');
            if (popAddress) popAddress.textContent = marker.address || `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;

            const popDesc = el.querySelector('.marker-popup-desc');
            if (popDesc) {
                popDesc.textContent = marker.description || '';
                popDesc.style.display = marker.description ? 'block' : 'none';
            }
        });
    }

    // =====================================
    // STATE UPDATERS
    // =====================================

    async setMarkerLabel(id, newLabel) {
        const marker = this.markers.get(id);
        if (!marker) return;
        marker.label = newLabel;
        if (marker.gMarker2D) marker.gMarker2D.title = newLabel;
        this.updateMarkerVisuals(id);
    }

    async setMarkerIcon(id, iconName, iconUrl) {
        const marker = this.markers.get(id);
        if (!marker) return;
        marker.iconName = iconName;
        marker.iconUrl = iconUrl;
        
        // Update both 2D and 3D images
        document.querySelectorAll(`.custom-map-marker[data-marker-id="${id}"] .marker-icon`).forEach(img => { 
            img.src = iconUrl; 
            img.alt = iconName; 
        });
    }

    async setMarkerLocationAndPlace(id, lat, lng, placeId = null, address = null) {
        const marker = this.markers.get(id);
        if (!marker) return;
        
        marker.lat = lat;
        marker.lng = lng;
        marker.placeId = placeId;
        marker.address = address;
        
        // Synchronize 2D and 3D locations instantly
        if (marker.gMarker2D) marker.gMarker2D.position = { lat, lng };
        if (marker.gMarker3D) marker.gMarker3D.position = { lat, lng, altitude: 0 }; 
        
        this.updateMarkerVisuals(id);

        if (window.EventBus) window.EventBus.emit('marker_location_changed', { id, lat, lng, placeId, address });
    }

    async setMarkerDescription(id, description) {
        const marker = this.markers.get(id);
        if (!marker) return;
        marker.description = description;
        this.updateMarkerVisuals(id);
    }

    async deleteMarker(id) {
        const marker = this.markers.get(id);
        if (!marker) return;
        
        if (marker.gMarker2D) marker.gMarker2D.map = null;
        if (marker.gMarker3D) marker.gMarker3D.remove(); 
        
        this.markers.delete(id);
        await this.updateSequence();
    }

    async updateSequence() {
        let currentSequence = 1;
        for (let [id, marker] of this.markers.entries()) {
            if (marker.isOrigin || marker.isDestination) {
                marker.sequence = 0;
            } else {
                marker.sequence = currentSequence;
                currentSequence++;
            }
            this.updateMarkerVisuals(id); // Force visual update when sequence changes
        }
    }

    getMarker(id) {
        return this.markers.get(id) || null;
    }
}

// Instantiate globally
window.markerManager = new MarkerManager();

// ==============================================================
// GLOBAL CLICK HANDLER (Safely closes popups)
// ==============================================================
document.addEventListener('click', (e) => {
    // If we click anywhere on the page that is NOT a marker, close all markers
    if (!e.target.closest('.custom-map-marker') && 
        !e.target.closest('gmp-marker') && 
        !e.target.closest('gmp-marker-3d')) {
        window.markerManager.collapseAllMarkers();
    }
});
