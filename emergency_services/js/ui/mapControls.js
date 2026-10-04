/**
 * HealthX Emergency Command Center
 * mapControls.js
 *
 * Handles:
 * - 2D / 3D view selection
 * - Map layer selection
 * - Correct layer options for each view
 * - EventBus communication with map engines
 */

(() => {
    "use strict";

    class MapControls {
        constructor() {
            this.viewSelect = null;
            this.layerSelect = null;

            this.currentView = "2D";
            this.currentLayer = "roadmap";

            this.initialized = false;
        }

        init() {
            if (this.initialized) {
                return;
            }

            this.initialized = true;

            this.cacheElements();
            this.bindEvents();

            /*
             * Start in 2D roadmap mode.
             */
            this.setViewUI(
                this.currentView
            );

            this.setLayerUI(
                this.currentLayer
            );

            console.log(
                "🗺️ Map controls initialized."
            );
        }

        cacheElements() {
            this.viewSelect =
                document.getElementById(
                    "view-mode-select"
                );

            this.layerSelect =
                document.getElementById(
                    "tile-layer-select"
                );

            if (!this.viewSelect) {
                console.warn(
                    "⚠️ #view-mode-select not found."
                );
            }

            if (!this.layerSelect) {
                console.warn(
                    "⚠️ #tile-layer-select not found."
                );
            }
        }

        bindEvents() {
            if (this.viewSelect) {
                this.viewSelect.addEventListener(
                    "change",
                    (event) => {
                        const requestedView =
                            String(
                                event.target.value ||
                                ""
                            ).toUpperCase();

                        this.changeView(
                            requestedView
                        );
                    }
                );
            }

            if (this.layerSelect) {
                this.layerSelect.addEventListener(
                    "change",
                    (event) => {
                        const layer =
                            String(
                                event.target.value ||
                                ""
                            ).toLowerCase();

                        this.changeLayer(
                            layer
                        );
                    }
                );
            }
        }

        /* ================================================================
           VIEW
           ================================================================ */

        changeView(view) {
            const normalized =
                String(view)
                    .trim()
                    .toUpperCase();

            if (
                normalized !== "2D" &&
                normalized !== "3D"
            ) {
                console.warn(
                    `⚠️ Unsupported map view: ${view}`
                );

                this.setViewUI(
                    this.currentView
                );

                return;
            }

            this.currentView =
                normalized;

            this.setViewUI(
                normalized
            );

            /*
             * 3D only supports satellite/hybrid.
             * If the user switches to 3D while roadmap/
             * terrain is selected, automatically move to hybrid.
             */
            if (
                normalized === "3D" &&
                (
                    this.currentLayer ===
                        "roadmap" ||
                    this.currentLayer ===
                        "terrain"
                )
            ) {
                this.currentLayer =
                    "hybrid";

                this.setLayerUI(
                    "hybrid"
                );
            }

            /*
             * Switching back to 2D while using hybrid/satellite
             * is perfectly valid, so retain the selected layer.
             */

            if (
                window.EventBus &&
                typeof window.EventBus.emit ===
                    "function"
            ) {
                if (
                    normalized === "3D"
                ) {
                    window.EventBus.emit(
                        "switch_to_3d",
                        {
                            view: "3d",
                            layer:
                                this.currentLayer
                        }
                    );
                } else {
                    window.EventBus.emit(
                        "switch_to_2d",
                        {
                            view: "2d",
                            layer:
                                this.currentLayer
                        }
                    );
                }
            }

            console.log(
                `🗺️ Map view changed to ${normalized}`
            );
        }

        setViewUI(view) {
            if (!this.viewSelect) {
                return;
            }

            const normalized =
                String(view)
                    .toUpperCase();

            this.viewSelect.value =
                normalized;

            /*
             * Rebuild layer options according to
             * the active map engine.
             */
            this.updateLayerOptions(
                normalized
            );
        }

        /* ================================================================
           LAYERS
           ================================================================ */

        changeLayer(layer) {
            const normalized =
                this.normalizeLayer(
                    layer
                );

            /*
             * 3D Google Maps currently uses only
             * satellite/hybrid in this application.
             */
            if (
                this.currentView === "3D" &&
                normalized !== "satellite" &&
                normalized !== "hybrid"
            ) {
                this.currentLayer =
                    "hybrid";

                this.setLayerUI(
                    "hybrid"
                );

                return;
            }

            this.currentLayer =
                normalized;

            this.setLayerUI(
                normalized
            );

            if (
                window.EventBus &&
                typeof window.EventBus.emit ===
                    "function"
            ) {
                window.EventBus.emit(
                    "change_tile_layer",
                    {
                        layer:
                            normalized,

                        view:
                            this.currentView ===
                            "3D"
                                ? "3d"
                                : "2d"
                    }
                );
            }

            console.log(
                `🎨 Map layer changed to ${normalized}`
            );
        }

        normalizeLayer(layer) {
            const value =
                String(layer || "")
                    .trim()
                    .toLowerCase();

            const allowed = [
                "roadmap",
                "satellite",
                "terrain",
                "hybrid"
            ];

            if (
                allowed.includes(value)
            ) {
                return value;
            }

            return "roadmap";
        }

        setLayerUI(layer) {
            if (!this.layerSelect) {
                return;
            }

            const normalized =
                this.normalizeLayer(
                    layer
                );

            /*
             * Make sure the requested option exists
             * before assigning it.
             */
            const optionExists =
                Array.from(
                    this.layerSelect.options
                ).some(
                    (option) =>
                        option.value ===
                        normalized
                );

            if (optionExists) {
                this.layerSelect.value =
                    normalized;
            }
        }

        updateLayerOptions(view) {
            if (!this.layerSelect) {
                return;
            }

            const normalized =
                String(view)
                    .toUpperCase();

            const is3D =
                normalized === "3D";

            const options =
                Array.from(
                    this.layerSelect.options
                );

            options.forEach(
                (option) => {
                    const value =
                        option.value;

                    if (
                        is3D &&
                        (
                            value ===
                                "roadmap" ||
                            value ===
                                "terrain"
                        )
                    ) {
                        option.hidden =
                            true;

                        option.disabled =
                            true;
                    } else {
                        option.hidden =
                            false;

                        option.disabled =
                            false;
                    }
                }
            );

            /*
             * When entering 3D, force a valid
             * 3D layer if the current one isn't valid.
             */
            if (
                is3D &&
                (
                    this.currentLayer ===
                        "roadmap" ||
                    this.currentLayer ===
                        "terrain"
                )
            ) {
                this.currentLayer =
                    "hybrid";
            }

            this.setLayerUI(
                this.currentLayer
            );
        }

        /* ================================================================
           PUBLIC API
           ================================================================ */

        getView() {
            return this.currentView;
        }

        getLayer() {
            return this.currentLayer;
        }

        setView(view) {
            this.changeView(view);
        }

        setLayer(layer) {
            this.changeLayer(layer);
        }
    }

    const initialize = () => {
        if (
            window.mapControls
        ) {
            return;
        }

        window.mapControls =
            new MapControls();

        window.mapControls.init();
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();