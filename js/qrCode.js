/**
 * qrCode.js
 * Renders a small QR code encoding the current page URL, so someone on
 * an unsupported browser/device (this app requires Android + Chrome)
 * can quickly open the same page on a supported one.
 *
 * Uses the 'qrcode-generator' CDN library loaded in index.html, which
 * exposes a global `qrcode(typeNumber, errorCorrectionLevel)` factory
 * function (typeNumber 0 = auto-select the smallest QR version needed).
 */

let lastRenderedText = null;

/**
 * Renders (or re-renders, if `text` changed) a QR code into `containerEl`.
 * No-ops quietly if the container is missing, `text` is falsy, or the
 * CDN library failed to load — this is a helpful extra, not something
 * that should ever break the page.
 * @param {HTMLElement|null|undefined} containerEl
 * @param {string} text
 */
export function renderUnsupportedQrCode(containerEl, text) {
  if (!containerEl || !text || typeof window.qrcode !== 'function') return;
  if (lastRenderedText === text && containerEl.childElementCount > 0) return;

  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    containerEl.innerHTML = qr.createTableTag(4, 8);
    lastRenderedText = text;
  } catch (error) {
    containerEl.innerHTML = '';
    console.error('qrCode: failed to render', error);
  }
}
