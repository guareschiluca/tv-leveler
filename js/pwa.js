/**
 * pwa.js
 * Progressive Web App support (spec section 8.1): service worker
 * registration for offline use, plus a custom "Install app" menu item
 * that only appears when BOTH of the spec's conditions hold:
 *
 *   - the browser supports PWA installation (it fired `beforeinstall-
 *     prompt`, meaning it judged the app installable), AND
 *   - the device supports the orientation sensors this app actually
 *     needs (js/sensors.js `preferredKind()`).
 *
 * An installable-but-sensorless device (or vice versa) never sees the
 * button — installing a tool that can't read its own sensors would be
 * a dead end.
 */

import { preferredKind } from './sensors.js';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Relative path: resolves correctly whether the app is served from a
  // domain root or a GitHub Pages project subpath.
  navigator.serviceWorker.register('./service-worker.js').catch(() => {
    // Offline support is a "nice to have" enhancement, not a hard
    // requirement -- a registration failure (e.g. running from a
    // file:// context during local dev) shouldn't block anything else.
  });
}

function alreadyInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true; // iOS Safari's own flag
}

function closeAppMenu() {
  const menuBtnEl = document.getElementById('menuBtn');
  if (!menuBtnEl || !window.bootstrap) return;
  window.bootstrap.Dropdown.getInstance(menuBtnEl)?.hide();
}

function initInstallPrompt() {
  const installMenuItem = document.getElementById('installAppMenuItem');
  const installBtn = document.getElementById('installAppBtn');
  if (!installMenuItem || !installBtn) return;
  if (alreadyInstalled() || !preferredKind()) return;

  let deferredEvent = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event;
    installMenuItem.classList.remove('d-none');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredEvent) return;
    closeAppMenu();
    deferredEvent.prompt();
    await deferredEvent.userChoice;
    // A given prompt event can only be used once either way (accepted
    // or dismissed); hide the button until the browser offers a fresh
    // one, which it may do again later in the session.
    deferredEvent = null;
    installMenuItem.classList.add('d-none');
  });

  window.addEventListener('appinstalled', () => {
    installMenuItem.classList.add('d-none');
  });
}

export function initPwa() {
  registerServiceWorker();
  initInstallPrompt();
}
