# 🥧 Казка «Пирожок» — 2.5D Animated Short Film

> **Книга Ведмедів. Казки для дітей — Казка 1**
> Contemporary watercolor-storybook 2.5D animated short film (`1920×1080 Full HD`, `1:40`, Ukrainian multi-voice acting via ElevenLabs, original 3-act fairytale chamber score, Remotion + Canvas 2.5D animation engine).

---

## ✨ Highlights

- **Cohesive Modern Storybook Visuals**: 11 custom-directed painterly watercolor/Ghibli-inspired scenes generated from a unified Character Sheet (`assets/character_sheet.jpg`) — featuring a modern cozy sunlit European family kitchen, a contemporary mom (dusty-rose T-shirt, beige A-line midi skirt, minimalist oatmeal-linen apron), a curly-haired barefoot boy, and a luminous White Dove with transparent sky-blue eyes.
- **Native Ukrainian 4-Voice Acting (`ElevenLabs eleven_multilingual_v2`)**:
  - Opening title strictly pronounced **«Казка Пирожок.»** (*Пирожок*, not *Пиріжок*).
  - Full role-based voice acting from *«Що це так пахне, мамо?!»* through the finale:
    - **Диктор (Narrator)**: *Mykola* — warm, velvety bedtime storyteller
    - **Хлопчик (Boy)**: *Torri Miles* — bright, lively, natural childlike Ukrainian voice
    - **Мама (Mom)**: *Khrystyna* — soft, tender, young maternal voice
    - **Білий Голуб (White Dove)**: *Dmytro* — serene messenger enhanced with delicate ethereal hall shimmer reverb
- **Sound Design & Original Score**:
  - 4 bespoke foley/magic SFX generated via ElevenLabs Sound Effects API (barefoot running footsteps, warm kitchen/oven ambiance, soft dove wing flutter, celestial celesta chime).
  - Original 3-act 48kHz stereo fairytale score (`scripts/compose_score.py`: acoustic plucked harp, felt celesta, bowed chamber strings, algorithmic hall reverb) mastered with smooth lookahead speech ducking (`-16.0 LUFS`, True Peak `-1.5 dBFS`, zero clipping).
- **Remotion 2.5D Living Animation (`studio/`)**:
  - Eased cinematic camera choreography (including a poetic two-beat close-up → wide tableau reveal in Scene 10).
  - Procedural volumetric sunbeams, floating golden dust motes & celestial sky-blue sparkles, rising organic raspberry-pie steam, rosy aroma wisps, delicate dove wing/nod motion, warm opening & closing calligraphy titles, and clean dialogue-free framing (no subtitles).
- **Multi-Agent Studio + Mandatory Quality Review**:
  - Built by specialized agents (**Art Director**, **Audio Engineer**, **Animation Engineer**) and audited across 3 phases (Artwork Continuity, Script & Audio Fidelity, Final Video & Secret Hygiene) by an independent **Quality Reviewer** ([docs/QA_REPORT.md](docs/QA_REPORT.md)).

---

## 📁 Repository Structure

```text
.
├── assets/
│   ├── character_sheet.jpg        # Locked modern 3-character visual reference
│   ├── scenes/                    # 11 QA-approved 16:9 painterly plates
│   ├── audio/
│   │   ├── lines/                 # 19 individual Ukrainian role-acted WAV clips
│   │   ├── timeline.json          # Millisecond-accurate line & scene manifest
│   │   ├── master_audio.m4a       # Mastered 48kHz stereo AAC audio
│   │   └── master_audio.wav       # Uncompressed 48kHz stereo PCM master (local)
│   ├── sfx/                       # 4 ElevenLabs foley & magic SFX clips
│   └── music/                     # Original 3-act fairytale chamber score
├── scripts/
│   ├── generate_voices.py         # ElevenLabs multi-voice TTS + SFX generator
│   ├── compose_score.py           # Procedural 3-act fairytale chamber score
│   └── mix_master.py              # FFmpeg ducking, reverb & EBU R128 mastering
├── studio/                        # Remotion (React + TypeScript + Canvas) 2.5D studio
├── output/
│   └── kazka_pyrozhok_1080p.mp4   # Final Full HD 1920×1080 animated short film
└── docs/
    └── QA_REPORT.md               # Full 3-phase Quality Reviewer audit report
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

### 2. Remotion 2.5D Video Render
```bash
cd studio
npm install
npm run render
```

The final `1920×1080` H.264/AAC master is written to `output/kazka_pyrozhok_1080p.mp4`.
