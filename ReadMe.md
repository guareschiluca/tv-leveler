# TV Leveler

[![Test](https://github.com/guareschiluca/tv-leveler/actions/workflows/test.yml/badge.svg)](https://github.com/guareschiluca/tv-leveler/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/guareschiluca/tv-leveler/actions/workflows/deploy.yml/badge.svg)](https://github.com/guareschiluca/tv-leveler/actions/workflows/deploy.yml)

A small browser tool that helps you hang a wall-mounted TV perfectly level,
using the orientation sensors already built into your smartphone.

*(This document is a work in progress and grows alongside the app. It is
also fetched and rendered at runtime as the in-app Help page, so keep it
user-facing and free of internal implementation notes.)*

## Try it

👉 **[Open the app](https://guareschiluca.github.io/tv-leveler/)** (works best on a phone).

## How it works

1. Place your phone flat against the wall, next to where the TV will hang.
2. Tap **Set Reference Orientation** to record the wall's angle. The
   button is disabled for a moment while the reading settles — hold the
   device still until it enables.
3. Place the phone against the back of the TV.
4. Adjust the TV until Roll and Yaw read close to zero. Pitch is up to you
   (a slight forward or backward tilt is often intentional).

## Getting an accurate reading

On most devices this app uses a sensor that never touches the compass, so
magnetic interference isn't a concern. If your device only supports the
fallback sensor (shown in the status badge as "Absolute Orientation
Sensor"), the yaw axis does rely on the compass and can be noisy or
drift near large metal objects (structural steel, pipes, appliances,
rebar in floors/walls). Either way:

- Hold the phone still for a second before capturing the reference — the
  **Set Reference Orientation** button won't be clickable until the
  reading has settled, precisely to avoid capturing a noisy value.
- If readings seem consistently off in the same spot on the fallback
  sensor, try moving a few inches from any large metal fixtures nearby.

## Status

🚧 Under active development. Live sensor readout, reference capture, and
delta display are working. The in-app Help page and PWA installation are
still coming.

**Recent fixes:**
- Relative orientation is now computed with quaternions instead of
  subtracting roll/pitch/yaw independently. The old approach could
  misreport a ~1-2 degree real difference as ~179 degrees whenever the
  phone was held near-vertical (e.g. flat against a wall or TV) — a
  classic Euler-angle gimbal-lock artifact. Absolute readings were
  unaffected; only the "how far off level" delta was wrong, and only in
  that near-vertical range.
- Reference capture is gated on reading stability, so a reference can't
  get captured while the reading is still settling — that used to bake
  noise into every later comparison. The first version of this check
  compared the filtered reading against the noisy raw sensor input,
  which almost never converges (raw sensor noise doesn't disappear).
  It now checks whether the *filtered* signal has stopped moving over a
  short recent window instead, which actually settles once the phone is
  still. The **Set Reference Orientation** button now clearly changes to
  "Hold Steady…" (not just a subtle dimming) while it isn't ready yet.
- Switched from `DeviceOrientationEvent` (universal, but hands us
  alpha/beta/gamma with no control over how they're fused) to the
  Generic Sensor API. This app now prefers
  `RelativeOrientationSensor` (gyroscope + accelerometer only) when
  available, falling back to `AbsoluteOrientationSensor` (adds the
  magnetometer back in) otherwise. The relative sensor structurally
  excludes the magnetometer, so it can't be thrown off by nearby metal
  (rebar, structural steel, appliances) the way a compass-based heading
  can — a deliberate trade for **Android + Chrome only** support, since
  this API has no Safari or Firefox implementation.
- **Regression fix:** the switch above fed raw sensor quaternions
  directly into the math built for the old `DeviceOrientationEvent`
  axis convention, which turned out to be a *different* convention —
  Roll and Pitch were silently swapped for a short period (Yaw was
  unaffected, since both conventions happen to treat the same axis as
  "up"). Fixed by deriving and verifying the correct convention against
  an independently-tested reference, with regression tests pinning all
  three axes going forward.

## Requirements

- **Android + Chrome (or another Chromium-based browser)**, on a phone with
  the required motion sensors. This app deliberately does not support
  iOS/Safari or Firefox — it relies on the Generic Sensor API
  (`RelativeOrientationSensor` / `AbsoluteOrientationSensor`), which those
  browsers don't implement. If you land here on an unsupported browser,
  the app shows a QR code to open the same page on a supported device.
- Motion & orientation sensor permission, granted via the browser's own
  prompt the first time the app requests it.

## Development

This is a plain HTML/CSS/JS static app — no build step, no bundler, no
npm dependencies of any kind. Open `index.html` with any static file
server (e.g. `npx serve .` or Python's `http.server`) and it runs as-is.

Unit tests for the pure orientation-math module use Node's built-in test
runner directly, with no dependency manifest required. Run from the repo
root:

```
node --test
```

## Privacy

This app runs entirely in your browser. It does not collect data, does not
talk to any server, and does not store anything beyond the current
reference orientation in memory for the current page session.

## License

See [LICENSE](./LICENSE). In short: you're welcome to use the app as
hosted, but the source is not open for reuse or redistribution.
