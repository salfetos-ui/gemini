"""Fast, vectorized painterly atmosphere, volumetric sunbeams, pie steam, aroma ribbons, halos, and 1080p camera."""

import math
import cv2
import numpy as np


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge1 <= edge0:
        return 1.0 if x >= edge1 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


_MOTE_PARAMS_CACHE: dict[tuple[int, int, float], tuple] = {}
_GRID_QUARTER_CACHE: dict[tuple[int, int], tuple[np.ndarray, np.ndarray]] = {}
_VIGNETTE_MUL_CACHE: dict[tuple[int, int, int], tuple[np.ndarray, np.ndarray]] = {}


def _get_quarter_grid(w: int, h: int) -> tuple[np.ndarray, np.ndarray]:
    key = (w, h)
    if key not in _GRID_QUARTER_CACHE:
        sw, sh = w // 4, h // 4
        yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
        _GRID_QUARTER_CACHE[key] = (xx, yy)
    return _GRID_QUARTER_CACHE[key]


def _screen_add_half(img: np.ndarray, glow_small_bgr_u8: np.ndarray) -> None:
    """Fast SIMD screen-like additive blend from small/half-res uint8 glow onto full-res BGR image (in-place)."""
    h, w = img.shape[:2]
    glow = cv2.resize(glow_small_bgr_u8, (w, h), interpolation=cv2.INTER_LINEAR)
    # Screen approximation in fast uint8 SIMD: img + glow * (1 - img/255) -> cv2.add with softly attenuated glow
    inv = cv2.subtract(255, img)
    scaled = cv2.multiply(glow, inv, scale=1.0 / 255.0)
    cv2.add(img, scaled, dst=img)


def add_volumetric_sunbeams(
    img: np.ndarray,
    origin: list[float],
    t: float,
    intensity: float = 0.20,
    angle_deg: float = 34.0,
) -> None:
    """Fast breathing golden volumetric sunbeams radiating from the painted window (in-place)."""
    if intensity <= 0.01:
        return
    h, w = img.shape[:2]
    sw, sh = w // 4, h // 4
    ox, oy = origin[0] / 4.0, origin[1] / 4.0

    xx, yy = _get_quarter_grid(w, h)
    dx = xx - ox
    dy = yy - oy
    rad = math.radians(angle_deg)
    ca, sa = math.cos(rad), math.sin(rad)

    along = dx * ca + dy * sa
    perp = -dx * sa + dy * ca

    dist_fade = np.clip(along / 40.0, 0.0, 1.0) * np.exp(-np.maximum(0.0, along) / (sw * 0.72))
    shafts = (
        0.55 * np.exp(-0.5 * ((perp + 28.0 + 4.0 * math.sin(t * 0.45)) / 24.0) ** 2)
        + 0.70 * np.exp(-0.5 * ((perp - 8.0 + 3.0 * math.cos(t * 0.38)) / 32.0) ** 2)
        + 0.45 * np.exp(-0.5 * ((perp - 58.0 + 5.0 * math.sin(t * 0.52 + 1.1)) / 28.0) ** 2)
    )
    pulse = 0.86 + 0.14 * math.sin(t * 0.75)
    beam = np.clip(dist_fade * shafts * intensity * pulse, 0.0, 0.45)

    warm = np.array([185.0, 232.0, 255.0], dtype=np.float32)
    glow_small = np.clip(beam[..., None] * warm, 0, 255).astype(np.uint8)
    _screen_add_half(img, glow_small)


