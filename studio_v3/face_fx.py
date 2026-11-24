"""Native Live2D painterly eye-blinking, 30fps audio-driven lip-sync, and White Dove beak articulation."""

import math
import cv2
import numpy as np


def compute_blink_amount(
    t: float,
    blink_times: list[float],
    close_dur: float = 0.075,
    hold_dur: float = 0.025,
    open_dur: float = 0.115,
) -> float:
    """Return smooth natural asymmetric blink amount in [0.0, 1.0]."""
    peak = 0.0
    total = close_dur + hold_dur + open_dur
    for bt in blink_times:
        dt = t - bt
        if 0.0 <= dt <= total:
            if dt < close_dur:
                u = dt / close_dur
                val = u * u  # crisp fast eyelid drop
            elif dt < close_dur + hold_dur:
                val = 1.0
            else:
                u = (dt - close_dur - hold_dur) / open_dur
                val = 1.0 - (1.0 - (1.0 - u) ** 3)
            if val > peak:
                peak = val
    return float(np.clip(peak, 0.0, 1.0))


def _sample_eyelid_colors(img: np.ndarray, cx: int, cy: int, rx: int, ry: int, kind: str):
    """Sample clean local watercolor eyelid skin/feather color avoiding dark eyebrows."""
    h, w = img.shape[:2]
    # Sample upper-cheek right BELOW the lower eye margin + inner/outer temple (never hits eyebrows!)
    y0_b = min(h - 2, int(cy + ry * 1.15))
    y1_b = min(h, max(y0_b + 3, int(cy + ry * 1.85)))
    x0_b = max(0, int(cx - rx * 0.85))
    x1_b = min(w, max(x0_b + 3, int(cx + rx * 0.85)))
    patch_below = img[y0_b:y1_b, x0_b:x1_b]

    # Also sample narrow band right above upper lash (taking only top 82nd percentile bright pixels)
    y0_t = max(0, int(cy - ry * 1.45))
    y1_t = max(y0_t + 2, int(cy - ry * 1.05))
    patch_above = img[y0_t:y1_t, x0_b:x1_b]

    samples = []
    if patch_below.size > 0:
        samples.append(patch_below.reshape(-1, 3).astype(np.float32))
    if patch_above.size > 0:
        samples.append(patch_above.reshape(-1, 3).astype(np.float32))

    if not samples:
        skin = np.array([185, 206, 238], dtype=np.float32) if "dove" not in kind else np.array([224, 226, 230], dtype=np.float32)
    else:
        flat = np.vstack(samples)
        luma = flat @ np.array([0.114, 0.587, 0.299], dtype=np.float32)
        if "dove" in kind:
            # 50th-percentile local median of surrounding watercolor feathers (avoids flat bright-white sticker!)
            skin = np.median(flat, axis=0)
        else:
            # Take brightest 35% of pixels -> strictly warm watercolor skin, NEVER dark brow/lash!
            thr = np.percentile(luma, 65)
            bright = flat[luma >= thr]
            skin = np.median(bright, axis=0) if len(bright) > 0 else np.median(flat, axis=0)

    if "dove" in kind:
        lid_col = np.clip(skin * 0.94, 0, 255)
        shade_col = np.clip(lid_col * 0.88, 0, 255)
        lash_col = (144, 140, 144)
    else:
        # Warm peach watercolor eyelid slightly lighter/softer than cheek blush
        lid_col = np.clip(skin * 0.98 + np.array([2, 3, 5], dtype=np.float32), 0, 255)
        shade_col = np.clip(lid_col * 0.87 + np.array([-3, -2, 2], dtype=np.float32), 0, 255)
        lash_col = (44, 54, 82)

    return lid_col, shade_col, lash_col


