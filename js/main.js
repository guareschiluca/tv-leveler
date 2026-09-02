/**
 * main.js
 * Application entry point.
 *
 *  - Initializes theme (system preference, manual override, no
 *    persistence per the app's no-storage privacy stance).
 *  - Wires the Help modal: opens on click and lazily loads its content
 *    from ReadMe.md via js/helpPage.js.
 *  - Initializes the live sensor readout (js/uiController.js), which in
 *    turn wires js/sensors.js + js/orientationMath.js to the DOM.
 */

import { initTheme, toggleTheme } from './theme.js';
import { initUiController } from './uiController.js';
import { loadHelpContent } from './helpPage.js';

function initHelpModal() {
  const helpBtn = document.getElementById('helpBtn');
  const helpModalEl = document.getElementById('helpModal');
  const helpContentEl = document.getElementById('helpContent');
  if (!helpBtn || !helpModalEl || !helpContentEl || !window.bootstrap) return;

  const modal = new window.bootstrap.Modal(helpModalEl);
  helpBtn.addEventListener('click', () => {
    modal.show();
    loadHelpContent(helpContentEl);
  });
}

function init() {
  initTheme();

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn?.addEventListener('click', toggleTheme);

  initHelpModal();
  initUiController();
}

document.addEventListener('DOMContentLoaded', init);
