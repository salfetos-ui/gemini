# QA Audit Report (v2) — Full-Motion 2D Animated Film «Пирожок»

- **Target Artifact:** `/home/antigravity/salfetos-ui/gemini/output/kazka_pyrozhok_1080p.mp4`
- **Reference Model Sheet:** `/home/antigravity/salfetos-ui/gemini/assets/character_sheet.jpg`
- **Audio Timeline Reference:** `/home/antigravity/salfetos-ui/gemini/assets/audio/timeline.json`
- **Audit Scope:** Independent stream/codec/loudness/black-frame verification, direct-from-MP4 multi-frame motion strip inspection, character model fidelity audit, and security/repository hygiene check.

---

## Executive Verdict

| Audit Pillar | Verdict | Summary |
|---|---|---|
| **1. Stream, Codec, Loudness & Container Integrity** | **PASS** *(1 minor tail-fade note)* | `1920×1080`, `30.000 fps`, `H.264 High`, `yuv420p`, `AAC 48 kHz stereo`, `+faststart`, `87.765s`, **`-16.0 LUFS`** (`-1.4 dBFS` true peak), **`48.34 MiB`** (`< 50 MiB`). Zero black frames in film body (`0.0–87.6s`); intentional outro fade triggers a `0.1s` `blackdetect` hit at `87.6–87.7s`. |
| **2. Full-Motion 2D Animation & Model Fidelity** | **PASS** *(minor polish notes)* | Genuine articulated 2D character animation verified directly from MP4 frames across all scenes (running stride, arm gestures, wing spread/flutter, physical dove nodding, hair stroking, synchronized lip-sync, blinks, camera push/pull). Modern Mom, Boy, and White Dove match `character_sheet.jpg` accurately. Crisp Ukrainian Cyrillic `Пирожок` titles, zero subtitles. |
| **3. Security & Secret Hygiene** | **PASS** | Zero `sk_...` ElevenLabs keys or hardcoded secrets in repository files. `.env` and `node_modules/` properly excluded. |
| **4. Repository Hygiene (`.gitignore`)** | **FAIL — FIX BEFORE COMMIT** | `studio_v2/preview/` (**19 MB**) is **NOT** listed in `.gitignore`. Must add `studio_v2/preview/` (and `studio_v2/out/`) before committing `studio_v2/`. |

> **Overall Release Verdict:** **CONDITIONAL PASS** — The rendered film (`kazka_pyrozhok_1080p.mp4`) **PASSES** full-motion animation, model fidelity, and broadcast audio/video QA. Resolve the 1-line `.gitignore` hygiene gap (`studio_v2/preview/`) before pushing to GitHub.

---

## 1. Stream, Codec, Loudness & Container Verification

Measured directly via `ffprobe`, Python MP4 box parser, and `ffmpeg` (`ebur128`, `blackdetect`):