def add_oven_glow(img: np.ndarray, bbox: list[float], t: float, intensity: float = 0.36) -> None:
    """Warm flickering amber hearth glow inside the baking oven (ROI-only, in-place)."""
    x0, y0, x1, y1 = bbox
    cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
    rx, ry = max(25.0, (x1 - x0) * 0.95), max(25.0, (y1 - y0) * 0.95)

    h, w = img.shape[:2]
    ix0, ix1 = max(0, int(cx - rx * 2.2)), min(w, int(cx + rx * 2.2))
    iy0, iy1 = max(0, int(cy - ry * 2.2)), min(h, int(cy + ry * 2.2))
    if ix1 <= ix0 or iy1 <= iy0:
        return

    flicker = 0.78 + 0.14 * math.sin(t * 5.2) + 0.08 * math.sin(t * 11.7 + 0.9)
    yy, xx = np.mgrid[iy0:iy1, ix0:ix1].astype(np.float32)
    g = np.exp(-0.5 * (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * (intensity * flicker)
    amber = np.array([65.0, 175.0, 255.0], dtype=np.float32)
    glow_u8 = np.clip(g[..., None] * amber, 0, 255).astype(np.uint8)
    roi = img[iy0:iy1, ix0:ix1]
    inv = cv2.subtract(255, roi)
    cv2.add(roi, cv2.multiply(glow_u8, inv, scale=1.0 / 255.0), dst=roi)


def add_dove_halo(
    img: np.ndarray,
    center: list[float],
    t: float,
    energy: float = 0.0,
    intensity: float = 0.42,
    radius: float = 240.0,
) -> None:
    """Pulsing golden-and-sky-blue radiant celestial halo behind the White Dove (fast 1/4-res -> SIMD screen)."""
    h, w = img.shape[:2]
    cx, cy = center[0] / 4.0, center[1] / 4.0
    rad = radius / 4.0

    xx, yy = _get_quarter_grid(w, h)
    dx = xx - cx
    dy = yy - cy
    dist = np.sqrt(dx * dx + dy * dy) + 1e-6
    ang = np.arctan2(dy, dx)

    pulse = 0.85 + 0.15 * math.sin(t * 2.1) + 0.25 * float(energy)
    rays = 0.75 + 0.25 * np.sin(ang * 10.0 + t * 0.45) * np.sin(ang * 6.0 - t * 0.30)

    inner_gold = np.exp(-0.5 * (dist / (rad * 0.58)) ** 2) * rays * (intensity * 0.85 * pulse)
    outer_sky = np.exp(-0.5 * ((dist - rad * 0.45) / (rad * 0.65)) ** 2) * (intensity * 0.55 * pulse)

    gold_bgr = np.array([165.0, 226.0, 255.0], dtype=np.float32)
    sky_bgr = np.array([255.0, 224.0, 155.0], dtype=np.float32)

    glow_small = np.clip(inner_gold[..., None] * gold_bgr + outer_sky[..., None] * sky_bgr, 0, 255).astype(np.uint8)
    _screen_add_half(img, glow_small)


def add_pie_steam(
    img: np.ndarray,
    x_range: list[float],
    base_y: float,
    t: float,
    n_wisps: int = 6,
    height: float = 190.0,
    intensity: float = 0.52,
) -> None:
    """6 organic multi-layered curling watercolor steam wisps rendered cleanly at half-res (in-place)."""
    if intensity <= 0.01:
        return
    h, w = img.shape[:2]
    hw, hh = w // 2, h // 2
    layer = np.zeros((hh, hw), dtype=np.float32)

    x0, x1 = float(x_range[0]) * 0.5, float(x_range[1]) * 0.5
    by_h = base_y * 0.5
    h_h = height * 0.5

    for i in range(n_wisps):
        u_base = (i + 0.5) / n_wisps
        sx_start = x0 + u_base * (x1 - x0)
        speed = 0.34 + 0.06 * (i % 3)
        phase = i * 1.37
        cycle = (t * speed + i / n_wisps) % 1.0

        for sub in (0.0, 0.5):
            c = (cycle + sub) % 1.0
            life_alpha = math.sin(c * math.pi) ** 0.85
            if life_alpha < 0.03:
                continue

            pts = []
            seg_len = h_h * 0.62
            y_bot = by_h - c * (h_h * 0.55)
            for k in range(12):
                s = k / 11.0
                py = y_bot - s * seg_len
                curl = (
                    math.sin(s * 5.2 - t * 2.1 + phase + sub * 3.1) * (5.0 + 8.0 * s)
                    + math.cos(s * 2.8 + t * 1.1 + phase) * 3.0
                )
                px = sx_start + curl + (c * 7.0 - 3.5)
                pts.append((int(round(px)), int(round(py))))

            for k in range(len(pts) - 1):
                s = k / (len(pts) - 1)
                w_seg = math.sin(s * math.pi) * life_alpha
                th = max(2, int(round(3 + 4.5 * s)))
                val = float(intensity * 0.50 * w_seg)
                cv2.line(layer, pts[k], pts[k + 1], val, th, cv2.LINE_AA)

    layer = np.clip(cv2.GaussianBlur(layer, (0, 0), sigmaX=3.8, sigmaY=3.8), 0.0, 0.72)
    steam_bgr = np.array([232.0, 244.0, 255.0], dtype=np.float32)
    glow_small = np.clip(layer[..., None] * steam_bgr * 0.92, 0, 255).astype(np.uint8)
    _screen_add_half(img, glow_small)


def add_aroma_ribbons(img: np.ndarray, path_pts: list[list[float]], t: float, intensity: float = 0.52) -> None:
    """Translucent rosy-gold painterly raspberry aroma ribbons rendered fast at half-res (in-place)."""
    h, w = img.shape[:2]
    hw, hh = w // 2, h // 2
    layer_rose = np.zeros((hh, hw), dtype=np.float32)
    layer_gold = np.zeros((hh, hw), dtype=np.float32)

    pts_arr = np.array(path_pts, dtype=np.float32) * 0.5
    ts_in = np.linspace(0.0, 1.0, len(pts_arr))
    n_samples = 34
    ts_out = np.linspace(0.0, 1.0, n_samples)
    bx = np.interp(ts_out, ts_in, pts_arr[:, 0])
    by = np.interp(ts_out, ts_in, pts_arr[:, 1])

    for r_idx in range(3):
        phase = r_idx * 2.1
        off_y = (r_idx - 1) * 10.0
        target = layer_rose if r_idx != 1 else layer_gold
        ribbon_pts = []
        for k in range(n_samples):
            u = k / (n_samples - 1)
            wave = math.sin(u * 9.0 - t * 3.4 + phase) * (7.0 + 5.0 * math.sin(u * math.pi))
            wave_x = math.cos(u * 6.0 - t * 2.6 + phase) * 4.0
            ribbon_pts.append((int(round(bx[k] + wave_x)), int(round(by[k] + off_y + wave))))

        for k in range(n_samples - 1):
            u = k / (n_samples - 1)
            travel = 0.55 + 0.45 * math.sin(u * 6.5 - t * 3.8 + phase)
            fade_ends = math.sin(u * math.pi) ** 0.75
            th = max(2, int(round(3 + 3 * math.sin(u * math.pi))))
            cv2.line(target, ribbon_pts[k], ribbon_pts[k + 1], float(intensity * 0.46 * travel * fade_ends), th, cv2.LINE_AA)

    layer_rose = np.clip(cv2.GaussianBlur(layer_rose, (0, 0), sigmaX=3.5, sigmaY=3.5), 0.0, 0.65)
    layer_gold = np.clip(cv2.GaussianBlur(layer_gold, (0, 0), sigmaX=3.2, sigmaY=3.2), 0.0, 0.65)

    rose_bgr = np.array([185.0, 178.0, 255.0], dtype=np.float32)
    gold_bgr = np.array([165.0, 224.0, 255.0], dtype=np.float32)
    glow_small = np.clip(layer_rose[..., None] * rose_bgr + layer_gold[..., None] * gold_bgr, 0, 255).astype(np.uint8)
    _screen_add_half(img, glow_small)


def add_light_motes(
    img: np.ndarray,
    t: float,
    seed: int = 42,
    count: int = 34,
    sky_blue_ratio: float = 0.25,
    region: list[float] | None = None,
    intensity: float = 0.85,
) -> None:
    """Luminous floating golden & sky-blue fairytale dust motes rendered cleanly at half-res (in-place)."""
    if intensity <= 0.01 or count <= 0:
        return
    h, w = img.shape[:2]
    hw, hh = w // 2, h // 2

    key = (seed, count, round(sky_blue_ratio, 2))
    if key not in _MOTE_PARAMS_CACHE:
        rng = np.random.RandomState(seed)
        _MOTE_PARAMS_CACHE[key] = (
            rng.uniform(0.0, 1.0, count),
            rng.uniform(0.0, 1.0, count),
            rng.uniform(-5.0, 7.0, count),
            rng.uniform(-7.0, -2.0, count),
            rng.uniform(1.1, 2.4, count),
            rng.uniform(0.0, math.tau, count),
            rng.uniform(1.2, 3.0, count),
            rng.uniform(0.0, 1.0, count) < sky_blue_ratio,
        )
    x_init, y_init, vx, vy, sizes, phases, freqs, is_blue = _MOTE_PARAMS_CACHE[key]

    if region is None:
        rx0, ry0, rx1, ry1 = 20.0, 15.0, float(hw - 20), float(hh - 20)
    else:
        rx0, ry0, rx1, ry1 = [float(v) * 0.5 for v in region]
    rw, rh = max(10.0, rx1 - rx0), max(10.0, ry1 - ry0)

    overlay = np.zeros((hh, hw, 3), dtype=np.uint8)
    for i in range(count):
        px = rx0 + ((x_init[i] * rw + vx[i] * t + 7.0 * math.sin(t * 0.7 + phases[i])) % rw)
        py = ry0 + ((y_init[i] * rh + vy[i] * t + 4.0 * math.cos(t * 0.6 + phases[i])) % rh)
        twinkle = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * freqs[i] + phases[i]))
        amp = intensity * twinkle

        col = (255.0, 224.0, 145.0) if is_blue[i] else (160.0, 230.0, 255.0)
        r_core = max(1, int(round(sizes[i])))
        r_halo = max(2, int(round(sizes[i] * 2.8)))
        ix, iy = int(round(px)), int(round(py))

        cv2.circle(overlay, (ix, iy), r_halo, tuple(int(min(255, c * amp * 0.28)) for c in col), -1, cv2.LINE_AA)
        cv2.circle(overlay, (ix, iy), r_core, tuple(int(min(255, c * amp * 0.85)) for c in col), -1, cv2.LINE_AA)

    overlay = cv2.GaussianBlur(overlay, (0, 0), sigmaX=1.0, sigmaY=1.0)
    _screen_add_half(img, overlay)


