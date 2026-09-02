/**
 * orientationMath.js
 * Pure, dependency-free math for the TV Leveler orientation model.
 *
 * Every export here is a pure function: same input always produces the
 * same output, no DOM/browser APIs, no side effects. This keeps the core
 * leveling logic trivially unit-testable and reusable outside the browser
 * (see tests/orientationMath.test.mjs).
 *
 * Angle convention: all angles are in degrees, normalized to the
 * half-open range [-180, 180).
 */

/**
 * Wraps an angle (in degrees) into the [-180, 180) range.
 * @param {number} angleDeg
 * @returns {number}
 */
export function normalizeAngle(angleDeg) {
  let a = angleDeg % 360;
  if (a < -180) a += 360;
  if (a >= 180) a -= 360;
  // Avoid returning -0
  return a === 0 ? 0 : a;
}

/**
 * Shortest signed angular difference `a - b`, normalized to [-180, 180).
 * Handles wrap-around correctly (e.g. difference(179, -179) === -2, not 358).
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function angleDifference(a, b) {
  return normalizeAngle(normalizeAngle(a) - normalizeAngle(b));
}

/**
 * @typedef {{roll: number, pitch: number, yaw: number}} Orientation
 */

/**
 * Computes the delta orientation of `current` relative to `reference`,
 * i.e. `current - reference` per axis, normalized to [-180, 180).
 * @param {Orientation} current
 * @param {Orientation} reference
 * @returns {Orientation}
 */
export function computeDelta(current, reference) {
  return {
    roll: angleDifference(current.roll, reference.roll),
    pitch: angleDifference(current.pitch, reference.pitch),
    yaw: angleDifference(current.yaw, reference.yaw),
  };
}

/**
 * Whether a value (in degrees) is close enough to zero to be considered
 * "level" for UI highlighting purposes.
 * @param {number} valueDeg
 * @param {number} [thresholdDeg=0.5]
 * @returns {boolean}
 */
export function isNearZero(valueDeg, thresholdDeg = 0.5) {
  return Math.abs(valueDeg) <= thresholdDeg;
}

/**
 * Whether an entire orientation reading counts as "level" on the axes
 * that matter for hanging a TV: roll and yaw near zero. Pitch is
 * intentionally excluded — per the spec, pitch is a user preference,
 * not a target of zero.
 * @param {Orientation} delta
 * @param {number} [thresholdDeg=0.5]
 * @returns {boolean}
 */
export function isLevel(delta, thresholdDeg = 0.5) {
  return isNearZero(delta.roll, thresholdDeg) && isNearZero(delta.yaw, thresholdDeg);
}

/**
 * Circular linear interpolation between two angles, taking the shortest
 * path around the wrap point. `t=0` returns `fromDeg`, `t=1` returns
 * `toDeg` (normalized).
 * @param {number} fromDeg
 * @param {number} toDeg
 * @param {number} t - blend factor, typically in [0, 1]
 * @returns {number}
 */
export function lerpAngle(fromDeg, toDeg, t) {
  const diff = angleDifference(toDeg, fromDeg);
  return normalizeAngle(fromDeg + diff * t);
}

/**
 * Single-pole low-pass smoothing filter for a raw orientation reading,
 * used to reduce sensor jitter. Wrap-around safe on every axis.
 *
 * @param {Orientation} previous - previously smoothed orientation
 * @param {Orientation} next - new raw orientation reading
 * @param {number} [alpha=0.2] - smoothing factor in [0, 1]; 0 keeps the
 *   previous value unchanged, 1 jumps straight to the new reading.
 * @returns {Orientation}
 */
export function smoothOrientation(previous, next, alpha = 0.2) {
  return {
    roll: lerpAngle(previous.roll, next.roll, alpha),
    pitch: lerpAngle(previous.pitch, next.pitch, alpha),
    yaw: lerpAngle(previous.yaw, next.yaw, alpha),
  };
}
