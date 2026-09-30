document.addEventListener('DOMContentLoaded', () => {
    
    const viewModeSelect = document.getElementById('view-mode-select');
    const tileLayerSelect = document.getElementById('tile-layer-select');

    // 1. Handle 2D vs 3D switching
    viewModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        
        if (mode === '3D') {
            // Tell the system to switch to 3D
            window.EventBus.emit('switch_to_3d');
            
            // Hide the tile selector because 3D Earth has its own integrated textures
            tileLayerSelect.closest('.control-group').style.display = 'none';
        } else {
            // Tell the system to switch to 2D
            window.EventBus.emit('switch_to_2d');
            
            // Bring back the tile selector
            tileLayerSelect.closest('.control-group').style.display = 'flex';
        }
    });

    // 2. Handle 2D Tile Layer switching (Satellite, Terrain, etc.)
    tileLayerSelect.addEventListener('change', (e) => {
        const selectedLayer = e.target.value;
        
        // Broadcast the change to whatever map is listening (our flatMap)
        window.EventBus.emit('change_tile_layer', { layerType: selectedLayer });
    });
});