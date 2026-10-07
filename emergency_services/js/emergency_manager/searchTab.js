/**
 * searchTab.js
 * Upgraded: Distance formatting fixes, No Enter-submit, and robust cascading locations.
 */
(() => {
    "use strict";

    class EmergencySearchTab {
        constructor() {
            this.activeFilters = { radius: 50 }; // Default 50km
            this.emergencies = [];
            this.lastSearchGps = null;
        }

        init() {
            this.injectHTML();
            this.cacheElements();
            this.bindEvents();
        }

        injectHTML() {
            const html = `
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
            `;
            document.getElementById('em-content-area').insertAdjacentHTML('beforeend', html);
        }

        cacheElements() {
            this.filterTypeSel = document.getElementById('em-filter-type');
            this.filterInput = document.getElementById('em-filter-input');
            this.filterDropdown = document.getElementById('em-filter-dropdown');
            this.btnAddFilter = document.getElementById('em-btn-add-filter');
            this.activeFiltersDiv = document.getElementById('em-active-filters');
            this.btnSearch = document.getElementById('em-btn-search');
            this.resultsContainer = document.getElementById('em-results-container');
        }

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

        bindEvents() {
            this.filterTypeSel.addEventListener('change', () => {
                const t = this.filterTypeSel.value;
                this.filterInput.value = '';
                
                if (t === 'radius') this.filterInput.type = 'number';
                else if (t === 'startDate') this.filterInput.type = 'date';
                else this.filterInput.type = 'text';

                // Clone input to strip old listeners
                const newInp = this.filterInput.cloneNode(true);
                this.filterInput.parentNode.replaceChild(newInp, this.filterInput);
                this.filterInput = newInp;
                
                // Allow enter key ONLY to add filter, not submit form
                this.filterInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') { 
                        e.preventDefault(); 
                        this.filterDropdown.classList.remove('active'); 
                        this.addCurrentFilter(); 
                    }
                });

                // Attach proper dataset based on selection type
                if (t === 'country') {
                    this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.EmAPI.locData?.countries, (c) => {
                        this.addCurrentFilter();
                        window.EmAPI.prefetchSearchDataForCountry(c); 
                    });
                } else if (t === 'state') {
                    this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.EmAPI.searchLocData?.states, () => this.addCurrentFilter());
                } else if (t === 'city') {
                    this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.EmAPI.searchLocData?.cities, () => this.addCurrentFilter());
                }
            });

            // Init country on first load
            this.attachAutocomplete(this.filterInput, this.filterDropdown, () => window.EmAPI.locData?.countries, (c) => {
                this.addCurrentFilter();
                window.EmAPI.prefetchSearchDataForCountry(c);
            });

            // Allow initial enter key binding
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
            this.renderFilterPills();
        }

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

        async executeSearch() {
            this.btnSearch.textContent = "Fetching GPS & Searching...";
            this.resultsContainer.innerHTML = `<div class="em-empty-state">Contacting Global Database...</div>`;
            
            const filters = { ...this.activeFilters };
            
            if (filters.radius) {
                try {
                    console.log("📍 [SearchTab] Fetching current device GPS for Radius Search...");
                    this.lastSearchGps = await window.EmMapUtils.getCurrentLocation('em_search_gps');
                    if (this.lastSearchGps) {
                        filters.lat = this.lastSearchGps.lat;
                        filters.lng = this.lastSearchGps.lng;
                    }
                } catch (err) {
                    console.warn("Could not get GPS. Ignoring radius filter.");
                }
            }

            const data = await window.EmAPI.searchEmergencies(filters);
            this.btnSearch.textContent = "🔍 Search Public Emergencies";

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
                
                if (em.location?.coordinates && this.lastSearchGps?.lat) {
                    const dist = this.calculateDistance(this.lastSearchGps.lat, this.lastSearchGps.lng, em.location.coordinates[1], em.location.coordinates[0]);
                    if (dist) distHtml = `<div class="em-card-distance">Within ${dist} km radius</div>`;
                }

                return `
                <div class="em-card" onclick="window.EmSearchTab.showDetailView(${i})">
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
            
            const victimsHtml = (em.victims || []).map(v => `
                <div class="em-victim-card">
                    <img src="${v.primaryImage || 'https://via.placeholder.com/60?text=NA'}" class="em-victim-img" alt="Victim">
                    <div class="em-victim-info">
                        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Victim: ${v.type || 'Adult'}</div>
                        <div class="em-victim-name">${v.name || 'Unknown'} (Age: ${v.age || '?'})</div>
                        <div style="font-size:11px; color:var(--text-muted);">Gender: ${v.gender || '?'} | Color: ${v.skinColor||'?'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">Last Seen: ${v.lastSeenLocation || 'Unknown'}</div>
                        ${v.reward && v.reward.amount > 0 ? `<div class="em-victim-reward">Reward: ${v.reward.amount}${v.reward.currency}</div>` : ''}
                    </div>
                </div>
            `).join('');

            const culpritsHtml = (em.culprits || []).map(c => `
                <div class="em-victim-card" style="border-left: 3px solid var(--danger);">
                    <img src="${c.primaryImage || 'https://via.placeholder.com/60?text=NA'}" class="em-victim-img" alt="Culprit">
                    <div class="em-victim-info">
                        <div style="font-size:10px; color:var(--danger); text-transform:uppercase; font-weight:700;">Suspect: ${c.culpritType || 'Unknown'}</div>
                        <div class="em-victim-name">${c.name || 'Unknown'} (Age: ${c.age || '?'})</div>
                        <div style="font-size:11px; color:var(--text-muted);">Gender: ${c.gender || '?'} | Ethnicity: ${c.ethnicity||'?'}</div>
                        ${c.reward && c.reward.amount > 0 ? `<div class="em-victim-reward" style="color:var(--danger)">Bounty: ${c.reward.amount}${c.reward.currency}</div>` : ''}
                    </div>
                </div>
            `).join('');

            const docHtml = em.detailedDocUri ? `
                <a href="${window.API_BASE_URL || ''}/api/emergency/${em.emergencyTrackingId}/document?token=${window.EmAPI.getToken()}" target="_blank" class="em-btn" style="text-decoration:none; margin-top:10px; display:block; text-align:center;">
                    📄 Download Detailed Incident Document
                </a>
            ` : '';

            this.resultsContainer.innerHTML = `
                <button onclick="window.EmSearchTab.renderList()" class="em-back-btn">← Back to List</button>
                <h3 style="color:var(--accent); margin:10px 0;">${em.title}</h3>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">ID: ${em.emergencyTrackingId}</div>
                <p style="font-size:13px;">${em.description}</p>
                
                ${victimsHtml}
                ${culpritsHtml}
                ${docHtml}

                <div class="em-join-box">
                    ${em.isPasswordProtected ? '<input type="password" id="em-join-pass" placeholder="Passcode required to join">' : ''}
                    <button onclick="window.EmSearchTab.triggerJoin('${em.emergencyTrackingId}')" class="em-btn em-btn-primary">Authenticate & Join Tracking</button>
                </div>
            `;
        }

        async triggerJoin(id) {
            const pass = document.getElementById('em-join-pass')?.value || null;
            const data = await window.EmAPI.joinEmergency(id, pass);
            if (data.success) {
                alert(`Joined ${data.data.title}! Tracking active.`);
                localStorage.setItem(`em_token_${id}`, data.data.token);
            } else alert(`Failed: ${data.message}`);
        }
    }

    window.EmSearchTab = new EmergencySearchTab();
})();
