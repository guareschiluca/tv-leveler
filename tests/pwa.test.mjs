/**
 * pwa.test.mjs
 *
 * The manifest, service worker, and icon files are static assets with
 * no logic to unit-test in the usual sense -- what's worth guarding
 * against here is a broken reference: a typo'd icon path, a manifest
 * field that's the wrong type, or a service-worker precache entry that
 * points at a file which no longer exists. Those fail silently in the
 * browser (a 404 in devtools nobody's looking at) rather than loudly,
 * so a fast on-disk check is cheap insurance.
 * Run with: node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

test('manifest.json has the fields a PWA install needs', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length > 0);
  assert.equal(typeof manifest.short_name, 'string');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.length >= 2);
});

test('every manifest icon file exists and includes a maskable-safe purpose', () => {
  for (const icon of manifest.icons) {
    assert.match(icon.sizes, /^\d+x\d+$/, `icon sizes should look like "192x192", got ${icon.sizes}`);
    assert.ok(
      existsSync(path.join(rootDir, icon.src)),
      `manifest references missing icon file: ${icon.src}`,
    );
    // Every icon must double as maskable content (it sits inside a
    // circular safe zone, and a host may crop it as such regardless
    // of what's declared) -- see icons/icon.svg.
    assert.match(icon.purpose ?? '', /maskable/);
  }
});

test('manifest start_url and scope are relative (subpath-hosting safe)', () => {
  assert.ok(!manifest.start_url.startsWith('/'), 'start_url must be relative for GitHub Pages project subpaths');
  assert.ok(!manifest.scope.startsWith('/'), 'scope must be relative for GitHub Pages project subpaths');
});

test('every same-origin file the service worker precaches exists on disk', () => {
  const swSource = readFileSync(path.join(rootDir, 'service-worker.js'), 'utf8');
  const relativePaths = [...swSource.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);

  assert.ok(relativePaths.length > 5, 'expected to find the APP_SHELL list in service-worker.js');

  for (const relativePath of relativePaths) {
    const resolved = relativePath === './' ? 'index.html' : relativePath;
    assert.ok(
      existsSync(path.join(rootDir, resolved)),
      `service-worker.js precaches a missing file: ${relativePath}`,
    );
  }
});

test('index.html references favicon/manifest files that exist on disk', () => {
  const html = readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/href="([^"]+\.(?:json|ico|png|svg))"/g)].map((m) => m[1]);

  assert.ok(hrefs.length > 0, 'expected to find at least one manifest/icon/favicon link in index.html');

  for (const href of hrefs) {
    assert.ok(
      existsSync(path.join(rootDir, href)),
      `index.html references a missing file: ${href}`,
    );
  }
});
