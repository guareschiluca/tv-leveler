/**
 * quaternionMath.js
 * Pure, dependency-free quaternion math used to compute a robust delta
 * (relative orientation) between two device readings.
 *
 * WHY THIS EXISTS
 * Representing orientation as three independent angles (roll/pitch/yaw)
 * and subtracting them per axis breaks down near pitch = +-90 degrees:
 * that's a gimbal-lock configuration where roll and yaw become coupled,
 * and a tiny real-world rotation can flip their *readings* by up to
 * ~180 degrees each, even though the true 3D rotation barely changed.
 * That's exactly the orientation you get holding a phone flat against a
 * vertical wall or TV — this app's primary use case — which is why the
 * bug was very visible in practice (see ReadMe.md changelog).
 *
 * The fix: convert each reading to a quaternion (a singularity-free 3D
 * rotation representation), compute the relative rotation between
 * reference and current as a single quaternion operation, and only
 * convert that (always small, when the physical difference is small)
 * delta back to roll/pitch/yaw for display. The absolute orientation can
 * sit right at the singularity; the *delta* no longer does.
 *
 * Convention: quaternions are plain {w, x, y, z} objects. Angles in and
 * out remain in degrees, normalized to [-180, 180), matching the rest of
 * the app (see orientationMath.js).
 */

import { normalizeAngle } from './orientationMath.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * @typedef {{roll: number, pitch: number, yaw: number}} Orientation
 * @typedef {{w: number, x: number, y: number, z: number}} Quaternion
 */

/**
 * Converts a {roll, pitch, yaw} reading (degrees) to a unit quaternion.
 * Uses the intrinsic Z(yaw)-X(pitch)-Y(roll) rotation order, matching
 * the W3C DeviceOrientationEvent alpha/beta/gamma convention (yaw=alpha
 * around Z, pitch=beta around X, roll=gamma around Y).
 * @param {Orientation} orientation
 * @returns {Quaternion}
 */
export function eulerToQuaternion({ roll, pitch, yaw }) {
  const hx = (pitch * DEG_TO_RAD) / 2;
  const hy = (roll * DEG_TO_RAD) / 2;
  const hz = (yaw * DEG_TO_RAD) / 2;

  const cX = Math.cos(hx), sX = Math.sin(hx);
  const cY = Math.cos(hy), sY = Math.sin(hy);
  const cZ = Math.cos(hz), sZ = Math.sin(hz);

  return {
    w: cX * cY * cZ - sX * sY * sZ,
    x: sX * cY * cZ - cX * sY * sZ,
    y: cX * sY * cZ + sX * cY * sZ,
    z: cX * cY * sZ + sX * sY * cZ,
  };
}

/**
 * Converts a unit quaternion back to {roll, pitch, yaw} degrees.
 * The exact analytical inverse of eulerToQuaternion's rotation order, so
 * round-tripping a single-axis reading returns that same axis/value.
 * @param {Quaternion} q
 * @returns {Orientation}
 */
export function quaternionToEuler(q) {
  const { w, x, y, z } = q;

  const sinPitch = clamp(2 * (y * z + w * x), -1, 1);
  const pitch = Math.asin(sinPitch);

  let roll, yaw;
  if (Math.abs(sinPitch) < 0.9999) {
    yaw = Math.atan2(2 * (w * z - x * y), 1 - 2 * (x * x + z * z));
    roll = Math.atan2(2 * (w * y - x * z), 1 - 2 * (x * x + y * y));
  } else {
    // Gimbal lock in the OUTPUT itself (pitch ~= +-90). Only reachable
    // here if the two orientations being compared differ by ~90 degrees
    // of pitch, which shouldn't happen for a "how far off level" delta.
    roll = 0;
    yaw = Math.atan2(2 * (x * y - w * z), 2 * (w * y + x * z));
  }

  return {
    roll: normalizeAngle(roll * RAD_TO_DEG),
    pitch: normalizeAngle(pitch * RAD_TO_DEG),
    yaw: normalizeAngle(yaw * RAD_TO_DEG),
  };
}

/**
 * Hamilton product a * b.
 * @param {Quaternion} a
 * @param {Quaternion} b
 * @returns {Quaternion}
 */
export function quaternionMultiply(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/**
 * Conjugate of a quaternion. For a unit quaternion this equals its
 * inverse (the rotation that undoes it).
 * @param {Quaternion} q
 * @returns {Quaternion}
 */
export function quaternionConjugate(q) {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

/**
 * Normalizes a quaternion to unit length. Falls back to the identity
 * quaternion for a zero-length input (should not happen in practice).
 * @param {Quaternion} q
 * @returns {Quaternion}
 */
export function quaternionNormalize(q) {
  const magnitude = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (magnitude === 0) return { w: 1, x: 0, y: 0, z: 0 };
  return { w: q.w / magnitude, x: q.x / magnitude, y: q.y / magnitude, z: q.z / magnitude };
}

/**
 * Spherical linear interpolation between two unit quaternions, taking
 * the shortest path (a quaternion and its negation represent the same
 * rotation, so the sign is flipped when needed before interpolating).
 * Used to smooth raw sensor readings without reintroducing Euler-angle
 * gimbal lock during the smoothing step itself.
 * @param {Quaternion} a
 * @param {Quaternion} b
 * @param {number} t - blend factor in [0, 1]; 0 returns a, 1 returns b
 * @returns {Quaternion}
 */
export function quaternionSlerp(a, b, t) {
  let { w: bw, x: bx, y: by, z: bz } = b;
  let dot = a.w * bw + a.x * bx + a.y * by + a.z * bz;

  if (dot < 0) {
    dot = -dot;
    bw = -bw; bx = -bx; by = -by; bz = -bz;
  }

  // Nearly identical/opposite rotations: linear interpolation is a
  // stable, accurate-enough approximation and avoids a division by a
  // near-zero sin(theta) below.
  if (dot > 0.9995) {
    return quaternionNormalize({
      w: a.w + t * (bw - a.w),
      x: a.x + t * (bx - a.x),
      y: a.y + t * (by - a.y),
      z: a.z + t * (bz - a.z),
    });
  }

  const theta0 = Math.acos(clamp(dot, -1, 1));
  const theta = theta0 * t;
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - (dot * Math.sin(theta)) / sinTheta0;
  const s1 = Math.sin(theta) / sinTheta0;

  return {
    w: s0 * a.w + s1 * bw,
    x: s0 * a.x + s1 * bx,
    y: s0 * a.y + s1 * by,
    z: s0 * a.z + s1 * bz,
  };
}

/**
 * Computes the relative orientation of `current` with respect to
 * `reference`, as {roll, pitch, yaw} degrees — the robust replacement
 * for orientationMath.js's per-axis computeDelta(). Correct even when
 * both readings sit near a pitch = +-90 singularity, as long as the
 * true difference between them is small.
 * @param {Orientation} current
 * @param {Orientation} reference
 * @returns {Orientation}
 */
export function computeRelativeOrientation(current, reference) {
  const currentQ = eulerToQuaternion(current);
  const referenceQ = eulerToQuaternion(reference);
  const relativeQ = quaternionNormalize(
    quaternionMultiply(currentQ, quaternionConjugate(referenceQ)),
  );
  return quaternionToEuler(relativeQ);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
