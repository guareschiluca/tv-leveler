/**
 * orientationMath.test.mjs
 *
 * These are deliberately simple "consistency" tests, not exhaustive
 * numerical-analysis tests: their job is to catch a future edit that
 * accidentally breaks the module's public interface or its basic,
 * documented behavior (signatures, ranges, edge cases at the wrap
 * boundary). Run with: node --test tests/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAngle,
  angleDifference,
  computeDelta,
  isNearZero,
  isLevel,
  lerpAngle,
  smoothOrientation,
} from '../js/orientationMath.js';

test('normalizeAngle keeps in-range values unchanged', () => {
  assert.equal(normalizeAngle(0), 0);
  assert.equal(normalizeAngle(90), 90);
  assert.equal(normalizeAngle(-90), -90);
  assert.equal(normalizeAngle(-179.9), -179.9);
});

test('normalizeAngle wraps values outside [-180, 180)', () => {
  assert.equal(normalizeAngle(180), -180);
  assert.equal(normalizeAngle(270), -90);
  assert.equal(normalizeAngle(360), 0);
  assert.equal(normalizeAngle(-181), 179);
  assert.equal(normalizeAngle(-270), 90);
});

test('normalizeAngle is idempotent', () => {
  for (const value of [0, 45, -45, 179.99, -179.99, 720, -540]) {
    const once = normalizeAngle(value);
    assert.equal(normalizeAngle(once), once);
  }
});

test('angleDifference returns 0 for equal angles', () => {
  assert.equal(angleDifference(10, 10), 0);
  assert.equal(angleDifference(-170, -170), 0);
});

test('angleDifference takes the shortest path across the wrap boundary', () => {
  // 179 -> -179 is a 2-degree step forward, not -358.
  assert.equal(angleDifference(179, -179), -2);
  assert.equal(angleDifference(-179, 179), 2);
});

test('computeDelta is zero when current equals reference', () => {
  const o = { roll: 12.3, pitch: -45, yaw: 179 };
  assert.deepEqual(computeDelta(o, o), { roll: 0, pitch: 0, yaw: 0 });
});

test('computeDelta computes per-axis normalized differences', () => {
  const current = { roll: 5, pitch: 10, yaw: -170 };
  const reference = { roll: 0, pitch: 0, yaw: 170 };
  const delta = computeDelta(current, reference);
  assert.equal(delta.roll, 5);
  assert.equal(delta.pitch, 10);
  assert.equal(delta.yaw, 20); // -170 - 170 wraps to +20, not -340
});

test('isNearZero respects the default and custom threshold', () => {
  assert.equal(isNearZero(0), true);
  assert.equal(isNearZero(0.5), true);
  assert.equal(isNearZero(-0.5), true);
  assert.equal(isNearZero(0.51), false);
  assert.equal(isNearZero(2, 5), true);
  assert.equal(isNearZero(6, 5), false);
});

test('isLevel only considers roll and yaw, not pitch', () => {
  assert.equal(isLevel({ roll: 0, pitch: 45, yaw: 0 }), true);
  assert.equal(isLevel({ roll: 1, pitch: 0, yaw: 0 }), false);
  assert.equal(isLevel({ roll: 0, pitch: 0, yaw: 1 }), false);
});

test('lerpAngle returns the endpoints at t=0 and t=1', () => {
  assert.equal(lerpAngle(10, 50, 0), 10);
  assert.equal(lerpAngle(10, 50, 1), 50);
});

test('lerpAngle takes the shortest path across the wrap boundary', () => {
  // From 170 to -170 (a 20-degree step), halfway should be 180 -> -180.
  assert.equal(lerpAngle(170, -170, 0.5), -180);
});

test('smoothOrientation with alpha=0 keeps the previous reading', () => {
  const previous = { roll: 1, pitch: 2, yaw: 3 };
  const next = { roll: 50, pitch: -50, yaw: 170 };
  assert.deepEqual(smoothOrientation(previous, next, 0), previous);
});

test('smoothOrientation with alpha=1 jumps straight to the new reading', () => {
  const previous = { roll: 1, pitch: 2, yaw: 3 };
  const next = { roll: 50, pitch: -50, yaw: 170 };
  assert.deepEqual(smoothOrientation(previous, next, 1), next);
});

test('smoothOrientation defaults to a partial blend when alpha is omitted', () => {
  const previous = { roll: 0, pitch: 0, yaw: 0 };
  const next = { roll: 10, pitch: 10, yaw: 10 };
  const result = smoothOrientation(previous, next);
  assert.ok(result.roll > 0 && result.roll < 10);
  assert.ok(result.pitch > 0 && result.pitch < 10);
  assert.ok(result.yaw > 0 && result.yaw < 10);
});
