class PlacesAutocompleteService {
    constructor() {
        this.instances = new Map();
        this.theme = document.documentElement.dataset.theme || 'dark';

        window.EventBus?.on('theme_changed', theme => {
            this.theme = theme || 'dark';
            this.instances.forEach(x => this.applyTheme(x.el));
        });
    }

    async loadPlacesLibrary() {
        if (!window.google?.maps) throw Error('Google Maps is not loaded');
        if (!google.maps.places) await google.maps.importLibrary('places');
    }

    applyTheme(el) {
        if (!el) return;

        const light = this.theme === 'light';
        el.style.colorScheme = light ? 'light' : 'dark';

        [
            ['--gmp-mat-color-surface', light ? '#fff' : '#0f172a'],
            ['--gmp-mat-color-surface-container', light ? '#f8fafc' : '#111827'],
            ['--gmp-mat-color-on-surface', light ? '#0f172a' : '#f8fafc'],
            ['--gmp-mat-color-on-surface-variant', light ? '#475569' : '#cbd5e1'],
            ['--gmp-mat-color-outline', light ? '#cbd5e1' : '#334155'],
            ['--gmp-mat-color-primary', light ? '#2563eb' : '#60a5fa']
        ].forEach(([k, v]) => el.style.setProperty(k, v));
    }

    value(el) {
        try {
            return String(el?.value || '').trim();
        } catch {
            return '';
        }
    }

    snapshot(input) {
        return {
            id: input.id,
            placeholder: input.placeholder || '',
            aria: input.getAttribute('aria-label') || '',
            value: input.value || ''
        };
    }

    destroy(id) {
        const r = this.instances.get(id);
        if (!r) return;

        r.dead = true;
        clearInterval(r.poll);
        r.mo?.disconnect();
        r.el?.remove();

        this.instances.delete(id);
    }

    async geocodeText(text) {
        const query = String(text || '').trim();
        if (!query) return null;

        await this.loadPlacesLibrary();

        const response = await new google.maps.Geocoder().geocode({
            address: query
        });

        const result = response.results?.[0];

        if (!result?.geometry?.location) return null;

        return {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            displayName: result.formatted_address,
            formattedAddress: result.formatted_address
        };
    }

    async attachToInput(input, onSelect, onClear) {
        if (!input?.id) return input;

        await this.loadPlacesLibrary();

        const id = input.id;
        const snap = this.snapshot(input);

        this.destroy(id);

        const el = new google.maps.places.PlaceAutocompleteElement({});

        el.id = id;
        el.placeholder = snap.placeholder;
        el.setAttribute('aria-label', snap.aria || 'Search address');
        el.setAttribute('data-healthx-autocomplete', 'true');

        this.applyTheme(el);

        const record = {
            el,
            snap,
            last: snap.value.trim(),
            clear: false,
            dead: false,
            busy: false,
            poll: null,
            mo: null
        };

        const sample = () => {
            if (record.dead) return;

            const value = this.value(el);

            if (record.last && !value && !record.clear) {
                record.clear = true;
                record.last = '';

                onClear?.(id);

                setTimeout(() => {
                    if (!record.dead && this.instances.get(id) === record) {
                        this.recreateInput(id, {
                            clear: true,
                            focus: true
                        });
                    }
                }, 0);
            }

            if (value) record.clear = false;
            record.last = value;
        };

        el.addEventListener('input', sample);
        el.addEventListener('change', sample);

        el.addEventListener('click', () => {
            [0, 60, 180].forEach(ms => setTimeout(sample, ms));
        });

        el.addEventListener('keydown', async e => {
            if (e.key !== 'Enter' || record.busy) return;

            const value = this.value(el);
            if (!value) return;

            record.busy = true;

            e.preventDefault();
            e.stopPropagation();

            try {
                const data = await this.geocodeText(value);

                if (data) {
                    record.last = data.formattedAddress;
                    onSelect?.(data);
                }
            } catch (error) {
                console.warn('Address lookup failed:', error);
            } finally {
                record.busy = false;
            }
        }, true);

        el.addEventListener('gmp-select', async event => {
            try {
                const prediction = event.placePrediction;
                if (!prediction) return;

                const place = prediction.toPlace();

                await place.fetchFields({
                    fields: [
                        'displayName',
                        'formattedAddress',
                        'location'
                    ]
                });

                if (!place.location) return;

                const data = {
                    lat: place.location.lat(),
                    lng: place.location.lng(),
                    displayName: place.displayName || place.formattedAddress,
                    formattedAddress: place.formattedAddress ||
                        place.displayName ||
                        this.value(el)
                };

                record.last = data.formattedAddress;
                record.clear = false;

                onSelect?.(data);

            } catch (error) {
                console.warn('Places selection failed:', error);
            }
        });

        record.mo = new MutationObserver(sample);

        record.mo.observe(el, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true
        });

        record.poll = setInterval(sample, 250);

        this.instances.set(id, record);

        input.replaceWith(el);

        return el;
    }

    async recreateInput(id, options = {}) {
        const record = this.instances.get(id);
        const old = record?.el || document.getElementById(id);

        const snap = record?.snap || this.snapshot(
            old || Object.assign(document.createElement('input'), { id })
        );

        const parent = old?.parentNode;
        if (!parent) return null;

        this.destroy(id);

        const input = document.createElement('input');

        input.type = 'text';
        input.id = id;
        input.placeholder = snap.placeholder || 'Search address...';
        input.value = options.clear ? '' : snap.value || '';

        if (snap.aria) {
            input.setAttribute('aria-label', snap.aria);
        }

        parent.replaceChild(input, old);

        const pointId = id.replace(/^input-/, '');

        const el = await this.attachToInput(
            input,
            data => window.markerManager?.selected(pointId, data),
            () => window.markerManager?.clear(pointId, false)
        );

        if (options.focus) {
            setTimeout(() => el?.focus(), 80);
        }

        return el;
    }

    getInstance(id) {
        return this.instances.get(id)?.el || null;
    }

    hasInstance(id) {
        return this.instances.has(id);
    }

    destroyAll() {
        [...this.instances.keys()].forEach(id => this.destroy(id));
    }
}

window.placesAutocompleteService = new PlacesAutocompleteService();