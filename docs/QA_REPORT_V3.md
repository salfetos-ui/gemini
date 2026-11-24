# v3 Live2D Painterly Feature-Film QA & Security Audit Report

- **Target Artifact**: `/home/antigravity/salfetos-ui/gemini/output/kazka_pyrozhok_1080p.mp4`
- **Audit Mode**: Independent, direct-from-MP4 decoding (`ffprobe`, `ffmpeg`, OpenCV frame diffs & zoomed contact strips) + Repository Security & Hygiene Scan
- **Diagnostic Frames Directory**: `/tmp/qa_v3_frames/` (43 extracted frames + 18 zoomed side-by-side comparison & motion-diff strips)
- **Overall Verdict**: **FAIL (Conditional — 3 localized visual compositing/rigging defects + 1 `.gitignore` gap; Technical Stream, Audio, Typography, Beat 10c Contemplative Hold, and Security all PASS)**

---

## Executive Summary

The v3 painterly Live2D pipeline achieves **100% broadcast-grade technical compliance**, **100% lush watercolor feature-film artwork** (zero flat vector replacement), **zero dialogue subtitles**, **crisp Cyrillic titles (`Пирожок` / `Казка «Пирожок»`)**, **zero leaked API keys**, and a **genuinely moving, verified 4.50-second Beat 10c contemplative mutual gaze pause** (`81.76s → 86.26s`) before the `11_outro` Closing Card. Scene 07 (Dove wings + articulated beak), Scene 08a (Boy), Scene 08b (Dove physical head nod with planted feet), and Scene 09 (pie steam) all pass motion inspection cleanly.

However, zoomed inspection of decoded MP4 frames reveals **three clearly visible visual artifacts** that fail the strict *"no weird sticker mouth or ghosting halo"* quality bar and must be fixed before final push:
1. **BLOCKING (Scene 02 — `t=4.4s–13.0s`)**: Severe inpainting ghost smear, floating residual hair curls on the hallway wall, and a blurred floor puddle in `studio_v3/cache/s02_bg.png` exposed as the Boy runs right, PLUS a misaligned double-mouth lip-sync overlay (`t=5.40s, 6.00s`).
2. **MAJOR (Scene 03 — `t=15.6s–19.2s`)**: Noticeable dark blurry silhouette ghost halo on `studio_v3/cache/s03_bg.png` floating behind Modern Mom's shoulder/neck, left hand, and skirt edge as she steps forward.
3. **MODERATE (Scene 08b — `t=56.55s` + partial blinks at `5.40s, 83.0s`)**: Flat bright-white circular sticker patch on the White Dove's closed eyelid (`t=56.55s`), plus a faint floating horizontal eyelid crease line on the Boy during low-amplitude blinks (`t=5.40s`, `t=83.0s`).
4. **HYGIENE (Repository)**: `studio_v3/cache/` (`9.1 MB`, 6 generated PNG cache files) is currently untracked and missing from `.gitignore`.

---

## 1. Stream, Codec, Loudness, Faststart & Black-Frame Verification — **PASS**

| Check | Requirement | Measured Value | Status |
| :--- | :--- | :--- | :--- |
| **Resolution & Aspect** | `1920×1080` (16:9) | `1920×1080` (`coded 1920×1080`, progressive) | **PASS** |
| **Frame Rate** | `30 fps` | `30/1` (`avg_frame_rate=30/1`, `2702` frames) | **PASS** |
| **Video Codec & Profile** | `h264 High`, `yuv420p` | `h264` (`avc1`), `High@L4.1`, `yuv420p`, `bt709`, `6969.8 kbps` | **PASS** |
| **Audio Codec & Format** | `aac 48kHz stereo` | `aac` (`LC`), `48000 Hz`, `2 ch stereo`, `fltp`, `285.4 kbps` | **PASS** |
| **Faststart (`+faststart`)** | `moov` before `mdat` | `ftyp@0`, `moov@32` (100,323 B), `free@100355`, `mdat@100363` | **PASS** |
| **Duration Parity** | `~90.16s` | Container/Audio `90.165s`, Video `90.067s` (98ms AAC padding) | **PASS** |
| **File Size** | `< 95 MB` (GitHub `< 100 MB`) | `81,785,922` bytes (`78.00 MiB` / `81.79 MB`) | **PASS** |
| **EBU R128 Loudness** | `~-16 LUFS`, zero clipping | Integrated **`-16.0 LUFS`**, LRA `4.3 LU`, True Peak **`-1.4 dBFS`** | **PASS** |
| **Black Frames** | `0` black frames | **`0`** (`blackdetect=d=0.05:pix_th=0.10` & strict `d=0.03:pix_th=0.10`) | **PASS** |

