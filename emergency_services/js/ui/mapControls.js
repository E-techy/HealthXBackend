document.addEventListener('DOMContentLoaded', () => {
    
    const viewModeSelect = document.getElementById('view-mode-select');
    const tileLayerSelect = document.getElementById('tile-layer-select');

    // Save the original 2D options
    const options2D = `
        <option value="roadmap">Political / Roads</option>
        <option value="satellite">Satellite (No Labels)</option>
        <option value="terrain">Terrain</option>
        <option value="hybrid">Hybrid (Satellite + Labels)</option>
    `;

    // 3D Options supported by Google Map3DElement
    const options3D = `
        <option value="hybrid">3D Hybrid (Default)</option>
        <option value="satellite">3D Satellite (Clean)</option>
    `;

    viewModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        
        if (mode === '3D') {
            tileLayerSelect.innerHTML = options3D;
            window.EventBus.emit('switch_to_3d');
        } else {
            tileLayerSelect.innerHTML = options2D;
            window.EventBus.emit('switch_to_2d');
        }
    });

    tileLayerSelect.addEventListener('change', (e) => {
        const selectedLayer = e.target.value;
        window.EventBus.emit('change_tile_layer', { layerType: selectedLayer });
    });
});