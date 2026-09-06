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
 *
 * Sensor readings now arrive as quaternions directly from the Generic
 * Sensor API (js/sensors.js) — no Euler-angle conversion needed on the
 * way in, only on the way out for display.
 */

import { isNearZero, isLevel } from './orientationMath.js';
import {
  quaternionToEuler,
  quaternionMultiply,
  quaternionConjugate,
  quaternionNormalize,
  quaternionSlerp,
  maxAngularSpreadDeg,
} from './quaternionMath.js';
import {
  SensorKind,
  SensorStatus,
  isKindSupported,
  preferredKind,
  subscribe,
} from './sensors.js';
import { renderUnsupportedQrCode } from './qrCode.js';

const SMOOTHING_ALPHA = 0.12; // low-pass filter strength for jitter reduction
const NEAR_ZERO_THRESHOLD_DEG = 0.5;

// A reading counts as "settled" once the *smoothed* orientation's own
// recent history stops moving — i.e. every sample in the last
// STABILITY_WINDOW_MS is within STABILITY_THRESHOLD_DEG of every other
// sample in that window. This deliberately checks the smoothed signal
// against its own recent past, not against the incoming raw reading:
// raw sensor data is genuinely noisy and never fully stops jittering,
// so comparing smoothed to raw never reliably settles. The smoothed
// signal, on the other hand, should actually flatten out once the
// phone stops moving — that flattening is what this measures.
const STABILITY_WINDOW_MS = 500;
const STABILITY_THRESHOLD_DEG = 0.4;
const SET_REFERENCE_LABEL = 'Set Reference Orientation';
const SETTLING_LABEL = 'Hold Steady…';

const STATUS_LABELS = {
  [SensorStatus.OK]: 'Sensors: OK',
  [SensorStatus.PERMISSION_REQUIRED]: 'Sensors: permission required',
  [SensorStatus.MISSING]: 'Sensors: missing',
  [SensorStatus.UNSUPPORTED]: 'Sensors: unsupported',
};

const SENSOR_KIND_LABELS = {
  [SensorKind.RELATIVE]: 'Relative Orientation Sensor',
  [SensorKind.ABSOLUTE]: 'Absolute Orientation Sensor',
};

/**
 * Initializes the live readout UI. Safe to call once on page load.
 */
