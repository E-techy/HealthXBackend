/**
 * HealthX Emergency Command Center
 * emergencyManager.js (UI Only)
 */
(() => {
    "use strict";

    class EmergencyManagerUI {
        constructor() {
            this.initialized = false;
            this.isVisible = false;
            this.emergencies = [];
            this.selectedGps = { lat: null, lng: null };
            this.activeFilters = { radius: 50 }; // Default 50km
        }

        init() {
            if (this.initialized) return;
            this.injectHTML();
            this.cacheElements();
            this.bindDragEvents();
            this.bindUIEvents();
            
            // Trigger background fetch for countries
            window.emergencyAPI.fetchGlobalCountries();
            this.initialized = true;
        }

        injectHTML() {
            const html = `
                <div id="em-manager-window" class="em-floating-window hidden">
                    <div class="em-header" id="em-drag-handle">
                        <span class="em-title">Emergency Operations</span>
                        <button class="em-close-btn" id="em-btn-close">×</button>
                    </div>
                    <div class="em-tabs">
                        <button class="em-tab-btn active" data-tab="discover">Discover</button>
                        <button class="em-tab-btn" data-tab="manage">Create Incident</button>
                    </div>
                    
                    <div class="em-content-area">
                        <!-- TAB: DISCOVER -->
                        <div id="em-view-discover" class="em-view active">
                            <div class="em-search-bar">
                                <select id="em-filter-type" class="em-search-input" style="max-width: 110px;">
                                    <option value="country">Country</option>
                                    <option value="state">State</option>
                                    <option value="city">City</option>
                                    <option value="radius">Radius (km)</option>
                                    <option value="startDate">Date (From)</option>
                                </select>
                                <div class="em-autocomplete-anchor" style="flex:1;">
                                    <input type="text" id="em-filter-input" class="em-search-input" style="width:100%;" placeholder="Select location filter...">
                                    <div id="em-filter-dropdown" class="em-global-dropdown"></div>
                                </div>
                                <button id="em-btn-add-filter" class="em-btn em-btn-primary">Add</button>
                            </div>
                            
                            <div id="em-active-filters" class="em-active-filters"></div>
                            <button id="em-btn-search" class="em-btn em-btn-primary" style="width: 100%;">🔍 Search Public Emergencies</button>
                            <div id="em-results-container" class="em-list-container">
                                <div class="em-empty-state">Apply filters to search global incidents.</div>
                            </div>
                        </div>

                        <!-- TAB: CREATE -->
                        <div id="em-view-manage" class="em-view">
                            <form id="em-create-form">
                                <div class="em-form-group">
                                    <label>Incident Title</label>
                                    <input type="text" id="em-create-title" required placeholder="e.g. Lost Hiker">
                                </div>
                                <div class="em-form-group">
                                    <label>Description</label>
                                    <textarea id="em-create-desc" placeholder="Provide full context..."></textarea>
                                </div>

                                <!-- GPS Picker -->
                                <div class="em-form-group">
                                    <label>Incident GPS Coordinates</label>
                                    <div class="em-gps-row">
                                        <input type="text" id="em-create-lat" class="em-gps-input" placeholder="Lat" readonly required>
                                        <input type="text" id="em-create-lng" class="em-gps-input" placeholder="Lng" readonly required>
                                    </div>
                                    <div class="em-gps-row">
                                        <button type="button" id="em-btn-gps-current" class="em-gps-btn">📍 Current Loc</button>
                                        <button type="button" id="em-btn-gps-map" class="em-gps-btn">🗺️ Pick on Map</button>
                                    </div>
                                </div>

                                <!-- Dynamic Location -->
                                <div class="em-form-row">
                                    <div class="em-form-group em-autocomplete-anchor">
                                        <label>Country</label>
                                        <input type="text" id="em-create-country" placeholder="Select..." autocomplete="off">
                                        <div id="em-create-country-drop" class="em-global-dropdown"></div>
                                    </div>
                                    <div class="em-form-group em-autocomplete-anchor">
                                        <label>State</label>
                                        <input type="text" id="em-create-state" placeholder="Select..." autocomplete="off" disabled>
                                        <div id="em-create-state-drop" class="em-global-dropdown"></div>
                                    </div>
                                </div>
                                <div class="em-form-group em-autocomplete-anchor">
                                    <label>City</label>
                                    <input type="text" id="em-create-city" placeholder="Select..." autocomplete="off" disabled>
                                    <div id="em-create-city-drop" class="em-global-dropdown"></div>
                                </div>

                                <div class="em-form-group">
                                    <label>Access Passcode (Optional)</label>
                                    <input type="password" id="em-create-pass" placeholder="Blank for open access">
                                </div>
                                <label class="em-checkbox-group">
                                    <input type="checkbox" id="em-create-public" checked>
                                    Allow Public Discovery
                                </label>

                                <hr style="border:0; border-top:1px solid var(--border-panel); margin: 10px 0;">
                                <div style="font-size: 11px; font-weight:700; color:var(--text-muted); margin-bottom: 10px;">VICTIM METADATA (OPTIONAL)</div>
                                <div class="em-form-row">
                                    <div class="em-form-group"><label>Name</label><input type="text" id="em-vic-name"></div>
                                    <div class="em-form-group"><label>Age</label><input type="number" id="em-vic-age"></div>
                                </div>
                                <div class="em-form-row">
                                    <div class="em-form-group"><label>Gender</label><input type="text" id="em-vic-gender"></div>
                                    <div class="em-form-group"><label>Reward (USD)</label><input type="number" id="em-vic-reward" value="0"></div>
                                </div>
                                <div class="em-form-group">
                                    <label>Photo URL</label>
                                    <input type="text" id="em-vic-photo" placeholder="https://...">
                                </div>
                                <label class="em-checkbox-group">
                                    <input type="checkbox" id="em-vic-public">
                                    Make Victim Info Publicly Visible
                                </label>
                                
                                <button type="submit" class="em-btn em-btn-primary" style="width: 100%; margin-top: 15px;">Create Emergency</button>
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
            
            // Search
            this.filterTypeSel = document.getElementById('em-filter-type');
            this.filterInput = document.getElementById('em-filter-input');
            this.filterDropdown = document.getElementById('em-filter-dropdown');
            this.btnAddFilter = document.getElementById('em-btn-add-filter');
            this.activeFiltersDiv = document.getElementById('em-active-filters');
            this.btnSearch = document.getElementById('em-btn-search');
            this.resultsContainer = document.getElementById('em-results-container');
            
            // Create
            this.createForm = document.getElementById('em-create-form');
            this.latInput = document.getElementById('em-create-lat');
            this.lngInput = document.getElementById('em-create-lng');
            this.btnGpsCurrent = document.getElementById('em-btn-gps-current');
            this.btnGpsMap = document.getElementById('em-btn-gps-map');
            
            this.inpCountry = document.getElementById('em-create-country');
            this.inpState = document.getElementById('em-create-state');
            this.inpCity = document.getElementById('em-create-city');
            this.dropCountry = document.getElementById('em-create-country-drop');
            this.dropState = document.getElementById('em-create-state-drop');
            this.dropCity = document.getElementById('em-create-city-drop');
        }

        // --- Toggle & Drag ---
        toggle() {
            if (!this.initialized) this.init();
            if (this.isVisible) {
                this.container.classList.add('hidden');
                this.isVisible = false;
            } else {
                this.container.classList.remove('hidden');
                this.isVisible = true;
                this.renderFilterPills();
            }
        }

        bindDragEvents() {
            let isDragging = false, startX, startY, initialLeft, initialTop;
            this.dragHandle.addEventListener('mousedown', (e) => {
                if (e.target === this.btnClose) return;
                isDragging = true;
                startX = e.clientX; startY = e.clientY;
                const rect = this.container.getBoundingClientRect();
                initialLeft = rect.left; initialTop = rect.top;
                this.container.style.transition = 'none';
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                this.container.style.left = `${initialLeft + (e.clientX - startX)}px`;
                this.container.style.top = `${initialTop + (e.clientY - startY)}px`;
            });
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.container.style.transition = 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease';
                }
            });
            this.btnClose.addEventListener('click', () => this.toggle());
        }

        // --- Autocomplete Factory ---
        attachAutocomplete(inputEl, dropdownEl, dataArrayGetter, onSelectCallback) {
            inputEl.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase();
                const dataset = dataArrayGetter() || [];
                const matches = dataset.filter(item => item.toLowerCase().includes(val)).slice(0, 10);
                
                if (matches.length > 0 && val !== '') {
                    dropdownEl.innerHTML = matches.map(m => `<div class="em-global-item">${m}</div>`).join('');
                    dropdownEl.classList.add('active');
                } else {
                    dropdownEl.classList.remove('active');
                }
            });

            dropdownEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('em-global-item')) {
                    inputEl.value = e.target.textContent;
                    dropdownEl.classList.remove('active');
                    if (onSelectCallback) onSelectCallback(inputEl.value);
                }
            });

            document.addEventListener('click', (e) => {
                if (e.target !== inputEl) dropdownEl.classList.remove('active');
            });
        }

        bindUIEvents() {
            // Tabs
            this.tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.tabBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    document.querySelectorAll('.em-view').forEach(v => v.classList.remove('active'));
                    document.getElementById(`em-view-${e.target.dataset.tab}`).classList.add('active');
                });
            });

            // --- CREATE FORM LOCATION BINDINGS ---
            this.attachAutocomplete(this.inpCountry, this.dropCountry, () => window.emergencyAPI.locData.countries, async (c) => {
                this.inpState.value = ''; this.inpCity.value = ''; this.inpCity.disabled = true;
                await window.emergencyAPI.fetchStatesForCountry(c);
                this.inpState.disabled = false;
            });
            this.attachAutocomplete(this.inpState, this.dropState, () => window.emergencyAPI.locData.states, async (s) => {
                this.inpCity.value = '';
                await window.emergencyAPI.fetchCitiesForState(this.inpCountry.value, s);
                this.inpCity.disabled = false;
            });
            this.attachAutocomplete(this.inpCity, this.dropCity, () => window.emergencyAPI.locData.cities);

            // --- SEARCH FILTER BINDINGS ---
            this.filterTypeSel.addEventListener('change', () => {
                const t = this.filterTypeSel.value;
                this.filterInput.value = '';
                
                if (t === 'radius') this.filterInput.type = 'number';
                else if (t === 'startDate') this.filterInput.type = 'date';
                else this.filterInput.type = 'text';

                // Strip old listeners
                const newInp = this.filterInput.cloneNode(true);
                this.filterInput.parentNode.replaceChild(newInp, this.filterInput);
                this.filterInput = newInp;
                
                this.filterInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); this.filterDropdown.classList.remove('active'); this.addCurrentFilter(); }
                });

                if (t === 'country') {
                    this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.emergencyAPI.locData.countries, (c) => {
                        this.addCurrentFilter();
                        window.emergencyAPI.prefetchSearchDataForCountry(c); 
                    });
                } else if (t === 'state') {
                    this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.emergencyAPI.searchLocData.states, () => this.addCurrentFilter());
                } else if (t === 'city') {
                    this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.emergencyAPI.searchLocData.cities, () => this.addCurrentFilter());
                }
            });

            // Initialize Country Search Autocomplete
            this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.emergencyAPI.locData.countries, (c) => {
                this.addCurrentFilter();
                window.emergencyAPI.prefetchSearchDataForCountry(c);
            });

            this.filterInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.filterDropdown.classList.remove('active'); this.addCurrentFilter(); }
            });

            this.btnAddFilter.addEventListener('click', () => this.addCurrentFilter());
            this.activeFiltersDiv.addEventListener('click', (e) => {
                if (e.target.classList.contains('em-pill-remove')) {
                    delete this.activeFilters[e.target.dataset.key];
                    this.renderFilterPills();
                }
            });

            this.btnSearch.addEventListener('click', () => this.executeSearch());
            this.createForm.addEventListener('submit', (e) => this.handleCreate(e));

            // --- GPS BUTTONS FIX ---
            this.btnGpsCurrent.addEventListener('click', async () => {
                this.btnGpsCurrent.textContent = "Locating...";
                try {
                    // Safe call to your existing Tracker Service
                    const pos = await window.gpsTracker.getCurrentLocation('em_create_gps');
                    this.latInput.value = pos.lat.toFixed(6);
                    this.lngInput.value = pos.lng.toFixed(6);
                    this.selectedGps = pos;
                } catch (error) {
                    if (error.message !== "ABORTED_BY_USER") console.error("GPS Failed:", error);
                } finally {
                    this.btnGpsCurrent.textContent = "📍 Current Loc";
                }
            });

            this.btnGpsMap.addEventListener('click', () => {
                if (!window.flatMapEngine || !window.flatMapEngine.map2D) {
                    alert("Map is not fully loaded yet."); return;
                }
                
                this.toggle(); // Hide UI
                window.flatMapEngine.map2D.setOptions({ draggableCursor: 'crosshair' });
                
                // Listen for a single click on the Google Map
                google.maps.event.addListenerOnce(window.flatMapEngine.map2D, 'click', (e) => {
                    const lat = e.latLng.lat();
                    const lng = e.latLng.lng();
                    
                    this.latInput.value = lat.toFixed(6);
                    this.lngInput.value = lng.toFixed(6);
                    this.selectedGps = { lat, lng };
                    
                    window.flatMapEngine.map2D.setOptions({ draggableCursor: '' }); // Reset cursor
                    this.toggle(); // Show UI
                });
            });
        }

        // --- Filters & Render ---
        addCurrentFilter() {
            const val = this.filterInput.value.trim();
            if (val) {
                this.activeFilters[this.filterTypeSel.value] = val;
                this.filterInput.value = '';
                this.renderFilterPills();
            }
        }

        renderFilterPills() {
            this.activeFiltersDiv.innerHTML = Object.entries(this.activeFilters).map(([k, v]) => `
                <div class="em-filter-pill">
                    <span>${k.toUpperCase()}: ${v}</span>
                    <button class="em-pill-remove" data-key="${k}">×</button>
                </div>
            `).join('');
        }

        calculateDistance(lat1, lon1, lat2, lon2) {
            if (!lat1 || !lon1 || !lat2 || !lon2) return null;
            const R = 6371; 
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            return (R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))).toFixed(1);
        }

        // --- Search API Call ---
        async executeSearch() {
            this.resultsContainer.innerHTML = `<div class="em-empty-state">Searching...</div>`;
            const filters = { ...this.activeFilters };
            if (filters.radius && this.selectedGps.lat) {
                filters.lat = this.selectedGps.lat;
                filters.lng = this.selectedGps.lng;
            }

            const data = await window.emergencyAPI.searchEmergencies(filters);

            if (data.success && data.count > 0) {
                this.emergencies = data.data;
                this.renderList();
            } else {
                this.resultsContainer.innerHTML = `<div class="em-empty-state">No active emergencies found matching criteria.</div>`;
            }
        }

        renderList() {
            this.resultsContainer.innerHTML = this.emergencies.map((em, i) => {
                const loc = em.address ? `${em.address.city||''}, ${em.address.country||''}`.replace(/^, | , $/g,'') : 'Unknown';
                let distHtml = '';
                if (em.location?.coordinates && this.selectedGps.lat) {
                    const dist = this.calculateDistance(this.selectedGps.lat, this.selectedGps.lng, em.location.coordinates[1], em.location.coordinates[0]);
                    if (dist) distHtml = `<div class="em-card-distance">${dist} km</div>`;
                }

                return `
                <div class="em-card" onclick="window.EmergencyManager.showDetailView(${i})">
                    <div class="em-card-header">
                        <div class="em-card-title">${em.title}</div>
                        ${distHtml}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">${loc}</div>
                </div>`;
            }).join('');
        }

        showDetailView(index) {
            const em = this.emergencies[index];
            
            let victimHtml = '';
            if (em.victimMetadata && em.victimMetadata.isPublic) {
                const img = em.victimMetadata.imageUri || 'https://via.placeholder.com/60?text=NA';
                const reward = em.victimMetadata.rewardAmount > 0 ? `Reward: ${em.victimMetadata.rewardAmount} ${em.victimMetadata.rewardCurrency}` : '';
                victimHtml = `
                    <div class="em-victim-card">
                        <img src="${img}" class="em-victim-img" alt="Victim">
                        <div class="em-victim-info">
                            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Subject of Interest</div>
                            <div class="em-victim-name">${em.victimMetadata.name || 'Unknown'} (Age: ${em.victimMetadata.age || '?'})</div>
                            <div style="font-size:11px; color:var(--text-muted);">Gender: ${em.victimMetadata.gender || 'Unknown'}</div>
                            <div class="em-victim-reward">${reward}</div>
                        </div>
                    </div>
                `;
            }

            this.resultsContainer.innerHTML = `
                <button onclick="window.EmergencyManager.renderList()" class="em-back-btn">← Back to List</button>
                <h3 style="color:var(--accent); margin:10px 0;">${em.title}</h3>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">ID: ${em.emergencyTrackingId}</div>
                <p style="font-size:13px;">${em.description}</p>
                
                ${victimHtml}

                <div class="em-join-box">
                    ${em.isPasswordProtected ? '<input type="password" id="em-join-pass" placeholder="Passcode required to join">' : ''}
                    <button onclick="window.EmergencyManager.triggerJoin('${em.emergencyTrackingId}')" class="em-btn em-btn-primary">Authenticate & Join</button>
                </div>
            `;
        }

        async triggerJoin(id) {
            const pass = document.getElementById('em-join-pass')?.value || null;
            const data = await window.emergencyAPI.joinEmergency(id, pass);
            if (data.success) {
                alert(`Joined ${data.data.title}!`);
            } else alert(`Failed: ${data.message}`);
        }

        // --- Create API Call ---
        async handleCreate(e) {
            e.preventDefault();
            
            if (!window.emergencyAPI.getToken()) {
                alert("🚨 Authorization Error: You are not logged in. Redirecting to login...");
                window.location.href = '/emergency/auth.html';
                return;
            }

            if (!this.selectedGps.lat || !this.selectedGps.lng) {
                alert("Please provide GPS coordinates using '📍 Current Loc' or '🗺️ Pick on Map'.");
                return;
            }

            const payload = {
                title: document.getElementById('em-create-title').value,
                description: document.getElementById('em-create-desc').value,
                password: document.getElementById('em-create-pass').value,
                isPublicVisibility: document.getElementById('em-create-public').checked,
                location: this.selectedGps,
                address: {
                    country: this.inpCountry.value,
                    state: this.inpState.value,
                    city: this.inpCity.value
                },
                victimMetadata: {
                    isPublic: document.getElementById('em-vic-public').checked,
                    name: document.getElementById('em-vic-name').value,
                    age: parseInt(document.getElementById('em-vic-age').value) || null,
                    gender: document.getElementById('em-vic-gender').value,
                    rewardAmount: parseFloat(document.getElementById('em-vic-reward').value) || 0,
                    imageUri: document.getElementById('em-vic-photo').value
                }
            };

            const data = await window.emergencyAPI.createEmergency(payload);
            if (data && data.success) {
                alert(`Emergency Created! ID: ${data.data.emergencyTrackingId}`);
                this.createForm.reset();
                this.latInput.value = ''; this.lngInput.value = '';
                this.tabBtns[0].click(); 
            } else {
                alert(`Error: ${data ? data.message : 'Network Error'}`);
            }
        }
    }

    window.EmergencyManager = new EmergencyManagerUI();
})();
