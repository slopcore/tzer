#!/usr/bin/env python3
"""Draw the tzer app icons (a mini day/night bar with the orange 'now' line) as PNGs, no dependencies."""
import os, struct, zlib

STOPS = [(0.0, "#070b1f"), (0.30, "#0f1838"), (0.40, "#26387a"), (0.47, "#4b73b3"),
         (0.55, "#76bbe5"), (0.75, "#a8def8"), (1.0, "#b6e5fa")]
NOW = (0xe8, 0x67, 0x2c)
STARS = [(0.14, 0.22, 0.016), (0.30, 0.34, 0.011), (0.10, 0.52, 0.010), (0.24, 0.66, 0.014), (0.36, 0.18, 0.009), (0.17, 0.82, 0.010)]

def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

STOPS = [(x, hex_rgb(c)) for x, c in STOPS]

def sky(x):
    for (x0, c0), (x1, c1) in zip(STOPS, STOPS[1:]):
        if x <= x1:
            t = (x - x0) / (x1 - x0)
            return tuple(a + (b - a) * t for a, b in zip(c0, c1))
    return STOPS[-1][1]

def coverage(px, py, size, radius):
    """Fraction of the pixel inside a rounded square (4x4 supersampling)."""
    if radius == 0:
        return 1.0
    hit = 0
    for sy in range(4):
        for sx in range(4):
            x, y = px + (sx + 0.5) / 4, py + (sy + 0.5) / 4
            cx = min(max(x, radius), size - radius)
            cy = min(max(y, radius), size - radius)
            hit += (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
    return hit / 16

def draw(size, rounded):
    radius = size * 0.22 if rounded else 0
    line_half = size * 0.022
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            x = (px + 0.5) / size
            r, g, b = sky(x)
            for sx, sy, sr in STARS:
                k = max(0.0, min(1.0, sr * size + 0.5 - ((px + 0.5 - sx * size) ** 2 + (py + 0.5 - sy * size) ** 2) ** 0.5))
                r, g, b = (r + (225 - r) * k, g + (232 - g) * k, b + (250 - b) * k)
            d = abs(px + 0.5 - size / 2)
            k = max(0.0, min(1.0, line_half + 0.5 - d))
            r, g, b = (r + (NOW[0] - r) * k, g + (NOW[1] - g) * k, b + (NOW[2] - b) * k)
            a = coverage(px, py, size, radius)
            row += bytes([round(r), round(g), round(b), round(255 * a)])
        rows.append(bytes(row))
    return png(size, b"".join(rows))

def png(size, raw):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

os.makedirs("icons", exist_ok=True)
for name, size, rounded in [("icon-192.png", 192, True), ("icon-512.png", 512, True),
                            ("icon-maskable-512.png", 512, False), ("apple-touch-icon.png", 180, False)]:
    open(os.path.join("icons", name), "wb").write(draw(size, rounded))
    print("icons/" + name)
