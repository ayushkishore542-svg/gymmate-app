"""
Generates PWA PNG icons for GymMate using only Python stdlib (no Pillow needed).
Run: python3 scripts/generate-icons.py
Creates: frontend/public/icons/icon-{192,512}.png  +  icon-maskable-*.png
"""

import os
import struct
import zlib

THEME  = (0x00, 0xBF, 0xA5)   # #00BFA5 teal
WHITE  = (0xFF, 0xFF, 0xFF)
DARK   = (0x00, 0x80, 0x70)   # darker teal for depth
TRANSPARENT = (0xFF, 0xFF, 0xFF, 0x00)


# ─── PNG helpers ────────────────────────────────────────────────────────────

def chunk(tag: bytes, data: bytes) -> bytes:
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

def encode_png(pixels: list[list[tuple]], width: int, height: int) -> bytes:
    """Encode an RGBA pixel grid to PNG bytes."""
    raw = b''
    for row in pixels:
        raw += b'\x00'  # filter type: None
        for px in row:
            raw += bytes(px)
    compressed = zlib.compress(raw, 9)
    sig   = b'\x89PNG\r\n\x1a\n'
    ihdr  = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    idat  = chunk(b'IDAT', compressed)
    iend  = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


# ─── Drawing helpers ─────────────────────────────────────────────────────────

def in_circle(cx, cy, r, x, y) -> bool:
    return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2

def blend(fg, alpha, bg):
    """Alpha-blend fg (RGB) at alpha [0-255] over bg (RGB)."""
    a = alpha / 255
    return tuple(int(fg[i] * a + bg[i] * (1 - a)) for i in range(3))

def aa_circle_alpha(cx, cy, r, x, y, sub=4) -> float:
    """Super-sample a pixel for antialiased circle coverage."""
    hits = 0
    step = 1 / sub
    for dx_i in range(sub):
        for dy_i in range(sub):
            sx = x + (dx_i + 0.5) * step - 0.5
            sy = y + (dy_i + 0.5) * step - 0.5
            if (sx - cx) ** 2 + (sy - cy) ** 2 <= r ** 2:
                hits += 1
    return hits / (sub * sub)


def draw_icon(size: int, maskable: bool = False) -> bytes:
    """
    Layout:
      - White square background
      - Teal circle (with padding if maskable)
      - White dumbbell (two discs + bar)
      - White 'GM' text below
    """
    pixels = [[(255, 255, 255, 255)] * size for _ in range(size)]

    pad   = int(size * 0.12) if maskable else 0
    cx    = size / 2
    cy    = size / 2
    r     = (size - pad * 2) / 2         # circle radius
    u     = size / 16                    # base unit

    # ── teal circle background ─────────────────────────────────────
    for y in range(size):
        for x in range(size):
            alpha = aa_circle_alpha(cx, cy, r, x, y)
            if alpha > 0:
                rgb = blend(THEME, int(alpha * 255), WHITE)
                pixels[y][x] = rgb + (255,)

    # ── dumbbell bar ───────────────────────────────────────────────
    bar_h  = max(2, int(u * 1.1))
    bar_x0 = int(cx - u * 3.5)
    bar_x1 = int(cx + u * 3.5)
    bar_y0 = int(cy - bar_h / 2)
    bar_y1 = bar_y0 + bar_h

    def in_teal(x, y):
        return aa_circle_alpha(cx, cy, r, x, y) > 0

    def draw_white_circle(dcx, dcy, dr):
        for y in range(max(0, int(dcy - dr) - 2), min(size, int(dcy + dr) + 2)):
            for x in range(max(0, int(dcx - dr) - 2), min(size, int(dcx + dr) + 2)):
                alpha = aa_circle_alpha(dcx, dcy, dr, x, y)
                if alpha > 0:
                    base = pixels[y][x][:3]
                    rgb = blend(WHITE, int(alpha * 255), base)
                    pixels[y][x] = rgb + (255,)

    def draw_white_rect(x0, y0, x1, y1):
        for y in range(max(0, y0), min(size, y1)):
            for x in range(max(0, x0), min(size, x1)):
                if in_teal(x, y):
                    pixels[y][x] = WHITE + (255,)

    # bar
    draw_white_rect(bar_x0, bar_y0, bar_x1, bar_y1)

    # left & right discs (outer white, inner teal cutout)
    disc_r_outer = u * 1.9
    disc_r_inner = u * 1.1
    disc_lx = cx - u * 4.3
    disc_rx = cx + u * 4.3
    disc_y  = cy

    draw_white_circle(disc_lx, disc_y, disc_r_outer)
    draw_white_circle(disc_rx, disc_y, disc_r_outer)

    # teal cutout in the centre of each disc
    def draw_teal_circle(dcx, dcy, dr):
        for y in range(max(0, int(dcy - dr) - 2), min(size, int(dcy + dr) + 2)):
            for x in range(max(0, int(dcx - dr) - 2), min(size, int(dcx + dr) + 2)):
                alpha = aa_circle_alpha(dcx, dcy, dr, x, y)
                if alpha > 0:
                    base = pixels[y][x][:3]
                    rgb = blend(THEME, int(alpha * 255), base)
                    pixels[y][x] = rgb + (255,)

    draw_teal_circle(disc_lx, disc_y, disc_r_inner)
    draw_teal_circle(disc_rx, disc_y, disc_r_inner)

    # ── 'GM' text below dumbbell (pixel font bitmaps) ──────────────
    # Render 'G' and 'M' using small bitmaps scaled to the icon size.
    # Each letter is defined on a 5×7 grid.
    G_BITMAP = [
        "011110",
        "100001",
        "100000",
        "100111",
        "100001",
        "100001",
        "011110",
    ]
    M_BITMAP = [
        "100001",
        "110011",
        "101101",
        "100001",
        "100001",
        "100001",
        "100001",
    ]

    def draw_bitmap(bitmap, top_left_x, top_left_y, cell):
        for row_i, row in enumerate(bitmap):
            for col_i, ch in enumerate(row):
                if ch == '1':
                    px0 = int(top_left_x + col_i * cell)
                    py0 = int(top_left_y + row_i * cell)
                    draw_white_rect(px0, py0, px0 + max(1, int(cell)), py0 + max(1, int(cell)))

    cell   = u * 0.55          # pixel cell size
    cols_g = len(G_BITMAP[0])  # 6
    cols_m = len(M_BITMAP[0])  # 6
    gap    = cell * 1.0        # gap between letters

    total_w = (cols_g + cols_m) * cell + gap
    text_x0 = cx - total_w / 2
    text_y0 = cy + u * 2.8

    draw_bitmap(G_BITMAP, text_x0, text_y0, cell)
    draw_bitmap(M_BITMAP, text_x0 + cols_g * cell + gap, text_y0, cell)

    return encode_png(pixels, size, size)


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir    = os.path.join(script_dir, '..', 'public', 'icons')
    os.makedirs(out_dir, exist_ok=True)

    configs = [
        ('icon-192.png',          192, False),
        ('icon-512.png',          512, False),
        ('icon-maskable-192.png', 192, True),
        ('icon-maskable-512.png', 512, True),
    ]

    for filename, size, maskable in configs:
        png = draw_icon(size, maskable)
        out = os.path.join(out_dir, filename)
        with open(out, 'wb') as f:
            f.write(png)
        print(f'✅  {filename}  ({size}×{size}, {"maskable" if maskable else "standard"})')

    print('\nAll icons written to frontend/public/icons/')
