/**
 * HealthX Emergency Command Center
 * tileManager.js
 *
 * Responsible for:
 * - Google Maps visual styles
 * - Light / dark tactical styling
 * - Layer-aware style selection
 * - Theme synchronization
 */

(() => {
    "use strict";

    class TileManager {
        constructor() {
            this.currentTheme = this.getTheme();

            this.tacticalDarkStyle = [
                {
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#1d2633"
                        }
                    ]
                },
                {
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#8f9bad"
                        }
                    ]
                },
                {
                    elementType: "labels.text.stroke",
                    stylers: [
                        {
                            color: "#1d2633"
                        }
                    ]
                },
                {
                    featureType: "administrative",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#394454"
                        }
                    ]
                },
                {
                    featureType: "administrative.country",
                    elementType: "geometry.stroke",
                    stylers: [
                        {
                            color: "#596679"
                        }
                    ]
                },
                {
                    featureType: "landscape",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#202a38"
                        }
                    ]
                },
                {
                    featureType: "poi",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#263141"
                        }
                    ]
                },
                {
                    featureType: "poi",
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#8794a7"
                        }
                    ]
                },
                {
                    featureType: "road",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#354154"
                        }
                    ]
                },
                {
                    featureType: "road",
                    elementType: "geometry.stroke",
                    stylers: [
                        {
                            color: "#293444"
                        }
                    ]
                },
                {
                    featureType: "road",
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#a6b0bf"
                        }
                    ]
                },
                {
                    featureType: "road.highway",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#46546a"
                        }
                    ]
                },
                {
                    featureType: "transit",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#2a3545"
                        }
                    ]
                },
                {
                    featureType: "water",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#101923"
                        }
                    ]
                },
                {
                    featureType: "water",
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#66778d"
                        }
                    ]
                }
            ];

            this.cleanLightStyle = [
                {
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#f3f6fa"
                        }
                    ]
                },
                {
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#465363"
                        }
                    ]
                },
                {
                    elementType: "labels.text.stroke",
                    stylers: [
                        {
                            color: "#f3f6fa"
                        }
                    ]
                },
                {
                    featureType: "administrative",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#c8d0da"
                        }
                    ]
                },
                {
                    featureType: "administrative.country",
                    elementType: "geometry.stroke",
                    stylers: [
                        {
                            color: "#aeb9c7"
                        }
                    ]
                },
                {
                    featureType: "landscape",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#eef2f6"
                        }
                    ]
                },
                {
                    featureType: "poi",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#e6ebf1"
                        }
                    ]
                },
                {
                    featureType: "poi",
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#687586"
                        }
                    ]
                },
                {
                    featureType: "road",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#ffffff"
                        }
                    ]
                },
                {
                    featureType: "road",
                    elementType: "geometry.stroke",
                    stylers: [
                        {
                            color: "#d3d9e1"
                        }
                    ]
                },
                {
                    featureType: "road",
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#586575"
                        }
                    ]
                },
                {
                    featureType: "road.highway",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#dce2e9"
                        }
                    ]
                },
                {
                    featureType: "transit",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#e0e6ed"
                        }
                    ]
                },
                {
                    featureType: "water",
                    elementType: "geometry",
                    stylers: [
                        {
                            color: "#dcebf5"
                        }
                    ]
                },
                {
                    featureType: "water",
                    elementType: "labels.text.fill",
                    stylers: [
                        {
                            color: "#688096"
                        }
                    ]
                }
            ];

            this.bindEvents();

            console.log("🎨 Tile manager initialized.");
        }

        bindEvents() {
            if (
                window.EventBus &&
                typeof window.EventBus.on === "function"
            ) {
                window.EventBus.on(
                    "theme_changed",
                    (data) => {
                        if (
                            data &&
                            (data.theme === "dark" ||
                                data.theme === "light")
                        ) {
                            this.currentTheme =
                                data.theme;
                        } else {
                            this.currentTheme =
                                this.getTheme();
                        }
                    }
                );
            }
        }

        getTheme() {
            const rootTheme =
                document.documentElement?.dataset
                    ?.theme;

            const bodyTheme =
                document.body?.dataset?.theme;

            return rootTheme === "light" ||
                bodyTheme === "light"
                ? "light"
                : "dark";
        }

        normalizeLayer(layerType) {
            const allowed = [
                "roadmap",
                "satellite",
                "terrain",
                "hybrid"
            ];

            return allowed.includes(layerType)
                ? layerType
                : "roadmap";
        }

        getStyleForLayer(layerType = "roadmap") {
            const layer =
                this.normalizeLayer(layerType);

            /*
             * Satellite and hybrid imagery already contain
             * their own visual styling. Applying a roadmap
             * style array to them can create inconsistent
             * rendering, so leave them untouched.
             */
            if (
                layer === "satellite" ||
                layer === "hybrid"
            ) {
                return [];
            }

            /*
             * Terrain remains theme-aware because its base
             * map labels / roads benefit from the same UI theme.
             */
            return this.currentTheme === "light"
                ? [...this.cleanLightStyle]
                : [...this.tacticalDarkStyle];
        }

        getCurrentTheme() {
            return this.currentTheme;
        }

        refreshTheme() {
            this.currentTheme =
                this.getTheme();

            return this.currentTheme;
        }
    }

    window.tileManager =
        new TileManager();

})();