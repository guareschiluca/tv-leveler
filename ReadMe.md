# TV Leveler

A small browser tool that helps you hang a wall-mounted TV perfectly level,
using the orientation sensors already built into your smartphone.

*(This document is a work in progress and grows alongside the app. It is
also fetched and rendered at runtime as the in-app Help page, so keep it
user-facing and free of internal implementation notes.)*

## How it works

1. Place your phone flat against the wall, next to where the TV will hang.
2. Tap **Set Reference Orientation** to record the wall's angle.
3. Place the phone against the back of the TV.
4. Adjust the TV until Roll and Yaw read close to zero. Pitch is up to you
   (a slight forward or backward tilt is often intentional).

## Status

🚧 Under active development. The app shell, theme, and layout are in place;
live sensor readings are coming in the next update.

## Requirements

- A modern smartphone browser (Android Chrome or iOS Safari recommended).
- Motion & orientation sensor permission, when prompted (required on iOS).

## Privacy

This app runs entirely in your browser. It does not collect data, does not
talk to any server, and does not store anything beyond the current
reference orientation in memory for the current page session.

## License

See [LICENSE](./LICENSE). In short: you're welcome to use the app as
hosted, but the source is not open for reuse or redistribution.
