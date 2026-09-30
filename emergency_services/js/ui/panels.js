document.addEventListener('DOMContentLoaded', () => {
    
    // Map hotkeys to their respective panel IDs
    const panelMap = {
        'm': document.getElementById('panel-map-controls'),
        'r': document.getElementById('panel-routing'),
        't': document.getElementById('panel-tracking')
    };

    // 1. KEYBOARD SHORTCUTS
    document.addEventListener('keydown', (e) => {
        // DO NOT trigger shortcuts if the user is typing inside an input box!
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        const key = e.key.toLowerCase();
        
        if (panelMap[key]) {
            e.preventDefault(); // Stop default browser behavior
            togglePanel(panelMap[key]);
        }
    });

    // 2. MOUSE CLICKS
    document.querySelectorAll('.floating-panel .toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panel = e.target.closest('.floating-panel');
            togglePanel(panel);
        });
    });

    // 3. CORE TOGGLE LOGIC
    function togglePanel(panel) {
        if (!panel) return;
        
        // Toggle the CSS class
        panel.classList.toggle('closed');
        
        // Update the arrow icon
        const btn = panel.querySelector('.toggle-btn');
        const isClosed = panel.classList.contains('closed');
        
        // Bottom panel opens UP, side panels open DOWN
        if (panel.id === 'panel-tracking') {
            btn.textContent = isClosed ? '▲' : '▼';
        } else {
            btn.textContent = isClosed ? '▼' : '▲';
        }
    }
});