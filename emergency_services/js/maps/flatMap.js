class FlatMapController {

    constructor() {

        this.container =
            document.getElementById('flat-map-view');

        this.map2D = null;
        this.initialized = false;
        this.initializing = false;

        this.currentLayer = 'roadmap';
        this.currentTheme =
            document.body?.dataset.theme || 'dark';

        this.defaultCenter = {
            lat: 22.9734,
            lng: 78.6569
        };

        this.bindEvents();

        // 2D map is the default view.
        this.initMap();
    }


    // ============================================================
    // EVENT BUS
    // ============================================================

    bindEvents() {

        if (!window.EventBus) {
            console.warn(
                '⚠️ EventBus not available for FlatMapController.'
            );

            return;
        }


        window.EventBus.on(
            'switch_to_2d',
            () => this.showMap()
        );


        window.EventBus.on(
            'switch_to_3d',
            () => this.hideMap()
        );


        window.EventBus.on(
            'change_tile_layer',
            (data) => {

                if (!data) return;

                this.changeLayer(
                    data.layer || data.value || data
                );
            }
        );


        window.EventBus.on(
            'update_location',
            (data) => {

                if (!data) return;

                this.updateLocation(
                    data.lat,
                    data.lng
                );
            }
        );


        window.EventBus.on(
            'theme_changed',
            (data) => {

                const theme =
                    typeof data === 'string'
                        ? data
                        : data?.theme;

                this.updateTheme(theme);
            }
        );
    }


    // ============================================================
    // USER LOCATION
    // ============================================================

    async getUserLocation() {

        return new Promise((resolve) => {

            if (!navigator.geolocation) {

                resolve({
                    ...this.defaultCenter
                });

                return;
            }


            navigator.geolocation.getCurrentPosition(

                (position) => {

                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },

                () => {

                    resolve({
                        ...this.defaultCenter
                    });
                },

                {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 30000
                }
            );
        });
    }


    // ============================================================
    // MAP INITIALIZATION
    // ============================================================

    async initMap(forceRefresh = false) {

        if (this.initialized && !forceRefresh) {
            return this.map2D;
        }


        if (this.initializing && !forceRefresh) {
            return this.initializing;
        }


        this.initializing =
            this._createMap(forceRefresh);


        try {

            return await this.initializing;

        } finally {

            this.initializing = false;
        }
    }


    async _createMap(forceRefresh = false) {

        try {

            // ----------------------------------------------------
            // Load Google Maps
            // ----------------------------------------------------

            if (!window.mapLoader) {

                throw new Error(
                    'MapLoader is not available.'
                );
            }


            await window.mapLoader.loadGoogleMaps(
                forceRefresh
            );


            // ----------------------------------------------------
            // Import Maps library
            // ----------------------------------------------------

            const { Map } =
                await google.maps.importLibrary(
                    'maps'
                );


            // ----------------------------------------------------
            // Get location
            // ----------------------------------------------------

            const center =
                await this.getUserLocation();


            // ----------------------------------------------------
            // Determine current theme
            // ----------------------------------------------------

            this.currentTheme =
                document.body?.dataset.theme ||
                document.documentElement?.dataset.theme ||
                'dark';


            // ----------------------------------------------------
            // Get map styling
            // ----------------------------------------------------

            let styles = [];

            if (window.tileManager) {

                styles =
                    window.tileManager.getStyleForLayer(
                        this.currentLayer
                    ) || [];
            }


            // ----------------------------------------------------
            // Create map
            // ----------------------------------------------------

            this.map2D = new Map(
                this.container,
                {
                    center,

                    zoom: 5,

                    mapId: 'DEMO_MAP_ID',

                    mapTypeId:
                        this.currentLayer,

                    styles,

                    disableDefaultUI: true,

                    zoomControl: true,

                    mapTypeControl: false,

                    streetViewControl: false,

                    fullscreenControl: false,

                    clickableIcons: true,

                    gestureHandling: 'greedy'
                }
            );


            this.initialized = true;


            // ----------------------------------------------------
            // IMPORTANT:
            //
            // There must be exactly ONE map click listener.
            // MarkerManager listens to the EventBus.
            // ----------------------------------------------------

            this.map2D.addListener(
                'click',
                (event) => {

                    if (
                        !event ||
                        !event.latLng ||
                        !window.EventBus
                    ) {
                        return;
                    }


                    const lat =
                        event.latLng.lat();

                    const lng =
                        event.latLng.lng();


                    if (
                        !Number.isFinite(lat) ||
                        !Number.isFinite(lng)
                    ) {
                        return;
                    }


                    window.EventBus.emit(
                        'map_clicked',
                        {
                            lat,
                            lng
                        }
                    );
                }
            );


            console.log(
                '🗺️ 2D Google Map initialized.'
            );


            return this.map2D;

        } catch (error) {

            console.error(
                '❌ Failed to initialize 2D map:',
                error
            );


            // ----------------------------------------------------
            // Retry once with a fresh Google Maps load.
            // ----------------------------------------------------

            if (!forceRefresh) {

                console.warn(
                    '🔄 Retrying 2D map initialization...'
                );


                return this.initMap(true);
            }


            this.initialized = false;
            this.map2D = null;

            throw error;
        }
    }


    // ============================================================
    // SHOW / HIDE
    // ============================================================

    async showMap() {

        if (!this.container) return;


        this.container.classList.remove(
            'hidden'
        );


        this.container.style.display =
            'block';


        if (!this.initialized) {

            try {
                await this.initMap();
            } catch (error) {

                console.error(
                    '❌ Could not show 2D map:',
                    error
                );

                return;
            }
        }


        // Give Google Maps one frame to recalculate
        // the container dimensions after a view switch.

        requestAnimationFrame(() => {

            if (
                this.map2D &&
                typeof google !== 'undefined' &&
                google.maps
            ) {

                google.maps.event.trigger(
                    this.map2D,
                    'resize'
                );
            }
        });
    }


    hideMap() {

        if (!this.container) return;


        this.container.classList.add(
            'hidden'
        );


        this.container.style.display =
            'none';
    }


    // ============================================================
    // THEME
    // ============================================================

    updateTheme(theme) {

        if (theme !== 'light' && theme !== 'dark') {

            theme =
                document.body?.dataset.theme ||
                document.documentElement?.dataset.theme ||
                'dark';
        }


        this.currentTheme = theme;


        // Satellite and hybrid imagery should not receive
        // artificial roadmap styling.
        if (
            this.currentLayer === 'satellite' ||
            this.currentLayer === 'hybrid'
        ) {
            return;
        }


        if (!this.map2D) return;


        if (!window.tileManager) return;


        const styles =
            window.tileManager.getStyleForLayer(
                this.currentLayer
            ) || [];


        // With a mapId, setOptions can still safely update
        // supported client-side options when styles are supplied.
        try {

            this.map2D.setOptions({
                styles
            });

        } catch (error) {

            console.warn(
                '⚠️ Could not update 2D map theme:',
                error
            );
        }
    }


    // ============================================================
    // TILE / MAP LAYER
    // ============================================================

    changeLayer(layerType) {

        const allowedLayers = [
            'roadmap',
            'satellite',
            'terrain',
            'hybrid'
        ];


        if (!allowedLayers.includes(layerType)) {

            console.warn(
                `⚠️ Unsupported 2D map layer: ${layerType}`
            );

            return;
        }


        this.currentLayer =
            layerType;


        if (!this.map2D) return;


        try {

            this.map2D.setMapTypeId(
                layerType
            );

        } catch (error) {

            console.error(
                '❌ Failed to change map layer:',
                error
            );

            return;
        }


        // --------------------------------------------------------
        // Roadmap / terrain can receive theme styling.
        // Satellite / hybrid should remain imagery-based.
        // --------------------------------------------------------

        if (
            layerType === 'satellite' ||
            layerType === 'hybrid'
        ) {

            try {

                this.map2D.setOptions({
                    styles: []
                });

            } catch (_) {}

            return;
        }


        if (window.tileManager) {

            const styles =
                window.tileManager.getStyleForLayer(
                    layerType
                ) || [];


            try {

                this.map2D.setOptions({
                    styles
                });

            } catch (error) {

                console.warn(
                    '⚠️ Could not apply layer style:',
                    error
                );
            }
        }
    }


    // ============================================================
    // LOCATION UPDATE
    // ============================================================

    updateLocation(lat, lng) {

        if (
            typeof lat !== 'number' ||
            typeof lng !== 'number' ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
        ) {
            return;
        }


        if (!this.map2D) {

            this.initMap()
                .then(() => {

                    this.updateLocation(
                        lat,
                        lng
                    );
                })
                .catch(error => {

                    console.error(
                        '❌ Cannot update map location:',
                        error
                    );
                });

            return;
        }


        const position = {
            lat,
            lng
        };


        this.map2D.panTo(
            position
        );


        // Do not aggressively zoom the map every time
        // a routing point changes. That would make typing /
        // selecting multiple points frustrating.

        if (this.map2D.getZoom() < 10) {

            this.map2D.setZoom(12);
        }
    }


    // ============================================================
    // PUBLIC ACCESSOR
    // ============================================================

    getMap() {

        return this.map2D;
    }


    isReady() {

        return !!(
            this.initialized &&
            this.map2D
        );
    }
}


// ================================================================
// INITIALIZATION
// ================================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        window.flatMapEngine =
            new FlatMapController();
    }
);