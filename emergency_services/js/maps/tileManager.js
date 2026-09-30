class TileManager {
    constructor() {
        // Custom Google Maps JSON to create a futuristic/tactical dark mode
        this.tacticalDarkStyle = [
            { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
            { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
            { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
            { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
            { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
            { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
            { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
            { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
            { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
            { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#023e58" }] },
            { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
            { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
            { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
            { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] }
        ];
    }

    // Returns the correct styling array depending on the chosen layer
    getStyleForLayer(layerType) {
        // Satellite and Hybrid have their own imagery, so they don't use JSON styling
        if (layerType === 'satellite' || layerType === 'hybrid') {
            return []; 
        }
        
        // For Roadmap and Terrain, use our tactical dark mode
        return this.tacticalDarkStyle;
    }
}

// Make it globally available
window.tileManager = new TileManager();