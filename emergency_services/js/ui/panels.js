/**
 * HealthX Emergency Command Center
 * panels.js
 *
 * Handles:
 * - Side dock panel opening / closing
 * - Active dock state
 * - Theme switching
 * - Collapse all
 * - Panel inactivity handling
 *
 * IMPORTANT:
 * Panel visibility is controlled ONLY through the `.hidden` class.
 * This keeps CSS transitions and JS state synchronized.
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
            if (this.initialized) {
                return;
            }

            this.initialized = true;

            this.cacheElements();
            this.initializeTheme();
            this.bindPanelEvents();
            this.bindThemeEvents();
            this.bindActivityEvents();

            /*
             * Always begin with all flyout panels closed.
             * This prevents stale HTML/CSS state from causing
             * multiple panels to overlap.
             */
            this.closeAllPanels();

            console.log(
                "🧩 Panel controller initialized."
            );
        }

        cacheElements() {
            this.dockButtons = Array.from(
                document.querySelectorAll(
                    ".dock-btn[data-target]"
                )
            );

            this.panels = Array.from(
                document.querySelectorAll(
                    ".flyout-panel"
                )
            );

            this.themeButton =
                document.getElementById(
                    "btn-theme-toggle"
                );

            this.collapseButton =
                document.getElementById(
                    "btn-collapse-all"
                );
        }

        /* ================================================================
           PANEL EVENTS
           ================================================================ */

        bindPanelEvents() {
            this.dockButtons.forEach((button) => {
                button.addEventListener(
                    "click",
                    (event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        const targetId =
                            button.dataset.target;

                        if (!targetId) {
                            return;
                        }

                        this.togglePanel(
                            targetId,
                            button
                        );
                    }
                );
            });

            if (this.collapseButton) {
                this.collapseButton.addEventListener(
                    "click",
                    (event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        this.closeAllPanels();
                    }
                );
            }

            /*
             * Clicking inside a panel must NOT close it.
             */
            this.panels.forEach((panel) => {
                panel.addEventListener(
                    "click",
                    (event) => {
                        event.stopPropagation();
                    }
                );
            });
        }

        togglePanel(
            panelId,
            clickedButton = null
        ) {
            const panel =
                document.getElementById(
                    panelId
                );

            if (!panel) {
                console.warn(
                    `⚠️ Panel not found: ${panelId}`
                );

                return;
            }

            const isAlreadyOpen =
                this.activePanelId ===
                    panelId &&
                !panel.classList.contains(
                    "hidden"
                );

            if (isAlreadyOpen) {
                this.closeAllPanels();
                return;
            }

            this.openPanel(
                panelId,
                clickedButton
            );
        }

        openPanel(
            panelId,
            clickedButton = null
        ) {
            const targetPanel =
                document.getElementById(
                    panelId
                );

            if (!targetPanel) {
                console.warn(
                    `⚠️ Cannot open missing panel: ${panelId}`
                );

                return;
            }

            /*
             * Close every other panel first.
             */
            this.panels.forEach((panel) => {
                const isTarget =
                    panel === targetPanel;

                panel.classList.toggle(
                    "hidden",
                    !isTarget
                );

                if (!isTarget) {
                    panel.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                }
            });

            /*
             * Update all dock buttons.
             */
            this.dockButtons.forEach(
                (button) => {
                    const isTarget =
                        button.dataset.target ===
                        panelId;

                    button.classList.toggle(
                        "active",
                        isTarget
                    );

                    button.setAttribute(
                        "aria-expanded",
                        isTarget
                            ? "true"
                            : "false"
                    );
                }
            );

            /*
             * Make target panel visible.
             */
            targetPanel.classList.remove(
                "hidden"
            );

            targetPanel.setAttribute(
                "aria-hidden",
                "false"
            );

            this.activePanelId =
                panelId;

            /*
             * Give keyboard focus to the panel
             * without stealing focus from an input.
             */
            if (
                clickedButton &&
                document.activeElement ===
                    clickedButton
            ) {
                clickedButton.blur();
            }

            this.resetInactivityTimer();

            /*
             * Let other modules know which panel
             * is currently active.
             */
            if (
                window.EventBus &&
                typeof window.EventBus.emit ===
                    "function"
            ) {
                window.EventBus.emit(
                    "panel_opened",
                    {
                        panelId
                    }
                );
            }
        }

        closeAllPanels() {
            this.panels.forEach(
                (panel) => {
                    panel.classList.add(
                        "hidden"
                    );

                    panel.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                }
            );

            this.dockButtons.forEach(
                (button) => {
                    button.classList.remove(
                        "active"
                    );

                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                }
            );

            this.activePanelId = null;

            this.clearInactivityTimer();

            if (
                window.EventBus &&
                typeof window.EventBus.emit ===
                    "function"
            ) {
                window.EventBus.emit(
                    "panels_closed"
                );
            }
        }

        /* ================================================================
           THEME
           ================================================================ */

        initializeTheme() {
            const savedTheme =
                localStorage.getItem(
                    "healthx_theme"
                );

            let theme =
                savedTheme === "light" ||
                savedTheme === "dark"
                    ? savedTheme
                    : null;

            if (!theme) {
                theme =
                    window.matchMedia &&
                    window.matchMedia(
                        "(prefers-color-scheme: light)"
                    ).matches
                        ? "light"
                        : "dark";
            }

            this.applyTheme(
                theme,
                false
            );
        }

        bindThemeEvents() {
            if (!this.themeButton) {
                return;
            }

            this.themeButton.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const current =
                        this.getCurrentTheme();

                    const next =
                        current === "dark"
                            ? "light"
                            : "dark";

                    this.applyTheme(
                        next,
                        true
                    );
                }
            );
        }

        getCurrentTheme() {
            const rootTheme =
                document.documentElement
                    ?.dataset?.theme;

            const bodyTheme =
                document.body
                    ?.dataset?.theme;

            if (
                rootTheme === "light" ||
                bodyTheme === "light"
            ) {
                return "light";
            }

            return "dark";
        }

        applyTheme(
            theme,
            persist = true
        ) {
            const normalized =
                theme === "light"
                    ? "light"
                    : "dark";

            /*
             * Set BOTH html and body.
             * Google Maps web components and regular
             * application CSS can then read the same state.
             */
            document.documentElement.dataset.theme =
                normalized;

            document.body.dataset.theme =
                normalized;

            document.documentElement.style.colorScheme =
                normalized;

            document.body.style.colorScheme =
                normalized;

            if (persist) {
                localStorage.setItem(
                    "healthx_theme",
                    normalized
                );
            }

            /*
             * Notify all dependent modules.
             */
            if (
                window.EventBus &&
                typeof window.EventBus.emit ===
                    "function"
            ) {
                window.EventBus.emit(
                    "theme_changed",
                    {
                        theme: normalized
                    }
                );
            }
        }

        /* ================================================================
           ACTIVITY / INACTIVITY
           ================================================================ */

        bindActivityEvents() {
            const events = [
                "mousemove",
                "mousedown",
                "keydown",
                "touchstart"
            ];

            events.forEach(
                (eventName) => {
                    document.addEventListener(
                        eventName,
                        () => {
                            this.resetInactivityTimer();
                        },
                        {
                            passive: true
                        }
                    );
                }
            );
        }

        resetInactivityTimer() {
            this.clearInactivityTimer();

            /*
             * Do NOT automatically close a panel while the user
             * is actively interacting with an input/control.
             *
             * This is particularly important for Places Autocomplete.
             */
            if (!this.activePanelId) {
                return;
            }

            this.inactivityTimer =
                window.setTimeout(
                    () => {
                        const activeElement =
                            document.activeElement;

                        const isTyping =
                            activeElement &&
                            (
                                activeElement.matches(
                                    "input, textarea, select"
                                ) ||
                                activeElement.closest(
                                    "gmp-place-autocomplete"
                                )
                            );

                        if (isTyping) {
                            this.resetInactivityTimer();
                            return;
                        }

                        this.closeAllPanels();
                    },
                    this.inactivityDelay
                );
        }

        clearInactivityTimer() {
            if (
                this.inactivityTimer !==
                null
            ) {
                window.clearTimeout(
                    this.inactivityTimer
                );

                this.inactivityTimer = null;
            }
        }

        /* ================================================================
           PUBLIC API
           ================================================================ */

        isOpen(panelId) {
            const panel =
                document.getElementById(
                    panelId
                );

            return !!(
                panel &&
                !panel.classList.contains(
                    "hidden"
                )
            );
        }

        getActivePanel() {
            return this.activePanelId;
        }
    }

    /*
     * Create globally accessible controller.
     */
    const initialize = () => {
        if (
            window.panelController
        ) {
            return;
        }

        window.panelController =
            new PanelController();

        window.panelController.init();
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();