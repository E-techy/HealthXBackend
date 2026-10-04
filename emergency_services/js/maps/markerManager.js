/**
 * MarkerManager
 * A robust, state-driven manager for Google Maps Advanced Markers.
 */
class MarkerManager {
    constructor() {
        this.markers = new Map();
        this.AdvancedMarkerElement = null;
        this.PinElement = null;
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

            const markerContent = document.createElement('div');
            markerContent.className = 'custom-map-marker collapsed';
            
            // 🌟 ADDED: Role Badge and Permanent Label containers
            markerContent.innerHTML = `
                <div class="marker-role-badge"></div>
                <div class="marker-pin-wrapper">
                    <img src="${finalIconUrl}" alt="${data.iconName || this.DEFAULT_ICON_NAME}" class="marker-icon"/>
                </div>
                <div class="marker-permanent-label"></div>
                <div class="marker-popup">
                    <div class="marker-popup-label"></div>
                    <div class="marker-popup-address"></div>
                    <div class="marker-popup-desc"></div>
                </div>
            `;

            markerContent.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-map-marker').forEach(el => el.classList.remove('expanded'));
                markerContent.classList.add('expanded');
            });

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
            await this.updateSequence(); // This will auto-call updateMarkerVisuals

            return markerState;
        } catch (error) {
            console.error(`❌ [MarkerManager] Error creating marker ${data?.id}:`, error);
            return null;
        }
    }

    // 🌟 NEW: Master visual updater that handles priority labeling
    updateMarkerVisuals(id) {
        const marker = this.markers.get(id);
        if (!marker || !marker.gMarker) return;
        const el = marker.gMarker.content;

        // 1. Setup Role Badge (Origin, Dest, or CP #)
        let roleText = "";
        let roleClass = "";
        if (marker.isOrigin) { roleText = "ORIGIN"; roleClass = "origin"; }
        else if (marker.isDestination) { roleText = "DEST"; roleClass = "dest"; }
        else { roleText = `CP ${marker.sequence}`; roleClass = "cp"; }

        const badgeEl = el.querySelector('.marker-role-badge');
        if (badgeEl) {
            badgeEl.textContent = roleText;
            badgeEl.className = `marker-role-badge ${roleClass}`;
        }

        // 2. Setup Priority Label (Custom Name > Display Name > GPS)
        let primaryText = "";
        if (marker.label && marker.label.trim() !== '') {
            primaryText = marker.label;
        } else if (marker.address && marker.address.trim() !== '') {
            primaryText = marker.address.split(',')[0]; // Grab just the first line/name of address
        } else {
            primaryText = `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;
        }

        const permLabelEl = el.querySelector('.marker-permanent-label');
        if (permLabelEl) permLabelEl.textContent = primaryText;

        // 3. Update the Expanded Popup content
        const popLabel = el.querySelector('.marker-popup-label');
        if (popLabel) popLabel.textContent = marker.label || 'Location';

        const popAddress = el.querySelector('.marker-popup-address');
        if (popAddress) popAddress.textContent = marker.address || `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;

        const popDesc = el.querySelector('.marker-popup-desc');
        if (popDesc) {
            popDesc.textContent = marker.description || '';
            popDesc.style.display = marker.description ? 'block' : 'none';
        }
    }

    async setMarkerLabel(id, newLabel) {
        const marker = this.markers.get(id);
        if (!marker) return;
        marker.label = newLabel;
        marker.gMarker.title = newLabel;
        this.updateMarkerVisuals(id);
    }

    async setMarkerIcon(id, iconName, iconUrl) {
        const marker = this.markers.get(id);
        if (!marker) return;
        marker.iconName = iconName;
        marker.iconUrl = iconUrl;
        const imgEl = marker.gMarker.content.querySelector('.marker-icon');
        if (imgEl) { imgEl.src = iconUrl; imgEl.alt = iconName; }
    }

    async setMarkerLocationAndPlace(id, lat, lng, placeId = null, address = null) {
        const marker = this.markers.get(id);
        if (!marker) return;
        marker.lat = lat;
        marker.lng = lng;
        marker.placeId = placeId;
        marker.address = address;
        marker.gMarker.position = { lat, lng };
        
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
        if (marker.gMarker) marker.gMarker.map = null;
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

window.markerManager = new MarkerManager();
