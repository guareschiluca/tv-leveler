/**
 * sensors.js
 * Browser orientation sensor access, isolated from math and UI concerns.
 *
 * Uses the widely-supported `DeviceOrientationEvent` (absolute variant
 * when available) rather than the still-patchy Generic Sensor API, per
 * the design doc's "use browser-provided fused orientation when
 * available" guidance. iOS 13+ requires an explicit, user-gesture-driven
 * permission request before events start firing.
 */

import { normalizeAngle } from './orientationMath.js';

/** @enum {string} */
export const SensorStatus = {
  OK: 'ok',
  MISSING: 'missing',
  PERMISSION_REQUIRED: 'permission-required',
  UNSUPPORTED: 'unsupported',
};

/**
 * Pure transform from a raw DeviceOrientationEvent-shaped object to this
 * app's {roll, pitch, yaw} model.
 *
 * Per the W3C spec, alpha/beta/gamma are defined as:
 *  - alpha: rotation around the Z axis, [0, 360) — compass heading → yaw
 *  - beta:  rotation around the X axis, [-180, 180] — front/back tilt → pitch
 *  - gamma: rotation around the Y axis, [-90, 90] — left/right tilt → roll
 *
 * @param {{alpha: number|null, beta: number|null, gamma: number|null}} event
 * @returns {{roll: number, pitch: number, yaw: number}}
 */
export function mapDeviceOrientationEvent(event) {
  return {
    roll: normalizeAngle(event.gamma ?? 0),
    pitch: normalizeAngle(event.beta ?? 0),
    yaw: normalizeAngle(event.alpha ?? 0),
  };
}

/**
 * Whether this browser exposes DeviceOrientationEvent at all.
 * @returns {boolean}
 */
export function isOrientationSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/**
 * Whether an explicit permission request is required before orientation
 * events will fire (iOS 13+ Safari).
 * @returns {boolean}
 */
export function needsPermissionRequest() {
  return isOrientationSupported() &&
    typeof window.DeviceOrientationEvent.requestPermission === 'function';
}

/**
 * Requests motion & orientation permission. Must be called synchronously
 * from within a user gesture handler (e.g. a button click) on iOS.
 * @returns {Promise<'granted'|'denied'|'unsupported'>}
 */
export async function requestPermission() {
  if (!needsPermissionRequest()) return 'unsupported';
  try {
    const result = await window.DeviceOrientationEvent.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Subscribes to live orientation updates.
 *
 * Prefers the 'deviceorientationabsolute' event (world-referenced, mainly
 * Android Chrome) and falls back to 'deviceorientation' otherwise. Only
 * readings that report actual sensor data (`event.absolute` truthy, or a
 * non-null alpha) are forwarded, so stale/empty events don't produce a
 * misleading "zero" reading.
 *
 * @param {(orientation: {roll: number, pitch: number, yaw: number}) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribe(callback) {
  if (!isOrientationSupported()) return () => {};

  const handler = (event) => {
    if (event.alpha === null && event.beta === null && event.gamma === null) return;
    callback(mapDeviceOrientationEvent(event));
  };

  const eventName = 'ondeviceorientationabsolute' in window
    ? 'deviceorientationabsolute'
    : 'deviceorientation';

  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}

/**
 * Synchronously determines the current sensor status. `permissionState`
 * should be tracked by the caller (e.g. uiController) across the
 * requestPermission() flow, since the browser exposes no way to query
 * permission state ahead of a request on most platforms.
 *
 * @param {{permissionState?: 'unknown'|'granted'|'denied'}} [state]
 * @returns {SensorStatus[keyof SensorStatus]}
 */
export function getStatus(state = {}) {
  if (!isOrientationSupported()) return SensorStatus.UNSUPPORTED;
  if (needsPermissionRequest() && state.permissionState !== 'granted') {
    return state.permissionState === 'denied'
      ? SensorStatus.MISSING
      : SensorStatus.PERMISSION_REQUIRED;
  }
  return SensorStatus.OK;
}
