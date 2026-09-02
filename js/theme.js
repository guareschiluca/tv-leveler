/**
 * theme.js
 * Light/dark theme handling for Bootstrap's `data-bs-theme` attribute.
 *
 * Privacy note: per the app's "no storage beyond in-memory state" stance,
 * the theme choice is NOT persisted (no localStorage/cookies). Each page
 * load re-derives the theme from the system's `prefers-color-scheme`, and
 * a manual toggle is available for the current session only.
 */

const DARK = 'dark';
const LIGHT = 'light';

let currentTheme = DARK;

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-bs-theme', theme);

  const iconDark = document.getElementById('themeIconDark');
  const iconLight = document.getElementById('themeIconLight');
  if (iconDark && iconLight) {
    iconDark.classList.toggle('d-none', theme === DARK);
    iconLight.classList.toggle('d-none', theme === LIGHT);
  }
}

/**
 * Sets the initial theme from the system preference. Falls back to dark
 * when the system preference cannot be determined.
 */
export function initTheme() {
  applyTheme(systemPrefersDark() ? DARK : LIGHT);

  // Keep in sync with system changes, unless the user has manually
  // overridden the theme for this session.
  window.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener?.('change', (event) => {
      if (!userOverride) applyTheme(event.matches ? DARK : LIGHT);
    });
}

let userOverride = false;

/**
 * Flips the current theme for this session only (not persisted).
 */
export function toggleTheme() {
  userOverride = true;
  applyTheme(currentTheme === DARK ? LIGHT : DARK);
}

/**
 * Returns the currently applied theme ('dark' | 'light').
 */
export function getTheme() {
  return currentTheme;
}