---

## 2. Direct-from-MP4 Visual, Typography & Live2D Motion Audit

### 2.1 Art Style, Character Model Fidelity & Typography — **PASS**
- **100% Lush Painterly Watercolor Artwork**: Verified across the full 30-frame 3-second overview contact sheet (`/tmp/qa_v3_frames/overview_grid_3s.jpg`) and full-resolution frames of all 10 scenes (`assets/scenes/scene_01..10.jpg`). Zero flat vector replacement.
- **Character Fidelity (vs. `assets/character_sheet.jpg`)**:
  - **Boy**: Exact tousled chestnut curls, warm brown eyes, cream waffle-knit long-sleeve shirt, rolled light-blue jeans, barefoot.
  - **Modern Mom**: Exact dusty-rose T-shirt, beige midi skirt, oatmeal apron with pockets, white sneakers, warm brown messy bun.
  - **White Dove**: Pure pearlescent white feathers, luminous sky-blue eyes, coral beak & feet.
- **Zero Dialogue Subtitles**: Confirmed **zero** burned-in or muxed subtitle tracks (`subtitle:0kB`) and zero dialogue text anywhere across all 30 sampled overview frames and per-scene captures.
- **Crisp Cyrillic Title Cards**:
  - Opening Card (`t=1.50s`, `/tmp/qa_v3_frames/00_opening_title_1p50.png`): `КНИГА ВЕДМЕДІВ · КАЗКА 1` / **`Пирожок`** — exact spelling (`Пирожок`), crisp serif typography over sunlit kitchen painting.
  - Closing Card (`t=87.80s`, `/tmp/qa_v3_frames/11_outro_87p80.png`): `КНИГА ВЕДМЕДІВ` / **`Казка «Пирожок»`** — exact spelling, warm cream parchment frame with golden double border.

### 2.2 Per-Scene Live2D Painterly Motion Verification