def apply_painterly_blink(
    img: np.ndarray,
    eye_cfg: dict,
    blink_amt: float,
    t: float = 0.0,
) -> None:
    """In-place native painterly eye blink (+ subtle sky-blue iris glint for macro Dove)."""
    cx = int(round(eye_cfg["cx"]))
    cy = int(round(eye_cfg["cy"]))
    rx = max(4, int(round(eye_cfg["rx"])))
    ry = max(4, int(round(eye_cfg["ry"])))
    kind = eye_cfg.get("kind", "human")
    angle = float(eye_cfg.get("angle", 0.0))

    h, w = img.shape[:2]

    # Subtle animated sky-light glint in macro Dove iris (Scene 05) when eye is open
    if kind == "dove_macro" and blink_amt < 0.4 and "specular" in eye_cfg:
        sx, sy = eye_cfg["specular"]
        pulse = 0.55 + 0.45 * math.sin(t * 2.1)
        g_rad = max(3, int(round(rx * 0.28)))
        x0, x1 = max(0, sx - g_rad * 2), min(w, sx + g_rad * 2 + 1)
        y0, y1 = max(0, sy - g_rad * 2), min(h, sy + g_rad * 2 + 1)
        if x1 > x0 and y1 > y0:
            yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            dist2 = ((xx - sx) ** 2 + (yy - sy) ** 2) / (g_rad * g_rad + 1e-6)
            glow = np.exp(-dist2 * 1.4) * (0.28 * pulse * (1.0 - blink_amt / 0.4))
            roi = img[y0:y1, x0:x1].astype(np.float32)
            # Soft sky-white luminous glint
            roi = np.clip(roi + glow[..., None] * np.array([255.0, 250.0, 238.0]), 0, 255)
            img[y0:y1, x0:x1] = roi.astype(np.uint8)

    if blink_amt <= 0.02:
        return

    # Tight ROI around eye
    pad_x = int(round(rx * 2.0)) + 8
    pad_y = int(round(ry * 2.0)) + 8
    x0, x1 = max(0, cx - pad_x), min(w, cx + pad_x + 1)
    y0, y1 = max(0, cy - pad_y), min(h, cy + pad_y + 1)
    if x1 <= x0 + 4 or y1 <= y0 + 4:
        return

    lid_col, shade_col, lash_col = _sample_eyelid_colors(img, cx, cy, rx, ry, kind)
    roi = img[y0:y1, x0:x1].astype(np.float32)
    rh, rw = roi.shape[:2]
    lcx = float(cx - x0)
    lcy = float(cy - y0)

    yy, xx = np.mgrid[0:rh, 0:rw].astype(np.float32)
    dx = xx - lcx
    dy = yy - lcy
    if abs(angle) > 0.1:
        rad = math.radians(-angle)
        ca, sa = math.cos(rad), math.sin(rad)
        rx_coord = dx * ca - dy * sa
        ry_coord = dx * sa + dy * ca
    else:
        rx_coord, ry_coord = dx, dy

    # Elliptical eye mask (wider soft feather for dove feathers so closed lid blends organically!)
    ex = rx * 1.18
    ey = ry * 1.18
    norm_r2 = (rx_coord / ex) ** 2 + (ry_coord / ey) ** 2
    if "dove" in kind:
        eye_mask = np.clip((1.06 - norm_r2) / 0.42, 0.0, 1.0)
    else:
        eye_mask = np.clip((1.12 - norm_r2) / 0.28, 0.0, 1.0)

    # Curved descending upper eyelid boundary + gently rising lower eyelid
    # Slight upward arch in center when open, softening into a peaceful slight curve when closed
    u_x = np.clip(rx_coord / (ex + 1e-6), -1.2, 1.2)
    arch_curve = (1.0 - u_x * u_x) * (ry * (0.30 * (1.0 - blink_amt) - 0.18 * blink_amt))
    lid_y = (-ry * 1.12) + blink_amt * (ry * 1.72) - arch_curve

    # Smooth feather right at the descending lid rim
    feather = max(1.2, ry * (0.18 if "dove" in kind else 0.12))
    upper_cover = np.clip((lid_y - ry_coord + feather) / (2.0 * feather), 0.0, 1.0)

    # Subtle lower lid rise when blink > 0.35
    lower_lid_y = (ry * 1.15) - blink_amt * (ry * 0.42) + (1.0 - u_x * u_x) * (ry * 0.08)
    lower_cover = np.clip((ry_coord - lower_lid_y + feather) / (2.0 * feather), 0.0, 1.0)

    cover = np.clip(np.maximum(upper_cover, lower_cover) * eye_mask, 0.0, 1.0)

    # Painterly eyelid shading gradient (slightly warmer/deeper near lid edge for 3D volume)
    dist_to_edge = np.clip((lid_y - ry_coord) / (ry * 1.4 + 1e-6), 0.0, 1.0)
    lid_paint = lid_col[None, None, :] * (0.86 + 0.14 * dist_to_edge[..., None]) + shade_col[None, None, :] * (0.14 * (1.0 - dist_to_edge[..., None]))

    # Subtle paper grain matching painting texture
    rng_y = (np.sin(xx * 0.7 + yy * 0.5) * np.cos(xx * 0.3 - yy * 0.9)) * 2.5
    lid_paint = np.clip(lid_paint + rng_y[..., None], 0, 255)

    out = roi * (1.0 - cover[..., None]) + lid_paint * cover[..., None]

    # Blend lash stroke gently ONLY once blink passes 0.14 (prevents floating horizontal line above open eyes!)
    lash_alpha = float(np.clip((blink_amt - 0.14) / 0.55, 0.0, 0.85))
    if "dove" in kind:
        lash_alpha *= 0.56  # soft delicate warm-grey feather crease shadow (NOT stark dark rim!)

    rad_fwd = math.radians(angle)
    ca_f, sa_f = math.cos(rad_fwd), math.sin(rad_fwd)
    if lash_alpha > 0.01:
        lash_layer = out.copy()
        n_pts = 17
        xs_rel = np.linspace(-rx * (0.92 if "dove" in kind else 1.02), rx * (0.92 if "dove" in kind else 1.02), n_pts)
        pts = []
        for xr in xs_rel:
            ux = xr / (ex + 1e-6)
            ac = (1.0 - ux * ux) * (ry * (0.30 * (1.0 - blink_amt) - 0.18 * blink_amt))
            yr = (-ry * 1.12) + blink_amt * (ry * 1.72) - ac
            px = lcx + xr * ca_f - yr * sa_f
            py = lcy + xr * sa_f + yr * ca_f
            pts.append([int(round(px)), int(round(py))])
        pts_arr = np.array(pts, dtype=np.int32)
        thickness = max(1, int(round(max(1.0, ry * (0.08 if "dove" in kind else 0.10)))))
        cv2.polylines(lash_layer, [pts_arr], False, lash_col, thickness, cv2.LINE_AA)
        out = out * (1.0 - lash_alpha) + lash_layer * lash_alpha

    # Subtle crease fold line slightly above lid when blinking on larger eyes
    if ry >= 12 and blink_amt > 0.35:
        crease_pts = []
        for xr in np.linspace(-rx * 0.78, rx * 0.78, 13):
            ux = xr / (ex + 1e-6)
            yr = -ry * 0.75 + (1.0 - ux * ux) * (-ry * 0.22) + blink_amt * (ry * 0.35)
            px = lcx + xr * ca_f - yr * sa_f
            py = lcy + xr * sa_f + yr * ca_f
            crease_pts.append([int(round(px)), int(round(py))])
        crease_layer = out.copy()
        cv2.polylines(crease_layer, [np.array(crease_pts, dtype=np.int32)], False, shade_col.tolist(), 1, cv2.LINE_AA)
        out = out * 0.78 + crease_layer * 0.22

    img[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)


