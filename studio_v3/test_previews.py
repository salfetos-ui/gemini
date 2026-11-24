"""Generate zoomed & full-frame QA verification contact strips for studio_v3 before final 1080p render."""

import sys
from pathlib import Path
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from director import SceneDirector

OUT_DIR = Path("/tmp/v3_previews")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def label_tile(img: np.ndarray, text: str) -> np.ndarray:
    out = img.copy()
    cv2.rectangle(out, (0, 0), (out.shape[1], 30), (20, 20, 20), -1)
    cv2.putText(out, text, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 245, 210), 1, cv2.LINE_AA)
    return out


def pack_grid(rows: list[list[np.ndarray]], tile_w: int, tile_h: int) -> np.ndarray:
    n_rows = len(rows)
    n_cols = max(len(r) for r in rows)
    canvas = np.full((n_rows * tile_h, n_cols * tile_w, 3), 24, dtype=np.uint8)
    for r_i, row in enumerate(rows):
        for c_i, tile in enumerate(row):
            resized = cv2.resize(tile, (tile_w, tile_h), interpolation=cv2.INTER_AREA)
            canvas[r_i * tile_h : (r_i + 1) * tile_h, c_i * tile_w : (c_i + 1) * tile_w] = resized
    return canvas


def crop_norm(frame: np.ndarray, x0n: float, y0n: float, x1n: float, y1n: float) -> np.ndarray:
    h, w = frame.shape[:2]
    x0, x1 = int(round(x0n * w)), int(round(x1n * w))
    y0, y1 = int(round(y0n * h)), int(round(y1n * h))
    return frame[max(0, y0) : min(h, y1), max(0, x0) : min(w, x1)]


def find_peak_speech_frame(d: SceneDirector, role: str, t0: float, t1: float) -> int:
    f0, f1 = int(t0 * d.fps), int(t1 * d.fps)
    best_f, best_e = f0, -1.0
    for f in range(f0, min(f1 + 1, d.total_frames)):
        e, _ = d.get_lipsync(role, f)
        if e > best_e:
            best_e = e
            best_f = f
    return best_f


