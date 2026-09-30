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

            closeAllPanels();

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
    // FIXED: Now listens to mouse AND keyboard so it doesn't close while typing!
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
    
    activityEvents.forEach(evt => {
        window.addEventListener(evt, () => {
            if (isPanelOpen) {
                resetInactivityTimer();
            }
        });
    });

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        // Extended to 15 seconds for a better UX while typing addresses
        inactivityTimer = setTimeout(() => {
            closeAllPanels();
        }, 15000); 
    }

    // --- 4. THEME TOGGLE ---
    themeToggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', currentTheme);
        localStorage.setItem('healthx_theme', currentTheme);
        
        if (window.EventBus) {
            window.EventBus.emit('theme_changed', currentTheme);
        }
    });
});