def add_gaze_bridge_motes(
    img: np.ndarray,
    pt_a: list[float],
    pt_b: list[float],
    t: float,
    intensity: float = 0.95,
) -> None:
    """Tender golden & sky-blue motes drifting gently along the mutual gaze sunbeam (half-res, in-place)."""
    if intensity <= 0.01:
        return
    h, w = img.shape[:2]
    hw, hh = w // 2, h // 2
    ax, ay = float(pt_a[0]) * 0.5, float(pt_a[1]) * 0.5
    bx, by = float(pt_b[0]) * 0.5, float(pt_b[1]) * 0.5

    key = (1010, 24, 0.5)
    if key not in _MOTE_PARAMS_CACHE:
        rng = np.random.RandomState(1010)
        _MOTE_PARAMS_CACHE[key] = (
            rng.uniform(0.06, 0.94, 24),
            rng.uniform(-26.0, 26.0, 24),
            np.array([rng.uniform(0.03, 0.07) * (1.0 if i % 2 == 0 else -1.0) for i in range(24)]),
            rng.uniform(0.0, math.tau, 24),
            rng.uniform(1.1, 2.5, 24),
        )
    u0s, spreads, speeds, phases, sizes = _MOTE_PARAMS_CACHE[key]

    overlay = np.zeros((hh, hw, 3), dtype=np.uint8)
    for i in range(24):
        u = (u0s[i] + speeds[i] * t) % 1.0
        edge_fade = math.sin(u * math.pi) ** 0.7
        twinkle = 0.45 + 0.55 * (0.5 + 0.5 * math.sin(t * 2.2 + phases[i]))
        amp = intensity * edge_fade * twinkle

        px = ax + u * (bx - ax)
        py = ay + u * (by - ay) + spreads[i] + 6.0 * math.sin(t * 0.9 + phases[i])
        col = (255.0, 228.0, 148.0) if (i % 2 == 0) else (162.0, 232.0, 255.0)
        ix, iy = int(round(px)), int(round(py))
        cv2.circle(overlay, (ix, iy), max(2, int(round(sizes[i] * 3.0))), tuple(int(min(255, c * amp * 0.28)) for c in col), -1, cv2.LINE_AA)
        cv2.circle(overlay, (ix, iy), max(1, int(round(sizes[i]))), tuple(int(min(255, c * amp * 0.88)) for c in col), -1, cv2.LINE_AA)

    overlay = cv2.GaussianBlur(overlay, (0, 0), sigmaX=1.1, sigmaY=1.1)
    _screen_add_half(img, overlay)


