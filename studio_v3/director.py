"""Unified Live2D Feature-Film Scene Director for 'Казка Пирожок' (used by both QA previews and 1080p render)."""

import json
import math
from pathlib import Path
import cv2
import numpy as np

from face_fx import (
    apply_dove_beak_lipsync,
    apply_painterly_blink,
    apply_painterly_lipsync,
    compute_blink_amount,
)
from mesh_warp import MeshField, rotate_point
from atmosphere import (
    add_aroma_ribbons,
    add_dove_halo,
    add_gaze_bridge_motes,
    add_light_motes,
    add_oven_glow,
    add_pie_steam,
    add_volumetric_sunbeams,
    apply_camera,
    blend_rgba_overlay,
    ease_in_out,
    smoothstep,
)

PROJECT_ROOT = Path("/home/antigravity/salfetos-ui/gemini")
SCENES_DIR = PROJECT_ROOT / "assets" / "scenes"
AUDIO_DIR = PROJECT_ROOT / "assets" / "audio"
STUDIO_DIR = PROJECT_ROOT / "studio_v3"
CACHE_DIR = STUDIO_DIR / "cache"


def _composite_fg_onto_bg(
    bg: np.ndarray,
    fg_rgba: np.ndarray,
    dx: float = 0.0,
    dy: float = 0.0,
    scale: float = 1.0,
    pivot: tuple[float, float] | None = None,
    shadow_cfg: dict | None = None,
) -> np.ndarray:
    """Fast ROI-shadow + SIMD uint8 alpha-composite of transformed BGRA foreground onto BGR background."""
    h, w = bg.shape[:2]
    out = bg.copy()

    # ROI-only soft cast floor shadow beneath running Boy / walking Mom
    if shadow_cfg is not None:
        sx = int(round(shadow_cfg["cx"] + dx))
        sy = int(round(shadow_cfg["cy"]))
        rx = max(10, int(round(shadow_cfg["rx"] * shadow_cfg.get("scale", 1.0))))
        ry = max(4, int(round(shadow_cfg["ry"] * shadow_cfg.get("scale", 1.0))))
        strength = float(shadow_cfg.get("strength", 0.28))
        pad_x, pad_y = rx + 44, ry + 26
        x0, x1 = max(0, sx - pad_x), min(w, sx + pad_x)
        y0, y1 = max(0, sy - pad_y), min(h, sy + pad_y)
        if x1 > x0 and y1 > y0:
            sh_roi = np.zeros((y1 - y0, x1 - x0), dtype=np.float32)
            cv2.ellipse(sh_roi, (sx - x0, sy - y0), (rx, ry), 0, 0, 360, strength, -1)
            sh_roi = cv2.GaussianBlur(sh_roi, (0, 0), sigmaX=14.0, sigmaY=7.0)[..., None]
            sh_tint = np.array([34.0, 52.0, 74.0], dtype=np.float32)
            patch = out[y0:y1, x0:x1].astype(np.float32)
            out[y0:y1, x0:x1] = np.clip(patch * (1.0 - sh_roi) + sh_tint * sh_roi, 0, 255).astype(np.uint8)

    if pivot is None:
        px, py = w * 0.5, h * 0.5
    else:
        px, py = pivot

    M = np.array(
        [
            [scale, 0.0, (1.0 - scale) * px + dx],
            [0.0, scale, (1.0 - scale) * py + dy],
        ],
        dtype=np.float32,
    )
    fg_t = cv2.warpAffine(
        fg_rgba,
        M,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    a3 = cv2.merge([fg_t[..., 3], fg_t[..., 3], fg_t[..., 3]])
    inv_a3 = cv2.subtract(255, a3)
    bg_part = cv2.multiply(out, inv_a3, scale=1.0 / 255.0)
    fg_part = cv2.multiply(fg_t[..., :3], a3, scale=1.0 / 255.0)
    cv2.add(bg_part, fg_part, dst=out)
    return out


class SceneDirector:
    """Loads paintings, landmarks, segmentation caches, timeline & lipsync once per worker process."""

    def __init__(self, out_w: int = 1920, out_h: int = 1080):
        self.out_w = out_w
        self.out_h = out_h

        self.landmarks = json.loads((STUDIO_DIR / "landmarks.json").read_text())["scenes"]
        self.timeline = json.loads((AUDIO_DIR / "timeline.json").read_text())
        self.lipsync = json.loads((AUDIO_DIR / "lipsync.json").read_text())

        self.fps = int(self.lipsync.get("fps", 30))
        self.total_duration = float(self.timeline["total_duration_sec"])
        self.total_frames = int(self.lipsync["total_frames"])

        self.scene_bounds = {s["scene_id"]: (float(s["start_sec"]), float(s["end_sec"])) for s in self.timeline["scenes"]}
        self.line_bounds = {l["id"]: (float(l["start_sec"]), float(l["end_sec"])) for l in self.timeline["lines"]}

        # Pre-load raw 1376x768 paintings
        self.imgs: dict[str, np.ndarray] = {}
        for sid, cfg in self.landmarks.items():
            p = SCENES_DIR / cfg["image"]
            self.imgs[sid] = cv2.imread(str(p))

        # Pre-load segmented assets for Scene 02 & Scene 03
        self.s02_bg = cv2.imread(str(CACHE_DIR / "s02_bg.png"))
        self.s02_fg = cv2.imread(str(CACHE_DIR / "s02_fg.png"), cv2.IMREAD_UNCHANGED)
        self.s03_bg = cv2.imread(str(CACHE_DIR / "s03_bg.png"))
        self.s03_fg = cv2.imread(str(CACHE_DIR / "s03_fg.png"), cv2.IMREAD_UNCHANGED)

        # Pre-load crisp 1920x1080 Cyrillic title plates
        t_open = cv2.imread(str(CACHE_DIR / "title_opening.png"), cv2.IMREAD_UNCHANGED)
        t_close = cv2.imread(str(CACHE_DIR / "title_closing.png"))
        if (out_w, out_h) != (1920, 1080):
            t_open = cv2.resize(t_open, (out_w, out_h), interpolation=cv2.INTER_AREA)
            t_close = cv2.resize(t_close, (out_w, out_h), interpolation=cv2.INTER_AREA)
        self.title_opening = t_open
        self.title_closing = t_close

        # Pre-index smoothed lip-sync envelopes for ultra-organic motion
        self._ls_chars = self.lipsync["characters"]

    def get_lipsync(self, role: str, frame_idx: int) -> tuple[float, str]:
        """Return gently smoothed (energy, viseme) at 30fps for character role."""
        arr = self._ls_chars.get(role)
        if not arr:
            return 0.0, "closed"
        idx = max(0, min(len(arr) - 1, frame_idx))
        cur = arr[idx]
        # 3-frame triangular smoothing on energy to eliminate single-frame chatter
        e_prev = arr[max(0, idx - 1)]["e"]
        e_cur = cur["e"]
        e_next = arr[min(len(arr) - 1, idx + 1)]["e"]
        e_smooth = 0.25 * e_prev + 0.50 * e_cur + 0.25 * e_next
        return float(e_smooth), str(cur["v"])

    # ------------------------------------------------------------------
    # Individual Scene Renderers -> return 1920x1080 BGR frame at time t
    # ------------------------------------------------------------------

    def render_scene_01(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["01"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        cfg = self.landmarks["01"]

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        canvas = mesh.apply(self.imgs["01"])

        add_oven_glow(canvas, cfg["oven_glow"], t, intensity=0.18)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.22, angle_deg=34.0)
        add_light_motes(canvas, t, seed=101, count=36, sky_blue_ratio=0.15, intensity=0.88)

        frame = apply_camera(
            canvas,
            zoom=1.01 + 0.065 * ease_in_out(u),
            cx_norm=0.49 + 0.015 * u,
            cy_norm=0.50 - 0.01 * u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.11,
        )

        # Crisp Opening Title ("КНИГА ВЕДМЕДІВ · КАЗКА 1 / Пирожок")
        title_in = smoothstep(0.42, 1.15, t)
        title_out = 1.0 - smoothstep(en - 0.55, en - 0.08, t)
        frame = blend_rgba_overlay(frame, self.title_opening, opacity=title_in * title_out)

        # Gentle warm sunlit cream fade-in at very start (0.0 -> 0.55s)
        fade_in = smoothstep(0.0, 0.55, t)
        if fade_in < 0.999:
            cream = np.array([224.0, 240.0, 252.0], dtype=np.float32)  # sunlit cream BGR
            frame = np.clip(frame.astype(np.float32) * fade_in + cream * (1.0 - fade_in), 0, 255).astype(np.uint8)
        return frame

    def render_scene_02(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["02"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        lt = t - st
        cfg = self.landmarks["02"]
        boy_cfg = cfg["boy"]

        # 1. Animate hallway background (foliage sway, aroma ribbons, morning light!)
        bg_mesh = MeshField()
        for f in cfg["foliage"]:
            bg_mesh.add_foliage_sway(f, t)
        bg = bg_mesh.apply(self.s02_bg)
        add_volumetric_sunbeams(bg, cfg["sunbeam_origin"], t, intensity=0.18, angle_deg=38.0)

        # 2. Animate Boy cutout (blinking + audio-driven lip-sync + running limb puppet warp!)
        boy_fg = self.s02_fg.copy()
        boy_bgr = boy_fg[..., :3].copy()

        blink = compute_blink_amount(t, [st + 1.35, st + 4.45, st + 7.90, st + 10.1])
        for eye in boy_cfg["eyes"]:
            apply_painterly_blink(boy_bgr, eye, blink, t)

        e_boy, v_boy = self.get_lipsync("boy", frame_idx)
        apply_painterly_lipsync(boy_bgr, boy_cfg["mouth"], e_boy, v_boy)
        boy_fg[..., :3] = boy_bgr

        # Stride cadence slows down slightly as he approaches the kitchen doorway at the end
        stride_speed = 6.6
        fg_mesh = MeshField()
        fg_mesh.add_s02_running_puppet(boy_cfg, lt, stride_freq=stride_speed)
        boy_fg = fg_mesh.apply(boy_fg)

        # Physical running translation across the sunlit hallway (-28px -> +45px) + bouncy stride hop
        # paired with smooth camera pan-follow so Boy runs lively & cohesively across crisp wood planks!
        run_u = ease_in_out(min(1.0, u * 1.04))
        dx_run = -28.0 + 73.0 * run_u
        hop = abs(math.sin(lt * stride_speed))
        dy_bob = -14.0 * hop
        # Subtle energetic scale swell as he rushes forward toward the kitchen
        boy_scale = 0.99 + 0.04 * math.sin(u * math.pi * 0.85)

        shadow_cfg = {
            "cx": 505.0,
            "cy": 706.0,
            "rx": 124.0,
            "ry": 16.0,
            "scale": 1.0 - 0.14 * hop,
            "strength": 0.25 - 0.07 * hop,
        }
        canvas = _composite_fg_onto_bg(
            bg,
            boy_fg,
            dx=dx_run,
            dy=dy_bob,
            scale=boy_scale,
            pivot=(505.0, 520.0),
            shadow_cfg=shadow_cfg,
        )

        # Swirling rose-gold raspberry aroma ribbons flowing past Boy's nose!
        aroma_pts = list(cfg["aroma_path"])
        aroma_pts[-1] = [565.0 + dx_run * 0.65, 290.0 + dy_bob * 0.5]
        add_aroma_ribbons(canvas, aroma_pts, t, intensity=0.52)
        add_light_motes(canvas, t, seed=202, count=30, sky_blue_ratio=0.10, intensity=0.80)

        # Smooth camera pan-follow tracking Boy forward across the sunlit hallway
        return apply_camera(
            canvas,
            zoom=1.05 + 0.065 * ease_in_out(u),
            cx_norm=0.475 + 0.068 * run_u,
            cy_norm=0.50 - 0.015 * u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.11,
        )

    def render_scene_03(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["03"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        lt = t - st
        cfg = self.landmarks["03"]
        mom_cfg = cfg["mom"]

        # 1. Background: dramatic billowing left sheer curtain + warm flickering baking oven!
        bg_mesh = MeshField()
        for c in cfg["curtains"]:
            bg_mesh.add_curtain_billow(c, t)
        bg = bg_mesh.apply(self.s03_bg)
        add_oven_glow(bg, cfg["oven_glow"], t, intensity=0.44)
        add_volumetric_sunbeams(bg, cfg["sunbeam_origin"], t, intensity=0.22, angle_deg=35.0)

        # 2. Modern Mom cutout: blinking + 30fps lip-sync + welcoming arm/skirt puppet warp!
        mom_fg = self.s03_fg.copy()
        mom_bgr = mom_fg[..., :3].copy()

        blink = compute_blink_amount(t, [st + 1.45, st + 4.55])
        for eye in mom_cfg["eyes"]:
            apply_painterly_blink(mom_bgr, eye, blink, t)

        e_mom, v_mom = self.get_lipsync("mom", frame_idx)
        apply_painterly_lipsync(mom_bgr, mom_cfg["mouth"], e_mom, v_mom)
        mom_fg[..., :3] = mom_bgr

        fg_mesh = MeshField()
        fg_mesh.add_s03_mom_welcoming(mom_cfg, lt)
        mom_fg = fg_mesh.apply(mom_fg)

        # Mom physically steps warmly forward toward Boy/camera (scale 1.00 -> 1.055, cleanly anchored!)
        step_u = ease_in_out(u)
        mom_scale = 1.00 + 0.055 * step_u
        walk_bob = -5.5 * abs(math.sin(lt * 3.0)) * (1.0 - 0.35 * step_u)
        dy_step = 4.0 * step_u + walk_bob

        shadow_cfg = {
            "cx": 706.0,
            "cy": 746.0,
            "rx": 92.0,
            "ry": 14.0,
            "scale": mom_scale,
            "strength": 0.24,
        }
        canvas = _composite_fg_onto_bg(
            bg,
            mom_fg,
            dx=2.0 * step_u,
            dy=dy_step,
            scale=mom_scale,
            pivot=(705.0, 390.0),
            shadow_cfg=shadow_cfg,
        )
        add_light_motes(canvas, t, seed=303, count=28, sky_blue_ratio=0.10, region=[80, 40, 1020, 720], intensity=0.82)

        # STRICT CROP: far-right dark pantry (x >= 1055) is 100% cropped cleanly out, with comfortable headroom above bun!
        return apply_camera(
            canvas,
            zoom=1.300 + 0.055 * step_u,
            cx_norm=0.378 + 0.017 * step_u,
            cy_norm=0.530 - 0.012 * step_u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.12,
        )

    def render_scene_04(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["04"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        cfg = self.landmarks["04"]

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(cfg["boy"]["torso_bbox"], t, amp_y=3.2, amp_x=1.4, freq=1.8)
        mesh.add_hair_sway(cfg["boy"]["hair_bbox"], t, amp_x=2.6, amp_y=1.6, freq=1.9)
        mesh.add_breathing(cfg["dove"]["body_bbox"], t, amp_y=2.4, amp_x=1.2, freq=2.0, phase=1.0)

        dove_tilt = 2.0 * math.sin(t * 1.15)
        mesh.add_pivoted_head_nod(cfg["dove"]["head_bbox"], cfg["dove"]["head_pivot"], dove_tilt)
        canvas = mesh.apply(self.imgs["04"])

        # Painterly blinks on both Boy & Dove
        b_boy = compute_blink_amount(t, [st + 1.85, st + 4.75])
        for eye in cfg["boy"]["eyes"]:
            apply_painterly_blink(canvas, eye, b_boy, t)

        b_dove = compute_blink_amount(t, [st + 3.10])
        for eye in cfg["dove"]["eyes"]:
            re = dict(eye)
            nx, ny = rotate_point((eye["cx"], eye["cy"]), tuple(cfg["dove"]["head_pivot"]), dove_tilt)
            re["cx"], re["cy"] = nx, ny
            apply_painterly_blink(canvas, re, b_dove, t)

        add_dove_halo(canvas, [955, 340], t, energy=0.0, intensity=0.22, radius=165.0)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.20, angle_deg=142.0)
        add_light_motes(canvas, t, seed=404, count=36, sky_blue_ratio=0.35, intensity=0.88)

        return apply_camera(
            canvas,
            zoom=1.02 + 0.075 * ease_in_out(u),
            cx_norm=0.47 + 0.065 * ease_in_out(u),
            cy_norm=0.50 - 0.015 * u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.11,
        )

    def render_scene_05(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["05"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        cfg = self.landmarks["05"]

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(cfg["dove"]["body_bbox"], t, amp_y=4.5, amp_x=2.2, freq=1.35)

        gentle_poise = 1.6 * math.sin(t * 0.75)
        mesh.add_pivoted_head_nod(cfg["dove"]["head_bbox"], cfg["dove"]["head_pivot"], gentle_poise)
        canvas = mesh.apply(self.imgs["05"])

        # Two slow, soulful, peaceful blinks on the macro sky-blue eye!
        b_dove = compute_blink_amount(t, [st + 2.85, st + 7.15], close_dur=0.14, hold_dur=0.07, open_dur=0.22)
        for eye in cfg["dove"]["eyes"]:
            re = dict(eye)
            nx, ny = rotate_point((eye["cx"], eye["cy"]), tuple(cfg["dove"]["head_pivot"]), gentle_poise)
            re["cx"], re["cy"] = nx, ny
            if "specular" in eye:
                sx, sy = rotate_point(tuple(eye["specular"]), tuple(cfg["dove"]["head_pivot"]), gentle_poise)
                re["specular"] = [int(round(sx)), int(round(sy))]
            apply_painterly_blink(canvas, re, b_dove, t)

        add_dove_halo(canvas, [680, 210], t, energy=0.1, intensity=0.22, radius=240.0)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.18, angle_deg=30.0)
        add_light_motes(canvas, t, seed=505, count=42, sky_blue_ratio=0.58, intensity=0.92)

        return apply_camera(
            canvas,
            zoom=1.01 + 0.14 * ease_in_out(u),
            cx_norm=0.50 + 0.015 * u,
            cy_norm=0.49 - 0.10 * ease_in_out(u),
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.10,
        )

    def render_scene_06(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["06"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        cfg = self.landmarks["06"]

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(cfg["boy"]["torso_bbox"], t, amp_y=3.5, amp_x=1.5, freq=2.0)
        mesh.add_hair_sway(cfg["boy"]["hair_bbox"], t, amp_x=3.0, amp_y=1.8, freq=2.1)
        mesh.add_breathing(cfg["dove"]["body_bbox"], t, amp_y=2.2, amp_x=1.0, freq=1.9)
        canvas = mesh.apply(self.imgs["06"])

        # Boy speaking "Хто ти?" + natural blinks on both characters
        e_boy, v_boy = self.get_lipsync("boy", frame_idx)
        apply_painterly_lipsync(canvas, cfg["boy"]["mouth"], e_boy, v_boy)

        b_boy = compute_blink_amount(t, [st + 1.95])
        for eye in cfg["boy"]["eyes"]:
            apply_painterly_blink(canvas, eye, b_boy, t)

        b_dove = compute_blink_amount(t, [st + 1.15])
        for eye in cfg["dove"]["eyes"]:
            apply_painterly_blink(canvas, eye, b_dove, t)

        add_dove_halo(canvas, [955, 340], t, energy=0.0, intensity=0.22, radius=160.0)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.18, angle_deg=142.0)
        add_light_motes(canvas, t, seed=606, count=34, sky_blue_ratio=0.35, intensity=0.85)

        return apply_camera(
            canvas,
            zoom=1.02 + 0.065 * ease_in_out(u),
            cx_norm=0.49 + 0.03 * ease_in_out(u),
            cy_norm=0.49 - 0.015 * u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.11,
        )

    def render_scene_07(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["07"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        cfg = self.landmarks["07"]
        dove_cfg = cfg["dove"]

        e_dove, v_dove = self.get_lipsync("dove", frame_idx)

        # Continuous majestic twin-wing feathered flutter + billowing curtains + basil sway!
        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_s07_wing_flutter(dove_cfg, t)

        # Subtle serene head emphasis synchronized with Dove's voice
        head_sway = 2.2 * math.sin(t * 1.45) - 2.4 * e_dove
        mesh.add_pivoted_head_nod(dove_cfg["head_bbox"], dove_cfg["head_pivot"], head_sway)
        canvas = mesh.apply(self.imgs["07"])

        # Articulated lower-beak lip-sync (adjusted for tiny head poise rotation!)
        beak_adj = dict(dove_cfg["beak"])
        beak_adj["hinge"] = list(rotate_point(tuple(dove_cfg["beak"]["hinge"]), tuple(dove_cfg["head_pivot"]), head_sway))
        beak_adj["upper_tip"] = list(rotate_point(tuple(dove_cfg["beak"]["upper_tip"]), tuple(dove_cfg["head_pivot"]), head_sway))
        apply_dove_beak_lipsync(canvas, beak_adj, e_dove, v_dove)

        # Serene painterly Dove blinks
        b_dove = compute_blink_amount(t, [st + 2.35, st + 6.15], close_dur=0.10, hold_dur=0.04, open_dur=0.15)
        for eye in dove_cfg["eyes"]:
            re = dict(eye)
            nx, ny = rotate_point((eye["cx"], eye["cy"]), tuple(dove_cfg["head_pivot"]), head_sway)
            re["cx"], re["cy"] = nx, ny
            apply_painterly_blink(canvas, re, b_dove, t)

        # Radiant pulsing golden-and-sky-blue celestial halo + abundant motes!
        add_dove_halo(canvas, dove_cfg["halo_center"], t, energy=e_dove, intensity=0.45, radius=275.0)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.22, angle_deg=110.0)
        add_light_motes(canvas, t, seed=707, count=52, sky_blue_ratio=0.52, intensity=0.98)

        return apply_camera(
            canvas,
            zoom=1.01 + 0.08 * ease_in_out(u),
            cx_norm=0.50 + 0.015 * math.sin(u * math.pi),
            cy_norm=0.50 - 0.045 * ease_in_out(u),
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.09,
        )

    def render_scene_08a(self, t: float, frame_idx: int) -> np.ndarray:
        st, _ = self.scene_bounds["08"]
        split_t = 54.72
        u = max(0.0, min(1.0, (t - st) / max(1e-4, split_t - st)))
        cfg = self.landmarks["08a"]
        boy_cfg = cfg["boy"]

        e_boy, v_boy = self.get_lipsync("boy", frame_idx)

        # Surprised eyebrow lift peaking on "Пиріг?" (50.38..51.34) and "Як пиріг?" (53.13..54.41)!
        q1 = smoothstep(50.32, 50.62, t) * (1.0 - smoothstep(51.20, 51.75, t))
        q2 = smoothstep(53.05, 53.35, t) * (1.0 - smoothstep(54.25, 54.70, t))
        surprise_lift = min(1.0, 0.25 + 0.75 * max(q1, q2) + 0.25 * e_boy)

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(boy_cfg["torso_bbox"], t, amp_y=4.0, amp_x=2.0, freq=2.3)
        mesh.add_hair_sway(boy_cfg["hair_bbox"], t, amp_x=4.0, amp_y=2.4, freq=2.4)
        mesh.add_s08a_surprise_eyebrows(boy_cfg, surprise_lift)
        canvas = mesh.apply(self.imgs["08a"])

        # Close-up 30fps lip-sync + natural blink between the two questions
        apply_painterly_lipsync(canvas, boy_cfg["mouth"], e_boy, v_boy)
        b_boy = compute_blink_amount(t, [51.95])
        for eye in boy_cfg["eyes"]:
            apply_painterly_blink(canvas, eye, b_boy, t)

        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.16, angle_deg=140.0)
        add_light_motes(canvas, t, seed=801, count=26, sky_blue_ratio=0.20, intensity=0.75)

        # Playful subtle micro-zoom pulse on both surprised questions!
        pulse_zoom = 0.025 * q1 + 0.035 * q2
        return apply_camera(
            canvas,
            zoom=1.02 + 0.045 * ease_in_out(u) + pulse_zoom,
            cx_norm=0.50,
            cy_norm=0.49 - 0.015 * surprise_lift,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.12,
        )

    def _compute_s08b_nod_angle(self, t: float) -> float:
        """3 calm, unmistakable, natural physical nods during 'А голуб стояв і лише головою кивав.'"""
        # Facing LEFT: negative angle pitches beak DOWN, positive angle lifts slightly UP!
        nods = [
            (55.08, 56.05, -13.0, 2.2),
            (56.08, 57.08, -12.0, 2.0),
            (57.12, 58.25, -12.5, 0.0),
        ]
        ang = 0.0
        for t0, t1, dip, up in nods:
            if t0 <= t <= t1:
                p = (t - t0) / (t1 - t0)
                if p < 0.48:
                    ang = dip * math.sin((p / 0.48) * math.pi * 0.5)
                elif p < 0.85:
                    q = (p - 0.48) / 0.37
                    ang = dip * (1.0 - ease_in_out(q)) + up * ease_in_out(q)
                else:
                    q = (p - 0.85) / 0.15
                    ang = up * (1.0 - ease_in_out(q))
                break
        return ang

    def render_scene_08b(self, t: float, frame_idx: int) -> np.ndarray:
        split_t = 54.72
        _, en = self.scene_bounds["08"]
        u = max(0.0, min(1.0, (t - split_t) / max(1e-4, en - split_t)))
        cfg = self.landmarks["08b"]
        dove_cfg = cfg["dove"]

        nod_deg = self._compute_s08b_nod_angle(t)

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(dove_cfg["body_bbox"], t, amp_y=2.2, amp_x=1.0, freq=1.8)
        mesh.add_pivoted_head_nod(dove_cfg["head_bbox"], dove_cfg["head_pivot"], nod_deg)
        canvas = mesh.apply(self.imgs["08b"])

        # Warm blink right on nod #2 (~56.45s), accurately tracked to rotated eye position!
        b_dove = compute_blink_amount(t, [56.42], close_dur=0.11, hold_dur=0.05, open_dur=0.16)
        for eye in dove_cfg["eyes"]:
            re = dict(eye)
            nx, ny = rotate_point((eye["cx"], eye["cy"]), tuple(dove_cfg["head_pivot"]), nod_deg)
            re["cx"], re["cy"] = nx, ny
            apply_painterly_blink(canvas, re, b_dove, t)

        add_dove_halo(canvas, [715, 290], t, energy=0.0, intensity=0.24, radius=190.0)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.20, angle_deg=135.0)
        add_light_motes(canvas, t, seed=802, count=36, sky_blue_ratio=0.45, intensity=0.88)

        return apply_camera(
            canvas,
            zoom=1.03 + 0.06 * ease_in_out(u),
            cx_norm=0.51,
            cy_norm=0.49 - 0.015 * u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.11,
        )

    def render_scene_09(self, t: float, frame_idx: int) -> np.ndarray:
        st, en = self.scene_bounds["09"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))
        cfg = self.landmarks["09"]
        mom_cfg = cfg["mom"]
        boy_cfg = cfg["boy"]

        e_boy, v_boy = self.get_lipsync("boy", frame_idx)

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(mom_cfg["torso_bbox"], t, amp_y=3.4, amp_x=1.5, freq=1.7)
        mesh.add_hair_sway(mom_cfg["hair_bbox"], t, amp_x=2.4, amp_y=1.5, freq=1.8)
        mesh.add_breathing(boy_cfg["torso_bbox"], t, amp_y=3.2, amp_x=1.4, freq=2.2)
        mesh.add_hair_sway(boy_cfg["hair_bbox"], t, amp_x=3.0, amp_y=2.0, freq=2.3)
        mesh.add_s09_pointing_gesture(boy_cfg, t, talk_energy=e_boy)
        canvas = mesh.apply(self.imgs["09"])

        # Boy speaking + natural blinks on both Mom & Boy
        apply_painterly_lipsync(canvas, boy_cfg["mouth"], e_boy, v_boy)
        b_boy = compute_blink_amount(t, [st + 2.80, st + 6.10])
        for eye in boy_cfg["eyes"]:
            apply_painterly_blink(canvas, eye, b_boy, t)

        b_mom = compute_blink_amount(t, [st + 1.65, st + 5.20])
        for eye in mom_cfg["eyes"]:
            apply_painterly_blink(canvas, eye, b_mom, t)

        # 6 organic multi-layered rising painterly steam wisps from the ruby-red raspberry pie!
        pie = cfg["pie"]
        add_pie_steam(canvas, pie["steam_x_range"], pie["steam_y"], t, n_wisps=6, height=205.0, intensity=0.58)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.20, angle_deg=142.0)
        add_light_motes(canvas, t, seed=909, count=34, sky_blue_ratio=0.18, intensity=0.84)

        return apply_camera(
            canvas,
            zoom=1.02 + 0.055 * ease_in_out(u),
            cx_norm=0.52 - 0.035 * ease_in_out(u),
            cy_norm=0.50 - 0.01 * u,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.11,
        )

    def render_scene_10(self, t: float, frame_idx: int) -> np.ndarray:
        """THREE-BEAT CLIMAX + MANDATORY 4.50-SECOND CONTEMPLATIVE MUTUAL GAZE PAUSE (81.7649s -> 86.2649s)!"""
        st, en = self.scene_bounds["10"]
        l19_st, l19_en = self.line_bounds["19_narrator_understood"]  # 77.4406 -> 81.7649
        cfg = self.landmarks["10"]
        mom_cfg = cfg["mom"]
        boy_cfg = cfg["boy"]
        dove_cfg = cfg["dove"]

        e_mom, v_mom = self.get_lipsync("mom", frame_idx)

        # Beat weights:
        # Beat 10a: st (66.18) -> l19_st (77.44) — intimate Mom caress & heartfelt speech
        # Beat 10b: l19_st (77.44) -> l19_en (81.76) — sweeping pull-back uniting Boy & Dove
        # Beat 10c: l19_en (81.76) -> en (86.26) — FULL 4.50s contemplative mutual gaze pause!
        caress_strength = 1.0 - smoothstep(l19_st - 0.6, l19_st + 1.4, t)
        pause_t = t - l19_en  # 0.0 -> 4.50s during Beat 10c!

        # Boy's subtle warm deepening smile right after his slow soulful blink (~82.8s -> 84.3s)!
        boy_smile_amt = smoothstep(l19_en + 1.05, l19_en + 2.35, t)

        # White Dove's gentle affectionate blessing tilt/bow around ~84.3s (2.5s into Beat 10c pause)!
        if pause_t < 2.20:
            dove_tilt = 1.2 * math.sin(t * 0.9)
        else:
            # Smooth bow down to -8.5 deg, holding warmly at -4.8 deg in silent blessing
            bow_in = smoothstep(2.20, 3.10, pause_t)
            bow_settle = smoothstep(3.10, 4.15, pause_t)
            dove_tilt = -8.5 * bow_in + 3.7 * bow_settle

        mesh = MeshField()
        for c in cfg["curtains"]:
            mesh.add_curtain_billow(c, t)
        for f in cfg["foliage"]:
            mesh.add_foliage_sway(f, t)
        mesh.add_breathing(mom_cfg["torso_bbox"], t, amp_y=3.0, amp_x=1.2, freq=1.45)
        mesh.add_hair_sway(mom_cfg["hair_bbox"], t, amp_x=2.0, amp_y=1.2, freq=1.5)
        mesh.add_breathing(boy_cfg["torso_bbox"], t, amp_y=2.8, amp_x=1.2, freq=1.65, phase=0.5)
        mesh.add_hair_sway(boy_cfg["hair_bbox"], t, amp_x=2.2, amp_y=1.4, freq=1.7)
        mesh.add_s10a_shoulder_caress(mom_cfg, t, caress_strength)
        mesh.add_s10_boy_feet_sway(boy_cfg, t)
        mesh.add_s10c_smile_deepen(boy_cfg, boy_smile_amt)

        mesh.add_breathing(dove_cfg["body_bbox"], t, amp_y=2.2, amp_x=1.0, freq=1.45, phase=1.2)
        mesh.add_pivoted_head_nod(dove_cfg["head_bbox"], dove_cfg["head_pivot"], dove_tilt)
        canvas = mesh.apply(self.imgs["10"])

        # Mom heartfelt lip-sync during Line 18 (70.97 -> 76.39)
        apply_painterly_lipsync(canvas, mom_cfg["mouth"], e_mom, v_mom)

        # Natural blinks during Beats 10a/10b + SLOW SOULFUL CONTEMPLATIVE BLINKS during Beat 10c!
        b_mom = compute_blink_amount(t, [st + 1.9, st + 6.2, st + 10.1, l19_en + 3.4], close_dur=0.11, hold_dur=0.05, open_dur=0.17)
        for eye in mom_cfg["eyes"]:
            apply_painterly_blink(canvas, eye, b_mom, t)

        # Boy: normal blinks in 10a/10b, plus SLOW SOULFUL BLINK at ~82.65s (~0.9s into Beat 10c)!
        b_boy_norm = compute_blink_amount(t, [st + 3.2, st + 8.1, l19_st + 1.8])
        b_boy_soul = compute_blink_amount(t, [l19_en + 0.88], close_dur=0.15, hold_dur=0.08, open_dur=0.23)
        b_boy = max(b_boy_norm, b_boy_soul)
        for eye in boy_cfg["eyes"]:
            apply_painterly_blink(canvas, eye, b_boy, t)

        # White Dove: serene blink in 10b + SLOW LUMINOUS BLINK at ~84.15s (~2.4s into Beat 10c)!
        b_dove_norm = compute_blink_amount(t, [l19_st + 2.4])
        b_dove_soul = compute_blink_amount(t, [l19_en + 2.38], close_dur=0.15, hold_dur=0.08, open_dur=0.24)
        b_dove = max(b_dove_norm, b_dove_soul)
        for eye in dove_cfg["eyes"]:
            re = dict(eye)
            nx, ny = rotate_point((eye["cx"], eye["cy"]), tuple(dove_cfg["head_pivot"]), dove_tilt)
            re["cx"], re["cy"] = nx, ny
            apply_painterly_blink(canvas, re, b_dove, t)

        # Soft warm lingering pie steam + radiant Dove aura + volumetric sunlight
        pie = cfg["pie"]
        add_pie_steam(canvas, pie["steam_x_range"], pie["steam_y"], t, n_wisps=4, height=130.0, intensity=0.36)

        gaze_glow = smoothstep(l19_st + 1.5, l19_en + 0.8, t)
        add_dove_halo(canvas, [955, 330], t, energy=0.15 * gaze_glow, intensity=0.22 + 0.16 * gaze_glow, radius=210.0)
        add_volumetric_sunbeams(canvas, cfg["sunbeam_origin"], t, intensity=0.22 + 0.05 * gaze_glow, angle_deg=142.0)
        add_light_motes(canvas, t, seed=1001, count=36, sky_blue_ratio=0.35 + 0.20 * gaze_glow, intensity=0.86)

        # Beat 10c: Luminous golden & sky-blue motes softly drifting along Boy <-> Dove mutual gaze sunbeam!
        if gaze_glow > 0.02:
            gl = cfg["gaze_line"]
            add_gaze_bridge_motes(canvas, gl["boy_eye"], gl["dove_eye"], t, intensity=0.95 * gaze_glow)

        # THREE-BEAT CAMERA CHOREOGRAPHY:
        if t < l19_st:
            # Beat 10a: Intimate warm push-in framing Mom & Boy (left-center)
            u10a = ease_in_out((t - st) / max(1e-4, l19_st - st))
            zoom = 1.36 + 0.08 * u10a
            cx_n = 0.355 + 0.020 * u10a
            cy_n = 0.440 - 0.015 * u10a
        elif t < l19_en:
            # Beat 10b: Smooth sweeping pull-back & glide uniting Mom, Boy, pie & glowing White Dove!
            u10b = ease_in_out((t - l19_st) / max(1e-4, l19_en - l19_st))
            zoom = 1.44 + (1.07 - 1.44) * u10b
            cx_n = 0.375 + (0.530 - 0.375) * u10b
            cy_n = 0.425 + (0.465 - 0.425) * u10b
        else:
            # ⭐ Beat 10c (FULL 4.50s!): Unhurried, tender cradling drift around Boy <-> Dove mutual gaze!
            u10c = ease_in_out((t - l19_en) / max(1e-4, en - l19_en))
            zoom = 1.07 + 0.065 * u10c
            cx_n = 0.530 + 0.018 * u10c
            cy_n = 0.465 - 0.028 * u10c

        return apply_camera(
            canvas,
            zoom=zoom,
            cx_norm=cx_n,
            cy_norm=cy_n,
            out_w=self.out_w,
            out_h=self.out_h,
            vignette=0.10,
        )

    def render_scene_11_outro(self, t: float, frame_idx: int) -> np.ndarray:
        """Warm golden sunlight bloom into velvety parchment Closing Title Card (86.2649 -> 90.1649s)."""
        st, en = self.scene_bounds["11_outro"]
        u = max(0.0, min(1.0, (t - st) / max(1e-4, en - st)))

        # Gentle serene breath zoom on Closing Title Card
        zoom = 1.00 + 0.025 * ease_in_out(u)
        h, w = self.title_closing.shape[:2]
        cw, ch = w / zoom, h / zoom
        x0, y0 = (w - cw) * 0.5, (h - ch) * 0.5
        sx, sy = w / cw, h / ch
        M = np.array([[sx, 0.0, -x0 * sx], [0.0, sy, -y0 * sy]], dtype=np.float32)
        frame = cv2.warpAffine(self.title_closing, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)

        # Delicate floating golden dust motes across the parchment card
        add_light_motes(frame, t, seed=1111, count=24, sky_blue_ratio=0.12, intensity=0.55)

        # Soft golden resolution at the very end (NO harsh pitch black — gentle warm cream-twilight fade!)
        fade_out = smoothstep(en - 0.95, en, t)
        if fade_out > 0.005:
            warm_cream = np.array([204.0, 224.0, 242.0], dtype=np.float32)  # serene golden parchment dusk
            frame = np.clip(frame.astype(np.float32) * (1.0 - fade_out * 0.65) + warm_cream * (fade_out * 0.65), 0, 255).astype(np.uint8)
        return frame

    # ------------------------------------------------------------------
    # Master Timeline Router with Golden Storybook Cross-Dissolves
    # ------------------------------------------------------------------

    def _render_by_key(self, key: str, t: float, frame_idx: int) -> np.ndarray:
        if key == "01":
            return self.render_scene_01(t, frame_idx)
        if key == "02":
            return self.render_scene_02(t, frame_idx)
        if key == "03":
            return self.render_scene_03(t, frame_idx)
        if key == "04":
            return self.render_scene_04(t, frame_idx)
        if key == "05":
            return self.render_scene_05(t, frame_idx)
        if key == "06":
            return self.render_scene_06(t, frame_idx)
        if key == "07":
            return self.render_scene_07(t, frame_idx)
        if key == "08a":
            return self.render_scene_08a(t, frame_idx)
        if key == "08b":
            return self.render_scene_08b(t, frame_idx)
        if key == "09":
            return self.render_scene_09(t, frame_idx)
        if key == "10":
            return self.render_scene_10(t, frame_idx)
        return self.render_scene_11_outro(t, frame_idx)

    def _golden_crossfade(self, img_a: np.ndarray, img_b: np.ndarray, alpha: float, bloom: float = 0.16) -> np.ndarray:
        """Warm golden storybook cross-dissolve between two 1080p frames."""
        a = ease_in_out(alpha)
        mix = img_a.astype(np.float32) * (1.0 - a) + img_b.astype(np.float32) * a
        # Soft sunlit honey bloom peaking right at the midpoint of the dissolve
        b_amt = math.sin(a * math.pi) * bloom
        if b_amt > 0.004:
            sun_gold = np.array([196.0, 232.0, 255.0], dtype=np.float32)
            mix = mix + b_amt * (255.0 - mix) * (sun_gold / 255.0)
        return np.clip(mix, 0, 255).astype(np.uint8)

    def render_frame(self, frame_idx: int) -> np.ndarray:
        """Render final 1920x1080 BGR frame for 0-based frame_idx at 30fps."""
        t = frame_idx / float(self.fps)

        # Ordered visual shots with exact boundaries from timeline.json (+ 08a/08b split at 54.72s)
        shots = [
            ("01", self.scene_bounds["01"][0], self.scene_bounds["01"][1], 0.42, 0.18),
            ("02", self.scene_bounds["02"][0], self.scene_bounds["02"][1], 0.42, 0.15),
            ("03", self.scene_bounds["03"][0], self.scene_bounds["03"][1], 0.42, 0.15),
            ("04", self.scene_bounds["04"][0], self.scene_bounds["04"][1], 0.42, 0.16),
            ("05", self.scene_bounds["05"][0], self.scene_bounds["05"][1], 0.42, 0.18),
            ("06", self.scene_bounds["06"][0], self.scene_bounds["06"][1], 0.40, 0.16),
            ("07", self.scene_bounds["07"][0], self.scene_bounds["07"][1], 0.40, 0.18),
            ("08a", self.scene_bounds["08"][0], 54.72, 0.28, 0.10),
            ("08b", 54.72, self.scene_bounds["08"][1], 0.42, 0.14),
            ("09", self.scene_bounds["09"][0], self.scene_bounds["09"][1], 0.44, 0.16),
            ("10", self.scene_bounds["10"][0], self.scene_bounds["10"][1], 0.85, 0.34),  # warm sunlit golden bloom into Outro!
            ("11_outro", self.scene_bounds["11_outro"][0], self.scene_bounds["11_outro"][1], 0.0, 0.0),
        ]

        # Find active shot
        active_i = len(shots) - 1
        for i, (key, st, en, _, _) in enumerate(shots):
            if t < en or i == len(shots) - 1:
                active_i = i
                break

        key, st, en, xfade_out, bloom_out = shots[active_i]

        # Check outgoing cross-dissolve into next shot (symmetric around boundary en)
        if active_i < len(shots) - 1 and xfade_out > 0.0:
            half = xfade_out * 0.5
            if t >= en - half:
                alpha = (t - (en - half)) / xfade_out
                f_a = self._render_by_key(key, t, frame_idx)
                f_b = self._render_by_key(shots[active_i + 1][0], t, frame_idx)
                return self._golden_crossfade(f_a, f_b, alpha, bloom=bloom_out)

        # Check incoming cross-dissolve from previous shot (symmetric around boundary st)
        if active_i > 0:
            prev_key, _, _, prev_xfade, prev_bloom = shots[active_i - 1]
            half = prev_xfade * 0.5
            if prev_xfade > 0.0 and t < st + half:
                alpha = (t - (st - half)) / prev_xfade
                f_a = self._render_by_key(prev_key, t, frame_idx)
                f_b = self._render_by_key(key, t, frame_idx)
                return self._golden_crossfade(f_a, f_b, alpha, bloom=prev_bloom)

        return self._render_by_key(key, t, frame_idx)
