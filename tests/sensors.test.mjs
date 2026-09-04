/**
 * sensors.test.mjs
 *
 * js/sensors.js is mostly browser-API wiring (constructing sensor
 * objects, listening for 'reading'/'error' events) that can't be
 * meaningfully unit-tested outside a real browser. What IS tested here:
 * the pure quaternion-array mapping, and the kind-selection logic
 * (isKindSupported/preferredKind), using a minimal mocked `window` so
 * these run under Node's test runner without a browser.
 * Run with: node --test
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  SensorKind,
  mapSensorQuaternion,
  isKindSupported,
  preferredKind,
} from '../js/sensors.js';

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
});

test('mapSensorQuaternion converts the spec\'s [x,y,z,w] array to a {w,x,y,z} object', () => {
  assert.deepEqual(mapSensorQuaternion([1, 2, 3, 4]), { w: 4, x: 1, y: 2, z: 3 });
});

test('isKindSupported is false when neither sensor constructor exists', () => {
  globalThis.window = {};
  assert.equal(isKindSupported(SensorKind.RELATIVE), false);
  assert.equal(isKindSupported(SensorKind.ABSOLUTE), false);
});

test('isKindSupported reflects only the constructor that is present', () => {
  globalThis.window = { RelativeOrientationSensor: class {} };
  assert.equal(isKindSupported(SensorKind.RELATIVE), true);
  assert.equal(isKindSupported(SensorKind.ABSOLUTE), false);
});

test('preferredKind prefers RELATIVE when both are available', () => {
  globalThis.window = {
    RelativeOrientationSensor: class {},
    AbsoluteOrientationSensor: class {},
  };
  assert.equal(preferredKind(), SensorKind.RELATIVE);
});

test('preferredKind falls back to ABSOLUTE when only that is available', () => {
  globalThis.window = { AbsoluteOrientationSensor: class {} };
  assert.equal(preferredKind(), SensorKind.ABSOLUTE);
});

test('preferredKind is null when neither is available', () => {
  globalThis.window = {};
  assert.equal(preferredKind(), null);
});
