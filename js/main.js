/**
 * main.js
 * Application entry point.
 *
 * Scaffold stage responsibilities (this file, for now):
 *  - Initialize theme (system preference, manual override, no persistence
 *    per the app's no-storage privacy stance — see ReadMe.md §Privacy).
 *  - Wire the Help modal open/close affordance.
 *
 * Sensor reading, orientation math, and the live readout UI are added in
 * subsequent modules (js/orientationMath.js, js/sensors.js,
 * js/uiController.js) and wired in here once available.
 */

import { initTheme, toggleTheme } from './theme.js';

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
}

document.addEventListener('DOMContentLoaded', init);