def apply_warm_vignette(img_1080p: np.ndarray, strength: float = 0.12) -> np.ndarray:
    """Ultra-fast cached uint8 SIMD warm storybook vignette on 1920x1080 frame."""
    if strength <= 0.005:
        return img_1080p
    h, w = img_1080p.shape[:2]
    key = (w, h, int(round(strength * 1000)))
    if key not in _VIGNETTE_MUL_CACHE:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        nx = (xx / (w - 1) - 0.5) * 2.0
        ny = (yy / (h - 1) - 0.5) * 2.0
        r2 = nx * nx + ny * ny
        vig = (np.clip((r2 - 0.65) / 1.35, 0.0, 1.0) ** 1.5) * strength
        # Precompute uint8 multiplier (1 - vig) and additive warm sepia bias (tint * vig)
        mul_u8 = np.clip((1.0 - vig) * 255.0, 0, 255).astype(np.uint8)
        mul_3 = np.repeat(mul_u8[..., None], 3, axis=2)
        tint = np.array([38.0, 56.0, 82.0], dtype=np.float32)
        add_3 = np.clip(vig[..., None] * tint, 0, 255).astype(np.uint8)
        _VIGNETTE_MUL_CACHE[key] = (mul_3, add_3)

    mul_3, add_3 = _VIGNETTE_MUL_CACHE[key]
    out = cv2.multiply(img_1080p, mul_3, scale=1.0 / 255.0)
    cv2.add(out, add_3, dst=out)
    return out


