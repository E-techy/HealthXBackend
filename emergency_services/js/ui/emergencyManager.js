/**
 * HealthX Emergency Command Center
 * emergencyManager.js
 * 
 * Handles the draggable Emergency Manager window, public discovery search,
 * smooth filtering dropdowns, and emergency creation/joining UI.
 */
(() => {
    "use strict";

    class EmergencyManager {
        constructor() {
            this.container = null;
            this.initialized = false;
            
            // State
            this.activeTab = 'discover';
            this.emergencies = [];
            this.currentLocation = { lat: 28.6139, lng: 77.2090 }; // Default fallback (New Delhi)
            
            // Filters State
            this.activeFilters = {
                radius: 50 // Default 50km radius
            };

            // Pre-built dropdown suggestions (Mock data for the smooth dropdown)
            this.filterSuggestions = {
                state: ['Delhi', 'Jharkhand', 'Maharashtra', 'Karnataka'],
                city: ['New Delhi', 'Ranchi', 'Mumbai', 'Bangalore', 'Indore'],
                country: ['India', 'USA', 'UK']
            };
        }

        init() {
            if (this.initialized) return;
            console.log("🚀 [EmergencyManager] Initializing UI...");

            this.injectHTML();
            this.cacheElements();
            this.bindDragEvents();
            this.bindUIEvents();
            this.getUserLocation();
            this.renderFilterPills();
            
            this.initialized = true;
        }

        // ======================================================================
        // 1. SHELL INJECTION & CACHING
        // ======================================================================
        injectHTML() {
            const html = `
                <div id="em-manager-window" class="em-floating-window hidden">
                    <!-- Header -->
                    <div class="em-header" id="em-drag-handle">
                        <span class="em-title">Emergency Operations</span>
                        <button class="em-close-btn" id="em-btn-close">×</button>
                    </div>
                    
                    <!-- Tabs -->
                    <div class="em-tabs">
                        <button class="em-tab-btn active" data-tab="discover">Discover</button>
                        <button class="em-tab-btn" data-tab="manage">Create / Manage</button>
                    </div>
                    
                    <!-- Content Area -->
                    <div class="em-content-area">
                        
                        <!-- VIEW: DISCOVER -->
                        <div id="em-view-discover" class="em-view active">
                            <!-- Search & Dropdown -->
                            <div class="em-dropdown-wrapper">
                                <div class="em-search-bar">
                                    <select id="em-filter-type" class="em-search-input" style="max-width: 120px;">
                                        <option value="city">City</option>
                                        <option value="state">State</option>
                                        <option value="country">Country</option>
                                        <option value="radius">Radius (km)</option>
                                        <option value="startDate">Date (From)</option>
                                    </select>
                                    <input type="text" id="em-filter-input" class="em-search-input" placeholder="Type to search or add custom...">
                                    <button id="em-btn-add-filter" class="em-btn em-btn-primary">Add</button>
                                </div>
                                <!-- Smooth Dropdown Menu -->
                                <div id="em-smooth-dropdown" class="em-dropdown-menu">
                                    <div id="em-dropdown-list" class="em-dropdown-list"></div>
                                </div>
                            </div>

                            <!-- Active Filters -->
                            <div id="em-active-filters" class="em-active-filters"></div>

                            <!-- Search Button -->
                            <button id="em-btn-search" class="em-btn em-btn-primary" style="width: 100%;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                Search Public Emergencies
                            </button>

                            <!-- List / Detail Container -->
                            <div id="em-results-container" class="em-list-container">
                                <!-- Default Empty State -->
                                <div class="em-empty-state">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>
                                    <p>Apply filters and hit search to discover active incidents near you.</p>
                                </div>
                            </div>
                        </div>

                        <!-- VIEW: CREATE / MANAGE -->
                        <div id="em-view-manage" class="em-view">
                            <form id="em-create-form">
                                <div class="em-form-group">
                                    <label>Incident Title</label>
                                    <input type="text" id="em-create-title" required placeholder="e.g. Missing Person - Sector 4">
                                </div>
                                <div class="em-form-group">
                                    <label>Description</label>
                                    <textarea id="em-create-desc" placeholder="Details about the incident..."></textarea>
                                </div>
                                <div class="em-form-row">
                                    <div class="em-form-group">
                                        <label>City</label>
                                        <input type="text" id="em-create-city">
                                    </div>
                                    <div class="em-form-group">
                                        <label>State</label>
                                        <input type="text" id="em-create-state">
                                    </div>
                                </div>
                                <div class="em-form-group">
                                    <label>Passcode (Optional)</label>
                                    <input type="password" id="em-create-pass" placeholder="Leave blank for open access">
                                </div>
                                <label class="em-checkbox-group">
                                    <input type="checkbox" id="em-create-public" checked>
                                    List globally in Public Discovery Search
                                </label>
                                <hr style="border:0; border-top:1px solid var(--border-panel); margin: 10px 0;">
                                <div style="font-size: 11px; font-weight:700; color:var(--text-muted); margin-bottom: 10px; text-transform:uppercase;">Victim Metadata (Optional)</div>
                                <div class="em-form-row">
                                    <div class="em-form-group">
                                        <label>Victim Name</label>
                                        <input type="text" id="em-victim-name">
                                    </div>
                                    <div class="em-form-group">
                                        <label>Reward (USD)</label>
                                        <input type="number" id="em-victim-reward" value="0">
                                    </div>
                                </div>
                                <label class="em-checkbox-group">
                                    <input type="checkbox" id="em-victim-public">
                                    Make Victim Details Public
                                </label>
                                
                                <button type="submit" class="em-btn em-btn-primary" style="width: 100%; margin-top: 10px;">Initialize Emergency</button>
                            </form>
                        </div>

                    </div>
                </div>
            `;
            document.getElementById('ui-layer').insertAdjacentHTML('beforeend', html);
        }

        cacheElements() {
            this.container = document.getElementById('em-manager-window');
            this.dragHandle = document.getElementById('em-drag-handle');
            this.btnClose = document.getElementById('em-btn-close');
            this.tabBtns = document.querySelectorAll('.em-tab-btn');
            
            // Discover View Elements
            this.filterTypeSel = document.getElementById('em-filter-type');
            this.filterInput = document.getElementById('em-filter-input');
            this.btnAddFilter = document.getElementById('em-btn-add-filter');
            this.activeFiltersDiv = document.getElementById('em-active-filters');
            this.smoothDropdown = document.getElementById('em-smooth-dropdown');
            this.dropdownList = document.getElementById('em-dropdown-list');
            this.btnSearch = document.getElementById('em-btn-search');
            this.resultsContainer = document.getElementById('em-results-container');
            
            // Create View Elements
            this.createForm = document.getElementById('em-create-form');
        }

        // ======================================================================
        // 2. WINDOW VISIBILITY & DRAGGING
        // ======================================================================
        show() {
            if (!this.initialized) this.init();
            this.container.classList.remove('hidden');
            console.log("👁️ [EmergencyManager] Window opened.");
        }

        hide() {
            if (this.container) this.container.classList.add('hidden');
            console.log("🙈 [EmergencyManager] Window hidden.");
        }

        bindDragEvents() {
            let isDragging = false, startX, startY, initialLeft, initialTop;

            this.dragHandle.addEventListener('mousedown', (e) => {
                if (e.target === this.btnClose) return; // Don't drag if clicking close
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = this.container.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                this.container.style.transition = 'none'; // Disable smooth transition while dragging
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                this.container.style.left = `${initialLeft + dx}px`;
                this.container.style.top = `${initialTop + dy}px`;
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.container.style.transition = 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease';
                }
            });
            
            this.btnClose.addEventListener('click', () => this.hide());
        }

        // ======================================================================
        // 3. UI EVENTS (Tabs, Smooth Dropdown, Filters)
        // ======================================================================
        bindUIEvents() {
            // Tab Switching
            this.tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.tabBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    document.querySelectorAll('.em-view').forEach(v => v.classList.remove('active'));
                    document.getElementById(`em-view-${e.target.dataset.tab}`).classList.add('active');
                });
            });

            // Filter Type Change (Reset input and change type)
            this.filterTypeSel.addEventListener('change', () => {
                this.filterInput.value = '';
                this.filterInput.type = this.filterTypeSel.value === 'startDate' ? 'date' : 
                                        this.filterTypeSel.value === 'radius' ? 'number' : 'text';
                this.smoothDropdown.classList.remove('active');
            });

            // Smooth Dropdown Typing Logic
            this.filterInput.addEventListener('input', (e) => {
                if (['radius', 'startDate'].includes(this.filterTypeSel.value)) return;
                
                const val = e.target.value.toLowerCase();
                const type = this.filterTypeSel.value;
                const options = this.filterSuggestions[type] || [];
                
                const matches = options.filter(opt => opt.toLowerCase().includes(val));
                
                if (matches.length > 0) {
                    this.dropdownList.innerHTML = matches.map(m => `<div class="em-dropdown-item">${m}</div>`).join('');
                    this.smoothDropdown.classList.add('active');
                } else {
                    this.smoothDropdown.classList.remove('active');
                }
            });

            // Dropdown Item Click
            this.dropdownList.addEventListener('click', (e) => {
                if (e.target.classList.contains('em-dropdown-item')) {
                    this.filterInput.value = e.target.textContent;
                    this.smoothDropdown.classList.remove('active');
                    this.addCurrentFilter();
                }
            });

            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.em-dropdown-wrapper')) {
                    this.smoothDropdown.classList.remove('active');
                }
            });

            // Add Filter Button
            this.btnAddFilter.addEventListener('click', () => this.addCurrentFilter());
            
            // Allow Enter key to add filter
            this.filterInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.smoothDropdown.classList.remove('active');
                    this.addCurrentFilter();
                }
            });

            // Active Filters Delegation (Remove Filter)
            this.activeFiltersDiv.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.em-pill-remove');
                if (removeBtn) {
                    const key = removeBtn.dataset.key;
                    delete this.activeFilters[key];
                    console.log(`❌ [EmergencyManager] Filter removed: ${key}`);
                    this.renderFilterPills();
                }
            });

            // Main Search Button
            this.btnSearch.addEventListener('click', () => this.fetchEmergencies());

            // Create Form Submit
            this.createForm.addEventListener('submit', (e) => this.handleCreateEmergency(e));
        }

        // ======================================================================
        // 4. FILTER PILLS LOGIC
        // ======================================================================
        addCurrentFilter() {
            const key = this.filterTypeSel.value;
            const val = this.filterInput.value.trim();
            
            if (!val) return;

            this.activeFilters[key] = val;
            console.log(`✅ [EmergencyManager] Filter added -> ${key}: ${val}`);
            
            this.filterInput.value = '';
            this.renderFilterPills();
        }

        renderFilterPills() {
            this.activeFiltersDiv.innerHTML = '';
            for (const [key, value] of Object.entries(this.activeFilters)) {
                let displayVal = value;
                if (key === 'radius') displayVal = `${value} km`;
                
                const pill = document.createElement('div');
                pill.className = 'em-filter-pill';
                pill.innerHTML = `
                    <span>${key.toUpperCase()}: ${displayVal}</span>
                    <button class="em-pill-remove" data-key="${key}">×</button>
                `;
                this.activeFiltersDiv.appendChild(pill);
            }
        }

        // ======================================================================
        // 5. GEOLOCATION & HAERSINE DISTANCE
        // ======================================================================
        getUserLocation() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.currentLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        console.log(`📍 [EmergencyManager] Location acquired: ${this.currentLocation.lat}, ${this.currentLocation.lng}`);
                    },
                    (error) => console.warn("Location access denied or failed. Using default.", error)
                );
            }
        }

        calculateDistance(lat1, lon1, lat2, lon2) {
            if (!lat1 || !lon1 || !lat2 || !lon2) return null;
            const R = 6371; // km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return (R * c).toFixed(1);
        }

        // ======================================================================
        // 6. API INTERACTION: DISCOVER & RENDER
        // ======================================================================
        async fetchEmergencies() {
            console.log(`🔍 [EmergencyManager] Fetching with filters:`, this.activeFilters);
            this.resultsContainer.innerHTML = `<div class="em-empty-state">Searching global networks...</div>`;

            try {
                // Build Query String
                const params = new URLSearchParams(this.activeFilters);
                // Inject current location if radius is applied
                if (this.activeFilters.radius) {
                    params.append('lat', this.currentLocation.lat);
                    params.append('lng', this.currentLocation.lng);
                }

                // Assume window.API_BASE_URL exists, or default to current origin
                const baseUrl = window.API_BASE_URL || '';
                const response = await fetch(`${baseUrl}/api/emergency/search?${params.toString()}`);
                const data = await response.json();

                console.log(`📥 [EmergencyManager] Search Response:`, data);

                if (data.success && data.count > 0) {
                    this.emergencies = data.data;
                    this.renderList();
                } else {
                    this.resultsContainer.innerHTML = `
                        <div class="em-empty-state">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                            <p>No active emergencies found matching your criteria.</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error(`💥 [EmergencyManager] Search failed:`, error);
                this.resultsContainer.innerHTML = `<div class="em-empty-state" style="color:var(--danger)">Error fetching data.</div>`;
            }
        }

        renderList() {
            this.resultsContainer.innerHTML = '';
            
            this.emergencies.forEach((em, index) => {
                let distHtml = '';
                if (em.location && em.location.coordinates) {
                    const dist = this.calculateDistance(
                        this.currentLocation.lat, this.currentLocation.lng,
                        em.location.coordinates[1], em.location.coordinates[0]
                    );
                    if (dist) distHtml = `<div class="em-card-distance">${dist} km away</div>`;
                }

                const locationStr = em.address ? `${em.address.city || ''}, ${em.address.state || ''}`.replace(/^, | , $/g, '') : 'Unknown Location';

                const card = document.createElement('div');
                card.className = 'em-card';
                card.innerHTML = `
                    <div class="em-card-header">
                        <div class="em-card-title">${em.title}</div>
                        ${distHtml}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); font-weight:600;">${locationStr} • ${new Date(em.createdAt).toLocaleDateString()}</div>
                    <div class="em-card-desc">${em.description || 'No description provided.'}</div>
                `;

                card.addEventListener('click', () => this.showDetailView(index));
                this.resultsContainer.appendChild(card);
            });
        }

        showDetailView(index) {
            const em = this.emergencies[index];
            console.log(`📄 [EmergencyManager] Opening Details for: ${em.emergencyTrackingId}`);

            const locationStr = em.address ? `${em.address.city || ''}, ${em.address.state || ''}`.replace(/^, | , $/g, '') : 'Unknown Location';

            let victimHtml = '';
            if (em.victimMetadata && em.victimMetadata.isPublic) {
                const img = em.victimMetadata.imageUri || 'https://via.placeholder.com/60?text=NA';
                const reward = em.victimMetadata.rewardAmount > 0 ? `Reward: ${em.victimMetadata.rewardAmount} ${em.victimMetadata.rewardCurrency}` : '';
                victimHtml = `
                    <div class="em-victim-card">
                        <img src="${img}" class="em-victim-img" alt="Victim">
                        <div class="em-victim-info">
                            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Subject of Interest</div>
                            <div class="em-victim-name">${em.victimMetadata.name || 'Unknown'}</div>
                            <div class="em-victim-reward">${reward}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${em.victimMetadata.extraDetails || ''}</div>
                        </div>
                    </div>
                `;
            }

            const isProtected = em.isPasswordProtected ? `
                <input type="password" id="em-join-pass" placeholder="Enter session passcode">
            ` : '';

            this.resultsContainer.innerHTML = `
                <div class="em-detail-header">
                    <button class="em-back-btn" id="em-btn-back">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div style="font-weight:700; font-size:14px;">Incident Details</div>
                </div>
                
                <h3 style="color:var(--accent); margin-bottom: 4px;">${em.title}</h3>
                <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom: 10px;">ID: ${em.emergencyTrackingId} • ${locationStr}</div>
                <div style="font-size:13px; line-height:1.5;">${em.description || 'No detailed description.'}</div>

                ${victimHtml}

                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button id="em-btn-map" class="em-btn" style="flex:1;">Show on Map</button>
                </div>

                <div class="em-join-box">
                    <div style="font-size:12px; font-weight:600;">Join Response Operation</div>
                    ${isProtected}
                    <button id="em-btn-join" class="em-btn em-btn-primary">Authenticate & Join</button>
                </div>
            `;

            // Bind Back Button
            document.getElementById('em-btn-back').addEventListener('click', () => this.renderList());

            // Bind Show on Map
            document.getElementById('em-btn-map').addEventListener('click', () => {
                console.log(`🗺️ [EmergencyManager] Action: Show on Map Triggered. Target: ${em.location?.coordinates}`);
                // TODO: Interface with markerManager to pan map.
            });

            // Bind Join
            document.getElementById('em-btn-join').addEventListener('click', () => {
                const passInput = document.getElementById('em-join-pass');
                const password = passInput ? passInput.value : null;
                this.joinEmergency(em.emergencyTrackingId, password);
            });
        }

        async joinEmergency(trackingId, password) {
            console.log(`🔑 [EmergencyManager] Attempting to join ${trackingId}...`);
            
            try {
                const baseUrl = window.API_BASE_URL || '';
                // Assume standard app auth token is stored in localStorage by core/auth.js
                const appToken = localStorage.getItem('healthx_token'); 
                const headers = { 'Content-Type': 'application/json' };
                if (appToken) headers['Authorization'] = `Bearer ${appToken}`;

                const response = await fetch(`${baseUrl}/api/emergency/join/credentials`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ emergencyTrackingId: trackingId, password })
                });

                const data = await response.json();
                console.log(`📥 [EmergencyManager] Join Response:`, data);

                if (data.success) {
                    alert(`Successfully joined ${data.data.title}! Session token acquired.`);
                    // Save emergency session token for socket connections
                    localStorage.setItem(`em_token_${trackingId}`, data.data.token);
                    
                    // Trigger global event if UI wants to switch to tracking panel automatically
                    if (window.EventBus) window.EventBus.emit('emergency_joined', data.data);
                } else {
                    alert(`Failed to join: ${data.message}`);
                }
            } catch (error) {
                console.error(`💥 [EmergencyManager] Join Request Failed:`, error);
            }
        }

        // ======================================================================
        // 7. API INTERACTION: CREATE
        // ======================================================================
        async handleCreateEmergency(e) {
            e.preventDefault();
            
            const payload = {
                title: document.getElementById('em-create-title').value,
                description: document.getElementById('em-create-desc').value,
                password: document.getElementById('em-create-pass').value,
                isPublicVisibility: document.getElementById('em-create-public').checked,
                address: {
                    city: document.getElementById('em-create-city').value,
                    state: document.getElementById('em-create-state').value
                },
                location: this.currentLocation, // Auto-attaching current coordinates
                victimMetadata: {
                    isPublic: document.getElementById('em-victim-public').checked,
                    name: document.getElementById('em-victim-name').value,
                    rewardAmount: parseFloat(document.getElementById('em-victim-reward').value)
                }
            };

            console.log(`📤 [EmergencyManager] Creating Emergency Payload:`, payload);

            try {
                const baseUrl = window.API_BASE_URL || '';
                const appToken = localStorage.getItem('healthx_token');
                
                const response = await fetch(`${baseUrl}/api/emergency/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${appToken}` // Requires Authentication
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                console.log(`📥 [EmergencyManager] Create Response:`, data);

                if (data.success) {
                    alert(`Emergency Initialized! Tracking ID: ${data.data.emergencyTrackingId}`);
                    this.createForm.reset();
                    // Switch back to discover tab
                    this.tabBtns[0].click();
                } else {
                    alert(`Error creating emergency: ${data.message}`);
                }
            } catch (error) {
                console.error(`💥 [EmergencyManager] Create Request Failed:`, error);
            }
        }

    }

    // Attach to global window scope so buttons in other files can call window.EmergencyManager.show()
    window.EmergencyManager = new EmergencyManager();

})();