| Scene / Beat | Timestamps Inspected | Motion Evidence | Status & Findings |
| :--- | :--- | :--- | :--- |
| **Scene 02** (Boy runs in) | `4.40s, 5.20s, 5.40s, 6.00s, 6.80s, 9.0s, 13.0s` | Boy translates right with lively bounce/limb motion (`mean_abs_diff = 10.76, 13.72`; `strip_s02_body.jpg`, `strip_s02_progression.jpg`). | **FAIL (BLOCKING)** — **(A) Background ghosting**: `s02_bg.png` exposes a large blurry grey-brown vertical wall smear, detached dark hair curls floating behind the Boy's head (`t=9.0s, 13.0s`), and a huge smudged horizontal beige blotch across the wooden floor under his feet. **(B) Lip-sync alignment**: At `t=5.40s` (peak) and `t=6.00s` (`strip_s02_mouth_peak.jpg`), the dark mouth cavity renders *above* the downward-warped painted smile line, creating a visible double-mouth + stray left corner dot. **(C) Faint blink line**: Thin horizontal lash line floats above open left eye at `t=5.40s`. |
| **Scene 03** (Modern Mom welcomes) | `15.60s, 16.00s, 17.50s, 19.20s` | Mom visibly steps forward/scales up (`mean_abs_diff = 9.46, 21.50`); natural expressive lip-sync (`15.60s, 19.20s` open vs `17.50s` closed smile); left curtain visibly billows; dark right pantry cleanly cropped out (`strip_s03_mom.jpg`, `strip_s03_face.jpg`). | **FAIL (MAJOR)** — Inpainted `s03_bg.png` leaves a clearly visible **dark blurry human-shaped ghost halo** floating behind Mom's right/left shoulder & neck (`strip_s03_face.jpg`), behind her outstretched left hand over the oven, and along her right skirt edge. |
| **Scene 07** (Dove wings + speech) | `41.2s, 42.50s, 43.70s, 44.50s, 45.80s, 47.00s` | Wings visibly flex, lift, and flutter across frames (`mean_abs_diff = 16.29, 16.55`; `strip_s07_wings.jpg` 4x motion diff). Lower mandible hinges cleanly open at peak speech (`43.70s` vs `41.2s` closed in `strip_s07_beak_peak.jpg`) with soft rose-sepia interior shading. | **PASS** — Lush, painterly, convincing wing flutter and clean beak articulation. |
| **Scene 08a** (Boy `"Пиріг? Як пиріг?"`) | `51.00s, 52.50s, 54.00s` | Mouth clearly articulates open/closed cleanly (`mean_abs_diff = 17.96, 24.49`; `strip_s08a_boy.jpg`) with brow/hair micro-motion and zero sticker artifacts. | **PASS** |
| **Scene 08b** (Dove nods silently) | `55.60s, 55.90s, 56.20s, 56.55s, 56.90s` | Dove's head physically nods clearly up & down (`strip_s08b_nod.jpg` 4x motion diff shows crisp crown/beak vertical displacement) while both feet stay firmly planted on the wooden windowsill. | **FAIL (MODERATE)** — At `t=56.55s` (`strip_s08b_head_close.jpg`), the closed-eye blink renders as a **flat bright-white circular sticker disc** with a stark dark lower rim that clashes sharply with the soft cool-shaded watercolor feathers around the eye. |
| **Scene 09** (Boy + Mom + Pie steam) | `61.00s, 64.00s` | Pie steam visibly rises/swirls above lattice crust; Boy's face and gesturing hand visibly animate (`mean_abs_diff = 34.72`; `strip_s09_pie.jpg`). | **PASS** |
| **⭐ Beat 10c** (Mandatory 4.5s Contemplative Mutual Gaze Pause) | `81.80s, 82.00s, 83.00s, 84.40s, 85.80s, 86.10s, 86.40s, 86.80s, 87.80s` | Narration Line 19 (`"все зрозумів..."`) ends cleanly at `81.7649s`. Audio holds gentle score-only sustain (`-20.55 dBFS` RMS, `-6.54 dBFS` peak) for the full **4.50 seconds** (`81.76s → 86.26s`). Frames at `82.0s, 83.0s, 84.4s, 85.8s` (`strip_10c_gaze.jpg`, `strip_10c_boy_eyes.jpg`, `strip_10c_dove_eyes.jpg`) preserve Boy's warm chestnut brown eyes, tender smile, grounded wooden stool, serene golden sunbeams, and slow Dove blink at `t=84.40s`. Centered cross-dissolve into `11_outro` begins at `86.10s`, crosses 50% at `86.26s`, and reaches 100% opaque Closing Card by `86.80s`/`87.80s` (`strip_10c_to_outro.jpg`). | **PASS** (with 1 minor polish note: faint thin horizontal eyelid stroke visible above Boy's open eyes at `t=83.0s`, fixed by the same `lash_alpha` ramp as Defect #3). |

---

## 3. Repository Hygiene & Security Audit

