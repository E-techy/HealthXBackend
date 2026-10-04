/**
 * RoutingManager
 * Generates the Google-style Routing Timeline UI.
 * Handles device file uploads for markers and Enter-key submits.
 */
class RoutingManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pickingForId = null;
        this.checkpointCount = 0;

        if (!this.container) return;

        this.buildInitialUI();
        this.bindEvents();

        setTimeout(() => {
            this.attachAutocompleteToNode('origin');
            this.attachAutocompleteToNode('destination');
        }, 500);
    }

    buildInitialUI() {
        // 🌟 FIX 3: Pure timeline injected straight into the flyout. No absolute wrapping divs.
        this.container.innerHTML = `
            <div class="rm-timeline" id="rm-timeline">
                ${this.generateNodeHTML('origin', 'Origin', true)}
                
                <div id="rm-checkpoints-container" style="display:contents;"></div>
                
                <!-- Seamless Add Checkpoint Node -->
                <div class="rm-node add-cp-node" id="rm-btn-add-cp" style="display: none; cursor: pointer;">
                    <div class="node-connector">
                        <div class="rm-dot add"></div>
                        <div class="node-line"></div>
                    </div>
                    <div class="node-content">
                        <span class="add-text-btn">+ Add checkpoint</span>
                    </div>
                </div>

                ${this.generateNodeHTML('destination', 'Destination', false)}
            </div>
        `;
        this.expandNode('origin');
    }

    generateNodeHTML(id, title, isOriginOrDest) {
        const typeClass = id === 'origin' ? 'origin' : (id === 'destination' ? 'destination' : 'checkpoint');
        const clearBtnHTML = isOriginOrDest 
            ? `<button class="rm-action-btn rm-btn-danger btn-clear" title="Clear">✖</button>`
            : `<button class="rm-action-btn rm-btn-danger btn-remove" title="Remove Checkpoint">🗑</button>`;

        return `
            <div class="rm-node collapsed" data-id="${id}">
                <div class="node-connector">
                    <div class="rm-dot ${typeClass}"></div>
                    <div class="node-line"></div>
                </div>
                
                <div class="node-content">
                    <div class="rm-summary">
                        <div class="rm-summary-info">
                            <span class="rm-node-title">${title}</span>
                            <span class="rm-node-value" id="summary-${id}">Select location...</span>
                        </div>
                    </div>
                    
                    <div class="rm-details">
                        <div class="rm-input-row">
                            <input type="text" id="input-${id}" placeholder="Search location..." />
                            <button class="rm-action-btn btn-map" title="Pick from Map">🎯</button>
                            <button class="rm-action-btn btn-gps" title="Use My Location">📍</button>
                            ${clearBtnHTML}
                        </div>
                        
                        <div class="rm-adv-form">
                            <label class="rm-adv-label">Marker Name
                                <input type="text" class="input-label" placeholder="Type and press Enter (or tap OK)..." />
                            </label>
                            <label class="rm-adv-label">Custom Image
                                <input type="file" class="input-icon-file" accept="image/png, image/jpeg, image/svg+xml, image/webp" />
                            </label>
                            <label class="rm-adv-label">Detailed Notes
                                <textarea class="input-desc" placeholder="Type and press Enter (or tap OK)..."></textarea>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const btnAddCp = document.getElementById('rm-btn-add-cp');
        btnAddCp.addEventListener('click', () => this.addCheckpoint());

        // CLICK DELEGATION
        this.container.addEventListener('click', (e) => {
            const node = e.target.closest('.rm-node');
            if (!node) return;
            const id = node.getAttribute('data-id');

            if (e.target.closest('.rm-summary')) this.expandNode(id);
            else if (e.target.closest('.btn-clear')) this.clearNode(id);
            else if (e.target.closest('.btn-remove')) this.removeCheckpoint(id);
            else if (e.target.closest('.btn-map')) this.startMapPicking(id);
            else if (e.target.closest('.btn-gps')) this.fetchDeviceGps(id);
        });

        // FILE UPLOAD (Fires on 'change' when device returns image)
        this.container.addEventListener('change', (e) => {
            if (e.target.classList.contains('input-icon-file')) {
                const id = e.target.closest('.rm-node').getAttribute('data-id');
                const file = e.target.files[0];
                if (file && window.markerManager.getMarker(id)) {
                    const objectUrl = URL.createObjectURL(file);
                    window.markerManager.setMarkerIcon(id, file.name, objectUrl);
                }
            }
        });

        // ENTER KEY HANDLER (For Label and Textarea)
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const id = e.target.closest('.rm-node')?.getAttribute('data-id');
                if (!id) return;

                if (e.target.classList.contains('input-label')) {
                    e.preventDefault(); 
                    window.markerManager.setMarkerLabel(id, e.target.value.trim());
                    this.updateNodeSummary(id);
                    e.target.blur(); 
                } 
                else if (e.target.classList.contains('input-desc')) {
                    e.preventDefault();
                    window.markerManager.setMarkerDescription(id, e.target.value.trim());
                    e.target.blur();
                }
            }
        });

        if (window.EventBus) {
            window.EventBus.on('map_clicked', (coords) => this.handleMapClick(coords));
            window.EventBus.on('marker_location_changed', (data) => this.syncNodeFromMarker(data.id));
        }
    }

    expandNode(idToExpand) {
        document.querySelectorAll('.rm-node:not(.add-cp-node)').forEach(node => {
            if (node.getAttribute('data-id') === idToExpand) {
                node.classList.add('expanded');
                node.classList.remove('collapsed');
            } else {
                node.classList.remove('expanded');
                node.classList.add('collapsed');
            }
        });
    }

    updateNodeSummary(id) {
        if (!window.markerManager) return;
        const marker = window.markerManager.getMarker(id);
        const summaryEl = document.getElementById(`summary-${id}`);
        if (!summaryEl) return;

        if (marker) {
            let display = marker.label ? `${marker.label}` : '';
            const locationStr = marker.address || `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;
            display = display ? `${display} (${locationStr})` : locationStr;
            summaryEl.textContent = display;
            summaryEl.style.color = 'var(--text-main)';
        } else {
            summaryEl.textContent = "Select location...";
            summaryEl.style.color = 'var(--text-muted)';
        }
        this.checkRouteValidity();
    }

    checkRouteValidity() {
        if (!window.markerManager) return;
        const originExists = !!window.markerManager.getMarker('origin');
        const destExists = !!window.markerManager.getMarker('destination');

        document.getElementById('rm-btn-add-cp').style.display = originExists ? 'flex' : 'none';
        
        const btnRoute = document.getElementById('btn-calculate-route');
        if (btnRoute) {
            if (originExists && destExists) btnRoute.removeAttribute('disabled');
            else btnRoute.setAttribute('disabled', 'true');
        }
    }

    startMapPicking(id) {
        this.pickingForId = id;
        document.body.style.cursor = 'crosshair';
    }

    async handleMapClick(coords) {
        if (!this.pickingForId) return;
        const id = this.pickingForId;
        this.pickingForId = null;
        document.body.style.cursor = 'default';
        await this.createOrUpdateMarker(id, coords.lat, coords.lng, null, null);
    }

    async fetchDeviceGps(id) {
        try {
            document.getElementById(`summary-${id}`).textContent = "Fetching GPS...";
            const coords = await window.gpsTracker.getCurrentLocation(id);
            await this.createOrUpdateMarker(id, coords.lat, coords.lng, null, "Current GPS Location");
        } catch (error) {
            if (error.message !== "ABORTED_BY_USER") {
                alert("Failed to get GPS location. " + error.message);
                this.updateNodeSummary(id);
            }
        }
    }

    async createOrUpdateMarker(id, lat, lng, placeId = null, address = null) {
        if (!window.markerManager) return;
        const existingMarker = window.markerManager.getMarker(id);
        const gmpInput = document.getElementById(`input-${id}`);
        
        if (gmpInput) gmpInput.setAttribute('data-marker-id', id);

        if (existingMarker) {
            await window.markerManager.setMarkerLocationAndPlace(id, lat, lng, placeId, address);
        } else {
            const isOrigin = id === 'origin';
            const isDest = id === 'destination';
            const label = isOrigin ? "Origin" : (isDest ? "Destination" : `Checkpoint`);
            await window.markerManager.addMarker({
                id, lat, lng, address, placeId, label, isOrigin, isDestination: isDest
            });
        }
        this.syncNodeFromMarker(id);
    }

    syncNodeFromMarker(id) {
        if (!window.markerManager) return;
        const marker = window.markerManager.getMarker(id);
        if (!marker) return;

        this.updateNodeSummary(id);
        const node = document.querySelector(`.rm-node[data-id="${id}"]`);
        if (node) {
            node.querySelector('.input-label').value = marker.label || '';
            node.querySelector('.input-desc').value = marker.description || '';
        }
    }

    async clearNode(id) {
        window.gpsTracker.cancelRequest(id);
        if (window.markerManager) await window.markerManager.deleteMarker(id);

        const node = document.querySelector(`.rm-node[data-id="${id}"]`);
        if (node) {
            const gmpInput = node.querySelector(`[id="input-${id}"]`);
            if (gmpInput) {
                gmpInput.value = '';
                gmpInput.removeAttribute('data-marker-id');
            }
            node.querySelector('.input-label').value = '';
            node.querySelector('.input-icon-file').value = '';
            node.querySelector('.input-desc').value = '';
        }
        this.updateNodeSummary(id);
    }

    addCheckpoint() {
        this.checkpointCount++;
        const id = `cp_${this.checkpointCount}`;
        const container = document.getElementById('rm-checkpoints-container');
        
        // 🌟 FIX: Inserts dynamically before the destination
        container.insertAdjacentHTML('beforeend', this.generateNodeHTML(id, `Checkpoint ${this.checkpointCount}`, false));
        this.attachAutocompleteToNode(id);
        this.expandNode(id);
    }

    async removeCheckpoint(id) {
        await this.clearNode(id);
        document.querySelector(`.rm-node[data-id="${id}"]`)?.remove();
        
        let seq = 1;
        document.querySelectorAll('#rm-checkpoints-container .rm-node').forEach(node => {
            const nodeTitle = node.querySelector('.rm-node-title');
            if (nodeTitle) nodeTitle.textContent = `Checkpoint ${seq}`;
            seq++;
        });
    }

    attachAutocompleteToNode(id) {
        const input = document.getElementById(`input-${id}`);
        if (input && window.placesAutocompleteService) {
            window.placesAutocompleteService.attachToInput(input);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.routingManager = new RoutingManager('routing-ui-container');
});
