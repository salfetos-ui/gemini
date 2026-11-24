"""Vectorized Live2D-style multi-region bicubic mesh deformation engine (cv2.remap)."""

import math
import cv2
import numpy as np


def rotate_point(pt: tuple[float, float], pivot: tuple[float, float], angle_deg: float) -> tuple[float, float]:
    """Rotate a 2D point around pivot by angle_deg (standard image coords: +deg = clockwise)."""
    rad = math.radians(angle_deg)
    ca, sa = math.cos(rad), math.sin(rad)
    dx = pt[0] - pivot[0]
    dy = pt[1] - pivot[1]
    return (pivot[0] + dx * ca - dy * sa, pivot[1] + dx * sa + dy * ca)


class MeshField:
    """Fast 1/4-resolution C1-continuous displacement mesh upscaled for single-pass bicubic cv2.remap."""

    _BASE_GRIDS: dict[tuple[int, int], tuple[np.ndarray, np.ndarray]] = {}

    def __init__(self, w: int = 1376, h: int = 768, scale: int = 4):
        self.w = w
        self.h = h
        self.scale = scale
        self.mw = w // scale
        self.mh = h // scale

        # Coarse grid in full-res pixel coordinates
        xs = np.linspace(0.0, float(w - 1), self.mw, dtype=np.float32)
        ys = np.linspace(0.0, float(h - 1), self.mh, dtype=np.float32)
        self.gx, self.gy = np.meshgrid(xs, ys)

        # Forward displacement (how much each painted pixel moves on screen)
        self.dx = np.zeros((self.mh, self.mw), dtype=np.float32)
        self.dy = np.zeros((self.mh, self.mw), dtype=np.float32)

    @classmethod
    def _get_base_grid(cls, w: int, h: int) -> tuple[np.ndarray, np.ndarray]:
        key = (w, h)
        if key not in cls._BASE_GRIDS:
            by, bx = np.mgrid[0:h, 0:w].astype(np.float32)
            cls._BASE_GRIDS[key] = (bx, by)
        return cls._BASE_GRIDS[key]

    def _soft_box_mask(self, bbox: list[float], pad_x: float = 18.0, pad_y: float = 18.0) -> np.ndarray:
        x0, y0, x1, y1 = bbox
        wx = np.clip((self.gx - x0) / pad_x, 0.0, 1.0) * np.clip((x1 - self.gx) / pad_x, 0.0, 1.0)
        wy = np.clip((self.gy - y0) / pad_y, 0.0, 1.0) * np.clip((y1 - self.gy) / pad_y, 0.0, 1.0)
        # Smoothstep for C1 continuity
        wx = wx * wx * (3.0 - 2.0 * wx)
        wy = wy * wy * (3.0 - 2.0 * wy)
        return wx * wy

    def _gauss_mask(self, cx: float, cy: float, sx: float, sy: float) -> np.ndarray:
        return np.exp(-0.5 * (((self.gx - cx) / (sx + 1e-6)) ** 2 + ((self.gy - cy) / (sy + 1e-6)) ** 2))

    def add_curtain_billow(self, cfg: dict, t: float) -> None:
        x0, y0, x1, y1 = cfg["bbox"]
        tie_y = float(cfg.get("tie_y", (y0 + y1) * 0.5))
        amp_x = float(cfg.get("amp_x", 8.0))
        freq = float(cfg.get("freq", 1.1))
        phase = float(cfg.get("phase", 0.0))

        m = self._soft_box_mask([x0, y0, x1, y1], pad_x=24.0, pad_y=28.0)
        # Anchored at top curtain rod (y=0) and damped gently near tie-back knot
        top_anchor = np.clip(self.gy / 85.0, 0.0, 1.0)
        tie_damp = 1.0 - 0.72 * np.exp(-0.5 * ((self.gy - tie_y) / 48.0) ** 2)
        # Stronger billow on free-hanging lower skirt
        lower_boost = 1.0 + 0.45 * np.clip((self.gy - tie_y) / 260.0, 0.0, 1.0)
        wave = (
            np.sin(t * freq + self.gy * 0.011 + phase)
            + 0.35 * np.sin(t * freq * 1.73 - self.gy * 0.019 + phase * 1.4)
        )
        w_eff = m * top_anchor * tie_damp * lower_boost
        self.dx += (amp_x * wave) * w_eff
        self.dy += (amp_x * 0.20 * np.cos(t * freq + self.gy * 0.011 + phase)) * w_eff

    def add_foliage_sway(self, cfg: dict, t: float) -> None:
        x0, y0, x1, y1 = cfg["bbox"]
        anchor_y = float(cfg.get("anchor_y", y1))
        amp_x = float(cfg.get("amp_x", 5.0))
        freq = float(cfg.get("freq", 1.25))
        phase = float(cfg.get("phase", 0.0))

        m = self._soft_box_mask([x0, y0, x1, y1], pad_x=16.0, pad_y=16.0)
        h_span = max(30.0, anchor_y - y0)
        tip_w = np.clip((anchor_y - self.gy) / h_span, 0.0, 1.0) ** 1.25
        wave = np.sin(t * freq + self.gx * 0.014 + phase) + 0.3 * np.sin(t * freq * 1.9 + phase)
        self.dx += (amp_x * wave) * m * tip_w
        self.dy += (amp_x * 0.18 * np.abs(wave)) * m * tip_w

    def add_breathing(self, bbox: list[float], t: float, amp_y: float = 3.2, amp_x: float = 1.5, freq: float = 1.75, phase: float = 0.0) -> None:
        x0, y0, x1, y1 = bbox
        cx = 0.5 * (x0 + x1)
        cy = y0 + 0.42 * (y1 - y0)
        sx = max(25.0, 0.36 * (x1 - x0))
        sy = max(25.0, 0.38 * (y1 - y0))
        g = self._gauss_mask(cx, cy, sx, sy)
        s = math.sin(t * freq + phase)
        self.dy += (-amp_y * s) * g
        self.dx += (amp_x * s * np.clip((self.gx - cx) / sx, -1.5, 1.5)) * g

    def add_hair_sway(self, bbox: list[float], t: float, amp_x: float = 3.2, amp_y: float = 1.8, freq: float = 2.0, phase: float = 0.0) -> None:
        x0, y0, x1, y1 = bbox
        cx = 0.5 * (x0 + x1)
        cy = 0.5 * (y0 + y1)
        rx = max(25.0, 0.48 * (x1 - x0))
        ry = max(25.0, 0.48 * (y1 - y0))
        m = self._soft_box_mask(bbox, pad_x=18.0, pad_y=18.0)
        # Keep lower-center face zone calmer while crown & outer curls gently sway
        r_norm = np.sqrt(((self.gx - cx) / rx) ** 2 + ((self.gy - (cy + ry * 0.25)) / ry) ** 2)
        crown_w = np.clip((r_norm - 0.32) / 0.55, 0.0, 1.0)
        w1 = np.sin(t * freq + self.gx * 0.018 + phase)
        w2 = np.cos(t * freq * 0.85 + self.gy * 0.022 + phase)
        self.dx += (amp_x * w1) * m * crown_w
        self.dy += (amp_y * w2) * m * crown_w

    def add_pivoted_limb(self, pivot: list[float], end: list[float], angle_deg: float, width: float = 55.0) -> None:
        """Smoothly pivot an arm/leg/hand segment around a shoulder/hip/elbow joint."""
        if abs(angle_deg) < 0.05:
            return
        px, py = float(pivot[0]), float(pivot[1])
        ex, ey = float(end[0]), float(end[1])
        vx, vy = ex - px, ey - py
        length = math.hypot(vx, vy) + 1e-6
        ux, uy = vx / length, vy / length
        nx, ny = -uy, ux

        rx = self.gx - px
        ry = self.gy - py
        along = rx * ux + ry * uy
        perp = np.abs(rx * nx + ry * ny)

        # Smooth mask along the limb (0 at joint -> 1 through limb -> fades softly past tip)
        m_along = np.clip(along / (length * 0.28), 0.0, 1.0) * np.clip((length * 1.38 - along) / (length * 0.35), 0.0, 1.0)
        m_perp = np.exp(-0.5 * (perp / width) ** 2)
        w = m_along * m_perp

        rad = math.radians(angle_deg)
        ca, sa = math.cos(rad), math.sin(rad)
        rot_x = px + rx * ca - ry * sa
        rot_y = py + rx * sa + ry * ca
        self.dx += (rot_x - self.gx) * w
        self.dy += (rot_y - self.gy) * w

    def add_s02_running_puppet(self, boy_cfg: dict, t: float, stride_freq: float = 6.8) -> None:
        """Lively running limb swing + bouncy curly hair for Scene 02 Boy cutout."""
        limbs = boy_cfg["limbs"]
        s = math.sin(t * stride_freq)
        c = math.cos(t * stride_freq)
        # Opposite arm/leg stride swing!
        self.add_pivoted_limb(limbs["front_arm_shoulder"], limbs["front_arm_hand"], angle_deg=11.0 * s, width=48.0)
        self.add_pivoted_limb(limbs["back_arm_shoulder"], limbs["back_arm_hand"], angle_deg=-10.0 * s, width=48.0)
        self.add_pivoted_limb(limbs["front_leg_hip"], limbs["front_leg_foot"], angle_deg=-12.5 * s, width=56.0)
        self.add_pivoted_limb(limbs["back_leg_hip"], limbs["back_leg_foot"], angle_deg=13.5 * s, width=54.0)
        # Joyful double-frequency hair bounce
        self.add_hair_sway(boy_cfg["hair_bbox"], t, amp_x=4.5, amp_y=4.2, freq=stride_freq * 1.0, phase=0.5)
        # Subtle breathing chest lift
        tx, ty = boy_cfg["torso_center"]
        g = self._gauss_mask(tx, ty, 60.0, 70.0)
        self.dy += (-3.5 * abs(c)) * g

    def add_s03_mom_welcoming(self, mom_cfg: dict, t: float) -> None:
        """Warm welcoming arm opening, flowing midi skirt sway, breathing & bun bounce for Scene 03 Mom cutout."""
        s = math.sin(t * 2.4)
        # Welcoming open arms softly rising and embracing
        self.add_pivoted_limb(mom_cfg["left_arm"]["shoulder"], mom_cfg["left_arm"]["hand"], angle_deg=-6.5 * s - 2.0, width=46.0)
        self.add_pivoted_limb(mom_cfg["right_arm"]["shoulder"], mom_cfg["right_arm"]["hand"], angle_deg=6.5 * s + 2.0, width=46.0)

        # Flowing beige midi skirt hem sway
        sx0, sy0, sx1, sy1 = mom_cfg["skirt_bbox"]
        m_sk = self._soft_box_mask([sx0 - 15, sy0, sx1 + 15, sy1 + 15], pad_x=22.0, pad_y=20.0)
        hem_w = np.clip((self.gy - sy0) / max(30.0, sy1 - sy0), 0.0, 1.0) ** 1.35
        skirt_wave = np.sin(t * 3.8 + self.gx * 0.025) * 9.5 + np.sin(t * 1.9) * 4.5
        self.dx += skirt_wave * m_sk * hem_w
        self.dy += (-2.5 * np.abs(np.cos(t * 3.8))) * m_sk * hem_w

        # Gentle hair bun & chest breathing
        self.add_hair_sway(mom_cfg["hair_bbox"], t, amp_x=2.8, amp_y=2.2, freq=2.6, phase=0.3)
        tx, ty = mom_cfg["torso_center"]
        self.dy += (-3.2 * math.sin(t * 2.1)) * self._gauss_mask(tx, ty, 52.0, 68.0)

    def add_s07_wing_flutter(self, dove_cfg: dict, t: float) -> None:
        """Majestic multi-wave feathered flutter across BOTH outstretched wings in Scene 07!"""
        for side, phase_off, amp_scale in [("left_wing", 0.0, 22.0), ("right_wing", 0.18, 28.0)]:
            wcfg = dove_cfg[side]
            rx, ry = float(wcfg["root"][0]), float(wcfg["root"][1])
            tx, ty = float(wcfg["tip"][0]), float(wcfg["tip"][1])
            poly = np.array(wcfg["polygon"], dtype=np.float32) / float(self.scale)

            # Build smooth polygon mask on coarse grid
            mask_u8 = np.zeros((self.mh, self.mw), dtype=np.uint8)
            cv2.fillPoly(mask_u8, [np.round(poly).astype(np.int32)], 255)
            mask = cv2.GaussianBlur(mask_u8.astype(np.float32) / 255.0, (0, 0), sigmaX=4.5, sigmaY=4.5)

            vx, vy = tx - rx, ty - ry
            span = math.hypot(vx, vy) + 1e-6
            ux, uy = vx / span, vy / span
            # Upward-pointing perpendicular normal to wing axis
            nx, ny = -uy, ux
            if ny > 0:
                nx, ny = -nx, -ny

            along = (self.gx - rx) * ux + (self.gy - ry) * uy
            u = np.clip(along / span, 0.0, 1.15)
            # Zero right at shoulder root, quadratic swell toward feather tips!
            radial_w = np.clip(u, 0.0, 1.0) ** 1.32

            # Continuous majestic wingbeat with traveling feather-tip phase lag
            primary = np.sin(t * 4.2 - u * 1.9 + phase_off)
            secondary = 0.28 * np.sin(t * 8.4 - u * 3.4 + phase_off)
            disp = amp_scale * (primary + secondary) * radial_w * mask

            self.dx += disp * nx
            self.dy += disp * ny

        # Subtle ethereal body rise & head poise synced with wing beat
        bx0, by0, bx1, by1 = dove_cfg["body_bbox"]
        self.add_breathing([bx0, by0, bx1, by1], t, amp_y=4.0, amp_x=2.0, freq=4.2, phase=-0.4)

    def add_s08a_surprise_eyebrows(self, boy_cfg: dict, lift_amt: float) -> None:
        """Expressive eyebrow lift & subtle upper-eye surprise widening on Scene 08a Boy."""
        if abs(lift_amt) < 0.02:
            return
        for eb in boy_cfg["eyebrows"]:
            cx, cy = float(eb["cx"]), float(eb["cy"])
            rx, ry = float(eb["rx"]), float(eb["ry"])
            g = self._gauss_mask(cx, cy, rx * 1.15, ry * 1.55)
            self.dy += (-12.5 * lift_amt) * g
        # Subtle eye-widen lift on upper eyelid margin
        for eye in boy_cfg["eyes"]:
            cx, cy = float(eye["cx"]), float(eye["cy"]) - float(eye["ry"]) * 0.75
            g = self._gauss_mask(cx, cy, float(eye["rx"]) * 0.95, float(eye["ry"]) * 0.45)
            self.dy += (-3.8 * lift_amt) * g

    def add_pivoted_head_nod(self, head_bbox: list[float], pivot: list[float], angle_deg: float) -> None:
        """Rigid-to-soft rotational head nod around neck pivot — keeps chest & feet 100% locked!"""
        if abs(angle_deg) < 0.05:
            return
        px, py = float(pivot[0]), float(pivot[1])
        x0, y0, x1, y1 = head_bbox
        # Soft region enclosing head & upper neck, fading cleanly to 0 below pivot_y!
        pad_x = max(24.0, (x1 - x0) * 0.25)
        pad_y = max(22.0, (y1 - y0) * 0.25)
        mx = np.clip((self.gx - (x0 - pad_x)) / pad_x, 0.0, 1.0) * np.clip(((x1 + pad_x) - self.gx) / pad_x, 0.0, 1.0)
        my_top = np.clip((self.gy - (y0 - pad_y)) / pad_y, 0.0, 1.0)
        # Smooth neck transition right across py: 1.0 above py-22, smoothly tapering to 0.0 by py+38
        my_bot = np.clip(((py + 38.0) - self.gy) / 62.0, 0.0, 1.0)
        w = mx * my_top * my_bot
        w = w * w * (3.0 - 2.0 * w)

        rad = math.radians(angle_deg)
        ca, sa = math.cos(rad), math.sin(rad)
        rx = self.gx - px
        ry = self.gy - py
        rot_x = px + rx * ca - ry * sa
        rot_y = py + rx * sa + ry * ca
        self.dx += (rot_x - self.gx) * w
        self.dy += (rot_y - self.gy) * w

    def add_s09_pointing_gesture(self, boy_cfg: dict, t: float, talk_energy: float) -> None:
        """Expressive childlike hand gesture while Boy asks Mom about the pie in Scene 09."""
        pa = boy_cfg["pointing_arm"]
        base_wave = math.sin(t * 3.1) * 3.5 + math.sin(t * 5.8) * (5.5 * talk_energy)
        self.add_pivoted_limb(pa["pivot"], pa["hand"], angle_deg=base_wave, width=44.0)

    def add_s10a_shoulder_caress(self, mom_cfg: dict, t: float, strength: float) -> None:
        """Tender rhythmic maternal hand caress on Boy's shoulder in Scene 10a."""
        if strength <= 0.02:
            return
        ch = mom_cfg["caress_hand"]
        hx, hy = float(ch["hand"][0]), float(ch["hand"][1])
        # Gentle soothing horizontal & slight vertical caress stroke along Boy's shoulder
        g = self._gauss_mask(hx, hy, 54.0, 34.0)
        stroke = math.sin(t * 1.95) * strength
        self.dx += (7.2 * stroke) * g
        self.dy += (-2.8 * math.cos(t * 1.95) * strength) * g
        # Subtle coupled forearm follow-through
        self.add_pivoted_limb(ch["pivot"], ch["hand"], angle_deg=-2.4 * stroke, width=38.0)

    def add_s10_boy_feet_sway(self, boy_cfg: dict, t: float) -> None:
        """Gentle peaceful dangling bare-feet sway in Scene 10."""
        fx0, fy0, fx1, fy1 = boy_cfg["feet_bbox"]
        m = self._soft_box_mask([fx0 - 12, fy0, fx1 + 12, fy1 + 12], pad_x=16.0, pad_y=16.0)
        tip = np.clip((self.gy - fy0) / max(20.0, fy1 - fy0), 0.0, 1.0) ** 1.2
        self.dx += (5.2 * math.sin(t * 1.65)) * m * tip
        self.dy += (-1.5 * math.cos(t * 3.3)) * m * tip

    def add_s10c_smile_deepen(self, boy_cfg: dict, smile_amt: float) -> None:
        """Subtle warm deepening smile lift on Boy during the 4.50s contemplative mutual gaze pause!"""
        if smile_amt <= 0.01:
            return
        mcfg = boy_cfg["mouth"]
        for corner in [mcfg["left_corner"], mcfg["right_corner"]]:
            cx, cy = float(corner[0]), float(corner[1])
            g = self._gauss_mask(cx, cy, 14.0, 12.0)
            self.dy += (-4.6 * smile_amt) * g
            # Slightly widen outward
            sign = -1.0 if cx < mcfg["cx"] else 1.0
            self.dx += (2.4 * sign * smile_amt) * g
        # Soft warm rosy cheek lift right under both eyes
        for eye in boy_cfg["eyes"]:
            cx, cy = float(eye["cx"]), float(eye["cy"]) + 20.0
            g = self._gauss_mask(cx, cy, 16.0, 11.0)
            self.dy += (-2.2 * smile_amt) * g

    def apply(self, img: np.ndarray) -> np.ndarray:
        """Execute single-pass bicubic cv2.remap on an image (BGR or BGRA)."""
        if not np.any(self.dx) and not np.any(self.dy):
            return img.copy()
        dx_full = cv2.resize(self.dx, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        dy_full = cv2.resize(self.dy, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        bx, by = self._get_base_grid(self.w, self.h)
        # Inverse mapping: destination (x,y) samples source at (x - dx, y - dy)
        map_x = bx - dx_full
        map_y = by - dy_full
        return cv2.remap(img, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)
