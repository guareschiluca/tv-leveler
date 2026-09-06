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
   button is disabled ("Hold Steady…") for a moment while the reading
   settles — hold the device still until it enables.
3. The screen switches to the alignment readout, and the reference
   button shrinks to a small button in the corner — tap it again any
   time to re-capture a fresh reference.
4. Place the phone against the back of the TV.
5. Adjust the TV until **Roll** and **Yaw** read close to zero. **Pitch**
   is up to you (a slight forward or backward tilt is often intentional).

The alignment screen isn't just three numbers: a small rectangle above
them tilts in 3D right along with the phone — spinning for roll, tipping
toward/away from you for pitch, turning sideways for yaw — against a
dashed outline showing the target. Its edges (and the little bar across
its middle, for roll) turn green axis-by-axis the moment that axis is
within tolerance, the same as the number below it. Each axis also has its
own icon as a quick visual reminder of what it means: a twisting phone for
roll, an up/down tilt for pitch, a left/right turn for yaw.

If your device supports both available sensor types, a **Relative /
Absolute** switch is available from the menu (top-right, next to the
status dot) — see "Getting an accurate reading" below for what that means
and when you'd want to switch it.

On a supported phone/browser, the menu also offers an **Install app**
option once your browser judges the page installable — see "Installing
as an app" below.

## Installing as an app

This app can be installed to your phone's home screen like a native app,
via **Install app** in the menu. It'll then open full-screen (no browser
address bar) with its own icon, and keeps working without a network
connection after the first visit — handy since a garage or a spot behind
a soon-to-be-mounted TV isn't always great for signal.

The install option only appears when your browser considers the app
installable *and* your device actually supports the sensors this app
needs — there's no point installing it otherwise. If you don't see it,
your browser may offer its own built-in "Add to Home Screen" option from
its menu instead (Chrome on Android always does).

## Getting an accurate reading

On most devices this app uses a sensor that never touches the compass, so
magnetic interference isn't a concern. If your device only supports the
fallback sensor (shown in the menu's status line as "Absolute Orientation
Sensor"), the yaw axis does rely on the compass and can be noisy or
drift near large metal objects (structural steel, pipes, appliances,
rebar in floors/walls). If your device supports both, a **Relative /
Absolute** switch in the menu lets you change it — e.g. if Relative
seems to be drifting over a long session, Absolute (compass-based) may
be steadier despite the interference trade-off, or vice versa.
Switching always requires capturing a fresh reference, since the two
sensors don't share a common frame of reference. Either way:

- Hold the phone still for a second before capturing the reference — the
  **Set Reference Orientation** button won't be clickable until the
  reading has settled, precisely to avoid capturing a noisy value.
- If readings seem consistently off in the same spot on the fallback
  sensor, try moving a few inches from any large metal fixtures nearby.

## Status

✅ Core functionality complete: live sensor readout, reference capture,
delta display, capture-first UX, a sensor-kind toggle where applicable,
and installable/offline PWA support.

**Recent changes:**
- **Installable PWA:** the app now has a manifest, an app icon (home
  screen + favicon), and a service worker that caches the app shell for
  offline use after the first visit. An **Install app** option appears
  in the menu, but only once the browser deems the page installable
  *and* the device supports the sensors this app actually needs.
- **Layout & clarity restyle:** the header now shows only the title and a
  small status dot, with the sensor-kind switch, theme toggle, and help
  moved into a single menu — nothing to wrap or crowd on small/portrait
  screens. The three axis cards are evenly sized and each pairs its label
  with a small icon and a plain-language hint ("tilt sideways", "tilt
  up/down", "turn left/right"), so roll/pitch/yaw don't require prior
  knowledge to read. The alignment screen also gained the live 3D tilt
  preview described above.
- **Capture-first UX rework:** numeric orientation is no longer shown at
  all before a reference exists (there's nothing to compare it to yet).
  The app now shows only a "Set Reference Orientation" prompt
  full-screen until you capture one; afterward, the roll/pitch/yaw
  alignment readout becomes the primary focus and the same button
  shrinks to a small corner control for re-capturing later.
- **Relative/Absolute sensor toggle**, shown only on devices that
  support both. Before adding this, a "swing-twist decomposition"
  algorithm was considered as a way to shield roll/pitch from a noisy
  compass — verified by simulation *before* implementing it, and it
  turned out not to help: near-vertical phone orientation (this app's
  main use case) puts the world heading axis and the device's own roll
  axis nearly on top of each other (that's what gimbal lock actually
  is), so compass noise genuinely becomes indistinguishable from roll
  noise at that orientation — no relabeling scheme fixes that, only
  removing the compass from the measurement entirely does. That's
  exactly what `RelativeOrientationSensor` already does, so the real,
  working choice is which *sensor* to trust, not which algorithm to
  decode it with.
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

The app icon lives at `icons/icon.svg` (the one file to edit if you want
to restyle it); every raster size (PNGs, `favicon.ico`) is generated from
it by `tools/generate-icons.sh`, a dev-only script with no bearing on the
running app itself. It needs `rsvg-convert` (Debian/Ubuntu:
`apt install librsvg2-bin`) and Python + Pillow
(`pip install --break-system-packages pillow`).

## Privacy

This app runs entirely in your browser. It does not collect data, does not
talk to any server, and does not store anything beyond the current
reference orientation in memory for the current page session. The
service worker's offline cache (used only if you install the app) stores
copies of the app's own files on your device for offline use — it does
not send anything anywhere, and holds no personal data.

## License

See [LICENSE](./LICENSE). In short: you're welcome to use the app as
hosted, but the source is not open for reuse or redistribution.
