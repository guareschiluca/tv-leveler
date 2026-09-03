/**
 * uiController.js
 * Wires js/sensors.js + js/orientationMath.js + js/quaternionMath.js to
 * the DOM described in index.html. This is the only module that touches
 * the readout markup.
 *
 * Orientation is tracked internally as a quaternion (not as independent
 * roll/pitch/yaw numbers) precisely to avoid the Euler-angle gimbal-lock
 * problem near pitch = +-90 degrees — see js/quaternionMath.js for the
 * full explanation. Plain {roll, pitch, yaw} numbers only exist at the
 * very last step, for display.
 */

import { isNearZero, isLevel } from './orientationMath.js';
import {
  eulerToQuaternion,
  quaternionToEuler,
  quaternionMultiply,
  quaternionConjugate,
  quaternionNormalize,
  quaternionSlerp,
  angularDistanceDeg,
} from './quaternionMath.js';
import {
  SensorStatus,
  isOrientationSupported,
  needsPermissionRequest,
  requestPermission,
  subscribe,
  getStatus,
} from './sensors.js';

const SMOOTHING_ALPHA = 0.12; // low-pass filter strength for jitter reduction
const NEAR_ZERO_THRESHOLD_DEG = 0.5;

// A reading counts as "settled" once the smoothed orientation stays
// within this many degrees of the raw, incoming orientation for
// STABLE_STREAK_REQUIRED consecutive frames. Raw sensor data (especially
// the compass-derived yaw axis) is genuinely noisy, and capturing a
// reference while it's still catching up from recent motion bakes that
// noise into every later comparison — this is what the gate prevents.
const STABILITY_THRESHOLD_DEG = 1.0;
const STABLE_STREAK_REQUIRED = 15; // ~250ms at 60Hz

const STATUS_LABELS = {
  [SensorStatus.OK]: 'Sensors: OK',
  [SensorStatus.PERMISSION_REQUIRED]: 'Sensors: permission required',
  [SensorStatus.MISSING]: 'Sensors: missing',
  [SensorStatus.UNSUPPORTED]: 'Sensors: unsupported',
};

/**
 * Initializes the live readout UI. Safe to call once on page load.
 */