def _viseme_factors(viseme: str) -> tuple[float, float, float]:
    """Return (open_height_mult, width_mult, teeth_alpha) for each classified viseme."""
    if viseme == "wide":
        return 1.15, 1.10, 0.52
    if viseme == "ah":
        return 1.00, 0.94, 0.42
    if viseme == "oh":
        return 0.92, 0.64, 0.10
    if viseme == "ee":
        return 0.55, 1.14, 0.48
    return 0.0, 1.0, 0.0


def apply_painterly_lipsync(
    img: np.ndarray,
    mouth_cfg: dict,
    energy: float,
    viseme: str,
) -> None:
    """In-place localized jaw-remap + feathered painterly interior mouth articulation."""
    energy = float(np.clip(energy, 0.0, 1.0))
    initially_open = bool(mouth_cfg.get("initially_open", False))
    facing = mouth_cfg.get("facing", "front")

    if not initially_open and (energy < 0.05 or viseme == "closed"):
        return

    cx = float(mouth_cfg["cx"])
    cy = float(mouth_cfg["cy"])
    mw = float(mouth_cfg["w"])
    mh = float(mouth_cfg["h"])
    jaw_drop = float(mouth_cfg.get("jaw_drop", max(8.0, mh * 0.75)))

    h, w = img.shape[:2]
    pad_x = int(round(mw * 2.2)) + 16
    pad_y = int(round(max(mh, jaw_drop) * 3.0)) + 20
    x0, x1 = max(0, int(cx) - pad_x), min(w, int(cx) + pad_x + 1)
    y0, y1 = max(0, int(cy) - pad_y), min(h, int(cy) + pad_y + 1)
    if x1 <= x0 + 8 or y1 <= y0 + 8:
        return

    roi = img[y0:y1, x0:x1].copy()
    rh, rw = roi.shape[:2]
    lcx = cx - x0
    lcy = cy - y0

    yy, xx = np.mgrid[0:rh, 0:rw].astype(np.float32)
    dx = xx - lcx
    dy = yy - lcy

    h_mult, w_mult, teeth_alpha = _viseme_factors(viseme)
    open_lvl = energy * h_mult

    # 1. Localized smooth Gaussian cv2.remap jaw/lip articulation
    if initially_open:
        # When silent (energy ~ 0): gently close the painted slightly-open mouth!
        # When speaking (energy > 0.25): expand smoothly downward & shape width by viseme!
        if energy < 0.06 or viseme == "closed":
            # Pull lower lip slightly UP toward upper lip to form soft resting closed/half-closed mouth
            dy_shift = -mh * 0.36
            wx = np.exp(-0.5 * (dx / (mw * 0.68)) ** 2)
            # Only affect lower lip & immediate chin (dy > -mh*0.1)
            wy = np.exp(-0.5 * ((dy - mh * 0.45) / (mh * 0.95)) ** 2) * np.clip((dy + mh * 0.15) / (mh * 0.45), 0.0, 1.0)
            map_x = xx
            map_y = yy - (dy_shift * wx * wy)
            warped = cv2.remap(roi, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)
            img[y0:y1, x0:x1] = warped
            return
        else:
            # Active speaking on already-open mouth: articulate jaw smoothly around neutral
            # energy 0.06..1.0 -> delta from -0.22*mh (almost closed) up to +jaw_drop*0.85 (wide open)
            delta_y = (open_lvl - 0.24) * jaw_drop * 0.85
            wx = np.exp(-0.5 * (dx / (mw * 0.85)) ** 2)
            wy = np.exp(-0.5 * ((dy - mh * 0.55) / (max(mh, jaw_drop) * 1.45)) ** 2) * np.clip((dy + mh * 0.25) / (mh * 0.55), 0.0, 1.0)
            # Horizontal lip rounding ('oh' narrows, 'ee'/'wide' widens slightly)
            hx = (w_mult - 1.0) * 0.20 * energy * dx * np.exp(-0.5 * ((dx / (mw * 0.95)) ** 2 + (dy / (mh * 1.15)) ** 2))
            map_x = xx - hx
            map_y = yy - (delta_y * wx * wy)
            warped = cv2.remap(roi, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)

            # Deepen interior rose-terracotta mouth cavity slightly on strong open syllables
            if open_lvl > 0.35:
                cavity_a = float(np.clip((open_lvl - 0.35) * 0.65, 0.0, 0.48))
                rx_m = mw * 0.34 * w_mult
                ry_m = max(2.0, mh * 0.32 + delta_y * 0.35)
                if facing == "profile_right":
                    cx_shift = -mw * 0.10
                elif facing == "left":
                    cx_shift = mw * 0.08
                else:
                    cx_shift = 0.0
                r2 = ((dx - cx_shift) / (rx_m + 1e-6)) ** 2 + ((dy - delta_y * 0.22) / (ry_m + 1e-6)) ** 2
                m_cav = np.clip((1.0 - r2) / 0.38, 0.0, 1.0) * cavity_a
                dark_rose = np.array([62.0, 66.0, 118.0], dtype=np.float32)
                wf = warped.astype(np.float32)
                wf = wf * (1.0 - m_cav[..., None]) + dark_rose[None, None, :] * m_cav[..., None]
                warped = np.clip(wf, 0, 255).astype(np.uint8)

            img[y0:y1, x0:x1] = warped
            return

    # Case A: Originally closed smiling mouth (S02 Boy, S10a Mom)
    drop = jaw_drop * open_lvl
    if drop < 1.0:
        return

    # Pull chin & lower skin strictly BELOW the painted smile line (dy >= 0.5) so the painted smile ink
    # remains 100% pinned as the upper lip border — ZERO double-mouth!
    wx = np.exp(-0.5 * (dx / (mw * 0.78)) ** 2)
    wy_down = np.exp(-0.5 * ((dy - drop * 0.55) / (max(mh, jaw_drop) * 1.45)) ** 2) * np.clip((dy - 0.5) / 3.5, 0.0, 1.0)
    map_x = xx
    map_y = yy - (drop * 0.85 * wx * wy_down)
    warped = cv2.remap(roi, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101).astype(np.float32)

    # Position interior mouth cavity strictly BELOW lcy so the pinned smile line forms a clean single upper lip!
    rx_m = max(4.0, mw * 0.43 * w_mult)
    ry_m = max(2.0, drop * 0.46)
    cy_m = lcy + ry_m * 0.65
    cx_m = lcx

    # Natural D-shaped talking mouth aperture hugging the pinned smile curve & tapering cleanly at the corners
    ux = (xx - cx_m) / (rx_m + 1e-6)
    smile_curve = -2.2 * (ux * ux)  # follows upward curve of painted smile corners
    uy = (yy - (cy_m + smile_curve)) / (ry_m + 1e-6)
    # Flatter top edge hugging directly beneath the painted smile ink
    r2 = ux * ux + np.where(uy < 0, (uy * 1.25) ** 2, uy ** 2)

    # Clamp top strictly at the pinned smile line & taper smoothly at left/right mouth corners
    top_clamp = np.clip((yy - (lcy + smile_curve - 0.2)) / 1.6, 0.0, 1.0)
    corner_taper = np.clip((1.05 - np.abs(ux)) / 0.28, 0.0, 1.0)
    inner_mask = np.clip((1.0 - r2) / 0.26, 0.0, 1.0) * top_clamp * corner_taper
    rim_mask = np.clip((1.15 - r2) / 0.22, 0.0, 1.0) * top_clamp * corner_taper - inner_mask
    rim_mask = np.clip(rim_mask, 0.0, 1.0)

    # Warm painterly rose-terracotta mouth interior (matches S03/S06/S08a paintings!)
    v_grad = np.clip((uy + 1.0) * 0.5, 0.0, 1.0)[..., None]
    top_col = np.array([58.0, 64.0, 118.0], dtype=np.float32)     # warm deep cocoa-plum
    bot_col = np.array([108.0, 118.0, 186.0], dtype=np.float32)   # soft warm watercolor rose-coral
    mouth_fill = top_col * (1.0 - v_grad) + bot_col * v_grad

    # Subtle warm ivory upper-tooth highlight on open/wide/ee vowels
    if teeth_alpha > 0.15 and ry_m >= 2.6:
        t_mask = np.clip((-uy - 0.15) / 0.42, 0.0, 1.0) * np.clip((0.76 - np.abs(ux)) / 0.24, 0.0, 1.0) * inner_mask
        ivory = np.array([228.0, 238.0, 248.0], dtype=np.float32)
        mouth_fill = mouth_fill * (1.0 - t_mask[..., None] * teeth_alpha) + ivory * (t_mask[..., None] * teeth_alpha)

    grain = (np.sin(xx * 0.8 + yy * 0.6) * 2.5)[..., None]
    mouth_fill = np.clip(mouth_fill + grain, 0, 255)

    sepia_rim = np.array([52.0, 60.0, 94.0], dtype=np.float32)
    alpha_in = float(np.clip(0.50 + 0.45 * open_lvl, 0.0, 0.92))
    alpha_rim = float(np.clip(0.24 + 0.32 * open_lvl, 0.0, 0.54))

    out = warped * (1.0 - inner_mask[..., None] * alpha_in) + mouth_fill * (inner_mask[..., None] * alpha_in)
    out = out * (1.0 - rim_mask[..., None] * alpha_rim) + sepia_rim * (rim_mask[..., None] * alpha_rim)
    img[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)


