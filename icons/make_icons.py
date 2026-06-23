#!/usr/bin/env python3
"""Generate Pop Learning PNG app icons using only the Python standard library.
A white five-point star (the app's sparkle motif) on the crayon-red->orange
gradient, supersampled for smooth edges. Run: python3 make_icons.py"""
import math, os, struct, zlib

TOP = (250, 82, 82)      # #FA5252
BOT = (255, 146, 43)     # #FF922B
SS = 4                   # supersample factor

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def rounded_alpha(x, y, w, h, radius):
    """Coverage (0..1-ish) for a rounded square; full square if radius<=0."""
    if radius <= 0:
        return 1.0
    cx = min(max(x, radius), w - radius)
    cy = min(max(y, radius), h - radius)
    dx = x - cx
    dy = y - cy
    d = math.hypot(dx, dy)
    return 1.0 if d <= radius else 0.0

def star_points(cx, cy, outer, inner, n=5, rot=-math.pi/2):
    pts = []
    for i in range(n * 2):
        r = outer if i % 2 == 0 else inner
        a = rot + i * math.pi / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def in_poly(px, py, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and \
           (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi):
            inside = not inside
        j = i
    return inside

def render(size, rounded, star_scale):
    S = size * SS
    radius = (S * 0.22) if rounded else 0
    star = star_points(S/2, S/2 + S*0.01, S*0.40*star_scale, S*0.165*star_scale)
    shadow = star_points(S/2, S/2 + S*0.045, S*0.40*star_scale, S*0.165*star_scale)
    buf = bytearray(S * S * 4)
    for y in range(S):
        t = y / (S - 1)
        base = lerp(TOP, BOT, t)
        row = y * S * 4
        for x in range(S):
            o = row + x * 4
            cov = rounded_alpha(x, y, S, S, radius)
            if cov <= 0:
                continue  # transparent corner
            r, g, b = base
            a = 255
            if in_poly(x, y, shadow):
                r = int(r * 0.55); g = int(g * 0.45); b = int(b * 0.45)
            if in_poly(x, y, star):
                r = g = b = 255
            buf[o] = r; buf[o+1] = g; buf[o+2] = b; buf[o+3] = a
    return downscale(buf, S, size)

def downscale(buf, S, size):
    out = bytearray(size * size * 4)
    f = SS
    for oy in range(size):
        for ox in range(size):
            ar = ag = ab = aa = 0
            for dy in range(f):
                sy = oy * f + dy
                base = (sy * S + ox * f) * 4
                for dx in range(f):
                    o = base + dx * 4
                    a = buf[o+3]
                    ar += buf[o] * a; ag += buf[o+1] * a; ab += buf[o+2] * a; aa += a
            n = f * f
            alpha = aa // n
            if aa == 0:
                r = g = b = 0
            else:
                r = ar // aa; g = ag // aa; b = ab // aa
            i = (oy * size + ox) * 4
            out[i] = r; out[i+1] = g; out[i+2] = b; out[i+3] = alpha
    return out

def write_png(path, rgba, size):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        raw += rgba[y*size*4:(y+1)*size*4]
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    jobs = [
        ("icon-512.png", 512, True, 1.0),
        ("icon-192.png", 192, True, 1.0),
        ("icon-180.png", 180, False, 1.0),          # Apple touch: opaque full square
        ("icon-maskable-512.png", 512, False, 0.7),  # maskable: smaller star in safe zone
    ]
    for name, size, rounded, sc in jobs:
        rgba = render(size, rounded, sc)
        write_png(os.path.join(here, name), rgba, size)
        print("wrote", name)

if __name__ == "__main__":
    main()
