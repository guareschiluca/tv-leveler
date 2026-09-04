/**
 * quaternionMath.test.mjs
 *
 * Consistency tests guarding this module's public interface — plus a
 * dedicated regression test for the gimbal-lock bug this module exists
 * to fix (two orientations ~1-2 degrees apart near pitch=+-90 were
 * previously reported ~179 degrees apart by naive per-axis subtraction).
 * Run with: node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  eulerToQuaternion,
  quaternionToEuler,
  quaternionMultiply,
  quaternionConjugate,
  quaternionNormalize,
  quaternionSlerp,
  rotationAngleDeg,
  angularDistanceDeg,
  maxAngularSpreadDeg,
  computeRelativeOrientation,
} from '../js/quaternionMath.js';

function assertOrientationClose(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual.roll - expected.roll) < eps, `roll: ${actual.roll} vs ${expected.roll}`);
  assert.ok(Math.abs(actual.pitch - expected.pitch) < eps, `pitch: ${actual.pitch} vs ${expected.pitch}`);
  assert.ok(Math.abs(actual.yaw - expected.yaw) < eps, `yaw: ${actual.yaw} vs ${expected.yaw}`);
}

test('eulerToQuaternion of zero orientation is the identity quaternion', () => {
  const q = eulerToQuaternion({ roll: 0, pitch: 0, yaw: 0 });
  assert.deepEqual(q, { w: 1, x: 0, y: 0, z: 0 });
});

test('quaternionToEuler round-trips single-axis orientations exactly', () => {
  assertOrientationClose(
    quaternionToEuler(eulerToQuaternion({ roll: 10, pitch: 0, yaw: 0 })),
    { roll: 10, pitch: 0, yaw: 0 },
  );
  assertOrientationClose(
    quaternionToEuler(eulerToQuaternion({ roll: 0, pitch: 15, yaw: 0 })),
    { roll: 0, pitch: 15, yaw: 0 },
  );
  assertOrientationClose(
    quaternionToEuler(eulerToQuaternion({ roll: 0, pitch: 0, yaw: 20 })),
    { roll: 0, pitch: 0, yaw: 20 },
  );
  assertOrientationClose(
    quaternionToEuler(eulerToQuaternion({ roll: -45, pitch: 0, yaw: 0 })),
    { roll: -45, pitch: 0, yaw: 0 },
  );
});

test('quaternionToEuler round-trips a small combined rotation', () => {
  assertOrientationClose(
    quaternionToEuler(eulerToQuaternion({ roll: 1, pitch: 2, yaw: 3 })),
    { roll: 1, pitch: 2, yaw: 3 },
    1e-9,
  );
});

test('quaternionMultiply by the identity quaternion is a no-op', () => {
  const identity = { w: 1, x: 0, y: 0, z: 0 };
  const q = eulerToQuaternion({ roll: 12, pitch: -34, yaw: 56 });
  assertOrientationClose(quaternionToEuler(quaternionMultiply(q, identity)), quaternionToEuler(q));
  assertOrientationClose(quaternionToEuler(quaternionMultiply(identity, q)), quaternionToEuler(q));
});

test('quaternionConjugate undoes a rotation when multiplied together', () => {
  const q = eulerToQuaternion({ roll: 30, pitch: 20, yaw: 10 });
  const result = quaternionNormalize(quaternionMultiply(q, quaternionConjugate(q)));
  assertOrientationClose(quaternionToEuler(result), { roll: 0, pitch: 0, yaw: 0 }, 1e-9);
});

test('quaternionNormalize returns a unit-length quaternion', () => {
  const q = quaternionNormalize({ w: 2, x: 2, y: 2, z: 2 });
  const magnitude = Math.sqrt(q.w ** 2 + q.x ** 2 + q.y ** 2 + q.z ** 2);
  assert.ok(Math.abs(magnitude - 1) < 1e-9);
});

test('quaternionSlerp returns the endpoints at t=0 and t=1', () => {
  const a = eulerToQuaternion({ roll: 0, pitch: 0, yaw: 0 });
  const b = eulerToQuaternion({ roll: 40, pitch: 0, yaw: 0 });
  assertOrientationClose(quaternionToEuler(quaternionSlerp(a, b, 0)), quaternionToEuler(a), 1e-9);
  assertOrientationClose(quaternionToEuler(quaternionSlerp(a, b, 1)), quaternionToEuler(b), 1e-9);
});

test('computeRelativeOrientation is zero when current equals reference, regardless of absolute orientation', () => {
  const nearSingularity = { roll: 45, pitch: -89.9, yaw: 200 };
  assertOrientationClose(
    computeRelativeOrientation(nearSingularity, nearSingularity),
    { roll: 0, pitch: 0, yaw: 0 },
    1e-6,
  );
});

test('computeRelativeOrientation matches simple per-axis subtraction away from the singularity', () => {
  const reference = { roll: 0, pitch: 0, yaw: 0 };
  const current = { roll: 1, pitch: 2, yaw: 3 };
  assertOrientationClose(computeRelativeOrientation(current, reference), current, 1e-6);
});

test('computeRelativeOrientation regression: near pitch=+-90, a small true rotation stays small', () => {
  // These two readings are physically only a couple of degrees apart,
  // but per-axis Euler subtraction (the old, buggy approach) reports
  // roll ~-178.5 and yaw ~179 for this exact pair — see the fix's PR
  // description for the reproduction. The quaternion-based delta must
  // stay small on every axis.
  const reference = { roll: 89.5, pitch: 89.0, yaw: 10.0 };
  const current = { roll: -89.0, pitch: 88.5, yaw: 189.0 };

  const delta = computeRelativeOrientation(current, reference);

  assert.ok(Math.abs(delta.roll) < 5, `roll delta too large: ${delta.roll}`);
  assert.ok(Math.abs(delta.pitch) < 5, `pitch delta too large: ${delta.pitch}`);
  assert.ok(Math.abs(delta.yaw) < 5, `yaw delta too large: ${delta.yaw}`);
});

test('rotationAngleDeg is 0 for the identity quaternion', () => {
  assert.equal(rotationAngleDeg({ w: 1, x: 0, y: 0, z: 0 }), 0);
});

test('rotationAngleDeg matches the source angle for a simple single-axis rotation', () => {
  const q = eulerToQuaternion({ roll: 90, pitch: 0, yaw: 0 });
  assert.ok(Math.abs(rotationAngleDeg(q) - 90) < 1e-9);
});

test('rotationAngleDeg treats a quaternion and its negation as the same rotation', () => {
  const q = eulerToQuaternion({ roll: 30, pitch: 0, yaw: 0 });
  const negated = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
  assert.ok(Math.abs(rotationAngleDeg(q) - rotationAngleDeg(negated)) < 1e-9);
});

test('angularDistanceDeg is 0 between an orientation and itself', () => {
  const q = eulerToQuaternion({ roll: 12, pitch: -34, yaw: 200 });
  assert.ok(Math.abs(angularDistanceDeg(q, q)) < 1e-9);
});

test('angularDistanceDeg is symmetric', () => {
  const a = eulerToQuaternion({ roll: 10, pitch: 5, yaw: 0 });
  const b = eulerToQuaternion({ roll: 0, pitch: 0, yaw: 40 });
  assert.ok(Math.abs(angularDistanceDeg(a, b) - angularDistanceDeg(b, a)) < 1e-9);
});

test('maxAngularSpreadDeg is 0 for fewer than 2 samples', () => {
  assert.equal(maxAngularSpreadDeg([]), 0);
  assert.equal(maxAngularSpreadDeg([eulerToQuaternion({ roll: 5, pitch: 0, yaw: 0 })]), 0);
});

test('maxAngularSpreadDeg is 0 when all samples are identical', () => {
  const q = eulerToQuaternion({ roll: 12, pitch: -8, yaw: 44 });
  assert.equal(maxAngularSpreadDeg([q, q, q]), 0);
});

test('maxAngularSpreadDeg finds the largest pairwise distance, not just adjacent pairs', () => {
  const samples = [
    eulerToQuaternion({ roll: 0, pitch: 0, yaw: 0 }),
    eulerToQuaternion({ roll: 2, pitch: 0, yaw: 0 }),
    eulerToQuaternion({ roll: 20, pitch: 0, yaw: 0 }), // outlier in the middle
    eulerToQuaternion({ roll: 3, pitch: 0, yaw: 0 }),
  ];
  assert.ok(Math.abs(maxAngularSpreadDeg(samples) - 20) < 1e-9);
});
