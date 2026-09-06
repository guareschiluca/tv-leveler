#!/usr/bin/env bash
# Regenerates every raster icon/favicon from icons/icon.svg, the single
# source of truth for the app's icon. Run this after editing icon.svg;
# commit the resulting PNGs and favicon.ico alongside it.
#
# This is a dev-only maintenance tool -- it plays no part in the running
# app, which stays free of Node/npm and any build step. It just needs:
#   - rsvg-convert  (Debian/Ubuntu: apt install librsvg2-bin)
#   - python3 + Pillow (pip install --break-system-packages pillow)
#
# Usage: ./tools/generate-icons.sh   (run from the repo root)

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="icons/icon.svg"
OUT="icons"

command -v rsvg-convert >/dev/null || {
  echo "error: rsvg-convert not found (apt install librsvg2-bin)" >&2
  exit 1
}

echo "Rendering PNGs from $SRC ..."
rsvg-convert -w 512 -h 512 "$SRC" -o "$OUT/icon-512.png"
rsvg-convert -w 192 -h 192 "$SRC" -o "$OUT/icon-192.png"
rsvg-convert -w 180 -h 180 "$SRC" -o "$OUT/apple-touch-icon.png"
rsvg-convert -w 32  -h 32  "$SRC" -o "$OUT/favicon-32.png"
rsvg-convert -w 16  -h 16  "$SRC" -o "$OUT/favicon-16.png"

# favicon.ico is built from a throwaway 48px render (kept out of git;
# only the .ico itself, at the repo root, is committed).
rsvg-convert -w 48 -h 48 "$SRC" -o /tmp/tvleveler-favicon-48.png

echo "Packing favicon.ico (16/32/48) ..."
python3 - << 'PY'
from PIL import Image

im = Image.open('/tmp/tvleveler-favicon-48.png').convert('RGBA')
im.save('favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
PY

rm -f /tmp/tvleveler-favicon-48.png

echo "Done. Regenerated:"
echo "  icons/icon-512.png"
echo "  icons/icon-192.png"
echo "  icons/apple-touch-icon.png"
echo "  icons/favicon-32.png"
echo "  icons/favicon-16.png"
echo "  favicon.ico"