### 3.1 Secret & API Key Check — **PASS**
- Ran `rg` across all workspace files (excluding `.git/`, `node_modules/`, `.env`, `.env.*`) and `git grep` across all tracked files for `sk_[A-Za-z0-9_-]{16,}` and hardcoded API key assignments.
- **Result**: **`0` leaked API keys** anywhere in tracked or untracked source/doc files.
- Verified `README.md:65` contains only the safe placeholder `ELEVENLABS_API_KEY=your_key_here`, `scripts/generate_voices.py:337` loads the key strictly from `.env` at runtime, and `.env` / `.env.*` are ignored on lines 1–2 of `.gitignore`.

### 3.2 `.gitignore` & Temporary Cache Hygiene — **ACTION REQUIRED**
- `studio_v3/__pycache__/` (`164 KB`) is already safely covered by `__pycache__/` and `*.pyc` in `.gitignore`.
- **Missing Ignore Rule**: `studio_v3/cache/` (**`9.1 MB`** containing 6 generated PNG files: `s02_bg.png`, `s02_fg.png`, `s03_bg.png`, `s03_fg.png`, `title_opening.png`, `title_closing.png`) is **NOT** in `.gitignore` and currently sits inside untracked `studio_v3/`.
- **Action**: Add `studio_v3/cache/` (and `studio_v3/preview/` if generated) to `.gitignore` before staging `studio_v3/` for commit/push!

---

## 4. Exact Actionable Fixes Required for `PASS`

1. **Fix Scene 02 Inpainted Hallway & Floor (`studio_v3/segmentation.py:128–169`)**:
   - **Expand foreground mask dilation (`dilate_px=12`)** before background inpainting so no residual brown hair curls remain outside `alpha` on the wall.
   - **Fix wall & trim restoration**: Instead of pasting a mismatched rectangular patch (`x=410..554`) only inside `boy_dil`, reconstruct the hallway wall by blending smoothly across the full clean wall strip from left-of-boy (`x=340..405`) and upper wall (`y=115..165`) matched to the exact local luminance gradient, AND restore the baseboard (`y=565..605`).
   - **Fix smudged floor puddle (`lines 161–168`)**: Replace the heavy `GaussianBlur(..., sigmaX=18.0)` smear with directional plank-preserving patch cloning (copy clean sunlit wood planks from the adjacent right floor `x=760..980` / lower floor `y=735..764` aligned to the horizontal plank seams), OR reduce Scene 02 Boy horizontal translation (`director.py`) so the Boy glides cleanly across a shorter parallax span while keeping a crisp dynamic drop shadow directly beneath his feet!
   - Delete `studio_v3/cache/s02_bg.png` & `s02_fg.png` (or run `segment_scene_02(force=True)`) after fixing.

2. **Fix Scene 02 Boy Closed-to-Open Lip-Sync Alignment (`studio_v3/face_fx.py:309–360`)**:
   - In `Case A` (`initially_open=False`), start the downward jaw warp strictly **below** the painted smile line (`np.clip((dy - 0.5) / 3.5, 0.0, 1.0)` instead of `dy + 1.5`) so the dark painted smile ink remains pinned as the upper lip border rather than separating downward into a double mouth.
   - Anchor the mouth interior ellipse **below** `lcy` (`cy_m = lcy + ry_m * 0.65`) and clamp the top rim cleanly at the smile curve so no dark cavity floats above the upper lip or leaves a detached dot at the left mouth corner.

3. **Fix Scene 03 Mom Shoulder/Hand/Skirt Ghost Halo (`studio_v3/segmentation.py:245` + `director.py`)**:
   - Cleanly reconstruct the sunlit kitchen background behind Mom's shoulders (`y=150..360, x=640..840`) by cloning the clean bright window/wall/cabinet geometry horizontally from clean neighboring pixels rather than relying solely on wide-radius Telea+NS blur over her dark hair/t-shirt (which creates the muddy dark halo in `s03_bg.png`).
   - Also tighten Mom's foreground scale/translation anchor in `director.py` (keep scale growth smooth and centered around her chest/shoulders with minimal lateral drift) so zero dark background smear peeks past her neck, left hand, or skirt edge.
   - Regenerate `studio_v3/cache/s03_bg.png` & `s03_fg.png`.

