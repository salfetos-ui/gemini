# 🥧 Казка «Пирожок» — Live2D Painterly Feature-Film Short (v3)

> **Книга Ведмедів. Казки для дітей — Казка 1**
> Cinema-grade watercolor & gouache **Live2D / 2.5D animated short film** (`1920×1080 Full HD`, `30 fps`, `1:30`, **ElevenLabs `eleven_v4`** Ukrainian 4-voice acting with 30fps audio-driven painterly lip-sync, original 3-act fairytale chamber score, and a 4.5-second contemplative mutual-gaze finale).

---

## ✨ Highlights (v3)

- **Lush Feature-Film Watercolor Art Brought to Life (`studio_v3/` — OpenCV + SciPy Bicubic Live2D Mesh Warp):**
  - Preserves 100% of our 11 studio-grade painterly watercolor/Ghibli illustrations (`assets/scenes/scene_01..10.jpg`) — modern cozy sunlit European home, contemporary mom (dusty-rose short-sleeve cotton T-shirt, beige A-line midi skirt, minimalist oatmeal-linen 2-pocket apron, white sneakers), curly-haired barefoot boy, and luminous White Dove with transparent sky-blue eyes.
  - **Native Painterly Facial Animation (`face_fx.py`)**: Watercolor-blended natural eye blinking on Boy, Mom, and White Dove (plus sky-blue iris glint in Scene 05), **30fps audio-driven painterly lip-sync** synced directly to `assets/audio/lipsync.json`, and articulated lower-beak movement on the speaking White Dove (Scene 07).
  - **Live2D Puppet Mesh Deformation & Segmented 2.5D Depth (`mesh_warp.py`, `segmentation.py`)**: Boy physically running across the cleanly inpainted sunlit hallway (Scene 02), Modern Mom stepping warmly forward with flowing skirt & billowing curtain (Scene 03), twin feathered White Dove wings unfolding & fluttering (Scene 07), Boy surprised brow lift (Scene 08a), physical 3-nod White Dove head motion with rock-steady feet (Scene 08b), rising 6-strand organic raspberry-pie steam & Boy pointing gesture (Scene 09), and Mom gently caressing her son's shoulder while he smiles peacefully (Scene 10).
  - **4.5-Second Contemplative Mutual Gaze Finale (`81.76s → 86.26s`)**: After *"Хлопчик подивився на голуба і, наче, все зрозумів..."*, the film holds **4.5 unhurried seconds** of quiet, glowing stillness where the Boy and the White Dove look deeply into each other's eyes — exchanging a slow soulful blink, deepening smile, and gentle Dove blessing bow across sunbeams before blooming softly into the Closing Title Card (`КНИГА ВЕДМЕДІВ / Казка «Пирожок»`).
- **Broadcast-Grade Ukrainian Voice Acting (`ElevenLabs eleven_v4`, `language_code: uk`):**
  - All 19 lines individually ear-verified for authentic Ukrainian stresses (strictly **«Ка́зка Пирожо́к»**, both **«варе́ння»**, **«пирі́г»**, **«послане́ць»**, **«ве́лич»**, **«се́рденько»**, clear **«і, на́че, все зрозумі́в»**), smooth natural tails (zero clipping), and organic conversational pauses:
    - **Диктор (Narrator):** *Pavlo Lysenko* — warm, intimate fairytale storyteller
    - **Хлопчик (Boy):** *Torri Miles* — bright, lively, natural childlike Ukrainian voice
    - **Мама (Mom):** *Kateryna* — tender, warm, distinctly maternal voice
    - **Білий Голуб (White Dove):** *Leonid Drapei* — serene messenger with custom SciPy silky diffuse stereo concert-hall shimmer reverb
  - Synced with 4 ElevenLabs foley/magic SFX + original 3-act fairytale chamber score (harp, felt celesta, bowed strings), mastered to **`-16.0 LUFS`**, True Peak **`-1.4 dBFS`**, zero clipping.
- **Clean Cinema Framing:** Zero dialogue subtitles — only Ukrainian Cyrillic calligraphy Opening (`КНИГА ВЕДМЕДІВ · КАЗКА 1` / **`Пирожок`**) and Closing (`КНИГА ВЕДМЕДІВ` / **`Казка «Пирожок»`**) title cards.
- **Multi-Agent Independent QA:** Audited across artwork, phonetics/stresses, direct-from-MP4 pixel-zoom motion strips, loudness, and secret hygiene ([docs/QA_REPORT_V3.md](docs/QA_REPORT_V3.md)).

---

## 📁 Repository Structure

```text
.
├── assets/
│   ├── character_sheet.jpg        # Locked modern 3-character visual reference
│   ├── scenes/                    # 11 QA-approved 16:9 painterly watercolor plates
│   ├── audio/
│   │   ├── lines/                 # 19 ear-verified Ukrainian role-acted WAV clips
│   │   ├── timeline.json          # Exact line & scene manifest (90.16s, incl. 4.5s finale gaze)
│   │   ├── lipsync.json           # 30fps per-frame viseme & energy map (2,705 frames)
│   │   ├── master_audio.m4a       # Mastered 48kHz stereo AAC audio (-16.0 LUFS)
│   │   └── master_audio.wav       # Uncompressed 48kHz stereo PCM master
│   ├── sfx/                       # 4 ElevenLabs foley & magic SFX clips
│   └── music/                     # Original 3-act fairytale chamber score
├── scripts/
│   ├── generate_voices.py         # ElevenLabs v4 multi-voice TTS + SFX + diffuse Dove reverb
│   ├── compose_score.py           # Procedural 3-act fairytale chamber score
│   └── mix_master.py              # FFmpeg ducking, EBU R128 mastering & 30fps lipsync.json
├── studio_v3/                     # Live2D painterly mesh-warp & compositing feature-film studio
│   ├── landmarks.json             # ±1px verified facial, wing, hand & curtain landmarks
│   ├── segmentation.py            # Foreground character extraction + clean background inpainting
│   ├── face_fx.py                 # Native painterly blinking, 30fps lip-sync & Dove beak
│   ├── mesh_warp.py               # Vectorized bicubic cv2.remap Live2D puppet deformation
│   ├── atmosphere.py              # Volumetric sunbeams, aroma ribbons, pie steam & sparkles
│   ├── director.py                # 30fps timeline & 4.5s finale gaze choreography
│   └── render_v3.py               # Parallel multi-core 1080p FFmpeg renderer
├── output/
│   └── kazka_pyrozhok_1080p.mp4   # Final Full HD 1920×1080 Live2D animated short film
└── docs/
    └── QA_REPORT_V3.md            # Independent v3 QA audit & verification report
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

### 2. Live2D Painterly Feature-Film Render (`studio_v3/`)
```bash
pip install opencv-python-headless scipy numpy pillow
python3 studio_v3/render_v3.py
```

The final `1920×1080` `30 fps` H.264/AAC master is written to `output/kazka_pyrozhok_1080p.mp4`.
