# 🥧 Казка «Пирожок» — Full-Motion 2D Animated Short Film (v2)

> **Книга Ведмедів. Казки для дітей — Казка 1**
> Genuine frame-by-frame rigged 2D painterly watercolor animated short film (`1920×1080 Full HD`, `30 fps`, `1:27`, `48.3 MiB`, **ElevenLabs `eleven_v4`** Ukrainian multi-voice acting with 30fps audio-driven lip-sync, original 3-act fairytale chamber score, and independent multi-agent QA).

---

## ✨ What's New in v2

- **100% Genuine Full-Motion 2D Skeletal Animation (`studio_v2/`) — ZERO static photos:**
  - **Boy Rig (`boyRig.mjs`)**: Articulated barefoot running & walking stride cycles, spring-physics curly chestnut hair, natural stochastic eye blinking, gaze shifts, expressive eyebrows, arm pointing/gesturing, dangling stool feet, and **7-viseme 30fps audio-driven lip-sync**.
  - **Modern Mom Rig (`momRig.mjs`)**: Contemporary 2026 wardrobe (dusty-rose short-sleeve cotton T-shirt, swaying beige A-line midi skirt, minimalist oatmeal-linen 2-pocket apron, white sneakers, plush messy bun) — walks forward opening her arms, carries the steaming raspberry lattice pie in quilted oven mitts, lip-syncs warmly, and **physically leans down to stroke her son's curly hair** in Scene 10.
  - **Luminous White Dove Rig (`doveRig.mjs`)**: Pearlescent white feathers with golden & sky-blue aura, macro blinking transparent sky-blue eye reflecting drifting clouds (Scene 05), articulated **wing-unfolding & fluttering** + beak lip-sync (Scene 07), and **physical head-nodding** (Scene 08b).
  - **Multi-Plane Parallax Living Environments (`livingEnvironments.mjs`)**: Drifting morning clouds, swaying garden trees outside, billowing sheer cream curtains, flickering baking oven glow, swirling rosy raspberry aroma ribbons, rising pie steam, volumetric sunbeams, and floating golden/sky-blue sparkles.
- **Broadcast-Grade Ukrainian Voice Acting (`ElevenLabs eleven_v4`, `language_code: uk`):**
  - Every single one of the 19 lines was verified by ear (both by an independent `audio_critic` agent and direct director listening) for authentic Ukrainian stresses (strictly **«Ка́зка Пирожо́к»**, both **«варе́ння»**, **«пирі́г»**, **«послане́ць»**, **«ве́лич»**, **«се́рденько»**, clear **«і, на́че, все зрозумі́в»**), zero clipped word tails, and natural conversational pauses:
    - **Диктор (Narrator):** *Pavlo Lysenko* — warm, intimate fairytale storyteller
    - **Хлопчик (Boy):** *Torri Miles* — bright, lively, natural childlike Ukrainian voice
    - **Мама (Mom):** *Kateryna* — tender, warm, distinctly maternal voice
    - **Білий Голуб (White Dove):** *Leonid Drapei* — serene messenger with custom Python/SciPy silky diffuse stereo concert-hall shimmer reverb
  - Synced to 4 ElevenLabs foley/magic SFX + original 3-act fairytale chamber score (harp, felt celesta, bowed strings), mastered at **`-16.0 LUFS`**, True Peak **`-1.4 dBFS`**, zero clipping.
- **Clean Cinema Framing:** No dialogue subtitles — only Ukrainian Cyrillic calligraphy Opening (`КНИГА ВЕДМЕДІВ · КАЗКА 1` / `Пирожок`) and Closing (`КНИГА ВЕДМЕДІВ` / `Казка «Пирожок»`) title cards.
- **Independent Multi-Agent QA:** Audited across artwork, phonetics/stress, direct-from-MP4 motion strips, loudness, and secret hygiene ([docs/QA_REPORT_V2.md](docs/QA_REPORT_V2.md)).

---

## 📁 Repository Structure

```text
.
├── assets/
│   ├── character_sheet.jpg        # Locked modern 3-character visual reference
│   ├── audio/
│   │   ├── lines/                 # 19 ear-verified Ukrainian role-acted WAV clips
│   │   ├── timeline.json          # Millisecond-accurate line & scene manifest (87.76s)
│   │   ├── lipsync.json           # 30fps per-frame viseme & energy map (2,633 frames)
│   │   ├── master_audio.m4a       # Mastered 48kHz stereo AAC audio (-16.0 LUFS)
│   │   └── master_audio.wav       # Uncompressed 48kHz stereo PCM master
│   ├── sfx/                       # 4 ElevenLabs foley & magic SFX clips
│   └── music/                     # Original 3-act fairytale chamber score
├── scripts/
│   ├── generate_voices.py         # ElevenLabs v4 multi-voice TTS + SFX + diffuse Dove reverb
│   ├── compose_score.py           # Procedural 3-act fairytale chamber score
│   └── mix_master.py              # FFmpeg ducking, EBU R128 mastering & 30fps lipsync.json
├── studio_v2/                     # Full-motion 2D rigged painterly animation studio
│   ├── src/engine/painterly.mjs   # Watercolor/gouache brush engine + 2-bone IK
│   ├── src/rigs/                  # boyRig.mjs, momRig.mjs, doveRig.mjs
│   ├── src/environments/          # livingEnvironments.mjs (multi-plane parallax & FX)
│   ├── src/scenes/director.mjs    # Frame-accurate 30fps director synced to timeline & lipsync
│   └── scripts/                   # preview-scenes.mjs, render-film.mjs, render-worker.mjs
├── output/
│   └── kazka_pyrozhok_1080p.mp4   # Final Full HD 1920×1080 full-motion animated short film
└── docs/
    ├── QA_REPORT.md               # v1 QA report
    └── QA_REPORT_V2.md            # v2 independent full-motion & audio QA report
```

---

## 🛠️ Reproducing / Re-Rendering Locally

### 1. Audio Pipeline (Optional — requires ElevenLabs API key)
Create a local `.env` file (gitignored):
```bash
echo "ELEVENLABS_API_KEY=your_key_here" > .env
python3 scripts/generate_voices.py
python3 scripts/compose_score.py
python3 scripts/mix_master.py
```

### 2. Full-Motion 2D Cartoon Render (`studio_v2/`)
```bash
cd studio_v2
npm install
npm run render-film
```

The final `1920×1080` `30 fps` H.264/AAC master is written to `output/kazka_pyrozhok_1080p.mp4`.
