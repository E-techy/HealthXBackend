class TileManager {
    constructor() {
        this.tacticalDarkStyle = [
            { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] }
            // ... (Add full dark JSON if desired, keeping it short here for brevity)
        ];

        // Clean Light Theme (Desaturated, crisp)
        this.cleanLightStyle = [
            { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
            { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] }
        ];
    }

    getStyleForLayer(layerType) {
        if (layerType === 'satellite' || layerType === 'hybrid') {
            return []; // Image tiles don't use vector styles
        }
        
        const currentTheme = document.body.getAttribute('data-theme') || 'dark';
        return currentTheme === 'dark' ? this.tacticalDarkStyle : this.cleanLightStyle;
    }
}
window.tileManager = new TileManager();