"""Clean foreground segmentation and seamless architectural background reconstruction for Scene 02 (Boy) and Scene 03 (Mom)."""

from pathlib import Path
import cv2
import numpy as np

SCENES_DIR = Path("/home/antigravity/salfetos-ui/gemini/assets/scenes")
CACHE_DIR = Path("/home/antigravity/salfetos-ui/gemini/studio_v3/cache")


def _refine_alpha(mask_u8: np.ndarray, feather_px: float = 1.1) -> np.ndarray:
    """Keep largest connected component, fill tiny enclosed holes, and feather edges cleanly."""
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_u8, connectivity=8)
    if num_labels > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        best = 1 + int(np.argmax(areas))
        clean = np.where(labels == best, 255, 0).astype(np.uint8)
    else:
        clean = mask_u8.copy()

    # Fill tiny interior holes
    h, w = clean.shape
    inv = cv2.bitwise_not(clean)
    ff = inv.copy()
    ff_mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, ff_mask, (0, 0), 0)
    clean = cv2.bitwise_or(clean, ff)

    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, k3, iterations=1)

    alpha = clean.astype(np.float32) / 255.0
    if feather_px > 0:
        alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=feather_px, sigmaY=feather_px)
        alpha = np.clip((alpha - 0.14) / 0.76, 0.0, 1.0)
    return (alpha * 255.0).astype(np.uint8)


