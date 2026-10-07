(() => {
    "use strict";

    class EmergencyManagerUI {
        constructor() {
            this.container = null;
            this.initialized = false;
            this.isVisible = false;
        }

        init() {
            if (this.initialized) return;
            this.injectHTML();
            this.container = document.getElementById('em-manager-window');
            this.dragHandle = document.getElementById('em-drag-handle');
            this.btnClose = document.getElementById('em-btn-close');
            
            this.bindDragEvents();
            this.bindTabs();

            // Initialize the sub-modules
            window.EmSearchTab.init();
            window.EmCreateTab.init();

            this.initialized = true;
        }

        injectHTML() {
            const html = `
                <div id="em-manager-window" class="em-floating-window hidden">
                    <div class="em-header" id="em-drag-handle">
                        <span class="em-title">Emergency Operations</span>
                        <button class="em-close-btn" id="em-btn-close">×</button>
                    </div>
                    <div class="em-tabs">
                        <button class="em-tab-btn active" data-tab="discover">Discover</button>
                        <button class="em-tab-btn" data-tab="manage">Create Incident</button>
                    </div>
                    <div class="em-content-area" id="em-content-area">
                        <!-- Sub-modules will inject their HTML here -->
                    </div>
                </div>
            `;
            document.getElementById('ui-layer').insertAdjacentHTML('beforeend', html);
        }

        bindTabs() {
            const btns = document.querySelectorAll('.em-tab-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    btns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    document.querySelectorAll('.em-view').forEach(v => v.classList.remove('active'));
                    document.getElementById(`em-view-${e.target.dataset.tab}`).classList.add('active');
                });
            });
        }

        bindDragEvents() {
            let isDragging = false, startX, startY, initialLeft, initialTop;
            this.dragHandle.addEventListener('mousedown', (e) => {
                if (e.target === this.btnClose) return;
                isDragging = true;
                startX = e.clientX; startY = e.clientY;
                const rect = this.container.getBoundingClientRect();
                initialLeft = rect.left; initialTop = rect.top;
                this.container.style.transition = 'none';
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                this.container.style.left = `${initialLeft + (e.clientX - startX)}px`;
                this.container.style.top = `${initialTop + (e.clientY - startY)}px`;
            });
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    this.container.style.transition = 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease';
                }
            });
            this.btnClose.addEventListener('click', () => this.toggle());
        }

        toggle() {
            if (!this.initialized) this.init();
            if (this.isVisible) {
                this.container.classList.add('hidden');
                this.isVisible = false;
            } else {
                this.container.classList.remove('hidden');
                this.isVisible = true;
            }
        }
    }

    // Expose globally so panels.js can call EmUIManager.toggle()
    window.EmUIManager = new EmergencyManagerUI();
    
    // Auto-update panels.js connection safely if it loads after
    document.addEventListener("DOMContentLoaded", () => {
        const emManagerBtn = document.getElementById("btn-open-em-manager");
        if (emManagerBtn) {
            // Remove old listeners by cloning
            const newBtn = emManagerBtn.cloneNode(true);
            emManagerBtn.parentNode.replaceChild(newBtn, emManagerBtn);
            newBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if(window.panelController) window.panelController.closeAllPanels();
                window.EmUIManager.toggle();
            });
        }
    });
})();