4. **Fix Scene 08b Dove Eye Blink Sticker & Subtle Eyelid Line (`studio_v3/face_fx.py:58–75, 138–190`)**:
   - **Dove eyelid tint (`lines 60–68`)**: For `"dove"` eyes, sample the **50th-percentile local median** around the eye socket (instead of the 65th-percentile brightest highlight + `[5, 4, 2]` boost) and slightly deepen (`skin * 0.94`) with a softer feathered eye mask (`(1.06 - norm_r2) / 0.42`) so the closed lid matches the surrounding soft blue-grey watercolor feather shading instead of pasting a stark white circle.
   - **Floating partial-blink lash line (`line 189`)**: Change `lash_alpha = float(np.clip(0.35 + 0.55 * blink_amt, 0.0, 0.88))` to `lash_alpha = float(np.clip((blink_amt - 0.14) / 0.55, 0.0, 0.85))` so subtle blinks (`blink_amt < 0.15`) never draw a floating dark line above open eyes (fixing both Scene 02 `t=5.40s` and Beat 10c `t=83.0s`).

5. **Update `.gitignore`**:
   - Add `studio_v3/cache/` to `.gitignore` so the `9.1 MB` intermediate PNG cache is never committed.

---

## Re-Verification Checklist (After Applying Fixes & Re-Rendering)
- Re-verify `studio_v3/cache/s02_bg.png` and `s03_bg.png` have zero ghost curls/halos/floor puddles.
- Re-extract & visually confirm Scene 02 (`t=4.4s, 5.2s, 5.4s, 6.0s, 13.0s`), Scene 03 (`t=15.6s, 16.0s, 19.2s`), Scene 08b (`t=56.55s`), and Beat 10c (`t=83.0s, 84.4s`) directly from the re-rendered MP4.
- Re-confirm stream specs, `-16.0 LUFS`, `0` black frames, `< 95 MB`, and clean `git status`.


---

## Final Re-Verification Addendum (Post-Fix Render) — **VERDICT: PASS**

All 4 items from the initial v3 audit were surgically resolved and verified directly from the re-rendered `/home/antigravity/salfetos-ui/gemini/output/kazka_pyrozhok_1080p.mp4`:

1. **Scene 02 Hallway Inpainting & Single-Mouth Lip-Sync (`5.4s`, `11.0s`) — PASS:** Wide dilated mask + plank-preserving floor cloning removed 100% of wall smudges, detached hair curls, and floor blur; updated jaw warp below smile line eliminated the double-mouth artifact completely.
2. **Scene 03 Mom Clean Background (`18.5s`) — PASS:** Bright kitchen geometry cloning and refined anchor eliminated 100% of shoulder/hand/skirt ghosting halos.
3. **Scene 08b Dove Eye Blink (`56.55s`) & Partial-Blink Eyelash Ramp (`5.4s`, `83.0s`) — PASS:** 50th-percentile local feather sampling & widened feather blend make the Dove's closed eyelid 100% native to the watercolor plumage; ramped eyelash alpha eliminated faint floating lines above open eyes.
4. **Final Encoded MP4 Specs & Hygiene — PASS:** `1920×1080`, `30 fps`, `H.264 High` (`7.00 Mbps`), `AAC 48 kHz stereo` (`285 kbps`), `90.165s` (incl. full `4.50s` Beat 10c mutual gaze pause `81.76s → 86.26s`), `78.36 MiB`, **`0` black frames**, **`-16.0 LUFS`**, **True Peak `-1.4 dBFS`**, `studio_v3/cache/` added to `.gitignore`, **`0` leaked API keys**.

**RELEASE APPROVED FOR GITHUB PUSH.**