def _inpaint_clean(img_bgr: np.ndarray, mask_u8: np.ndarray, dilate_px: int = 12) -> np.ndarray:
    """Wide-dilated Telea + NS blend inpainting with gentle painterly bilateral smoothing."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1))
    inpaint_mask = cv2.dilate((mask_u8 > 16).astype(np.uint8) * 255, k, iterations=1)

    res_telea = cv2.inpaint(img_bgr, inpaint_mask, 9, cv2.INPAINT_TELEA)
    res_ns = cv2.inpaint(img_bgr, inpaint_mask, 7, cv2.INPAINT_NS)
    blended = cv2.addWeighted(res_telea, 0.65, res_ns, 0.35, 0)

    smooth = cv2.bilateralFilter(blended, 9, 36, 36)
    soft_m = cv2.GaussianBlur(inpaint_mask.astype(np.float32) / 255.0, (0, 0), 3.0)[..., None]
    return np.clip(smooth * soft_m + img_bgr * (1.0 - soft_m), 0, 255).astype(np.uint8)


def _blend_patch(dst: np.ndarray, patch: np.ndarray, mask_01: np.ndarray, y0: int, y1: int, x0: int, x1: int) -> None:
    """In-place soft alpha blend of patch onto dst[y0:y1, x0:x1] using float mask_01."""
    m = mask_01[y0:y1, x0:x1, None]
    dst[y0:y1, x0:x1] = np.clip(
        patch.astype(np.float32) * m + dst[y0:y1, x0:x1].astype(np.float32) * (1.0 - m),
        0,
        255,
    ).astype(np.uint8)


def _tile_clean_planks(
    src_img: np.ndarray,
    dst_h: int,
    dst_w: int,
    src_y0: int,
    src_y1: int,
    src_x0: int,
    src_x1: int,
) -> np.ndarray:
    """Build a crisp wood-plank texture patch via seamless mirrored tiling of clean sunlit planks."""
    src_patch = src_img[src_y0:src_y1, src_x0:src_x1]
    sh, sw = src_patch.shape[:2]
    # Resize vertically to match target height while preserving plank width scale, then mirror-tile horizontally
    v_scaled = cv2.resize(src_patch, (sw, dst_h), interpolation=cv2.INTER_CUBIC)
    mir = cv2.flip(v_scaled, 1)
    pair = np.hstack([v_scaled, mir])
    reps = (dst_w // pair.shape[1]) + 2
    tiled = np.tile(pair, (1, reps, 1))[:, :dst_w]
    return tiled


def segment_scene_02(force: bool = False):
    """Segment the running Boy in Scene 02 and cleanly reconstruct the sunlit hallway, baseboard, and crisp wood planks."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    bg_path = CACHE_DIR / "s02_bg.png"
    fg_path = CACHE_DIR / "s02_fg.png"
    if not force and bg_path.exists() and fg_path.exists():
        return cv2.imread(str(bg_path)), cv2.imread(str(fg_path), cv2.IMREAD_UNCHANGED)

    img = cv2.imread(str(SCENES_DIR / "scene_02_boy_runs_in.jpg"))
    h, w = img.shape[:2]

    gc_mask = np.full((h, w), cv2.GC_BGD, dtype=np.uint8)
    gc_mask[162:716, 304:710] = cv2.GC_PR_BGD

    # Expanded probable-FG polygon cleanly capturing 100% of Boy's chestnut curls (left to x=402, top to y=164)
    pr_fg_poly = np.array([
        [432, 168], [500, 162], [564, 166], [600, 198],
        [606, 268], [588, 326], [568, 350], [638, 405],
        [708, 434], [706, 470], [620, 456], [562, 428],
        [548, 514], [538, 608], [598, 648], [598, 710],
        [516, 712], [492, 616], [452, 612], [398, 620],
        [386, 656], [348, 656], [348, 584], [404, 558],
        [430, 505], [435, 445], [388, 455], [356, 474],
        [308, 460], [308, 424], [396, 382], [442, 344],
        [406, 300], [400, 240], [412, 194]
    ], dtype=np.int32)
    cv2.fillPoly(gc_mask, [pr_fg_poly], cv2.GC_PR_FGD)

    # Definite FG cores inside Boy (including left/top curls!)
    fg_polys = [
        np.array([[426, 192], [574, 196], [586, 294], [532, 326], [452, 314], [418, 255]], np.int32),
        np.array([[456, 355], [544, 360], [540, 494], [448, 494]], np.int32),
        np.array([[446, 510], [524, 510], [532, 614], [492, 616], [458, 558]], np.int32),
        np.array([[402, 574], [462, 560], [460, 604], [400, 608]], np.int32),
        np.array([[392, 408], [464, 378], [466, 412], [404, 436]], np.int32),
        np.array([[548, 380], [614, 415], [608, 440], [545, 414]], np.int32),
        np.array([[358, 598], [412, 588], [414, 608], [384, 640], [360, 642]], np.int32),
        np.array([[522, 654], [552, 668], [582, 668], [544, 696], [524, 694]], np.int32),
    ]
    for p in fg_polys:
        cv2.fillPoly(gc_mask, [p], cv2.GC_FGD)

    # Explicit definite BG masks keeping hair curls untouched while stripping wall/plant/floor gaps
    bg_polys = [
        np.array([[304, 555], [348, 555], [348, 678], [304, 678]], np.int32),
        np.array([[394, 622], [478, 614], [504, 712], [358, 712], [358, 656]], np.int32),
        np.array([[388, 322], [444, 324], [442, 362], [388, 366]], np.int32),
        np.array([[368, 454], [434, 454], [428, 548], [365, 558]], np.int32),
        np.array([[304, 710], [710, 710], [710, 768], [304, 768]], np.int32),
        np.array([[562, 450], [710, 468], [710, 648], [558, 636]], np.int32),
        np.array([[594, 320], [710, 320], [710, 416], [634, 392]], np.int32),
        np.array([[304, 305], [404, 308], [394, 378], [304, 412]], np.int32),
    ]
    for p in bg_polys:
        cv2.fillPoly(gc_mask, [p], cv2.GC_BGD)

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, gc_mask, None, bgd_model, fgd_model, 8, cv2.GC_INIT_WITH_MASK)

    raw_mask = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    hull_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(hull_mask, [pr_fg_poly], 255)
    raw_mask = cv2.bitwise_and(raw_mask, hull_mask)
    alpha = _refine_alpha(raw_mask, feather_px=1.0)

    # -----------------------------------------------------------------------
    # ARCHITECTURALLY CLEAN HALLWAY & PLANK-PRESERVING FLOOR RECONSTRUCTION
    # -----------------------------------------------------------------------
    # 1. Wide-dilated foreground mask (dilate_px=12) so 100% of dark curls & edges are erased
    #    Keep floor cast shadow OUTSIDE Telea so original crisp wood planks stay razor-sharp!
    k12 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    boy_dil = cv2.dilate((alpha > 12).astype(np.uint8) * 255, k12, iterations=1)
    # Also ensure every pixel inside the hair envelope is covered in the removal mask
    hair_pad = np.zeros((h, w), dtype=np.uint8)
    cv2.ellipse(hair_pad, (505, 248), (112, 86), 0, 0, 360, 255, -1)
    boy_dil = cv2.bitwise_or(boy_dil, cv2.bitwise_and(hair_pad, cv2.dilate(raw_mask, k12)))

    bg_clean = _inpaint_clean(img, boy_dil, dilate_px=2)
    m_boy = cv2.GaussianBlur(boy_dil.astype(np.float32) / 255.0, (0, 0), 4.5)

    # 2. Reconstruct smooth sunlit rear hallway wall (x=415..562, y=150..570) with ZERO seam at x=410!
    #    Match exact warm cream-taupe luminance of clean upper wall (y=135..165) + left clean strip (x=416..428)
    #    with gentle sunlit warmth moving down toward the floor (NOT dark grey!)
    wy0, wy1, wx0, wx1 = 148, 570, 415, 564
    wh, ww = wy1 - wy0, wx1 - wx0
    top_strip = img[132:162, wx0:wx1].astype(np.float32)
    wall_base = cv2.resize(top_strip, (ww, wh), interpolation=cv2.INTER_CUBIC)
    # Measure clean warm wall brightness on left side wall near corner (y=360..540, x=340..368) vs top
    top_luma = float(np.mean(top_strip))
    left_mid_col = np.median(img[280:360, 418:432].reshape(-1, 3), axis=0).astype(np.float32)
    top_mid_col = np.median(top_strip[:, :20].reshape(-1, 3), axis=0).astype(np.float32)
    # Smooth gentle vertical illumination gradient (slightly brighter/warmer in sunlit mid-wall, soft near baseboard)
    yy_w = np.linspace(0.0, 1.0, wh, dtype=np.float32)[:, None]
    xx_w = np.linspace(0.0, 1.0, ww, dtype=np.float32)[None, :]
    # Diagonal morning sunlight shaft streaming from upper-left to lower-mid wall
    sun_shaft = np.exp(-0.5 * ((yy_w * 1.1 - xx_w * 0.65 - 0.25) / 0.42) ** 2)
    ratio = np.clip(left_mid_col / (top_mid_col + 1e-4), 0.96, 1.14)
    warm_gain = 1.0 + (ratio[None, None, :] - 1.0) * (0.65 * sun_shaft[..., None] + 0.35 * yy_w[..., None])
    wall_col = np.clip(wall_base * warm_gain, 0, 255)
    # Smoothly feather the left edge x=415..428 so there is ZERO vertical seam along x=415!
    edge_l = np.clip(np.arange(ww, dtype=np.float32) / 14.0, 0.0, 1.0)[None, :]
    m_wall = m_boy.copy()
    m_wall[wy0:wy1, wx0:wx1] *= edge_l
    _blend_patch(bg_clean, wall_col, m_wall, wy0, wy1, wx0, wx1)

    # 3. Restore crisp horizontal white baseboard (y=566..605, x=415..564) from clean right rear-wall baseboard (x=1044..1072)
    bb_src = img[566:605, 1046:1072].astype(np.float32)
    bb_patch = cv2.resize(bb_src, (wx1 - wx0, 605 - 566), interpolation=cv2.INTER_CUBIC)
    # Match brightness smoothly to the left baseboard at x=335..365, y=585..612
    bb_patch = np.clip(bb_patch * 0.97, 0, 255)
    m_bb = m_boy.copy()
    m_bb[566:605, wx0:wx1] *= edge_l
    _blend_patch(bg_clean, bb_patch, m_bb, 566, 605, wx0, wx1)

    # 4. Restore crisp vertical white kitchen doorway molding (x=562..598, y=155..604) from clean top trim (y=68..155)
    trim_src = img[68:155, 562:598].astype(np.float32)
    trim_bot = img[545:598, 562:598].astype(np.float32)
    trim_col = cv2.resize(trim_src, (598 - 562, 604 - 155), interpolation=cv2.INTER_CUBIC)
    # Match vertical shading smoothly from top trim to bottom trim
    top_t_mean = np.mean(trim_src, axis=(0, 1))
    bot_t_mean = np.mean(trim_bot, axis=(0, 1))
    ty_g = np.linspace(0.0, 1.0, 604 - 155, dtype=np.float32)[:, None, None]
    trim_gain = (1.0 - ty_g) + ty_g * np.clip(bot_t_mean / (top_t_mean + 1e-4), 0.85, 1.15)[None, None, :]
    trim_col = np.clip(trim_col * trim_gain, 0, 255)
    _blend_patch(bg_clean, trim_col, m_boy, 155, 604, 562, 598)

    # 5. Plank-preserving floor restoration (ZERO GaussianBlur puddle!)
    #    (A) For the two foot-overlap holes (back foot x=340..422, y=596..668; front foot x=508..608, y=604..718),
    #        clone crisp sunlit painted wood planks directly from pristine right-side planks (x=760..980, y=604..718)!
    for fy0, fy1, fx0, fx1, sx0, sx1 in [
        (600, 668, 340, 426, 760, 846),
        (604, 720, 506, 610, 770, 874),
    ]:
        plank_src = img[fy0:fy1, sx0:sx1].astype(np.float32)
        # Match local warm floor color right next to the hole (clean ring immediately outside boy_dil)
        ring_y0, ring_y1 = max(604, fy0), min(755, fy1 + 18)
        ring_x0, ring_x1 = max(320, fx0 - 25), min(760, fx1 + 25)
        ring_m = boy_dil[ring_y0:ring_y1, ring_x0:ring_x1] == 0
        if np.any(ring_m):
            target_med = np.median(bg_clean[ring_y0:ring_y1, ring_x0:ring_x1][ring_m], axis=0).astype(np.float32)
            src_med = np.median(plank_src.reshape(-1, 3), axis=0).astype(np.float32)
            plank_matched = np.clip(plank_src * np.clip(target_med / (src_med + 1e-4), 0.78, 1.25), 0, 255)
        else:
            plank_matched = plank_src
        _blend_patch(bg_clean, plank_matched, m_boy, fy0, fy1, fx0, fx1)

    #    (B) Gently de-shadow the original Boy's painted cast floor shadow (y=672..736, x=365..985)
    #        by lifting ONLY low-frequency shadow darkness back to match clean sunlit planks above/below,
    #        keeping 100% of razor-sharp painted wood grain & perspective plank seams intact!
    sh_y0, sh_y1, sh_x0, sh_x1 = 670, 740, 355, 995
    floor_strip = bg_clean[sh_y0:sh_y1, sh_x0:sh_x1].astype(np.float32)
    ref_above = np.median(bg_clean[642:668, sh_x0:sh_x1].astype(np.float32), axis=0)  # (W, 3)
    ref_below = np.median(bg_clean[740:764, sh_x0:sh_x1].astype(np.float32), axis=0)  # (W, 3)
    ref_above = cv2.GaussianBlur(ref_above[None, :, :], (0, 0), sigmaX=18.0, sigmaY=0.5)[0]
    ref_below = cv2.GaussianBlur(ref_below[None, :, :], (0, 0), sigmaX=18.0, sigmaY=0.5)[0]
    ty_f = np.linspace(0.0, 1.0, sh_y1 - sh_y0, dtype=np.float32)[:, None, None]
    expected_col = ref_above[None, :, :] * (1.0 - ty_f) + ref_below[None, :, :] * ty_f

    # Separate low-frequency illumination from crisp high-frequency wood grain & seams
    low_freq = cv2.GaussianBlur(floor_strip, (0, 0), sigmaX=14.0, sigmaY=9.0)
    # Only lift where low_freq is genuinely darker than expected sunlit floor (ratio > 1.03)
    lift_ratio = np.clip(expected_col / (low_freq + 8.0), 1.0, 1.38)
    # Smooth elliptical weight covering the cast shadow band
    yy_s, xx_s = np.mgrid[0:(sh_y1 - sh_y0), 0:(sh_x1 - sh_x0)].astype(np.float32)
    ew_y = np.exp(-0.5 * ((yy_s - 34.0) / 18.0) ** 2)
    ew_x = np.clip(np.minimum(xx_s / 45.0, (sh_x1 - sh_x0 - xx_s) / 55.0), 0.0, 1.0)
    ew = (ew_y * ew_x)[..., None] * 0.85
    deshadowed = floor_strip * (1.0 + (lift_ratio - 1.0) * ew)
    bg_clean[sh_y0:sh_y1, sh_x0:sh_x1] = np.clip(deshadowed, 0, 255).astype(np.uint8)

    fg_rgba = np.dstack([img, alpha])
    cv2.imwrite(str(bg_path), bg_clean)
    cv2.imwrite(str(fg_path), fg_rgba)
    return bg_clean, fg_rgba