export function initUiController() {
  const dom = queryDom();

  let status = SensorStatus.UNSUPPORTED;
  let referenceQuaternion = null;
  let smoothedQuaternion = null; // null until the first sensor reading
  let unsubscribe = null;
  let frameScheduled = false;
  let latestForRender = null;
  let stabilityBuffer = []; // [{ t: DOMHighResTimeStamp, q: Quaternion }], newest last
  let isStable = false;
  let kind = preferredKind(); // RELATIVE preferred over ABSOLUTE when both exist

  const bothKindsSupported = isKindSupported(SensorKind.RELATIVE) && isKindSupported(SensorKind.ABSOLUTE);

  function setStatusBadge(nextStatus) {
    const kindSuffix = nextStatus === SensorStatus.OK && kind
      ? ` (${SENSOR_KIND_LABELS[kind]})`
      : '';
    const label = (STATUS_LABELS[nextStatus] ?? 'Sensors: unknown') + kindSuffix;

    // The header only shows a small colored dot (title attribute covers
    // hover/long-press); the full sentence lives in the menu instead.
    dom.sensorStatusDot.dataset.status = nextStatus;
    dom.sensorStatusDot.title = label;
    dom.sensorStatusLabel.textContent = label;
  }

  function updateSensorKindToggleUi() {
    if (!bothKindsSupported) return;
    dom.sensorKindRelativeBtn.classList.toggle('active', kind === SensorKind.RELATIVE);
    dom.sensorKindAbsoluteBtn.classList.toggle('active', kind === SensorKind.ABSOLUTE);
  }

  function switchKind(nextKind) {
    if (nextKind === kind || !isKindSupported(nextKind)) return;
    unsubscribe?.();
    unsubscribe = null;
    kind = nextKind;
    // Different sensor kinds have unrelated internal reference frames
    // (e.g. RelativeOrientationSensor's yaw zero-point is arbitrary and
    // tied to when it started) — a reference captured under one is
    // meaningless under the other, so switching always requires a fresh
    // capture.
    referenceQuaternion = null;
    smoothedQuaternion = null;
    stabilityBuffer = [];
    isStable = false;
    updateStabilityUi();
    updateSensorKindToggleUi();
    showCaptureSlot();
    handleStatusChange(SensorStatus.PERMISSION_REQUIRED);
    startSensors();
  }

  function showCaptureSlot() {
    dom.alignmentView.classList.add('d-none');
    dom.levelBadge.classList.add('d-none');
    dom.captureSlot.classList.remove('d-none');
    dom.setReferenceBtn.classList.remove('btn-sm', 'corner-position');
    dom.setReferenceBtn.classList.add('btn-lg');
    dom.captureSlot.appendChild(dom.setReferenceBtn);
  }

  function showAlignmentView() {
    dom.captureSlot.classList.add('d-none');
    dom.alignmentView.classList.remove('d-none');
    dom.setReferenceBtn.classList.remove('btn-lg');
    dom.setReferenceBtn.classList.add('btn-sm', 'corner-position');
    dom.cornerSlot.appendChild(dom.setReferenceBtn);
  }

  function showOnly(sectionToShow) {
    for (const section of [dom.permissionPrompt, dom.unsupportedNotice, dom.readoutView]) {
      section.classList.toggle('d-none', section !== sectionToShow);
    }
  }

  function render() {
    setStatusBadge(status);

    if (status === SensorStatus.UNSUPPORTED) {
      dom.statusMessageTitle.textContent =
        "This browser/device doesn't support the orientation sensors this app needs (Android + Chrome required).";
      dom.statusMessageHint.classList.remove('d-none');
      showOnly(dom.unsupportedNotice);
      renderUnsupportedQrCode(dom.unsupportedQr, window.location.href);
      return;
    }

    if (status === SensorStatus.MISSING) {
      dom.statusMessageTitle.textContent = 'Motion sensor permission was denied.';
      dom.statusMessageHint.classList.add('d-none');
      showOnly(dom.unsupportedNotice);
      renderUnsupportedQrCode(dom.unsupportedQr, window.location.href);
      return;
    }

    if (status === SensorStatus.PERMISSION_REQUIRED) {
      showOnly(dom.permissionPrompt);
      return;
    }

    // SensorStatus.OK
    showOnly(dom.readoutView);
  }

  function handleStatusChange(nextStatus) {
    status = nextStatus;
    render();
  }

  function startSensors() {
    if (unsubscribe || !kind) return;
    unsubscribe = subscribe(kind, handleRawQuaternion, handleStatusChange);
  }

  function handleRawQuaternion(rawQuaternion) {
    smoothedQuaternion = smoothedQuaternion
      ? quaternionSlerp(smoothedQuaternion, rawQuaternion, SMOOTHING_ALPHA)
      : rawQuaternion;

    updateStabilityBuffer(smoothedQuaternion);
    updateStabilityUi();

    if (!referenceQuaternion) return; // nothing visible to update pre-capture

    latestForRender = relativeOrientation(smoothedQuaternion, referenceQuaternion);
    scheduleFrame();
  }

  function updateStabilityBuffer(quaternion) {
    const now = performance.now();
    stabilityBuffer.push({ t: now, q: quaternion });
    while (stabilityBuffer.length > 1 && now - stabilityBuffer[0].t > STABILITY_WINDOW_MS) {
      stabilityBuffer.shift();
    }

    const hasFullWindow = stabilityBuffer.length > 1
      && now - stabilityBuffer[0].t >= STABILITY_WINDOW_MS * 0.9;
    const spread = maxAngularSpreadDeg(stabilityBuffer.map((entry) => entry.q));
    isStable = hasFullWindow && spread <= STABILITY_THRESHOLD_DEG;
  }

  function updateStabilityUi() {
    dom.setReferenceBtn.disabled = !isStable;
    dom.setReferenceBtn.classList.toggle('is-settling', !isStable);
    dom.setReferenceBtn.textContent = isStable ? SET_REFERENCE_LABEL : SETTLING_LABEL;
    dom.setReferenceBtn.title = isStable
      ? ''
      : 'Hold the device steady for a moment before capturing the reference';
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

    dom.levelBadge.classList.toggle(
      'd-none',
      !isLevel(orientation, NEAR_ZERO_THRESHOLD_DEG),
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

    // Same button, relocated: full-screen -> secondary corner
    // affordance, since alignment is now the primary focus. Clicking it
    // again from the corner just re-captures a fresh reference -- no
    // separate "reset" control needed.
    showAlignmentView();
  }

  dom.requestPermissionBtn.addEventListener('click', startSensors);
  dom.setReferenceBtn.addEventListener('click', setReference);
  dom.setReferenceBtn.disabled = true; // enabled once the first reading settles
  dom.setReferenceBtn.textContent = SETTLING_LABEL;
  dom.setReferenceBtn.classList.add('is-settling');
  showCaptureSlot(); // starts full-screen, pre-capture

  if (bothKindsSupported) {
    dom.sensorKindMenuItem.classList.remove('d-none');
    dom.sensorKindRelativeBtn.addEventListener('click', () => switchKind(SensorKind.RELATIVE));
    dom.sensorKindAbsoluteBtn.addEventListener('click', () => switchKind(SensorKind.ABSOLUTE));
    updateSensorKindToggleUi();
  }

  if (!kind) {
    handleStatusChange(SensorStatus.UNSUPPORTED);
    return;
  }
  handleStatusChange(SensorStatus.PERMISSION_REQUIRED);
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
    sensorStatusDot: document.getElementById('sensorStatusDot'),
    sensorStatusLabel: document.getElementById('sensorStatusLabel'),
    sensorKindMenuItem: document.getElementById('sensorKindMenuItem'),
    sensorKindRelativeBtn: document.getElementById('sensorKindRelativeBtn'),
    sensorKindAbsoluteBtn: document.getElementById('sensorKindAbsoluteBtn'),
    permissionPrompt: document.getElementById('permissionPrompt'),
    requestPermissionBtn: document.getElementById('requestPermissionBtn'),
    unsupportedNotice: document.getElementById('unsupportedNotice'),
    statusMessageTitle: document.getElementById('statusMessageTitle'),
    statusMessageHint: document.getElementById('statusMessageHint'),
    unsupportedQr: document.getElementById('unsupportedQr'),
    readoutView: document.getElementById('readoutView'),
    captureSlot: document.getElementById('captureSlot'),
    alignmentView: document.getElementById('alignmentView'),
    cornerSlot: document.getElementById('cornerSlot'),
    rollValue: document.getElementById('rollValue'),
    pitchValue: document.getElementById('pitchValue'),
    yawValue: document.getElementById('yawValue'),
    rollCard: document.querySelector('.axis-card[data-axis="roll"]'),
    pitchCard: document.querySelector('.axis-card[data-axis="pitch"]'),
    yawCard: document.querySelector('.axis-card[data-axis="yaw"]'),
    levelBadge: document.getElementById('levelBadge'),
    setReferenceBtn: document.getElementById('setReferenceBtn'),
  };
}