def main():
    d = SceneDirector(out_w=1920, out_h=1080)

    def rf(t: float) -> np.ndarray:
        return d.render_frame(int(round(t * d.fps)))

    def rfi(fi: int) -> np.ndarray:
        return d.render_frame(fi)

    # 1. BOY BLINKS & LIP-SYNC (zoomed crops!)
    f_s02_pk = find_peak_speech_frame(d, "boy", 4.6, 6.4)
    f_s06_pk = find_peak_speech_frame(d, "boy", 37.7, 38.6)
    f_s08_pk1 = find_peak_speech_frame(d, "boy", 50.4, 51.3)
    f_s08_pk2 = find_peak_speech_frame(d, "boy", 53.2, 54.3)
    f_s09_pk = find_peak_speech_frame(d, "boy", 59.5, 65.0)

    r1 = [
        label_tile(crop_norm(rf(4.25), 0.20, 0.18, 0.44, 0.56), "S02 Boy silent"),
        label_tile(crop_norm(rfi(f_s02_pk), 0.24, 0.18, 0.48, 0.56), f"S02 Boy speak e={d.get_lipsync('boy', f_s02_pk)[0]:.2f}"),
        label_tile(crop_norm(rf(5.45), 0.24, 0.18, 0.48, 0.56), "S02 Boy BLINK"),
        label_tile(crop_norm(rf(37.45), 0.34, 0.24, 0.54, 0.58), "S06 Boy silent"),
    ]
    r2 = [
        label_tile(crop_norm(rfi(f_s06_pk), 0.34, 0.24, 0.54, 0.58), f"S06 Boy speak e={d.get_lipsync('boy', f_s06_pk)[0]:.2f}"),
        label_tile(crop_norm(rf(39.32), 0.34, 0.24, 0.54, 0.58), "S06 Boy BLINK"),
        label_tile(crop_norm(rf(52.35), 0.38, 0.28, 0.64, 0.72), "S08a Boy closed"),
        label_tile(crop_norm(rfi(f_s08_pk1), 0.38, 0.28, 0.64, 0.72), f"S08a Boy speak1 e={d.get_lipsync('boy', f_s08_pk1)[0]:.2f}"),
    ]
    r3 = [
        label_tile(crop_norm(rfi(f_s08_pk2), 0.38, 0.28, 0.64, 0.72), f"S08a Boy speak2 e={d.get_lipsync('boy', f_s08_pk2)[0]:.2f}"),
        label_tile(crop_norm(rf(52.04), 0.38, 0.28, 0.64, 0.72), "S08a Boy BLINK"),
        label_tile(crop_norm(rfi(f_s09_pk), 0.54, 0.38, 0.74, 0.70), f"S09 Boy speak e={d.get_lipsync('boy', f_s09_pk)[0]:.2f}"),
        label_tile(crop_norm(rf(61.42), 0.54, 0.38, 0.74, 0.70), "S09 Boy BLINK"),
    ]
    cv2.imwrite(str(OUT_DIR / "qa_1_blinks_lipsync_boy.jpg"), pack_grid([r1, r2, r3], 360, 320), [cv2.IMWRITE_JPEG_QUALITY, 92])

    # 2. MOM & DOVE BLINKS & LIP-SYNC (zoomed crops!)
    f_s03_pk = find_peak_speech_frame(d, "mom", 15.2, 16.5)
    f_s07_pk1 = find_peak_speech_frame(d, "dove", 41.5, 45.0)
    f_s07_pk2 = find_peak_speech_frame(d, "dove", 45.5, 49.0)
    f_s10_pk = find_peak_speech_frame(d, "mom", 71.2, 76.0)

    m1 = [
        label_tile(crop_norm(rf(17.40), 0.56, 0.03, 0.78, 0.36), "S03 Mom silent"),
        label_tile(crop_norm(rfi(f_s03_pk), 0.56, 0.03, 0.78, 0.36), f"S03 Mom speak e={d.get_lipsync('mom', f_s03_pk)[0]:.2f}"),
        label_tile(crop_norm(rf(16.43), 0.56, 0.03, 0.78, 0.36), "S03 Mom BLINK"),
        label_tile(crop_norm(rf(29.00), 0.38, 0.10, 0.64, 0.48), "S05 Dove eye open+glint"),
    ]
    m2 = [
        label_tile(crop_norm(rf(30.58), 0.38, 0.10, 0.64, 0.48), "S05 Dove SLOW BLINK"),
        label_tile(crop_norm(rf(41.25), 0.38, 0.26, 0.58, 0.56), "S07 Dove beak closed"),
        label_tile(crop_norm(rfi(f_s07_pk1), 0.38, 0.26, 0.58, 0.56), f"S07 Dove beak1 e={d.get_lipsync('dove', f_s07_pk1)[0]:.2f}"),
        label_tile(crop_norm(rfi(f_s07_pk2), 0.38, 0.26, 0.58, 0.56), f"S07 Dove beak2 e={d.get_lipsync('dove', f_s07_pk2)[0]:.2f}"),
    ]
    m3 = [
        label_tile(crop_norm(rf(43.56), 0.38, 0.26, 0.58, 0.56), "S07 Dove BLINK"),
        label_tile(crop_norm(rf(68.50), 0.24, 0.04, 0.48, 0.40), "S10a Mom closed"),
        label_tile(crop_norm(rfi(f_s10_pk), 0.24, 0.04, 0.48, 0.40), f"S10a Mom speak e={d.get_lipsync('mom', f_s10_pk)[0]:.2f}"),
        label_tile(crop_norm(rf(68.20), 0.24, 0.04, 0.48, 0.40), "S10a Mom BLINK"),
    ]
    cv2.imwrite(str(OUT_DIR / "qa_2_blinks_lipsync_mom_dove.jpg"), pack_grid([m1, m2, m3], 360, 320), [cv2.IMWRITE_JPEG_QUALITY, 92])

    # 3. FULL-FRAME MOTION: S02 RUNNING & S03 MOM STEPPING FORWARD (ZERO PANTRY!)
    s23_1 = [
        label_tile(rf(4.40), "S02 Boy runs in (t=4.4s)"),
        label_tile(rf(9.20), "S02 Boy mid-hallway (t=9.2s)"),
        label_tile(rf(14.10), "S02 Boy near kitchen (t=14.1s)"),
    ]
    s23_2 = [
        label_tile(rf(15.40), "S03 Mom steps fwd (t=15.4s)"),
        label_tile(rf(18.50), "S03 Mom mid-step (t=18.5s)"),
        label_tile(rf(21.10), "S03 Mom close warm (t=21.1s)"),
    ]
    cv2.imwrite(str(OUT_DIR / "qa_3_motion_s02_s03.jpg"), pack_grid([s23_1, s23_2], 540, 304), [cv2.IMWRITE_JPEG_QUALITY, 92])

    # 4. S07 WING FLUTTER, S08b PHYSICAL HEAD NOD, S09 STEAMING PIE
    w1 = [
        label_tile(rf(42.20), "S07 Wings phase A (t=42.2s)"),
        label_tile(rf(42.95), "S07 Wings phase B (t=42.95s)"),
        label_tile(rf(43.70), "S07 Wings phase C (t=43.7s)"),
    ]
    w2 = [
        label_tile(rf(54.92), "S08b Dove neutral (t=54.9s)"),
        label_tile(rf(55.52), "S08b Dove NOD 1 DOWN (t=55.52s)"),
        label_tile(rf(56.55), "S08b Dove NOD 2 + BLINK (t=56.55s)"),
    ]
    w3 = [
        label_tile(rf(59.60), "S09 Pie steam + gesture (t=59.6s)"),
        label_tile(rf(62.40), "S09 Pie steam + gesture (t=62.4s)"),
        label_tile(rf(65.10), "S09 Pie steam + gesture (t=65.1s)"),
    ]
    cv2.imwrite(str(OUT_DIR / "qa_4_wings_nods_pie.jpg"), pack_grid([w1, w2, w3], 540, 304), [cv2.IMWRITE_JPEG_QUALITY, 92])

    # 5. OPENING TITLE + SCENE 10 THREE-BEAT CLIMAX + 4.50s CONTEMPLATIVE MUTUAL GAZE PAUSE + CLOSING CARD!
    f1 = [
        label_tile(rf(2.15), "S01 Opening Title (t=2.15s)"),
        label_tile(rf(72.50), "S10a Mom caress+speak (t=72.5s)"),
        label_tile(rf(79.40), "S10b Pull-back glide (t=79.4s)"),
        label_tile(rf(82.25), "S10c Gaze +0.5s (t=82.25s)"),
    ]
    f2 = [
        label_tile(rf(82.82), "S10c +1.05s Boy SOUL BLINK"),
        label_tile(rf(84.32), "S10c +2.55s Dove BLINK+BOW"),
        label_tile(rf(85.75), "S10c +4.00s Smile+Blessing"),
        label_tile(rf(86.30), "S10c->11 Golden Sunlight Bloom"),
    ]
    f3 = [
        label_tile(rf(87.60), "S11 Closing Title Card (t=87.6s)"),
        label_tile(rf(89.95), "S11 Warm Twilight End (t=89.95s)"),
        label_tile(crop_norm(rf(82.82), 0.25, 0.24, 0.50, 0.55), "ZOOM S10c Boy Soul Blink"),
        label_tile(crop_norm(rf(84.70), 0.58, 0.24, 0.80, 0.55), "ZOOM S10c Dove Blessing Bow"),
    ]
    cv2.imwrite(str(OUT_DIR / "qa_5_finale_and_titles.jpg"), pack_grid([f1, f2, f3], 440, 260), [cv2.IMWRITE_JPEG_QUALITY, 92])

    print("ALL 5 QA contact strips generated in /tmp/v3_previews/!")


if __name__ == "__main__":
    main()
