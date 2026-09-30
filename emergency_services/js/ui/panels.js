document.addEventListener('DOMContentLoaded', () => {
    
    const dockBtns = document.querySelectorAll('.dock-btn[data-target]');
    const flyoutPanels = document.querySelectorAll('.flyout-panel');
    const collapseBtn = document.getElementById('btn-collapse-all');
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    
    let inactivityTimer = null;
    let isPanelOpen = false;

    // --- SYSTEM THEME INIT ---
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    let currentTheme = localStorage.getItem('healthx_theme') || (prefersLight ? 'light' : 'dark');
    document.body.setAttribute('data-theme', currentTheme);

    // --- 1. DOCK CLICKS ---
    dockBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetPanel = document.getElementById(targetId);
            const isCurrentlyActive = btn.classList.contains('active');

            // Close everything first
            closeAllPanels();

            // If it wasn't active, open it
            if (!isCurrentlyActive) {
                btn.classList.add('active');
                targetPanel.classList.remove('hidden');
                isPanelOpen = true;
                resetInactivityTimer();
            }
        });
    });

    // --- 2. COLLAPSE CONTROLS ---
    collapseBtn.addEventListener('click', closeAllPanels);

    function closeAllPanels() {
        dockBtns.forEach(b => b.classList.remove('active'));
        flyoutPanels.forEach(p => p.classList.add('hidden'));
        isPanelOpen = false;
        clearTimeout(inactivityTimer);
    }

    // --- 3. AUTO-COLLAPSE ON INACTIVITY ---
    // Listen for mouse movement anywhere on the window. 
    // If a panel is open and the mouse stops moving for 5 seconds, collapse.
    window.addEventListener('mousemove', () => {
        if (isPanelOpen) {
            resetInactivityTimer();
        }
    });

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            closeAllPanels();
        }, 5000); // 5 seconds of no mouse movement
    }

    // --- 4. THEME TOGGLE ---
    themeToggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', currentTheme);
        localStorage.setItem('healthx_theme', currentTheme);
        
        // Tell the 2D map to update its colors
        if (window.EventBus) {
            window.EventBus.emit('theme_changed', currentTheme);
        }
    });
});