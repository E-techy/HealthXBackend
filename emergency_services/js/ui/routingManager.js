/**
 * RoutingManager
 * 
 * Auto-generates and manages the Routing Panel UI.
 * Handles accordion expanding/collapsing, GPS fetching, Map picking, 
 * and synchronizing data down to the MarkerManager.
 */
class RoutingManager {
    /**
     * @param {String} containerId - The ID of the div where the panel should be built.
     */
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pickingForId = null; // Tracks if user is clicking on the map for a specific node
        this.checkpointCount = 0;

        if (!this.container) {
            console.error(`[RoutingManager] Container #${containerId} not found.`);
            return;
        }

        this.buildInitialUI();
        this.bindGlobalEvents();

        // Initially attempt to attach Places Autocomplete for Origin and Dest
        setTimeout(() => {
            this.attachAutocompleteToNode('origin');
            this.attachAutocompleteToNode('destination');
        }, 500);
    }

    // ==========================================
    // 1. UI BUILDERS
    // ==========================================
    
    buildInitialUI() {
        this.container.className = 'routing-manager-wrapper';
        this.container.innerHTML = `
            <div id="routing-manager-panel">
                <!-- Header -->
                <div class="rm-header">
                    <span class="rm-title-text">Route Dispatch</span>
                    <button class="btn-global-toggle" title="Toggle Panel">◀</button>
                </div>
                
                <!-- Body / Nodes -->
                <div class="rm-body" id="rm-node-list">
                    ${this.generateNodeHTML('origin', 'Origin', true)}
                    
                    <div id="rm-checkpoints-container"></div>
                    
                    <button id="rm-btn-add-cp" class="rm-btn-add-cp" style="display: none;">+ Add Checkpoint</button>
                    
                    ${this.generateNodeHTML('destination', 'Destination', false)}
                </div>

                <!-- Footer -->
                <div class="rm-footer">
                    <button id="rm-btn-find-route" class="rm-btn-primary" disabled>Calculate Route</button>
                </div>
            </div>
        `;

        // Expand Origin by default
        this.expandNode('origin');
    }

    generateNodeHTML(id, title, isOriginOrDest) {
        const typeClass = id === 'origin' ? 'origin' : (id === 'destination' ? 'destination' : 'checkpoint');
        const clearBtnHTML = isOriginOrDest 
            ? `<button class="rm-action-btn rm-btn-danger btn-clear" title="Clear">✖</button>`
            : `<button class="rm-action-btn rm-btn-danger btn-remove" title="Remove Checkpoint">🗑</button>`;

        return `
            <div class="rm-node collapsed" data-id="${id}">
                <!-- Collapsed Summary -->
                <div class="rm-summary">
                    <div class="rm-dot ${typeClass}"></div>
                    <div class="rm-summary-info">
                        <span class="rm-node-title">${title}</span>
                        <span class="rm-node-value" id="summary-${id}">Select location...</span>
                    </div>
                </div>
                
                <!-- Expanded Content -->
                <div class="rm-details">
                    <div class="rm-input-row">
                        <input type="text" id="input-${id}" placeholder="Search Google Maps..." />
                        <button class="rm-action-btn btn-map" title="Pick from Map">🎯</button>
                        <button class="rm-action-btn btn-gps" title="Use My Location">📍</button>
                        ${clearBtnHTML}
                    </div>
                    
                    <div class="rm-adv-form">
                        <div class="rm-adv-title">Advanced Marker Settings</div>
                        <input type="text" class="input-label" placeholder="Custom Label Name" />
                        <input type="text" class="input-icon" placeholder="Custom Icon URL (png, jpg, svg)" />
                        <textarea class="input-desc" placeholder="Detailed description/notes..."></textarea>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 2. EVENT BINDING
    // ==========================================

    bindGlobalEvents() {
        const panel = document.getElementById('routing-manager-panel');
        const body = document.getElementById('rm-node-list');
        const btnAddCp = document.getElementById('rm-btn-add-cp');
        const btnFindRoute = document.getElementById('rm-btn-find-route');

        // Global Collapse
        panel.querySelector('.btn-global-toggle').addEventListener('click', () => {
            panel.classList.toggle('panel-collapsed');
        });

        // Add Checkpoint
        btnAddCp.addEventListener('click', () => this.addCheckpoint());

        // Event Delegation for all Nodes
        body.addEventListener('click', (e) => {
            const node = e.target.closest('.rm-node');
            if (!node) return;
            const id = node.getAttribute('data-id');

            // 1. Expand Accordion
            if (e.target.closest('.rm-summary')) {
                this.expandNode(id);
            }
            // 2. Clear Origin/Dest
            else if (e.target.closest('.btn-clear')) {
                this.clearNode(id);
            }
            // 3. Remove Checkpoint completely
            else if (e.target.closest('.btn-remove')) {
                this.removeCheckpoint(id);
            }
            // 4. Map Picking
            else if (e.target.closest('.btn-map')) {
                this.startMapPicking(id);
            }
            // 5. GPS Location
            else if (e.target.closest('.btn-gps')) {
                this.fetchDeviceGps(id);
            }
        });

        // Event Delegation for Advanced Inputs (Auto-sync to MarkerManager on blur/enter)
        body.addEventListener('change', (e) => {
            const node = e.target.closest('.rm-node');
            if (!node) return;
            const id = node.getAttribute('data-id');
            const marker = window.markerManager.getMarker(id);

            // If user types here, cancel any pending GPS request to prevent overwrite
            window.gpsTracker.cancelRequest(id);

            if (!marker) return; // Cant update advanced settings if marker doesn't exist yet

            if (e.target.classList.contains('input-label')) {
                window.markerManager.setMarkerLabel(id, e.target.value.trim());
                this.updateNodeSummary(id); // Update summary text to show new label
            }
            else if (e.target.classList.contains('input-icon')) {
                const url = e.target.value.trim();
                // Validate via MarkerManager
                if (url && window.markerManager.isValidImageUrl(url)) {
                    window.markerManager.setMarkerIcon(id, marker.iconName, url);
                } else if (url) {
                    alert("Invalid image format. Use JPG, PNG, GIF, SVG, or WEBP.");
                    e.target.value = '';
                }
            }
            else if (e.target.classList.contains('input-desc')) {
                window.markerManager.setMarkerDescription(id, e.target.value.trim());
            }
        });

        // Listen for Map Clicks (from flatMap.js or sphereMap.js)
        if (window.EventBus) {
            window.EventBus.on('map_clicked', (coords) => this.handleMapClick(coords));
            
            // Listen for changes emitted by PlacesAutocomplete or MarkerManager dragging
            window.EventBus.on('marker_location_changed', (data) => this.syncNodeFromMarker(data.id));
        }
    }

    // ==========================================
    // 3. ACCORDION & UI LOGIC
    // ==========================================

    expandNode(idToExpand) {
        document.querySelectorAll('.rm-node').forEach(node => {
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
        const marker = window.markerManager.getMarker(id);
        const summaryEl = document.getElementById(`summary-${id}`);
        
        if (!summaryEl) return;

        if (marker) {
            // Show "Label - Address" or just Coordinates if no address
            let display = marker.label ? `${marker.label}` : '';
            const locationStr = marker.address || `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;
            
            if (display) display += ` (${locationStr})`;
            else display = locationStr;

            summaryEl.textContent = display;
            summaryEl.style.color = 'var(--rm-text)';
        } else {
            summaryEl.textContent = "Select location...";
            summaryEl.style.color = 'var(--rm-text-muted)';
        }

        this.checkRouteValidity();
    }

    checkRouteValidity() {
        const originExists = !!window.markerManager.getMarker('origin');
        const destExists = !!window.markerManager.getMarker('destination');

        // Show/Hide Add Checkpoint button based on Origin
        document.getElementById('rm-btn-add-cp').style.display = originExists ? 'block' : 'none';

        // Enable/Disable Find Route button
        const btnRoute = document.getElementById('rm-btn-find-route');
        if (originExists && destExists) {
            btnRoute.removeAttribute('disabled');
        } else {
            btnRoute.setAttribute('disabled', 'true');
        }
    }

    // ==========================================
    // 4. MAP PICKING & GPS
    // ==========================================

    startMapPicking(id) {
        this.pickingForId = id;
        document.body.style.cursor = 'crosshair';
        console.log(`[RoutingManager] Click on the map to set location for ${id}`);
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
                this.updateNodeSummary(id); // Revert summary
            }
        }
    }

    // ==========================================
    // 5. DATA SYNC & CRUD
    // ==========================================

    async createOrUpdateMarker(id, lat, lng, placeId = null, address = null) {
        const existingMarker = window.markerManager.getMarker(id);
        const gmpInput = document.getElementById(`input-${id}`);
        
        // Safety: ensure Places UI knows about this marker
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
        const marker = window.markerManager.getMarker(id);
        if (!marker) return;

        // Update Summary
        this.updateNodeSummary(id);

        // Update Advanced Inputs
        const node = document.querySelector(`.rm-node[data-id="${id}"]`);
        if (node) {
            node.querySelector('.input-label').value = marker.label || '';
            node.querySelector('.input-icon').value = marker.iconUrl === window.markerManager.DEFAULT_ICON_URL ? '' : marker.iconUrl;
            node.querySelector('.input-desc').value = marker.description || '';
        }
    }

    async clearNode(id) {
        // Cancel GPS
        window.gpsTracker.cancelRequest(id);

        // Delete from maps & state
        await window.markerManager.deleteMarker(id);

        // Clear UI Inputs
        const node = document.querySelector(`.rm-node[data-id="${id}"]`);
        if (node) {
            const gmpInput = node.querySelector(`[id="input-${id}"]`);
            if (gmpInput) {
                gmpInput.value = '';
                gmpInput.removeAttribute('data-marker-id');
            }
            node.querySelector('.input-label').value = '';
            node.querySelector('.input-icon').value = '';
            node.querySelector('.input-desc').value = '';
        }

        this.updateNodeSummary(id);
    }

    addCheckpoint() {
        this.checkpointCount++;
        const id = `cp_${this.checkpointCount}`;
        const container = document.getElementById('rm-checkpoints-container');
        
        container.insertAdjacentHTML('beforeend', this.generateNodeHTML(id, `Checkpoint ${this.checkpointCount}`, false));
        
        this.attachAutocompleteToNode(id);
        this.expandNode(id);
    }

    async removeCheckpoint(id) {
        await this.clearNode(id);
        document.querySelector(`.rm-node[data-id="${id}"]`)?.remove();
        
        // Update labels for remaining checkpoints visually
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

// Instantiate and bind to a generic div in your index.html
document.addEventListener('DOMContentLoaded', () => {
    // Requires <div id="routing-ui-container"></div> in your HTML
    window.routingManager = new RoutingManager('routing-ui-container');
});
