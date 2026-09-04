/**
 * sensors.js
 * Orientation sensor access via the Generic Sensor API
 * (RelativeOrientationSensor / AbsoluteOrientationSensor), isolated
 * from math and UI concerns.
 *
 * DELIBERATE SCOPE: Android + Chrome only. This app previously used
 * DeviceOrientationEvent as a universal (including iOS Safari)
 * fallback, but that API forces the browser to fuse gyroscope +
 * accelerometer + magnetometer internally and hand us the result as
 * alpha/beta/gamma, with no way to exclude the magnetometer when it's
 * unreliable (e.g. near structural metal) and no way to get the OS's
 * fusion result as a quaternion directly. The Generic Sensor API fixes
 * both: it gives us a quaternion natively, and — critically —
 * RelativeOrientationSensor fuses gyroscope + accelerometer *only*,
 * structurally excluding the magnetometer rather than just trusting it
 * less. That's the real fix for yaw reliability; DeviceOrientationEvent
 * has no equivalent. The Generic Sensor API has no Safari or Firefox
 * implementation, so supporting it means dropping iOS — a deliberate,
 * agreed trade-off for this project, not an oversight.
 */

/** @enum {string} */
export const SensorKind = {
  // Gyroscope + accelerometer only. No magnetometer, so it can't be
  // disturbed by nearby metal — but yaw isn't tied to true north and
  // will drift slowly over time (gyro integration). Preferred default:
  // this app only ever needs a *relative* orientation (current vs a
  // just-captured reference), never true compass heading.
  RELATIVE: 'relative',
  // Gyroscope + accelerometer + magnetometer, north-referenced.
  // Subject to magnetic interference. Used as a fallback on devices
  // that don't expose RelativeOrientationSensor.
  ABSOLUTE: 'absolute',
};

/** @enum {string} */
export const SensorStatus = {
  OK: 'ok',
  MISSING: 'missing', // permission denied
  PERMISSION_REQUIRED: 'permission-required', // awaiting the browser's own permission prompt
  UNSUPPORTED: 'unsupported',
};

function sensorClassFor(kind) {
  if (typeof window === 'undefined') return undefined;
  return kind === SensorKind.RELATIVE
    ? window.RelativeOrientationSensor
    : window.AbsoluteOrientationSensor;
}

/**
 * Whether the given sensor kind's constructor exists in this browser.
 * Does NOT indicate permission has been granted, or that the device
 * physically has the required hardware — only that the API is present.
 * @param {SensorKind[keyof SensorKind]} kind
 * @returns {boolean}
 */
export function isKindSupported(kind) {
  return sensorClassFor(kind) !== undefined;
}

/**
 * Best available sensor kind for this app's needs: RelativeOrientation-
 * Sensor when available (immune to magnetic interference), falling back
 * to AbsoluteOrientationSensor, or null if neither is supported.
 * @returns {SensorKind[keyof SensorKind]|null}
 */
export function preferredKind() {
  if (isKindSupported(SensorKind.RELATIVE)) return SensorKind.RELATIVE;
  if (isKindSupported(SensorKind.ABSOLUTE)) return SensorKind.ABSOLUTE;
  return null;
}

/**
 * Pure transform: the Generic Sensor API's `quaternion` reading (a
 * 4-element array in [x, y, z, w] order, per the W3C Orientation Sensor
 * spec) to this app's {w, x, y, z} object shape.
 * @param {[number, number, number, number]} quaternionArray
 * @returns {{w: number, x: number, y: number, z: number}}
 */
export function mapSensorQuaternion([x, y, z, w]) {
  return { w, x, y, z };
}

/**
 * Starts a sensor of the given kind and streams quaternion readings.
 *
 * Unlike DeviceOrientationEvent, the Generic Sensor API has no separate
 * up-front permission request step — the browser shows its own native
 * permission prompt the first time `sensor.start()` is called, similar
 * to geolocation. `onStatusChange` reports PERMISSION_REQUIRED while
 * that's pending, OK once real readings start arriving, MISSING if
 * permission is denied, and UNSUPPORTED if the sensor can't be
 * constructed at all (API absent, or, per spec, a SecurityError from a
 * disallowed Permissions-Policy context).
 *
 * @param {SensorKind[keyof SensorKind]} kind
 * @param {(quaternion: {w: number, x: number, y: number, z: number}) => void} callback
 * @param {(status: SensorStatus[keyof SensorStatus]) => void} [onStatusChange]
 * @returns {() => void} unsubscribe function; safe to call multiple times
 */
export function subscribe(kind, callback, onStatusChange) {
  const SensorClass = sensorClassFor(kind);
  if (!SensorClass) {
    onStatusChange?.(SensorStatus.UNSUPPORTED);
    return () => {};
  }

  let sensor;
  try {
    sensor = new SensorClass({ frequency: 60 });
  } catch {
    // e.g. SecurityError if disallowed by Permissions-Policy
    onStatusChange?.(SensorStatus.UNSUPPORTED);
    return () => {};
  }

  const handleReading = () => {
    callback(mapSensorQuaternion(sensor.quaternion));
    onStatusChange?.(SensorStatus.OK);
  };

  const handleError = (event) => {
    onStatusChange?.(
      event.error?.name === 'NotAllowedError' ? SensorStatus.MISSING : SensorStatus.UNSUPPORTED,
    );
  };

  sensor.addEventListener('reading', handleReading);
  sensor.addEventListener('error', handleError);

  onStatusChange?.(SensorStatus.PERMISSION_REQUIRED);
  sensor.start();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    sensor.removeEventListener('reading', handleReading);
    sensor.removeEventListener('error', handleError);
    sensor.stop();
  };
}