export function initUiController() {
  const dom = queryDom();

  /** @type {'unknown'|'granted'|'denied'} */
  let permissionState = 'unknown';
  let referenceQuaternion = null;
  let smoothedQuaternion = null; // null until the first sensor reading
  let unsubscribe = null;
  let frameScheduled = false;
  let latestForRender = null;
  let stableStreak = 0;
  let isStable = false;

  function currentStatus() {
    return getStatus({ permissionState });
  }

  function setStatusBadge(status) {
    dom.sensorStatusBadge.dataset.status = status;
    dom.sensorStatusBadge.textContent = STATUS_LABELS[status] ?? 'Sensors: unknown';
  }

  function showOnly(sectionToShow) {
    for (const section of [dom.permissionPrompt, dom.unsupportedNotice, dom.readoutView]) {
      section.classList.toggle('d-none', section !== sectionToShow);
    }
  }

  function render() {
    const status = currentStatus();
    setStatusBadge(status);

    if (status === SensorStatus.UNSUPPORTED) {
      dom.statusMessageTitle.textContent = "Orientation sensors aren't available on this browser/device.";
      dom.statusMessageHint.classList.remove('d-none');
      showOnly(dom.unsupportedNotice);
      return;
    }

    if (status === SensorStatus.MISSING) {
      dom.statusMessageTitle.textContent = 'Motion sensor permission was denied.';
      dom.statusMessageHint.classList.add('d-none');
      showOnly(dom.unsupportedNotice);
      return;
    }

    if (status === SensorStatus.PERMISSION_REQUIRED) {
      showOnly(dom.permissionPrompt);
      return;
    }

    // SensorStatus.OK
    showOnly(dom.readoutView);
    startSubscriptionIfNeeded();
  }

  function startSubscriptionIfNeeded() {
    if (unsubscribe) return;
    unsubscribe = subscribe(handleRawOrientation);
  }

  function handleRawOrientation(raw) {
    const rawQuaternion = eulerToQuaternion(raw);
    smoothedQuaternion = smoothedQuaternion
      ? quaternionSlerp(smoothedQuaternion, rawQuaternion, SMOOTHING_ALPHA)
      : rawQuaternion;

    const settlingGap = angularDistanceDeg(smoothedQuaternion, rawQuaternion);
    stableStreak = settlingGap <= STABILITY_THRESHOLD_DEG ? stableStreak + 1 : 0;
    isStable = stableStreak >= STABLE_STREAK_REQUIRED;
    updateStabilityUi();

    const displayOrientation = referenceQuaternion
      ? relativeOrientation(smoothedQuaternion, referenceQuaternion)
      : quaternionToEuler(smoothedQuaternion);

    latestForRender = displayOrientation;
    scheduleFrame();
  }

  function updateStabilityUi() {
    dom.setReferenceBtn.disabled = !isStable;
    dom.setReferenceBtn.title = isStable
      ? ''
      : 'Hold the device steady for a moment before capturing the reference';
    dom.stabilityHint.classList.toggle('d-none', isStable);
  }

  function scheduleFrame() {
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(() => {
      frameScheduled = false;
      if (latestForRender) renderOrientation(latestForRender);
    });
  }

  function renderOrientation(orientation) {
    setAxisValue(dom.rollValue, dom.rollCard, orientation.roll);
    setAxisValue(dom.pitchValue, dom.pitchCard, orientation.pitch);
    setAxisValue(dom.yawValue, dom.yawCard, orientation.yaw);

    const hasReference = referenceQuaternion !== null;
    dom.modeLabel.textContent = hasReference
      ? 'Relative orientation (Δ from reference)'
      : 'Absolute orientation';

    dom.levelBadge.classList.toggle(
      'd-none',
      !(hasReference && isLevel(orientation, NEAR_ZERO_THRESHOLD_DEG)),
    );
  }

  function setAxisValue(valueEl, cardEl, valueDeg) {
    const displayValue = Object.is(valueDeg, -0) ? 0 : valueDeg;
    valueEl.textContent = `${displayValue.toFixed(1)}°`;
    cardEl.classList.toggle('is-near-zero', isNearZero(valueDeg, NEAR_ZERO_THRESHOLD_DEG));
  }

  function setReference() {
    if (!smoothedQuaternion || !isStable) return; // no reading yet, or still settling
    referenceQuaternion = smoothedQuaternion;
    dom.resetReferenceBtn.classList.remove('d-none');
  }

  function resetReference() {
    referenceQuaternion = null;
    dom.resetReferenceBtn.classList.add('d-none');
    dom.levelBadge.classList.add('d-none');
  }

  async function handleRequestPermission() {
    const result = await requestPermission();
    permissionState = result === 'granted' ? 'granted' : 'denied';
    render();
  }

  dom.requestPermissionBtn.addEventListener('click', handleRequestPermission);
  dom.setReferenceBtn.addEventListener('click', setReference);
  dom.resetReferenceBtn.addEventListener('click', resetReference);
  dom.setReferenceBtn.disabled = true; // enabled once the first reading settles

  // Permission state starts 'unknown' on platforms that require a
  // request; browsers that don't require one report OK immediately.
  if (!isOrientationSupported()) {
    render();
    return;
  }
  if (!needsPermissionRequest()) {
    permissionState = 'granted'; // no explicit grant needed on this platform
  }
  render();
}

/**
 * Relative orientation of `current` with respect to `reference`, both
 * already-computed quaternions (avoids re-deriving them from Euler
 * angles on every animation frame).
 */
function relativeOrientation(currentQuaternion, referenceQuaternion) {
  const relative = quaternionNormalize(
    quaternionMultiply(currentQuaternion, quaternionConjugate(referenceQuaternion)),
  );
  return quaternionToEuler(relative);
}

function queryDom() {
  return {
    sensorStatusBadge: document.getElementById('sensorStatusBadge'),
    permissionPrompt: document.getElementById('permissionPrompt'),
    requestPermissionBtn: document.getElementById('requestPermissionBtn'),
    unsupportedNotice: document.getElementById('unsupportedNotice'),
    statusMessageTitle: document.getElementById('statusMessageTitle'),
    statusMessageHint: document.getElementById('statusMessageHint'),
    readoutView: document.getElementById('readoutView'),
    modeLabel: document.getElementById('modeLabel'),
    rollValue: document.getElementById('rollValue'),
    pitchValue: document.getElementById('pitchValue'),
    yawValue: document.getElementById('yawValue'),
    rollCard: document.querySelector('.axis-card[data-axis="roll"]'),
    pitchCard: document.querySelector('.axis-card[data-axis="pitch"]'),
    yawCard: document.querySelector('.axis-card[data-axis="yaw"]'),
    levelBadge: document.getElementById('levelBadge'),
    setReferenceBtn: document.getElementById('setReferenceBtn'),
    resetReferenceBtn: document.getElementById('resetReferenceBtn'),
    stabilityHint: document.getElementById('stabilityHint'),
  };
}
