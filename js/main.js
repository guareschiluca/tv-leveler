/**
 * main.js
 * Application entry point.
 *
 *  - Initializes theme (system preference, manual override, no
 *    persistence per the app's no-storage privacy stance).
 *  - Wires the Help modal open/close affordance.
 *  - Initializes the live sensor readout (js/uiController.js), which in
 *    turn wires js/sensors.js + js/orientationMath.js to the DOM.
 *
 * The Help modal's content (fetched/rendered from ReadMe.md) lands in a
 * later module (js/helpPage.js).
 */

import { initTheme, toggleTheme } from './theme.js';
import { initUiController } from './uiController.js';

function initHelpModal() {
  const helpBtn = document.getElementById('helpBtn');
  const helpModalEl = document.getElementById('helpModal');
  if (!helpBtn || !helpModalEl || !window.bootstrap) return;

  const modal = new window.bootstrap.Modal(helpModalEl);
  helpBtn.addEventListener('click', () => modal.show());
}

function init() {
  initTheme();

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn?.addEventListener('click', toggleTheme);

  initHelpModal();
  initUiController();
}

document.addEventListener('DOMContentLoaded', init);
