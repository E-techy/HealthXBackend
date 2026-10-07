(() => {
    "use strict";

    class EmergencyCreateTab {
        constructor() {
            this.selectedGps = { lat: null, lng: null };
            this.victims = [];
            this.culprits = [];
        }

        init() {
            this.injectHTML();
            this.cacheElements();
            this.bindEvents();
        }

        injectHTML() {
            const html = `
                <div id="em-view-manage" class="em-view">
                    <form id="em-create-form">
                        <div class="em-form-group">
                            <label>Incident Title</label>
                            <input type="text" id="em-create-title" required placeholder="e.g. Bank Robbery - Sector 4">
                        </div>
                        <div class="em-form-group">
                            <label>Description</label>
                            <textarea id="em-create-desc" placeholder="Provide full context..."></textarea>
                        </div>

                        <!-- Document Upload -->
                        <div class="em-form-group">
                            <label>Attach Detailed PDF / DOC (Optional)</label>
                            <input type="file" id="em-create-doc" class="em-file-input" accept=".pdf,.doc,.docx">
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

                        <!-- Dynamic Arrays -->
                        <hr style="border:0; border-top:1px solid var(--border-panel); margin: 15px 0;">
                        
                        <div class="em-entity-list" id="em-victims-list"></div>
                        <button type="button" class="em-add-btn" id="em-btn-add-victim">+ Add Victim</button>

                        <hr style="border:0; border-top:1px solid var(--border-panel); margin: 15px 0;">

                        <div class="em-entity-list" id="em-culprits-list"></div>
                        <button type="button" class="em-add-btn" id="em-btn-add-culprit" style="color:var(--danger); border-color:var(--danger);">+ Add Suspect / Culprit</button>
                        
                        <button type="submit" class="em-btn em-btn-primary" style="width: 100%; margin-top: 25px;">Initialize Emergency Network</button>
                    </form>
                </div>
            `;
            document.getElementById('em-content-area').insertAdjacentHTML('beforeend', html);
        }

        cacheElements() {
            this.form = document.getElementById('em-create-form');
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
            
            this.victimsList = document.getElementById('em-victims-list');
            this.culpritsList = document.getElementById('em-culprits-list');
        }

        attachAutocomplete(inputEl, dropdownEl, dataArrayGetter, onSelectCallback) {
            inputEl.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase();
                const dataset = dataArrayGetter() || [];
                const matches = dataset.filter(item => item.toLowerCase().includes(val)).slice(0, 10);
                if (matches.length > 0 && val !== '') {
                    dropdownEl.innerHTML = matches.map(m => `<div class="em-global-item">${m}</div>`).join('');
                    dropdownEl.classList.add('active');
                } else dropdownEl.classList.remove('active');
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
            // Location Autocompletes
            this.attachAutocomplete(this.inpCountry, this.dropCountry, () => window.EmAPI.locData?.countries, async (c) => {
                this.inpState.value = ''; this.inpCity.value = ''; this.inpCity.disabled = true;
                await window.EmAPI.fetchStates(c);
                this.inpState.disabled = false;
            });
            this.attachAutocomplete(this.inpState, this.dropState, () => window.EmAPI.locData?.states, async (s) => {
                this.inpCity.value = '';
                await window.EmAPI.fetchCities(this.inpCountry.value, s);
                this.inpCity.disabled = false;
            });
            this.attachAutocomplete(this.inpCity, this.dropCity, () => window.EmAPI.locData?.cities);

            // GPS Picking
            this.btnGpsCurrent.addEventListener('click', async () => {
                this.btnGpsCurrent.textContent = "Locating...";
                const pos = await window.EmMapUtils.getCurrentLocation('em_create_gps');
                if (pos) {
                    this.latInput.value = pos.lat.toFixed(6);
                    this.lngInput.value = pos.lng.toFixed(6);
                    this.selectedGps = pos;
                    await window.EmMapUtils.markAndPanMap(pos.lat, pos.lng, "Incident Origin");
                }
                this.btnGpsCurrent.textContent = "📍 Current Loc";
            });

            this.btnGpsMap.addEventListener('click', () => {
                window.EmUIManager.toggle(); // Hide UI
                window.EmMapUtils.pickFromMap((pos) => {
                    this.latInput.value = pos.lat.toFixed(6);
                    this.lngInput.value = pos.lng.toFixed(6);
                    this.selectedGps = pos;
                    window.EmUIManager.toggle(); // Show UI
                });
            });

            // Dynamic Array Buttons
            document.getElementById('em-btn-add-victim').addEventListener('click', () => {
                this.victims.push({ id: Date.now() });
                this.renderVictims();
            });

            document.getElementById('em-btn-add-culprit').addEventListener('click', () => {
                this.culprits.push({ id: Date.now() });
                this.renderCulprits();
            });

            // Form Submit
            this.form.addEventListener('submit', (e) => this.handleCreate(e));
        }

        renderVictims() {
            this.victimsList.innerHTML = this.victims.map((v, index) => `
                <div class="em-entity-card" data-index="${index}">
                    <div class="em-entity-header">
                        Victim ${index + 1}
                        <button type="button" class="em-entity-remove" onclick="window.EmCreateTab.removeVictim(${index})">×</button>
                    </div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="text" class="v-name" placeholder="Name"></div>
                        <div class="em-form-group"><input type="number" class="v-age" placeholder="Age"></div>
                    </div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="text" class="v-gender" placeholder="Gender"></div>
                        <div class="em-form-group"><input type="text" class="v-type" placeholder="Type (e.g. Minor)" value="Adult"></div>
                    </div>
                    <div class="em-form-group"><input type="text" class="v-lastseen" placeholder="Last Seen Location"></div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="number" class="v-reward-amt" placeholder="Reward Amt" value="0"></div>
                        <div class="em-form-group"><input type="text" class="v-reward-cur" placeholder="Currency" value="USD"></div>
                    </div>
                    <div class="em-form-group">
                        <label>Upload Photo (Max 3MB)</label>
                        <input type="file" class="v-image em-file-input" accept="image/*">
                    </div>
                    <label class="em-checkbox-group"><input type="checkbox" class="v-public" checked> Public Details</label>
                </div>
            `).join('');
        }

        renderCulprits() {
            this.culpritsList.innerHTML = this.culprits.map((c, index) => `
                <div class="em-entity-card" data-index="${index}" style="border-left: 3px solid var(--danger);">
                    <div class="em-entity-header" style="color:var(--danger)">
                        Suspect ${index + 1}
                        <button type="button" class="em-entity-remove" onclick="window.EmCreateTab.removeCulprit(${index})">×</button>
                    </div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="text" class="c-name" placeholder="Name/Alias"></div>
                        <div class="em-form-group"><input type="number" class="c-age" placeholder="Age"></div>
                    </div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="text" class="c-gender" placeholder="Gender"></div>
                        <div class="em-form-group"><input type="text" class="c-type" placeholder="Type (e.g. Robbery)" required></div>
                    </div>
                    <div class="em-form-group"><input type="text" class="c-ident" placeholder="Identifications (Tattoos, scars...)"></div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="number" class="c-reward-amt" placeholder="Bounty Amt" value="0"></div>
                        <div class="em-form-group"><input type="text" class="c-reward-cur" placeholder="Currency" value="USD"></div>
                    </div>
                    <div class="em-form-group">
                        <label>Upload Photo (Max 3MB)</label>
                        <input type="file" class="c-image em-file-input" accept="image/*">
                    </div>
                    <label class="em-checkbox-group"><input type="checkbox" class="c-public" checked> Public Details</label>
                </div>
            `).join('');
        }

        removeVictim(index) { this.victims.splice(index, 1); this.renderVictims(); }
        removeCulprit(index) { this.culprits.splice(index, 1); this.renderCulprits(); }

        // --- MASTER UPLOAD & CREATE ENGINE ---
        async handleCreate(e) {
            e.preventDefault();
            
            if (!window.EmAPI.getToken()) {
                alert("🚨 Authorization Error: Please log in.");
                window.location.href = '/emergency/auth.html';
                return;
            }

            if (!this.selectedGps.lat) return alert("Please provide GPS coordinates.");

            const submitBtn = this.form.querySelector('button[type="submit"]');
            submitBtn.textContent = "Uploading assets & creating...";
            submitBtn.disabled = true;

            try {
                // 1. Gather files into FormData
                const formData = new FormData();
                let hasFiles = false;

                const docFile = document.getElementById('em-create-doc').files[0];
                if (docFile) { formData.append('detailedDoc', docFile); hasFiles = true; }

                const vCards = document.querySelectorAll('#em-victims-list .em-entity-card');
                vCards.forEach((card, i) => {
                    const file = card.querySelector('.v-image').files[0];
                    if (file) { formData.append('victimImage', file, `v_${i}_${file.name}`); hasFiles = true; }
                });

                const cCards = document.querySelectorAll('#em-culprits-list .em-entity-card');
                cCards.forEach((card, i) => {
                    const file = card.querySelector('.c-image').files[0];
                    if (file) { formData.append('culpritImage', file, `c_${i}_${file.name}`); hasFiles = true; }
                });

                // 2. Upload files if any exist
                let uploadedDocs = {};
                let uploadedVicImages = {};
                let uploadedCulImages = {};

                if (hasFiles) {
                    console.log("📤 [CreateTab] Uploading files to server...");
                    const uploadRes = await window.EmAPI.uploadFiles(formData);
                    if (uploadRes.success) {
                        uploadRes.data.forEach(fileData => {
                            if (fileData.fieldname === 'detailedDoc') uploadedDocs.uri = fileData.url;
                            if (fileData.fieldname === 'victimImage') {
                                const index = parseInt(fileData.originalname.split('_')[1]); // parse back the index we injected
                                uploadedVicImages[index] = fileData.url;
                            }
                            if (fileData.fieldname === 'culpritImage') {
                                const index = parseInt(fileData.originalname.split('_')[1]);
                                uploadedCulImages[index] = fileData.url;
                            }
                        });
                    } else {
                        throw new Error(uploadRes.message);
                    }
                }

                // 3. Build Final JSON Payload
                const finalVictims = Array.from(vCards).map((card, i) => ({
                    isPublic: card.querySelector('.v-public').checked,
                    name: card.querySelector('.v-name').value,
                    age: parseInt(card.querySelector('.v-age').value) || null,
                    gender: card.querySelector('.v-gender').value,
                    type: card.querySelector('.v-type').value,
                    lastSeenLocation: card.querySelector('.v-lastseen').value,
                    primaryImage: uploadedVicImages[i] || null,
                    reward: {
                        amount: parseFloat(card.querySelector('.v-reward-amt').value) || 0,
                        currency: card.querySelector('.v-reward-cur').value
                    }
                }));

                const finalCulprits = Array.from(cCards).map((card, i) => ({
                    isPublic: card.querySelector('.c-public').checked,
                    name: card.querySelector('.c-name').value,
                    age: parseInt(card.querySelector('.c-age').value) || null,
                    gender: card.querySelector('.c-gender').value,
                    culpritType: card.querySelector('.c-type').value,
                    identifications: card.querySelector('.c-ident').value,
                    primaryImage: uploadedCulImages[i] || null,
                    reward: {
                        amount: parseFloat(card.querySelector('.c-reward-amt').value) || 0,
                        currency: card.querySelector('.c-reward-cur').value
                    }
                }));

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
                    victims: finalVictims,
                    culprits: finalCulprits,
                    detailedDocUri: uploadedDocs.uri || null
                };

                // 4. Send to Database
                const res = await window.EmAPI.createEmergency(payload);
                if (res.success) {
                    alert(`Emergency Active! ID: ${res.data.emergencyTrackingId}`);
                    this.form.reset();
                    this.victims = []; this.culprits = [];
                    this.renderVictims(); this.renderCulprits();
                    this.latInput.value = ''; this.lngInput.value = '';
                    document.querySelector('.em-tab-btn[data-tab="discover"]').click();
                } else alert(`Error: ${res.message}`);

            } catch (err) {
                console.error(err);
                alert(`Creation failed: ${err.message}`);
            } finally {
                submitBtn.textContent = "Initialize Emergency Network";
                submitBtn.disabled = false;
            }
        }
    }

    window.EmCreateTab = new EmergencyCreateTab();
})();
