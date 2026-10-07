/**
 * createTab.js
 * Upgraded: Free-text uppercase inputs, Require Name before GPS, Live Map Image Previews.
 */
(() => {
    "use strict";

    class EmergencyCreateTab {
        constructor() {
            this.selectedGps = { lat: null, lng: null };
            this.victimCounter = 0;
            this.culpritCounter = 0;
        }

        init() {
            this.injectHTML();
            this.cacheElements();
            this.bindEvents();
            this.bindMainMediaToggle();
        }

        injectHTML() {
            const html = `
                <div id="em-view-manage" class="em-view">
                    <form id="em-create-form" onsubmit="return false;">
                        <div class="em-form-group">
                            <label>Incident Title</label>
                            <input type="text" id="em-create-title" required placeholder="e.g. Bank Robbery - Sector 4">
                        </div>
                        <div class="em-form-group">
                            <label>Description</label>
                            <textarea id="em-create-desc" placeholder="Provide full context..."></textarea>
                        </div>

                        <!-- Main Document Upload (File vs URL) -->
                        <div class="em-form-group">
                            <label>Attach Detailed PDF / DOC (Optional)</label>
                            <div class="em-media-toggle">
                                <label><input type="radio" name="main_doc_type" value="file" checked> Upload File</label>
                                <label><input type="radio" name="main_doc_type" value="url"> Link URL</label>
                            </div>
                            <div id="main-doc-file-wrapper" class="em-file-wrapper">
                                <input type="file" id="em-create-doc-file" class="em-file-input" accept=".pdf,.doc,.docx">
                                <div id="main-doc-badge" class="em-file-selected-badge" style="display:none;">
                                    <span id="main-doc-name"></span>
                                    <button type="button" id="main-doc-clear" class="em-remove-file-btn" title="Remove file">×</button>
                                </div>
                            </div>
                            <input type="text" id="em-create-doc-url" class="em-search-input" placeholder="https://..." style="display:none; width:100%;">
                        </div>

                        <!-- GPS Picker -->
                        <div class="em-form-group">
                            <label>Incident GPS Coordinates</label>
                            <div class="em-gps-row">
                                <input type="text" id="em-create-lat" class="em-gps-input" placeholder="Lat" readonly required>
                                <input type="text" id="em-create-lng" class="em-gps-input" placeholder="Lng" readonly required>
                                <button type="button" id="em-btn-gps-clear" class="em-btn-clear" title="Clear Map Marker">×</button>
                            </div>
                            <div class="em-gps-row">
                                <button type="button" id="em-btn-gps-current" class="em-gps-btn">📍 Current Loc</button>
                                <button type="button" id="em-btn-gps-map" class="em-gps-btn">🗺️ Pick on Map</button>
                            </div>
                        </div>

                        <!-- Dynamic Free-Text Location -->
                        <div class="em-form-row">
                            <div class="em-form-group em-autocomplete-anchor">
                                <label>Country</label>
                                <input type="text" id="em-create-country" placeholder="TYPE COUNTRY..." autocomplete="off">
                                <div id="em-create-country-drop" class="em-global-dropdown"></div>
                            </div>
                            <div class="em-form-group em-autocomplete-anchor">
                                <label>State</label>
                                <input type="text" id="em-create-state" placeholder="TYPE STATE..." autocomplete="off">
                                <div id="em-create-state-drop" class="em-global-dropdown"></div>
                            </div>
                        </div>
                        <div class="em-form-group em-autocomplete-anchor">
                            <label>City</label>
                            <input type="text" id="em-create-city" placeholder="TYPE CITY..." autocomplete="off">
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

                        <hr style="border:0; border-top:1px solid var(--border-panel); margin: 15px 0;">
                        
                        <div class="em-entity-list" id="em-victims-list"></div>
                        <button type="button" class="em-add-btn" id="em-btn-add-victim">+ Add Victim</button>

                        <hr style="border:0; border-top:1px solid var(--border-panel); margin: 15px 0;">

                        <div class="em-entity-list" id="em-culprits-list"></div>
                        <button type="button" class="em-add-btn" id="em-btn-add-culprit" style="color:var(--danger); border-color:var(--danger);">+ Add Suspect / Culprit</button>
                        
                        <button type="button" id="em-btn-submit-form" class="em-btn em-btn-primary" style="width: 100%; margin-top: 25px;">Initialize Emergency Network</button>
                    </form>
                </div>
            `;
            document.getElementById('em-content-area').insertAdjacentHTML('beforeend', html);
        }

        cacheElements() {
            this.form = document.getElementById('em-create-form');
            this.submitBtn = document.getElementById('em-btn-submit-form');
            
            this.latInput = document.getElementById('em-create-lat');
            this.lngInput = document.getElementById('em-create-lng');
            this.btnGpsCurrent = document.getElementById('em-btn-gps-current');
            this.btnGpsMap = document.getElementById('em-btn-gps-map');
            this.btnGpsClear = document.getElementById('em-btn-gps-clear');
            
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
            // Force Uppercase
            inputEl.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
                const val = e.target.value.toLowerCase();
                const dataset = dataArrayGetter() || [];
                const matches = dataset.filter(item => item.toLowerCase().includes(val)).slice(0, 10);
                
                if (matches.length > 0 && val !== '') {
                    dropdownEl.innerHTML = matches.map(m => `<div class="em-global-item">${m.toUpperCase()}</div>`).join('');
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

        bindFreeTextLocations() {
            // Auto-fetch if country is clicked from dropdown
            this.attachAutocomplete(this.inpCountry, this.dropCountry, () => window.EmAPI.locData?.countries, async (c) => {
                console.log(`[CreateTab] Country selected: ${c}, fetching states...`);
                await window.EmAPI.fetchStates(c);
            });

            this.attachAutocomplete(this.inpState, this.dropState, () => window.EmAPI.locData?.states, async (s) => {
                console.log(`[CreateTab] State selected: ${s}, fetching cities...`);
                await window.EmAPI.fetchCities(this.inpCountry.value, s);
            });

            this.attachAutocomplete(this.inpCity, this.dropCity, () => window.EmAPI.locData?.cities);
        }

        updateMainGpsInputs(lat, lng) {
            this.latInput.value = lat.toFixed(6);
            this.lngInput.value = lng.toFixed(6);
            this.selectedGps = { lat, lng };
            console.log(`[CreateTab] Main Incident coords updated: ${lat}, ${lng}`);
        }

        clearMainGps() {
            this.latInput.value = '';
            this.lngInput.value = '';
            this.selectedGps = { lat: null, lng: null };
            window.EmMapUtils.clearPicker('main_emergency');
        }

        bindEvents() {
            this.bindFreeTextLocations();

            // Prevent Enter Key submit
            this.form.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
            });

            this.btnGpsCurrent.addEventListener('click', async () => {
                this.btnGpsCurrent.textContent = "Locating...";
                const pos = await window.EmMapUtils.getCurrentLocation('em_create_gps');
                if (pos) {
                    this.updateMainGpsInputs(pos.lat, pos.lng);
                    await window.EmMapUtils.createDraggablePicker(
                        'main_emergency', pos.lat, pos.lng, 'origin', 'Incident Origin', 'ORIGIN', null,
                        (newPos) => this.updateMainGpsInputs(newPos.lat, newPos.lng),
                        () => this.clearMainGps()
                    );
                }
                this.btnGpsCurrent.textContent = "📍 Current Loc";
            });

            this.btnGpsMap.addEventListener('click', () => {
                window.EmUIManager.toggle(); 
                window.EmMapUtils.pickFromMap(
                    'main_emergency', 'origin', 'Incident Origin', 'ORIGIN', null,
                    (newPos) => this.updateMainGpsInputs(newPos.lat, newPos.lng), 
                    () => { this.clearMainGps(); },  
                    (pos) => { this.updateMainGpsInputs(pos.lat, pos.lng); window.EmUIManager.toggle(); } 
                );
            });

            this.btnGpsClear.addEventListener('click', () => this.clearMainGps());

            document.getElementById('em-btn-add-victim').addEventListener('click', () => this.addEntityCard('victim'));
            document.getElementById('em-btn-add-culprit').addEventListener('click', () => this.addEntityCard('culprit'));
            this.submitBtn.addEventListener('click', (e) => this.handleCreate(e));
        }

        bindMainMediaToggle() {
            const radios = document.querySelectorAll('input[name="main_doc_type"]');
            const fileWrap = document.getElementById('main-doc-file-wrapper');
            const urlInput = document.getElementById('em-create-doc-url');
            const fileInput = document.getElementById('em-create-doc-file');
            const badge = document.getElementById('main-doc-badge');
            const badgeName = document.getElementById('main-doc-name');
            const clearBtn = document.getElementById('main-doc-clear');

            radios.forEach(r => r.addEventListener('change', (e) => {
                if (e.target.value === 'file') {
                    fileWrap.style.display = 'flex'; urlInput.style.display = 'none'; urlInput.value = '';
                } else {
                    fileWrap.style.display = 'none'; urlInput.style.display = 'block';
                    fileInput.value = ''; fileInput.style.display = 'block'; badge.style.display = 'none';
                }
            }));

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    badgeName.textContent = e.target.files[0].name;
                    badge.style.display = 'flex'; fileInput.style.display = 'none';
                }
            });

            clearBtn.addEventListener('click', () => {
                fileInput.value = ''; badge.style.display = 'none'; fileInput.style.display = 'block';
            });
        }

        addEntityCard(type) {
            const isVic = type === 'victim';
            const id = isVic ? this.victimCounter++ : this.culpritCounter++;
            const listEl = isVic ? this.victimsList : this.culpritsList;
            
            const title = isVic ? `Victim ${id + 1}` : `Suspect ${id + 1}`;
            const typeLabel = isVic ? 'Type (e.g. Minor, Adult)' : 'Type (e.g. Robbery, Assault)';
            const borderCol = isVic ? '' : 'border-left: 3px solid var(--danger);';
            const headCol = isVic ? '' : 'color:var(--danger);';
            const pfx = isVic ? 'v' : 'c';

            const html = `
                <div class="em-entity-card ${pfx}-card" id="${pfx}-card-${id}" data-id="${id}" style="${borderCol}">
                    <div class="em-entity-header" style="${headCol}">
                        ${title}
                        <button type="button" class="em-entity-remove" title="Remove">×</button>
                    </div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="text" class="${pfx}-name" placeholder="Name/Alias (Required for Map)"></div>
                        <div class="em-form-group"><input type="number" class="${pfx}-age" placeholder="Age"></div>
                    </div>
                    <div class="em-form-row">
                        <div class="em-form-group"><input type="text" class="${pfx}-gender" placeholder="Gender"></div>
                        <div class="em-form-group"><input type="text" class="${pfx}-type" placeholder="${typeLabel}"></div>
                    </div>
                    
                    <div class="em-form-group">
                        <label>Last Seen GPS</label>
                        <div class="em-gps-row">
                            <input type="text" class="${pfx}-lat em-gps-input" placeholder="Lat" readonly>
                            <input type="text" class="${pfx}-lng em-gps-input" placeholder="Lng" readonly>
                            <button type="button" class="em-btn-clear ${pfx}-btn-gps-clear" title="Clear Marker">×</button>
                        </div>
                        <div class="em-gps-row">
                            <button type="button" class="em-gps-btn ${pfx}-btn-gps-map">🗺️ Pick on Map</button>
                        </div>
                    </div>

                    <div class="em-form-group">
                        <label>Photo</label>
                        <div class="em-media-toggle">
                            <label><input type="radio" name="${pfx}_media_${id}" value="file" checked> File</label>
                            <label><input type="radio" name="${pfx}_media_${id}" value="url"> Link</label>
                        </div>
                        <div class="${pfx}-file-wrapper em-file-wrapper">
                            <input type="file" class="${pfx}-image-file em-file-input" accept="image/*">
                            <div class="${pfx}-file-badge em-file-selected-badge" style="display:none;">
                                <span class="${pfx}-file-name"></span>
                                <button type="button" class="${pfx}-file-clear em-remove-file-btn">×</button>
                            </div>
                        </div>
                        <input type="text" class="${pfx}-image-url em-search-input" placeholder="https://..." style="display:none; width:100%;">
                    </div>
                    <label class="em-checkbox-group"><input type="checkbox" class="${pfx}-public" checked> Public Details</label>
                </div>
            `;
            
            listEl.insertAdjacentHTML('beforeend', html);
            this.bindEntityEvents(document.getElementById(`${pfx}-card-${id}`), type, id, title);
        }

        bindEntityEvents(card, type, id, titleBadge) {
            const pfx = type === 'victim' ? 'v' : 'c';
            const markerId = `${type}_lastseen_${id}`;

            card.querySelector('.em-entity-remove').addEventListener('click', () => {
                window.EmMapUtils.clearPicker(markerId);
                card.remove(); 
            });

            // Media toggles
            const radios = card.querySelectorAll(`input[name="${pfx}_media_${id}"]`);
            const fileWrap = card.querySelector(`.${pfx}-file-wrapper`);
            const urlInp = card.querySelector(`.${pfx}-image-url`);
            const fileInp = card.querySelector(`.${pfx}-image-file`);
            const badge = card.querySelector(`.${pfx}-file-badge`);
            const badgeName = card.querySelector(`.${pfx}-file-name`);
            const fileClearBtn = card.querySelector(`.${pfx}-file-clear`);

            radios.forEach(r => r.addEventListener('change', (e) => {
                if (e.target.value === 'file') {
                    fileWrap.style.display = 'flex'; urlInp.style.display = 'none'; urlInp.value = '';
                } else {
                    fileWrap.style.display = 'none'; urlInp.style.display = 'block';
                    fileInp.value = ''; fileInp.style.display = 'block'; badge.style.display = 'none';
                }
            }));

            fileInp.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    badgeName.textContent = e.target.files[0].name;
                    badge.style.display = 'flex'; fileInp.style.display = 'none';
                }
            });

            fileClearBtn.addEventListener('click', () => {
                fileInp.value = ''; badge.style.display = 'none'; fileInp.style.display = 'block';
            });

            // Specific Map Picker for Entity
            const nameInp = card.querySelector(`.${pfx}-name`);
            const latInp = card.querySelector(`.${pfx}-lat`);
            const lngInp = card.querySelector(`.${pfx}-lng`);
            const mapBtn = card.querySelector(`.${pfx}-btn-gps-map`);
            const clrBtn = card.querySelector(`.${pfx}-btn-gps-clear`);

            const updateCoords = (lat, lng) => { latInp.value = lat.toFixed(6); lngInp.value = lng.toFixed(6); };
            const clearCoords = () => { latInp.value = ''; lngInp.value = ''; window.EmMapUtils.clearPicker(markerId); };

            mapBtn.addEventListener('click', () => {
                const name = nameInp.value.trim();
                if (!name) return alert(`Please enter the ${titleBadge} Name/Alias before marking the map.`);

                // Grab preview image if available
                let imgUrl = null;
                const rType = card.querySelector(`input[name="${pfx}_media_${id}"]:checked`).value;
                if (rType === 'file' && fileInp.files.length > 0) {
                    imgUrl = URL.createObjectURL(fileInp.files[0]); // Live blob URL!
                } else if (rType === 'url') {
                    imgUrl = urlInp.value;
                }

                window.EmUIManager.toggle();
                window.EmMapUtils.pickFromMap(
                    markerId, type, name, titleBadge, imgUrl,
                    (pos) => updateCoords(pos.lat, pos.lng),  
                    () => clearCoords(),                      
                    (pos) => { updateCoords(pos.lat, pos.lng); window.EmUIManager.toggle(); } 
                );
            });

            clrBtn.addEventListener('click', () => clearCoords());
        }

        async handleCreate(e) {
            e.preventDefault();
            
            if (!window.EmAPI.getToken()) {
                alert("🚨 Authorization Error: Please log in.");
                return window.location.href = '/emergency/auth.html';
            }

            if (!this.selectedGps.lat) return alert("Please provide the main Incident GPS coordinates.");

            this.submitBtn.textContent = "Uploading assets & creating...";
            this.submitBtn.disabled = true;

            try {
                const formData = new FormData();
                let hasFiles = false;

                const docRadio = document.querySelector('input[name="main_doc_type"]:checked').value;
                const docFile = document.getElementById('em-create-doc-file').files[0];
                if (docRadio === 'file' && docFile) { formData.append('detailedDoc', docFile); hasFiles = true; }

                const vCards = document.querySelectorAll('.v-card');
                vCards.forEach(card => {
                    const id = card.dataset.id;
                    const rType = card.querySelector(`input[name="v_media_${id}"]:checked`).value;
                    const file = card.querySelector('.v-image-file').files[0];
                    if (rType === 'file' && file) { formData.append('victimImage', file, `v_${id}_${file.name}`); hasFiles = true; }
                });

                const cCards = document.querySelectorAll('.c-card');
                cCards.forEach(card => {
                    const id = card.dataset.id;
                    const rType = card.querySelector(`input[name="c_media_${id}"]:checked`).value;
                    const file = card.querySelector('.c-image-file').files[0];
                    if (rType === 'file' && file) { formData.append('culpritImage', file, `c_${id}_${file.name}`); hasFiles = true; }
                });

                let uploadedDocsUri = docRadio === 'url' ? document.getElementById('em-create-doc-url').value : null;
                let uploadedVicImages = {};
                let uploadedCulImages = {};

                if (hasFiles) {
                    console.log("📤 [CreateTab] Uploading files to server...");
                    const uploadRes = await window.EmAPI.uploadFiles(formData);
                    if (uploadRes.success) {
                        uploadRes.data.forEach(f => {
                            if (f.fieldname === 'detailedDoc') uploadedDocsUri = f.url;
                            if (f.fieldname === 'victimImage') uploadedVicImages[f.originalname.split('_')[1]] = f.url;
                            if (f.fieldname === 'culpritImage') uploadedCulImages[f.originalname.split('_')[1]] = f.url;
                        });
                    } else throw new Error(uploadRes.message);
                }

                const buildEntityPayload = (cards, pfx, imgDict) => Array.from(cards).map(card => {
                    const id = card.dataset.id;
                    const rType = card.querySelector(`input[name="${pfx}_media_${id}"]:checked`).value;
                    const lat = parseFloat(card.querySelector(`.${pfx}-lat`).value);
                    const lng = parseFloat(card.querySelector(`.${pfx}-lng`).value);
                    let lastSeen = null;
                    if (!isNaN(lat) && !isNaN(lng)) lastSeen = `${lat},${lng}`;

                    return {
                        isPublic: card.querySelector(`.${pfx}-public`).checked,
                        name: card.querySelector(`.${pfx}-name`).value,
                        age: parseInt(card.querySelector(`.${pfx}-age`).value) || null,
                        gender: card.querySelector(`.${pfx}-gender`).value,
                        type: card.querySelector(`.${pfx}-type`).value,
                        lastSeenLocation: lastSeen || '',
                        primaryImage: rType === 'url' ? card.querySelector(`.${pfx}-image-url`).value : (imgDict[id] || null)
                    };
                });

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
                    victims: buildEntityPayload(vCards, 'v', uploadedVicImages),
                    culprits: buildEntityPayload(cCards, 'c', uploadedCulImages),
                    detailedDocUri: uploadedDocsUri || null
                };

                console.log("📤 [CreateTab] Creating Incident:", payload);
                const res = await window.EmAPI.createEmergency(payload);
                if (res.success) {
                    alert(`Emergency Active! ID: ${res.data.emergencyTrackingId}`);
                    this.form.reset();
                    Array.from(vCards).forEach(c => c.querySelector('.em-entity-remove').click());
                    Array.from(cCards).forEach(c => c.querySelector('.em-entity-remove').click());
                    this.clearMainGps();
                    document.querySelector('.em-tab-btn[data-tab="discover"]').click();
                } else {
                    alert(`Error: ${res.message}`);
                }

            } catch (err) {
                console.error(err);
                alert(`Creation failed: ${err.message}`);
            } finally {
                this.submitBtn.textContent = "Initialize Emergency Network";
                this.submitBtn.disabled = false;
            }
        }
    }

    window.EmCreateTab = new EmergencyCreateTab();
})();
