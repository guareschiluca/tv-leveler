/**
 * helpPage.js
 * Fetches ReadMe.md at runtime and renders it into the Help modal, so the
 * README stays the single source of truth for both GitHub repo visitors
 * and in-app Help — no content duplication to maintain.
 *
 * Relies on the `marked` parser loaded globally via CDN in index.html
 * (window.marked). Uses a relative fetch path so it resolves correctly
 * both locally and when the app is served from a GitHub Pages subpath.
 */

const README_PATH = 'ReadMe.md';

let cachedHtml = null;

/**
 * Loads (once) and renders ReadMe.md into the given container element.
 * Safe to call multiple times — subsequent calls reuse the cached
 * render instead of re-fetching.
 * @param {HTMLElement} containerEl
 * @returns {Promise<void>}
 */
export async function loadHelpContent(containerEl) {
  if (cachedHtml) {
    containerEl.innerHTML = cachedHtml;
    return;
  }

  try {
    const response = await fetch(README_PATH);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

    const markdown = await response.text();

    if (!window.marked) throw new Error('Markdown parser unavailable');

    // The README is our own trusted, version-controlled content (not
    // user input), so rendering the parser's HTML output directly is
    // safe here.
    cachedHtml = window.marked.parse(markdown);
    containerEl.innerHTML = cachedHtml;
  } catch (error) {
    containerEl.innerHTML = `
      <p class="text-body-secondary">
        Couldn't load the help content right now.
      </p>
      <p class="small text-body-secondary">
        You can read it directly on
        <a href="https://github.com/guareschiluca/tv-leveler#readme" target="_blank" rel="noopener">GitHub</a>.
      </p>
    `;
    console.error('helpPage: failed to load ReadMe.md', error);
  }
}
