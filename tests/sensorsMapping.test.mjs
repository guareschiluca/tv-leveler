/**
 * sensorsMapping.test.mjs
 *
 * Only js/sensors.js's pure transform (mapDeviceOrientationEvent) is
 * unit-tested here — the rest of that module talks to browser globals
 * (window, DeviceOrientationEvent) and is exercised manually/visually
 * instead. Run with: node --test tests/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mapDeviceOrientationEvent } from '../js/sensors.js';

test('mapDeviceOrientationEvent maps alpha/beta/gamma to yaw/pitch/roll', () => {
  const result = mapDeviceOrientationEvent({ alpha: 10, beta: 20, gamma: 30 });
  assert.deepEqual(result, { roll: 30, pitch: 20, yaw: 10 });
});

test('mapDeviceOrientationEvent normalizes out-of-range values', () => {
  const result = mapDeviceOrientationEvent({ alpha: 350, beta: 0, gamma: 0 });
  assert.equal(result.yaw, -10);
});

test('mapDeviceOrientationEvent treats null fields as zero', () => {
  const result = mapDeviceOrientationEvent({ alpha: null, beta: null, gamma: null });
  assert.deepEqual(result, { roll: 0, pitch: 0, yaw: 0 });
});