def segment_scene_03(force: bool = False):
    """Segment Modern Mom in Scene 03 and cleanly reconstruct bright sunlit kitchen geometry behind her (ZERO ghost halo)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    bg_path = CACHE_DIR / "s03_bg.png"
    fg_path = CACHE_DIR / "s03_fg.png"
    if not force and bg_path.exists() and fg_path.exists():
        return cv2.imread(str(bg_path)), cv2.imread(str(fg_path), cv2.IMREAD_UNCHANGED)

    img = cv2.imread(str(SCENES_DIR / "scene_03_mom_welcomes.jpg"))
    h, w = img.shape[:2]

    gc_mask = np.full((h, w), cv2.GC_BGD, dtype=np.uint8)
    gc_mask[146:758, 510:902] = cv2.GC_PR_BGD

    # Tight probable-FG polygon hugging Mom strictly (excluding kitchen window & counter!)
    pr_fg_poly = np.array([
        [670, 148], [760, 150], [768, 255], [748, 272],
        [786, 308], [835, 368], [896, 386], [896, 428],
        [846, 422], [774, 366], [766, 462], [806, 616],
        [752, 648], [752, 718], [726, 724], [716, 756],
        [672, 756], [680, 654], [618, 632], [650, 462],
        [644, 366], [580, 408], [516, 415], [516, 370],
        [592, 355], [648, 286], [662, 245], [660, 195]
    ], dtype=np.int32)
    cv2.fillPoly(gc_mask, [pr_fg_poly], cv2.GC_PR_FGD)

    fg_polys = [
        np.array([[678, 162], [750, 166], [746, 244], [682, 246]], np.int32),
        np.array([[668, 286], [746, 286], [760, 478], [656, 478]], np.int32),
        np.array([[650, 478], [766, 478], [786, 612], [638, 616]], np.int32),
        np.array([[645, 316], [660, 338], [576, 390], [554, 378]], np.int32),
        np.array([[756, 318], [842, 388], [830, 404], [750, 342]], np.int32),
        np.array([[690, 652], [708, 652], [710, 744], [684, 744]], np.int32),
        np.array([[724, 646], [742, 646], [746, 710], [728, 710]], np.int32),
    ]
    for p in fg_polys:
        cv2.fillPoly(gc_mask, [p], cv2.GC_FGD)

    # STRICT definite BG masks around Mom (completely excluding sunlit window & counter!)
    bg_polys = [
        np.array([[510, 146], [656, 146], [648, 275], [588, 350], [510, 365]], np.int32),
        np.array([[772, 146], [902, 146], [902, 375], [840, 360], [790, 300]], np.int32),
        np.array([[510, 418], [644, 418], [640, 535], [510, 535]], np.int32),
        np.array([[776, 405], [842, 425], [902, 434], [902, 585], [792, 585]], np.int32),
        np.array([[510, 645], [668, 648], [668, 758], [510, 758]], np.int32),
        np.array([[762, 648], [902, 648], [902, 758], [762, 758]], np.int32),
        np.array([[595, 402], [644, 370], [644, 425]], np.int32),
        np.array([[768, 372], [826, 415], [770, 428]], np.int32),
        np.array([[715, 668], [724, 668], [722, 718], [714, 718]], np.int32),
    ]
    for p in bg_polys:
        cv2.fillPoly(gc_mask, [p], cv2.GC_BGD)

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, gc_mask, None, bgd_model, fgd_model, 8, cv2.GC_INIT_WITH_MASK)

    raw_mask = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    hull_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(hull_mask, [pr_fg_poly], 255)
    raw_mask = cv2.bitwise_and(raw_mask, hull_mask)
    alpha = _refine_alpha(raw_mask, feather_px=1.0)

    # -----------------------------------------------------------------------
    # BRIGHT-KITCHEN ARCHITECTURAL RECONSTRUCTION (ZERO DARK GHOST HALO!)
    # -----------------------------------------------------------------------
    # 1. Dilate removal mask cleanly by 12px so ZERO dark hair/t-shirt/skirt outline leaks in!
    k12 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    mom_dil = cv2.dilate((alpha > 12).astype(np.uint8) * 255, k12, iterations=1)
    bg_clean = _inpaint_clean(img, mom_dil, dilate_px=2)
    m_mom = cv2.GaussianBlur(mom_dil.astype(np.float32) / 255.0, (0, 0), 4.0)

    # 2. Zone A — Sunlit kitchen window & white right window frame (x=630..688, y=158..410)
    #    Clone clean sunlit right window pane brightness from adjacent clean left pane (x=590..638)
    win_src = img[168:402, 594:636].astype(np.float32)
    win_pane = cv2.resize(win_src, (676 - 654, 402 - 168), interpolation=cv2.INTER_CUBIC)
    # Warm sunlit window glow matching right pane
    win_pane = np.clip(win_pane * 1.03 + 6.0, 0, 255)
    _blend_patch(bg_clean, win_pane, m_mom, 168, 402, 654, 676)

    # Clean vertical white right window casing (x=676..690, y=160..410) from clean left casing (x=538..552)
    casing_src = img[160:410, 538:552].astype(np.float32)
    _blend_patch(bg_clean, casing_src, m_mom, 160, 410, 676, 690)

    # 3. Zone B — Bright cream kitchen wall between window & upper cabinets (x=688..740, y=148..414)
    #    Sample pristine warm sunlit wall right above Mom's head (y=116..146, x=688..740)
    wall_top = img[116:146, 688:740].astype(np.float32)
    wall_fill = cv2.resize(wall_top, (740 - 688, 414 - 148), interpolation=cv2.INTER_CUBIC)
    # Gentle sunlit brightness boost matching the sunlit wall at y=280..400 (NO dark smudge!)
    wy_g = np.linspace(1.0, 1.06, 414 - 148, dtype=np.float32)[:, None, None]
    wall_fill = np.clip(wall_fill * wy_g, 0, 255)
    _blend_patch(bg_clean, wall_fill, m_mom, 148, 414, 688, 740)

    # 4. Zone C — Upper kitchen cabinets behind Mom's upper right shoulder & head (x=738..842, y=135..314)
    #    Clone horizontally from clean right cabinet surface (x=822..894, y=135..314), matched to left cabinet top (y=120..145)
    cab_src = img[135:314, 820:892].astype(np.float32)
    cab_fill = cv2.resize(cab_src, (842 - 738, 314 - 135), interpolation=cv2.INTER_CUBIC)
    # Match exact sunlit brightness of the clean top of the left cabinet (x=742..805, y=125..150)
    l_cab_med = np.median(img[125:150, 742:805].reshape(-1, 3), axis=0).astype(np.float32)
    r_cab_med = np.median(img[125:150, 822:885].reshape(-1, 3), axis=0).astype(np.float32)
    cab_fill = np.clip(cab_fill * np.clip(l_cab_med / (r_cab_med + 1e-4), 0.94, 1.15), 0, 255)
    # Add subtle diagonal warm sunbeam glow across lower-left of cabinet matching x=740..810
    yy_c, xx_c = np.mgrid[0:(314 - 135), 0:(842 - 738)].astype(np.float32)
    beam_c = np.clip((yy_c / 179.0 - xx_c / 104.0 * 0.6 + 0.15), 0.0, 1.0)[..., None]
    cab_fill = np.clip(cab_fill + beam_c * np.array([10.0, 16.0, 20.0], dtype=np.float32), 0, 255)
    _blend_patch(bg_clean, cab_fill, m_mom, 135, 314, 738, 842)

    # 5. Zone D — Clean bright sunlit backsplash behind Mom's right arm/hand & shoulders (x=738..904, y=314..420)
    #    Sample clean sunlit backsplash right above her outstretched right hand (y=318..360, x=812..904)
    bs_src = img[318:360, 812:904].astype(np.float32)
    bs_fill = cv2.resize(bs_src, (904 - 738, 420 - 314), interpolation=cv2.INTER_CUBIC)
    bs_fill = np.clip(bs_fill * 1.02, 0, 255)
    _blend_patch(bg_clean, bs_fill, m_mom, 314, 420, 738, 904)

    # Clean horizontal counter edge & oven top control panel behind Mom's right fingertips (x=812..908, y=414..446)
    # Blend clean left/right oven panel edges (x=814..828 & x=898..912) horizontally across y=414..446
    ov_l = img[414:446, 812:826].astype(np.float32)
    ov_r = img[414:446, 898:912].astype(np.float32)
    ov_row_l = np.median(ov_l, axis=1, keepdims=True)
    ov_row_r = np.median(ov_r, axis=1, keepdims=True)
    tx_ov = np.linspace(0.0, 1.0, 908 - 812, dtype=np.float32)[None, :, None]
    ov_fill = ov_row_l * (1.0 - tx_ov) + ov_row_r * tx_ov
    _blend_patch(bg_clean, ov_fill, m_mom, 414, 446, 812, 908)

    # 6. Zone E — Clean sunlit left kitchen island front behind Mom's left skirt/apron (x=592..656, y=420..648)
    isl_src = img[420:648, 548:612].astype(np.float32)
    _blend_patch(bg_clean, isl_src, m_mom, 420, 648, 592, 656)

    # Clean bright lower kitchen cabinet drawers behind Mom's torso/apron/skirt (x=654..812, y=420..608)
    # Use clean horizontal drawer strip from x=772..804, y=420..608
    drw_src = img[420:608, 772:804].astype(np.float32)
    drw_fill = cv2.resize(drw_src, (812 - 654, 608 - 420), interpolation=cv2.INTER_CUBIC)
    # Gentle warm sunlit tint on left side near window
    tx_d = np.linspace(1.0, 0.0, 812 - 654, dtype=np.float32)[None, :, None]
    drw_fill = np.clip(drw_fill + tx_d * np.array([6.0, 14.0, 20.0], dtype=np.float32), 0, 255)
    _blend_patch(bg_clean, drw_fill, m_mom, 420, 608, 654, 812)

    # 7. Zone F — Clean sunlit horizontal wood floorboards behind Mom's lower skirt & sneakers (x=598..824, y=604..758)
    #    Row-by-row horizontal interpolation between pristine left planks (x=548..598) & right planks (x=822..896)
    #    preserving 100% of crisp horizontal wood plank seams & golden sunlight bars!
    fl_y0, fl_y1, fl_x0, fl_x1 = 604, 758, 598, 824
    fl_w = fl_x1 - fl_x0
    right_planks = img[fl_y0:fl_y1, 822:906].astype(np.float32)
    right_tiled = _tile_clean_planks(img, fl_y1 - fl_y0, fl_w, fl_y0, fl_y1, 822, 906).astype(np.float32)
    # Match gentle horizontal sunlit gradient from left floor (x=555..596) to right floor (x=822..880)
    # Below y=648 left side is open floor; above y=648 left side is island base so rely on right planks!
    l_row = np.median(img[fl_y0:fl_y1, 555:596].astype(np.float32), axis=1, keepdims=True)
    r_row = np.median(right_planks, axis=1, keepdims=True)
    # Smoothly transition l_row to r_row above y=648 where island ends
    yy_fl = np.arange(fl_y0, fl_y1, dtype=np.float32)[:, None, None]
    w_left_valid = np.clip((yy_fl - 648.0) / 14.0, 0.0, 1.0)
    l_target = l_row * w_left_valid + r_row * (1.0 - w_left_valid)
    tx_fl = np.linspace(0.0, 1.0, fl_w, dtype=np.float32)[None, :, None]
    desired_row = l_target * (1.0 - tx_fl) + r_row * tx_fl
    gain_fl = np.clip(desired_row / (r_row + 8.0), 0.85, 1.18)
    floor_patch = np.clip(right_tiled * gain_fl, 0, 255)
    _blend_patch(bg_clean, floor_patch, m_mom, fl_y0, fl_y1, fl_x0, fl_x1)

    fg_rgba = np.dstack([img, alpha])
    cv2.imwrite(str(bg_path), bg_clean)
    cv2.imwrite(str(fg_path), fg_rgba)
    return bg_clean, fg_rgba


if __name__ == "__main__":
    print("Re-segmenting Scene 02 (Boy) and Scene 03 (Mom) with architectural clean-plate reconstruction...")
    bg2, fg2 = segment_scene_02(force=True)
    bg3, fg3 = segment_scene_03(force=True)

    def save_qa(bg, fg, out_path):
        h, w = bg.shape[:2]
        chk = np.zeros((h, w, 3), dtype=np.uint8)
        yy, xx = np.mgrid[0:h, 0:w]
        pat = ((xx // 16) + (yy // 16)) % 2 == 0
        chk[pat] = (180, 210, 180)
        chk[~pat] = (140, 175, 140)
        a = fg[..., 3:4].astype(np.float32) / 255.0
        comp = (fg[..., :3] * a + chk * (1.0 - a)).astype(np.uint8)
        strip = np.hstack([cv2.resize(bg, (688, 384)), cv2.resize(comp, (688, 384))])
        cv2.imwrite(out_path, strip, [cv2.IMWRITE_JPEG_QUALITY, 92])

    Path("/tmp/v3_previews").mkdir(parents=True, exist_ok=True)
    save_qa(bg2, fg2, "/tmp/v3_previews/qa_seg_s02.jpg")
    save_qa(bg3, fg3, "/tmp/v3_previews/qa_seg_s03.jpg")
    print("Done!")