def apply_camera(
    img: np.ndarray,
    zoom: float = 1.0,
    cx_norm: float = 0.5,
    cy_norm: float = 0.5,
    out_w: int = 1920,
    out_h: int = 1080,
    vignette: float = 0.12,
) -> np.ndarray:
    """Smooth sub-pixel 16:9 camera crop & crisp 1080p upscale, strictly clamped inside painting."""
    h, w = img.shape[:2]
    target_ar = out_w / out_h
    if w / h >= target_ar:
        max_h = float(h)
        max_w = max_h * target_ar
    else:
        max_w = float(w)
        max_h = max_w / target_ar

    zoom = max(1.0, float(zoom))
    cw = max_w / zoom
    ch = max_h / zoom

    cx = float(cx_norm) * w
    cy = float(cy_norm) * h
    x0 = max(0.0, min(w - cw, cx - cw * 0.5))
    y0 = max(0.0, min(h - ch, cy - ch * 0.5))

    sx = out_w / cw
    sy = out_h / ch
    M = np.array([[sx, 0.0, -x0 * sx], [0.0, sy, -y0 * sy]], dtype=np.float32)
    frame = cv2.warpAffine(img, M, (out_w, out_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    if vignette > 0.005:
        frame = apply_warm_vignette(frame, vignette)
    return frame


def blend_rgba_overlay(base_bgr: np.ndarray, overlay_bgra: np.ndarray, opacity: float = 1.0) -> np.ndarray:
    """Fast SIMD uint8 alpha-composite of a BGRA overlay (like title_opening.png) over a BGR frame."""
    if opacity <= 0.005:
        return base_bgr
    a_u8 = overlay_bgra[..., 3] if opacity >= 0.995 else cv2.convertScaleAbs(overlay_bgra[..., 3], alpha=float(opacity))
    a3 = cv2.merge([a_u8, a_u8, a_u8])
    inv_a3 = cv2.subtract(255, a3)
    bg_p = cv2.multiply(base_bgr, inv_a3, scale=1.0 / 255.0)
    fg_p = cv2.multiply(overlay_bgra[..., :3], a3, scale=1.0 / 255.0)
    return cv2.add(bg_p, fg_p)
