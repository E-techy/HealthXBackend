/**
 * HealthX Emergency Command Center
 * panels.js
 *
 * Handles:
 * - Side dock panel opening / closing
 * - Native Browser Theme switching (Dark/Light fallback)
 * - Inactivity handling (safe for Places Autocomplete inputs)
 */
(() => {
    "use strict";

    class PanelController {
        constructor() {
            this.dockButtons = [];
            this.panels = [];
            this.activePanelId = null;
            this.themeButton = null;
            this.collapseButton = null;
            this.inactivityTimer = null;
            this.inactivityDelay = 15000;
            this.initialized = false;
        }

        init() {
            if (this.initialized) return;
            this.initialized = true;

            this.cacheElements();
            this.initializeTheme();
            this.bindPanelEvents();
            this.bindThemeEvents();
            this.bindActivityEvents();
            this.closeAllPanels();

            console.log("🧩 [PanelController] initialized.");
        }

        cacheElements() {
            this.dockButtons = Array.from(document.querySelectorAll(".dock-btn[data-target]"));
            this.panels = Array.from(document.querySelectorAll(".flyout-panel"));
            this.themeButton = document.getElementById("btn-theme-toggle");
            this.collapseButton = document.getElementById("btn-collapse-all");
        }

        /* ================================================================
           PANEL EVENTS
           ================================================================ */
        bindPanelEvents() {
            this.dockButtons.forEach((button) => {
                button.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = button.dataset.target;
                    if (targetId) this.togglePanel(targetId, button);
                });
            });

            if (this.collapseButton) {
                this.collapseButton.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeAllPanels();
                });
            }

              // --- UPDATED BLOCK FOR TOGGLE ---
            const emManagerBtn = document.getElementById("btn-open-em-manager");
            if (emManagerBtn) {
                emManagerBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeAllPanels(); // Close standard flyouts

                    if (window.EmergencyManager) {
                        window.EmergencyManager.toggle(); // <--- Changed from show() to toggle()
                    } else {
                        console.warn("EmergencyManager not loaded yet.");
                    }
                });
            }

            // Prevent clicks inside panel from bubbling up and closing it
            this.panels.forEach((panel) => {
                panel.addEventListener("click", (e) => e.stopPropagation());
            });
        }

        togglePanel(panelId, clickedButton = null) {
            const panel = document.getElementById(panelId);
            if (!panel) return;

            const isAlreadyOpen = this.activePanelId === panelId && !panel.classList.contains("hidden");

            if (isAlreadyOpen) {
                this.closeAllPanels();
            } else {
                this.openPanel(panelId, clickedButton);
            }
        }

        openPanel(panelId, clickedButton = null) {
            const targetPanel = document.getElementById(panelId);
            if (!targetPanel) return;

            // Hide other panels
            this.panels.forEach((panel) => {
                const isTarget = panel === targetPanel;
                panel.classList.toggle("hidden", !isTarget);
                panel.setAttribute("aria-hidden", !isTarget ? "true" : "false");
            });

            // Update dock states
            this.dockButtons.forEach((button) => {
                const isTarget = button.dataset.target === panelId;
                button.classList.toggle("active", isTarget);
                button.setAttribute("aria-expanded", isTarget ? "true" : "false");
            });

            this.activePanelId = panelId;

            if (clickedButton && document.activeElement === clickedButton) {
                clickedButton.blur();
            }

            this.resetInactivityTimer();

            if (window.EventBus) {
                window.EventBus.emit("panel_opened", { panelId });
            }
        }

        closeAllPanels() {
            this.panels.forEach((panel) => {
                panel.classList.add("hidden");
                panel.setAttribute("aria-hidden", "true");
            });

            this.dockButtons.forEach((button) => {
                button.classList.remove("active");
                button.setAttribute("aria-expanded", "false");
            });

            this.activePanelId = null;
            this.clearInactivityTimer();

            if (window.EventBus) window.EventBus.emit("panels_closed");
        }

        /* ================================================================
           THEME CONTROLS (NATIVE CSS PRIORITY)
           ================================================================ */
        initializeTheme() {
            // Only apply a manual theme if the user has explicitly saved one before.
            // Otherwise, we do nothing and let the CSS `@media (prefers-color-scheme)` handle it natively.
            const savedTheme = localStorage.getItem("healthx_theme");
            
            if (savedTheme === "light" || savedTheme === "dark") {
                this.applyTheme(savedTheme, false);
            }
        }

        bindThemeEvents() {
            if (!this.themeButton) return;

            this.themeButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                // If no theme is hardcoded on HTML, read the browser's current OS preference to decide what to flip to
                let current = document.documentElement.dataset.theme;
                if (!current) {
                    current = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
                }

                const next = current === "dark" ? "light" : "dark";
                this.applyTheme(next, true);
            });
        }

        applyTheme(theme, persist = true) {
            document.documentElement.dataset.theme = theme;
            document.body.dataset.theme = theme;
            
            if (persist) {
                localStorage.setItem("healthx_theme", theme);
            }

            if (window.EventBus) window.EventBus.emit("theme_changed", { theme });
        }

        /* ================================================================
           ACTIVITY LOGIC
           ================================================================ */
        bindActivityEvents() {
            ["mousemove", "mousedown", "keydown", "touchstart"].forEach((eventName) => {
                document.addEventListener(eventName, () => this.resetInactivityTimer(), { passive: true });
            });
        }

        resetInactivityTimer() {
            this.clearInactivityTimer();
            if (!this.activePanelId) return;

            this.inactivityTimer = window.setTimeout(() => {
                const activeEl = document.activeElement;
                
                // Keep panel open if user is actively typing in a standard input or the GMP element
                const isTyping = activeEl && (
                    activeEl.matches("input, textarea, select") || 
                    activeEl.closest("gmp-place-autocomplete")
                );

                if (isTyping) {
                    this.resetInactivityTimer();
                    return;
                }

                this.closeAllPanels();
            }, this.inactivityDelay);
        }

        clearInactivityTimer() {
            if (this.inactivityTimer !== null) {
                window.clearTimeout(this.inactivityTimer);
                this.inactivityTimer = null;
            }
        }
    }

    // Auto-initialize
    const initialize = () => {
        if (!window.panelController) {
            window.panelController = new PanelController();
            window.panelController.init();
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
