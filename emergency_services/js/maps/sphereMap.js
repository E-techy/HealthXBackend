/**
 * HealthX Emergency Command Center
 * sphereMap.js
 *
 * Handles:
 * - Google Maps 3D / Maps 3D Element
 * - 3D map initialization
 * - 3D ↔ 2D visibility
 * - 3D layer switching
 * - 3D camera positioning
 * - Normalized map click events for route-point picking
 */

(() => {
    "use strict";

    class SphereMapController {
        constructor() {
            this.container = null;
            this.map3D = null;

            this.initialized = false;
            this.initializing = null;

            this.currentLayer = "hybrid";

            this.defaultLocation = {
                lat: 22.9734,
                lng: 78.6569
            };

            this.bindEvents();

            if (document.readyState === "loading") {
                document.addEventListener(
                    "DOMContentLoaded",
                    () => this.setup(),
                    { once: true }
                );
            } else {
                this.setup();
            }
        }

        setup() {
            this.container =
                document.getElementById(
                    "sphere-map-view"
                );

            if (!this.container) {
                console.warn(
                    "⚠️ #sphere-map-view not found."
                );
                return;
            }

            /*
             * Keep 3D hidden until explicitly selected.
             */
            this.hideMap();

            console.log(
                "🌐 Sphere map controller initialized."
            );
        }

        bindEvents() {
            if (
                !window.EventBus ||
                typeof window.EventBus.on !== "function"
            ) {
                return;
            }

            window.EventBus.on(
                "switch_to_3d",
                (data) => {
                    this.currentLayer =
                        data?.layer === "satellite"
                            ? "satellite"
                            : "hybrid";

                    this.showMap();
                    this.initMap();
                }
            );

            window.EventBus.on(
                "switch_to_2d",
                () => {
                    this.hideMap();
                }
            );

            window.EventBus.on(
                "change_tile_layer",
                (data) => {
                    /*
                     * Only react to layer changes while the
                     * active view is 3D.
                     *
                     * 2D has its own controller.
                     */
                    if (
                        data?.view &&
                        data.view !== "3d"
                    ) {
                        return;
                    }

                    const layer =
                        data?.layer;

                    if (
                        layer !== "hybrid" &&
                        layer !== "satellite"
                    ) {
                        return;
                    }

                    this.currentLayer =
                        layer;

                    if (this.initialized) {
                        this.changeLayer(
                            layer
                        );
                    }
                }
            );

            window.EventBus.on(
                "update_location",
                (data) => {
                    if (
                        data &&
                        Number.isFinite(
                            Number(data.lat)
                        ) &&
                        Number.isFinite(
                            Number(data.lng)
                        )
                    ) {
                        this.updateLocation({
                            lat: Number(data.lat),
                            lng: Number(data.lng)
                        });
                    }
                }
            );
        }

        async getUserLocation() {
            if (
                !navigator.geolocation
            ) {
                return {
                    ...this.defaultLocation
                };
            }

            return new Promise((resolve) => {
                let completed = false;

                const finish = (location) => {
                    if (completed) {
                        return;
                    }

                    completed = true;
                    resolve(location);
                };

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        finish({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    },
                    () => {
                        finish({
                            ...this.defaultLocation
                        });
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 7000,
                        maximumAge: 60000
                    }
                );

                /*
                 * Do not leave the 3D map waiting forever for
                 * browser GPS permission / provider response.
                 */
                setTimeout(() => {
                    finish({
                        ...this.defaultLocation
                    });
                }, 8000);
            });
        }

        async initMap(forceRefresh = false) {
            if (this.initialized && this.map3D) {
                return this.map3D;
            }

            if (this.initializing) {
                return this.initializing;
            }

            this.initializing =
                this._createMap(
                    forceRefresh
                ).finally(() => {
                    this.initializing = null;
                });

            return this.initializing;
        }

        async _createMap(forceRefresh) {
            try {
                if (!window.mapLoader) {
                    throw new Error(
                        "MapLoader is not available."
                    );
                }

                await window.mapLoader.loadGoogleMaps(
                    forceRefresh
                );

                const maps3d =
                    await google.maps.importLibrary(
                        "maps3d"
                    );

                if (
                    !maps3d ||
                    !maps3d.Map3DElement
                ) {
                    throw new Error(
                        "Google Maps 3D library is unavailable."
                    );
                }

                if (!this.container) {
                    this.container =
                        document.getElementById(
                            "sphere-map-view"
                        );
                }

                if (!this.container) {
                    throw new Error(
                        "3D map container not found."
                    );
                }

                const location =
                    await this.getUserLocation();

                const Map3DElement =
                    maps3d.Map3DElement;

                /*
                 * Remove an old element if initialization is
                 * retried or the controller is re-created.
                 */
                if (this.map3D) {
                    try {
                        this.map3D.remove();
                    } catch (error) {
                        console.warn(
                            "⚠️ Unable to remove old 3D map:",
                            error
                        );
                    }

                    this.map3D = null;
                }

                const map3D =
                    new Map3DElement({
                        center: {
                            lat: location.lat,
                            lng: location.lng,
                            altitude: 2500
                        },
                        tilt: 45,
                        heading: 0,
                        range: 5000,
                        mode:
                            this.currentLayer ===
                            "satellite"
                                ? "SATELLITE"
                                : "HYBRID"
                    });

                /*
                 * Normalize the 3D click event into the same
                 * { lat, lng } structure emitted by flatMap.js.
                 *
                 * MarkerManager can therefore use exactly one
                 * map_clicked event handler for both map modes.
                 */
                map3D.addEventListener(
                    "gmp-click",
                    (event) => {
                        const position =
                            event?.position ||
                            event?.detail?.position;

                        if (!position) {
                            return;
                        }

                        const lat =
                            this.extractCoordinate(
                                position,
                                "lat"
                            );

                        const lng =
                            this.extractCoordinate(
                                position,
                                "lng"
                            );

                        if (
                            !Number.isFinite(lat) ||
                            !Number.isFinite(lng)
                        ) {
                            return;
                        }

                        if (
                            window.EventBus &&
                            typeof window.EventBus.emit ===
                                "function"
                        ) {
                            window.EventBus.emit(
                                "map_clicked",
                                {
                                    lat,
                                    lng
                                }
                            );
                        }
                    }
                );

                this.container.replaceChildren(
                    map3D
                );

                this.map3D = map3D;
                this.initialized = true;

                this.showMap();

                console.log(
                    "🌐 Google Maps 3D initialized."
                );

                return this.map3D;
            } catch (error) {
                console.error(
                    "❌ 3D map initialization failed:",
                    error
                );

                /*
                 * Retry once with a fresh Maps bootstrap when
                 * the first initialization fails.
                 */
                if (!forceRefresh) {
                    console.warn(
                        "🔄 Retrying 3D map initialization..."
                    );

                    return this.initMap(true);
                }

                throw error;
            }
        }

        extractCoordinate(position, axis) {
            if (!position) {
                return NaN;
            }

            const candidate =
                position[axis];

            if (
                typeof candidate ===
                "function"
            ) {
                return Number(
                    candidate.call(position)
                );
            }

            return Number(candidate);
        }

        showMap() {
            if (!this.container) {
                return;
            }

            this.container.classList.add(
                "active"
            );

            this.container.style.display =
                "block";
        }

        hideMap() {
            if (!this.container) {
                return;
            }

            this.container.classList.remove(
                "active"
            );

            this.container.style.display =
                "none";
        }

        changeLayer(layer) {
            if (!this.map3D) {
                return;
            }

            if (
                layer !== "hybrid" &&
                layer !== "satellite"
            ) {
                return;
            }

            this.currentLayer =
                layer;

            /*
             * Map3DElement uses a map mode rather than the
             * regular 2D mapTypeId.
             */
            try {
                this.map3D.mode =
                    layer === "satellite"
                        ? "SATELLITE"
                        : "HYBRID";
            } catch (error) {
                console.warn(
                    "⚠️ Unable to change 3D map layer:",
                    error
                );
            }
        }

        updateLocation(location) {
            if (
                !location ||
                !Number.isFinite(
                    Number(location.lat)
                ) ||
                !Number.isFinite(
                    Number(location.lng)
                )
            ) {
                return;
            }

            if (!this.map3D) {
                return;
            }

            const lat =
                Number(location.lat);

            const lng =
                Number(location.lng);

            try {
                /*
                 * Keep the camera close enough to be useful
                 * without forcing an extreme zoom.
                 */
                this.map3D.flyCameraTo({
                    endCamera: {
                        center: {
                            lat,
                            lng,
                            altitude: 2500
                        },
                        tilt: 60,
                        heading: 0,
                        range: 5000
                    },
                    durationMillis: 1200
                });
            } catch (error) {
                console.warn(
                    "⚠️ 3D camera update failed:",
                    error
                );
            }
        }

        getMap() {
            return this.map3D;
        }

        getLayer() {
            return this.currentLayer;
        }

        isReady() {
            return (
                this.initialized &&
                !!this.map3D
            );
        }
    }

    window.sphereMapEngine =
        new SphereMapController();

})();