| Check | Requirement | Measured Value | Status |
|---|---|---|---|
| **Resolution & Aspect** | `1920×1080` (16:9) | `1920×1080`, progressive (`16:9`) | **PASS** |
| **Frame Rate** | `30 fps` | `30/1` (`30.000 fps`), `2,632` frames | **PASS** |
| **Video Codec & Profile** | `h264 (High)`, `yuv420p` | `h264` (`avc1`), `High` L4.0, `yuv420p`, `4,328 kbps` | **PASS** |
| **Audio Codec** | `aac 48 kHz stereo` | `aac (LC)` (`mp4a`), `48000 Hz`, `2 ch stereo`, `285 kbps` | **PASS** |
| **Web Streaming (`+faststart`)** | `moov` before `mdat` | `ftyp (0) → moov (32) → free (97929) → mdat (97937)` | **PASS** |
| **Duration Parity** | `~87.76s` | Format `87.765s` / Audio `87.765s` / Video `87.733s` (`Δ 0.032s`, <1 frame; matches `timeline.json` `87.7649s`) | **PASS** |
| **Integrated Loudness (EBU R128)** | `~-16 LUFS`, zero clipping | **`-16.0 LUFS`**, `LRA: 4.1 LU`, True Peak **`-1.4 dBFS`** | **PASS** |
| **File Size** | `< 50 MB` (GitHub friendly) | `50,690,673 bytes` = **`48.34 MiB`** (`ls -lh`: `49M`; decimal `50.69 MB`, safely under GitHub's `50 MiB` warning threshold) | **PASS** |
| **Black Frames (`blackdetect=d=0.1:pix_th=0.10`)** | `0` black segments | **0** segments in `0.0–87.6s` (head opens on warm cream `mean RGB 240.0`). Tail fade triggers `black_start:87.6 black_end:87.7 black_duration:0.1` (`mean RGB 19.3 → 14.0`). | **NOTE** |

### Tail-Fade Note (Non-Blocking)
At the very end of the closing card (`87.0s → 87.7s`), luminance fades smoothly (`135.5 → 66.0 → 29.7 → 19.3 → 14.0` mean RGB), crossing `pix_th=0.10` (RGB ≤ 25) for the final 3 frames (`0.1s`). There are **zero** black gaps or dropped frames anywhere during the film. If strict `0` output from `blackdetect=d=0.1:pix_th=0.10` is required, fade the closing card to warm parchment `#FBF3E4` (matching `t=0.0s`) rather than dark.

---

## 2. Direct-from-MP4 Visual & Full-Motion QA Inspection

All frames and multi-frame motion strips were extracted directly from `/home/antigravity/salfetos-ui/gemini/output/kazka_pyrozhok_1080p.mp4` to `/tmp/qa_v2_frames/` and visually inspected pixel-by-pixel against `/home/antigravity/salfetos-ui/gemini/assets/character_sheet.jpg`.

### Opening & Closing Titles
- **Opening Title (`t=2.4s` — `01_title.png`) — PASS:**
  - Crisp Ukrainian Cyrillic serif typography: `КНИГА ВЕДМЕДІВ · КАЗКА 1` / **`Пирожок`** (exact spelling `Пирожок`, NOT `Пиріжок`).
  - Set over the living sunlit kitchen scene (glowing oven with baking pie, copper kettle, swaying sheer curtains, sunbeams, dust motes, garden trees). Zero subtitles.
  - *Minor polish note:* The small teacup on the windowsill sits directly behind the right edge of the final letter `к` in `Пирожок` (minor overlap, fully legible).
- **Closing Card (`t=85.5s` — `11_end.png`) — PASS:**
  - Clean warm-parchment storybook card with fine double border and floating golden motes: `КНИГА ВЕДМЕДІВ` / **`Казка «Пирожок»`**.
  - Verified **zero dialogue subtitles** across every inspected scene in the film.

### Scene-by-Scene Motion & Character Fidelity Audit

1. **Motion Strip 1 — Scene 02 Boy Running (`t=4.2s, 4.7s, 5.2s, 5.8s` — `strip_02_run.png`) — PASS:**
   - **Full-Motion Proof:** Unmistakable articulated 2D running animation. At `4.2s → 4.7s`, the Boy sprints right from the open sunlit doorway in a true side-running stride (bent knees, bare feet lifting cleanly off the floorboards, pumping arms, leaning torso, raspberry aroma ribbons streaming from the kitchen). By `5.2s → 5.8s`, he plants facing forward and throws both arms up joyfully with open hands.
   - **Lip-Sync:** Mouth dynamically modulates (`smile` → wide open `"О/А"` at `4.7s` → closed/smile at `5.2s` → open speaking at `5.8s`), aligned with `"Що це так пахне, мамо?!"` (`4.50–6.58s`).
   - **Model Fidelity:** Spot-on match to `character_sheet.jpg` — chestnut curls, warm brown eyes, rosy freckles, cream waffle-knit shirt with pushed-up cuffs, rolled light-blue jeans, bare feet.

2. **Motion Strip 2 — Scene 03 Mom Welcoming (`t=15.4s, 16.2s, 18.8s, 20.0s` — `strip_03_mom.png`) — PASS:**
   - **Modern Wardrobe Fidelity (100% On-Model):** Dusty-rose short-sleeve T-shirt, beige pleated midi skirt, oatmeal 2-pocket apron, white lace-up sneakers, brown hair in a high bun with loose side tendrils. Zero vintage dress, zero sweater.
   - **Full-Motion & Lip-Sync:** Mom visibly steps forward toward camera (distinct leg-stride spread at `16.2s` and scale-in through `20.0s`), blinks softly (`20.0s`), and actively lip-syncs (`"Заходь, сину"` / `"пиріг допікається, будемо куштувати"`).
   - *Honest polish note:* Mom's arms remain in a nearly constant outstretched welcoming pose across all four sampled frames (`15.4–20.0s`); sweeping her arms from relaxed-by-sides into the open embrace would add extra expressive arc.

3. **Hero Frames — Scenes 04, 05, 06 (`t=24.5s, 32.0s, 38.2s`) — PASS:**
   - **Scene 04 (`04_hero.png`, `24.5s`):** Boy enters sunlit kitchen and discovers the radiant White Dove perched on the windowsill with spread feathered wings and sky-blue eyes.
   - **Scene 05 (`05_eye.png`, `32.0s`):** Macro close-up of the White Dove's luminous sky-blue iris with crisp radial detail, sky/cloud reflection, specular catchlights, and gentle cloud/light aura.
   - **Scene 06 (`06_ask.png`, `38.2s`):** Medium two-shot with Boy looking up toward the Dove, mouth actively open speaking `"Хто ти?"` (`37.69–38.65s`).
   - *Honest rig defect (non-blocking polish):* On the Boy's arms-down/standing poses (`04_hero.png`, `06_ask.png`, `08_surp`, `09_pie.png`), the upper sleeve caps bulge slightly upward with an internal contour seam where the sleeve meets the torso, looking slightly more "puffy-jointed" than the smooth drop-shoulder knit in `character_sheet.jpg`. In `05_eye.png`, the beak base meets the head along a straight vertical line under the cere that could be softened slightly.

4. **Motion Strip 3 — Scene 07 White Dove Wing Spread & Flutter (`t=42.2s, 44.0s, 46.5s, 48.5s` — `strip_07_dove.png`) — PASS:**
   - **Full-Motion Proof:** Feathered wings visibly rise higher (`42.2s → 44.0s`), shift and flutter (`46.5s → 48.5s`), golden-blue luminous aura expands with slow camera push-in, beak opens/modulates dynamically in sync with `"Я — посланець..."`, and the Dove performs a serene closed-eye blink (`48.5s`).
   - **Model Fidelity:** Pure white plumage with warm sunlit rim shading, layered wing feathers, sky-blue eyes, rosy-orange beak and feet matching `character_sheet.jpg`.

5. **Motion Strip 4 — Scene 08a Boy Surprised & 08b Dove Physical Nodding (`t=51.3s, 54.0s, 55.8–57.5s` — `strip_08_nod.png`, `zoom_08_nod.png`) — PASS:**
   - **08a Boy Surprised (`51.3s`, `54.0s`):** Wide-eyed astonishment, raised arched eyebrows, open round `"O"` mouth actively lip-syncing `"Пиріг?"` and `"Як пиріг?"`.
   - **08b Dove Physical Nodding (verified on tight crop `zoom_08_nod.png` at `55.8, 56.2, 56.6, 57.0, 57.4s`):** Beak tip clearly pitches **below** the horizontal window muntin (`55.8s`), lifts **upward** level with the muntin (`56.2s`), holds with a serene **closed-eye blink** (`56.6s → 57.0s`), and pitches **downward again** (`57.4s`). Real head-pitch nodding confirmed!
   - *Honest polish note:* The physical nod excursion is subtle (~10–12°); increasing head/neck pitch to ~18–22° in a future pass would make the nod read even more boldly at full-frame scale.

6. **Hero Frame & Strip — Scene 09 Mom with Raspberry Pie & Boy Pointing (`t=60.5s, 62.5s, 64.5s` — `09_pie.png`, `zoom_09_pie.png`) — PASS:**
   - Modern Mom holds the golden lattice-crust raspberry pie on a baking tray wearing quilted oven mitts; Boy stands beside her pointing toward the Dove on the windowsill, visibly shifting stance and actively lip-syncing (`60.5s` closed → `62.5s` wide open `"O"` → `64.5s` mid-word).
   - *Honest polish note:* Rising steam wisps above the pie are present in `zoom_09_pie.png` but very low-contrast (pale white over Mom's light oatmeal apron bib and white backsplash). Increasing steam opacity or giving it a soft warm tint would make it read clearly at normal viewing distance.

7. **Motion Strip 5 — Scene 10a Mom Stroking Hair → 10b Wide Finale (`t=69.5–81.5s` — `strip_10_finale.png`, `zoom_10_stroke.png`) — PASS:**
   - **10a Hair Stroking (`zoom_10_stroke.png`, `69.5–75.0s`):** Mom's left hand **visibly glides back and forth** across the crown of the Boy's curls across all six sampled timestamps (`69.5s` left temple → `70.5s` high crown → `71.5s` lower left → `72.5s` upper crown → `73.5s` lower left → `75.0s` mid-crown), while Mom blinks warmly (`70.5s`) and lip-syncs `"Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа..."`.
   - **Grounding & Eyes:** Boy sits securely grounded on a four-legged wooden stool with warm chestnut-brown eyes; fresh lattice pie rests on the kitchen counter.
   - **10b Wide Finale (`79.5s`, `81.5s`):** Camera smoothly pulls back to the full warm kitchen tableau; Mom closes her eyes with a peaceful smile, Boy shifts his gaze rightward toward the glowing White Dove (`79.5s`) and then closes his eyes in serene understanding (`81.5s`).
   - *Honest polish note:* At `79.5s`, the Boy's pupils clearly turn right toward the Dove while his head remains mostly front-facing; a slight 10–15° head rotation toward the window would strengthen the visual connection further.

---

## 3. Security & Repository Hygiene Audit

| Check | Result | Details |
|---|---|---|
| **Leaked `sk_...` ElevenLabs Keys** | **PASS** | `rg "sk_[a-zA-Z0-9]{10,}"` (excluding `.env`, `node_modules`, `.git`) returned **0 matches**. `scripts/generate_voices.py:674` cleanly reads `api_key` from environment. |
| **`.env` Exclusion** | **PASS** | `.env` and `.env.*` present in `.gitignore`; not tracked in `git ls-files`. |
| **`node_modules/` Exclusion** | **PASS** | `node_modules/` present in `.gitignore` (excludes `studio_v2/node_modules`, `33 MB`); not tracked. |
| **`studio_v2/preview/` Exclusion** | **FAIL** | `studio_v2/preview/` currently holds **19 MB** of preview renders and is **NOT** in `.gitignore`! |

### Required Action Before Git Commit
Add the following lines to `/home/antigravity/salfetos-ui/gemini/.gitignore`:
```gitignore
studio_v2/preview/
studio_v2/out/
studio_v2/.remotion/
```

---

## 4. Summary of Actionable Items

1. **Mandatory (Before Commit):** Add `studio_v2/preview/` (19 MB) to `.gitignore`.
2. **Optional Polish (Only if doing a v2.1 pass):**
   - Fade outro card (`87.0–87.7s`) to warm cream `#FBF3E4` instead of dark to eliminate the `0.1s` tail `blackdetect` hit.
   - Smooth the Boy's upper sleeve-cap shoulder contour seam on standing poses (`Scenes 04, 06, 08, 09`) to match the seamless knit drape of `character_sheet.jpg`.
   - Boost raspberry pie steam contrast slightly in `Scene 09` and increase Dove nod pitch from ~12° to ~20° in `Scene 08b`.
