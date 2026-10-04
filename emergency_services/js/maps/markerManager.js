/**
 * MarkerManager
 * A robust, state-driven manager for Google Maps Advanced Markers.
 */
class MarkerManager {
    constructor() {
        this.markers = new Map();
        this.AdvancedMarkerElement = null;
        this.PinElement = null;
        
        // 🌟 FIX 1: Proper default Google-style red pin SVG
        this.DEFAULT_ICON_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ea4335'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E";
        this.DEFAULT_ICON_NAME = "default_pin";
        this.ALLOWED_IMAGE_FORMATS = /\.(jpeg|jpg|gif|png|svg|webp)$/i;
    }

    async initGoogleLibraries() {
        try {
            if (!this.AdvancedMarkerElement) {
                const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
                this.AdvancedMarkerElement = AdvancedMarkerElement;
                this.PinElement = PinElement;
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

            // 🌟 FIX 2: Rich HTML structure for Click-to-Expand functionality
            const markerContent = document.createElement('div');
            markerContent.className = 'custom-map-marker collapsed';
            markerContent.innerHTML = `
                <div class="marker-pin-wrapper">
                    <img src="${finalIconUrl}" alt="${data.iconName || this.DEFAULT_ICON_NAME}" class="marker-icon"/>
                </div>
                <div class="marker-popup">
                    <div class="marker-popup-label">${data.label || 'Location'}</div>
                    <div class="marker-popup-address">${data.address || `${data.lat.toFixed(4)},${data.lng.toFixed(4)}`}</div>
                    <div class="marker-popup-desc" style="${data.description ? 'display:block;' : 'display:none;'}">${data.description || ''}</div>
                </div>
            `;

            // Click listener to toggle the big image and popup
            markerContent.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other markers first
                document.querySelectorAll('.custom-map-marker').forEach(el => el.classList.remove('expanded'));
                // Toggle this one
                markerContent.classList.add('expanded');
            });

            // Click anywhere else on the map to shrink it back
            if (window.flatMapEngine && window.flatMapEngine.map2D) {
                window.flatMapEngine.map2D.addListener('click', () => {
                    document.querySelectorAll('.custom-map-marker').forEach(el => el.classList.remove('expanded'));
                });
            }

            const gMarker = new this.AdvancedMarkerElement({
                map: window.flatMapEngine ? window.flatMapEngine.map2D : null,
                position: { lat: data.lat, lng: data.lng },
                content: markerContent,
                title: data.label || data.id,
                gmpDraggable: true
            });

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
                gMarker: gMarker
            };

            gMarker.addEventListener('gmp-dragend', async () => {
                const newLat = gMarker.position.lat;
                const newLng = gMarker.position.lng;
                await this.setMarkerLocationAndPlace(data.id, newLat, newLng, null, null);
            });

            this.markers.set(data.id, markerState);
            await this.updateSequence();

            return markerState;
        } catch (error) {
            console.error(`❌ [MarkerManager] Error creating marker ${data?.id}:`, error);
            return null;
        }
    }

    async setMarkerLabel(id, newLabel) {
        try {
            const marker = this.markers.get(id);
            if (!marker) return;
            marker.label = newLabel;
            const labelEl = marker.gMarker.content.querySelector('.marker-popup-label');
            if (labelEl) labelEl.textContent = newLabel || 'Location';
            marker.gMarker.title = newLabel;
        } catch (error) {}
    }

    async setMarkerIcon(id, iconName, iconUrl) {
        try {
            const marker = this.markers.get(id);
            if (!marker) return;
            marker.iconName = iconName;
            marker.iconUrl = iconUrl;
            const imgEl = marker.gMarker.content.querySelector('.marker-icon');
            if (imgEl) {
                imgEl.src = iconUrl;
                imgEl.alt = iconName;
            }
        } catch (error) {}
    }

    async setMarkerLocationAndPlace(id, lat, lng, placeId = null, address = null) {
        try {
            const marker = this.markers.get(id);
            if (!marker) return;
            marker.lat = lat;
            marker.lng = lng;
            marker.placeId = placeId;
            marker.address = address;
            marker.gMarker.position = { lat, lng };

            // Update the HTML popup address dynamically
            const addressEl = marker.gMarker.content.querySelector('.marker-popup-address');
            if (addressEl) addressEl.textContent = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

            if (window.EventBus) {
                window.EventBus.emit('marker_location_changed', { id, lat, lng, placeId, address });
            }
        } catch (error) {}
    }

    async setMarkerDescription(id, description) {
        try {
            const marker = this.markers.get(id);
            if (!marker) return;
            marker.description = description;
            const descEl = marker.gMarker.content.querySelector('.marker-popup-desc');
            if (descEl) {
                descEl.textContent = description;
                descEl.style.display = description.trim() ? 'block' : 'none';
            }
        } catch (error) {}
    }

    async deleteMarker(id) {
        try {
            const marker = this.markers.get(id);
            if (!marker) return;
            if (marker.gMarker) marker.gMarker.map = null;
            this.markers.delete(id);
            await this.updateSequence();
        } catch (error) {}
    }

    async updateSequence() {
        let currentSequence = 1;
        for (let [id, marker] of this.markers.entries()) {
            if (marker.isOrigin || marker.isDestination) {
                marker.sequence = 0;
                continue;
            }
            marker.sequence = currentSequence;
            currentSequence++;
        }
    }

    getMarker(id) {
        return this.markers.get(id) || null;
    }
}

window.markerManager = new MarkerManager();