def apply_dove_beak_lipsync(
    img: np.ndarray,
    beak_cfg: dict,
    energy: float,
    viseme: str,
) -> None:
    """In-place articulated lower-beak rotation + warm interior shading for the speaking White Dove (S07)."""
    energy = float(np.clip(energy, 0.0, 1.0))
    if energy < 0.06 or viseme == "closed":
        return

    hx, hy = float(beak_cfg["hinge"][0]), float(beak_cfg["hinge"][1])
    utx, uty = float(beak_cfg["upper_tip"][0]), float(beak_cfg["upper_tip"][1])
    max_deg = float(beak_cfg.get("max_angle_deg", 18.0))
    facing = beak_cfg.get("facing", "left")

    h_mult, _, _ = _viseme_factors(viseme)
    open_deg = max_deg * energy * max(0.65, h_mult)
    if open_deg < 1.2:
        return

    h, w = img.shape[:2]
    beak_len = math.hypot(utx - hx, uty - hy)
    pad = int(round(beak_len * 1.5)) + 16
    x0, x1 = max(0, int(hx) - pad), min(w, int(hx) + pad + 1)
    y0, y1 = max(0, int(hy) - pad), min(h, int(hy) + pad + 1)
    if x1 <= x0 + 8 or y1 <= y0 + 8:
        return

    roi = img[y0:y1, x0:x1].copy()
    rh, rw = roi.shape[:2]
    lhx = hx - x0
    lhy = hy - y0
    lutx = utx - x0
    luty = uty - y0

    # Unit vector along beak split line from hinge -> upper_tip
    vx = lutx - lhx
    vy = luty - lhy
    vlen = math.hypot(vx, vy) + 1e-6
    ux_v, uy_v = vx / vlen, vy / vlen
    # Downward normal perpendicular to beak split line
    nx_v, ny_v = (-uy_v, ux_v) if facing == "left" else (uy_v, -ux_v)
    if ny_v < 0:
        nx_v, ny_v = -nx_v, -ny_v

    yy, xx = np.mgrid[0:rh, 0:rw].astype(np.float32)
    rx_p = xx - lhx
    ry_p = yy - lhy

    along = rx_p * ux_v + ry_p * uy_v   # 0 at hinge, +vlen at tip
    perp = rx_p * nx_v + ry_p * ny_v    # >0 below beak split line (lower mandible!)

    # Smooth mask covering ONLY the lower mandible region below the beak split line
    m_along = np.clip((along + 4.0) / 8.0, 0.0, 1.0) * np.clip((vlen * 1.25 - along) / 10.0, 0.0, 1.0)
    m_perp = np.clip((perp + 1.5) / 4.0, 0.0, 1.0) * np.clip((vlen * 0.72 - perp) / 10.0, 0.0, 1.0)
    lower_w = m_along * m_perp

    # Rotate lower mandible DOWNWARD around hinge:
    # Facing left -> downward rotation is negative angle in image coords; inverse map uses +rad!
    sign = -1.0 if facing == "left" else 1.0
    ang = math.radians(sign * open_deg) * lower_w
    ca = np.cos(-ang)
    sa = np.sin(-ang)
    map_x = lhx + rx_p * ca - ry_p * sa
    map_y = lhy + rx_p * sa + ry_p * ca

    warped = cv2.remap(roi, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101).astype(np.float32)

    # Paint delicate warm coral-rose interior wedge inside the freshly opened beak mouth!
    max_gap_rad = math.radians(open_deg)
    wedge_height = np.maximum(0.0, along) * math.tan(max_gap_rad)
    in_wedge = (
        np.clip((along - 1.5) / 4.5, 0.0, 1.0)
        * np.clip((vlen * 0.82 - along) / 6.0, 0.0, 1.0)
        * np.clip((perp + 0.5) / 2.0, 0.0, 1.0)
        * np.clip((wedge_height - perp + 0.5) / 2.2, 0.0, 1.0)
    )
    beak_inner = np.array([92.0, 102.0, 152.0], dtype=np.float32)  # soft muted rose-sepia
    w_alpha = float(np.clip(0.55 + 0.35 * energy, 0.0, 0.85))
    out = warped * (1.0 - in_wedge[..., None] * w_alpha) + beak_inner[None, None, :] * (in_wedge[..., None] * w_alpha)
    img[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)
