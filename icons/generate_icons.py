#!/usr/bin/env python3
"""Generate JellyView jellyfish icon PNGs at multiple sizes."""

import math
from PIL import Image, ImageDraw


def lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def create_icon(size):
    BG = (15, 23, 42)
    VIOLET = (139, 92, 246)
    INDIGO = (99, 102, 241)
    INDIGO_DK = (67, 56, 202)
    CYAN = (34, 211, 238)
    TEAL = (8, 145, 178)
    DOT = (103, 232, 249)
    WHITE = (255, 255, 255)
    LAVENDER = (196, 181, 253)

    s = size / 512.0
    img = Image.new('RGBA', (size, size), (*BG, 255))
    draw = ImageDraw.Draw(img)

    cx = size // 2
    base_y = int(290 * s)

    # === Bell dome ===
    bell_w = int(125 * s)
    bell_h = int(165 * s)
    dome_cy = base_y - bell_h // 2

    # Full dome ellipse (bell shape)
    draw.ellipse(
        [(cx - bell_w, dome_cy - bell_h // 2),
         (cx + bell_w, dome_cy + bell_h // 2)],
        fill=INDIGO
    )

    # Gradient overlay on dome (top lighter, bottom darker)
    for i in range(bell_h):
        t = i / max(1, bell_h)
        if t < 0.5:
            color = lerp_color(VIOLET, INDIGO, t * 2)
        else:
            color = lerp_color(INDIGO, INDIGO_DK, (t - 0.5) * 2)

        row_y = dome_cy - bell_h // 2 + i
        # Calculate ellipse width at this row
        dy = (row_y - dome_cy) / max(1, bell_h // 2)
        if abs(dy) > 1:
            continue
        dx = math.sqrt(max(0, 1 - dy * dy))
        row_w = int(bell_w * dx)
        if row_w > 0:
            draw.line([(cx - row_w, row_y), (cx + row_w, row_y)], fill=color)

    # === Inner highlight ===
    hi_w = int(65 * s)
    hi_h = int(70 * s)
    hi_cy = dome_cy - int(15 * s)
    draw.ellipse(
        [(cx - hi_w, hi_cy - hi_h), (cx + hi_w, hi_cy + int(hi_h * 0.3))],
        fill=LAVENDER
    )

    # Fade inner highlight into dome
    for i in range(int(hi_h * 1.3)):
        row_y = hi_cy - hi_h + i
        t = i / max(1, hi_h * 1.3)
        if t < 0.3:
            continue
        fade = min(1.0, (t - 0.3) / 0.7)
        color = lerp_color(LAVENDER, INDIGO, fade)
        dy_norm = (row_y - hi_cy) / max(1, hi_h)
        if abs(dy_norm) > 1:
            continue
        dx_norm = math.sqrt(max(0, 1 - dy_norm * dy_norm))
        # Compressed vertically
        row_w = int(hi_w * dx_norm)
        if row_w > 0:
            # Check if within bell
            bell_dy = (row_y - dome_cy) / max(1, bell_h // 2)
            if abs(bell_dy) <= 1:
                bell_dx = math.sqrt(max(0, 1 - bell_dy * bell_dy))
                bell_row_w = int(bell_w * bell_dx)
                if row_w <= bell_row_w:
                    draw.line([(cx - row_w, row_y), (cx + row_w, row_y)], fill=color)

    # === Rim (flat bottom of bell) ===
    rim_y = dome_cy + bell_h // 2
    rim_h = max(3, int(14 * s))
    draw.rectangle(
        [(cx - bell_w, rim_y), (cx + bell_w, rim_y + rim_h)],
        fill=INDIGO_DK
    )
    # Cyan rim highlight
    draw.line(
        [(cx - bell_w + int(8 * s), rim_y),
         (cx + bell_w - int(8 * s), rim_y)],
        fill=CYAN, width=max(2, int(3 * s))
    )

    # === Eyes ===
    if size >= 64:
        eye_r = max(2, int(7 * s))
        eye_y = dome_cy - int(15 * s)
        lx = cx - int(22 * s)
        rx_pos = cx + int(22 * s)

        draw.ellipse([(lx - eye_r, eye_y - eye_r), (lx + eye_r, eye_y + eye_r)],
                     fill=WHITE)
        draw.ellipse([(rx_pos - eye_r, eye_y - eye_r), (rx_pos + eye_r, eye_y + eye_r)],
                     fill=WHITE)

        pupil_r = max(1, int(3.5 * s))
        draw.ellipse([(lx - pupil_r, eye_y - pupil_r), (lx + pupil_r, eye_y + pupil_r)],
                     fill=INDIGO_DK)
        draw.ellipse([(rx_pos - pupil_r, eye_y - pupil_r), (rx_pos + pupil_r, eye_y + pupil_r)],
                     fill=INDIGO_DK)

    # === Oral arms / tentacles ===
    tent_top = rim_y + rim_h

    tent_specs = [
        (-80, 5, INDIGO, 1.0),
        (-45, 4, TEAL, 0.8),
        (-15, 3, TEAL, 0.6),
        (0, 6, INDIGO, 1.0),
        (15, 3, TEAL, 0.6),
        (45, 4, TEAL, 0.8),
        (80, 5, INDIGO, 1.0),
    ]

    for x_off, thickness, color, length_mod in tent_specs:
        tent_len = int(175 * s * length_mod)
        wave_amp = int(14 * s * length_mod)
        num_segs = max(8, int(30 * s))
        seg_h = tent_len / num_segs

        points = []
        for seg in range(num_segs + 1):
            t = seg / num_segs
            wave = wave_amp * math.sin(t * math.pi * 2.5)
            px = cx + int((x_off + wave) * s)
            py = int(tent_top + seg * seg_h)
            points.append((px, py))

        for i in range(len(points) - 1):
            t = i / max(1, len(points) - 1)
            fade_color = lerp_color(color, TEAL, t * 0.5)
            line_w = max(1, int(thickness * s * (1 - t * 0.4)))
            draw.line([points[i], points[i + 1]], fill=fade_color, width=line_w)

    # === Bioluminescent dots ===
    if size >= 32:
        dot_specs = [
            (-75, 55, 3.5),
            (-42, 90, 2.5),
            (-12, 45, 2),
            (0, 75, 3),
            (12, 45, 2),
            (42, 90, 2.5),
            (75, 55, 3.5),
            (-55, 130, 2),
            (0, 120, 2.5),
            (55, 130, 2),
        ]
        for dx, dy, dr in dot_specs:
            dot_x = cx + int(dx * s)
            dot_y = tent_top + int(dy * s)
            dot_r = max(1, int(dr * s))
            draw.ellipse([(dot_x - dot_r, dot_y - dot_r),
                          (dot_x + dot_r, dot_y + dot_r)],
                         fill=DOT)

    return img


def main():
    sizes = [512, 256, 128, 64, 32]
    icons_dir = '/home/greedy/devops/jellyview/icons'

    for size in sizes:
        print(f'Generating {size}x{size} icon...')
        img = create_icon(size)
        filepath = f'{icons_dir}/jellyview-{size}x{size}.png'
        img.save(filepath, 'PNG')
        print(f'  Saved: {filepath}')

    print('\nAll icons generated!')


if __name__ == '__main__':
    main()