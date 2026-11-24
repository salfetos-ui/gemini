#!/usr/bin/env python3
"""
Studio-grade Ukrainian voice acting & foley SFX generation for "Казка Пирожок".
Uses ElevenLabs multilingual_v2 with 4 distinct native Ukrainian voices and
ElevenLabs Sound Effects API for cozy fairytale foley.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
import requests

PROJECT_ROOT = Path("/home/antigravity/salfetos-ui/gemini")
ENV_PATH = PROJECT_ROOT / ".env"
RAW_DIR = PROJECT_ROOT / "assets" / "audio" / "raw"
LINES_DIR = PROJECT_ROOT / "assets" / "audio" / "lines"
SFX_DIR = PROJECT_ROOT / "assets" / "sfx"
META_PATH = PROJECT_ROOT / "assets" / "audio" / "lines_meta.json"

BASE_URL = "https://api.elevenlabs.io/v1"

# Curated 4-voice native Ukrainian cast with distinct pitch & timbral territories:
#   narrator: Mykola - Christmas Storyteller (warm, kindly bedtime storyteller, ~111 Hz)
#   boy:      Torri Miles (bright, lively, high childlike Ukrainian intonations, ~267-327 Hz)
#   mom:      Khrystyna - Sweet & Calm (soft, silky, deeply loving young mother, ~235 Hz)
#   dove:     Dmytro - Warm Cinematic Narrator (serene, luminous smooth voice, ~130 Hz + ethereal reverb)
VOICE_CAST = {
    "narrator": {
        "name": "Mykola - Christmas Storyteller",
        "voice_id": "jsQZaQ22xaNCrus7aTPu",
        "public_owner_id": "7c44864f17126a9a30d33b4044c7358a98764c4922af672caf3a8409524d84c3",
        "fallback_id": "jn6ifzU1eO5tfUZ2ZJVg",
        "fallback_owner": "bfc377778415e5566d7450f776d8ce750827708f1567aa86476bf24415aa7fc0",
        "settings": {
            "stability": 0.56,
            "similarity_boost": 0.80,
            "style": 0.30,
            "use_speaker_boost": True,
        },
        "target_lufs": -17.5,
    },
    "boy": {
        "name": "Torri Miles - Bright Childlike",
        "voice_id": "a30ekmfK56EKHR341YaO",
        "public_owner_id": "a1619e4c4df7b47c002ab4ed46be676b603ec0102a1b11da011a2193310a0a85",
        "fallback_id": "NzxZZhrUg9MwxGQtQRFf",
        "fallback_owner": "3b6ca8a5354fa3090e156f55c5942ba48a879a73134ae95c92f462ca871d4522",
        "settings": {
            "stability": 0.42,
            "similarity_boost": 0.78,
            "style": 0.48,
            "use_speaker_boost": True,
        },
        "target_lufs": -16.8,
    },
    "mom": {
        "name": "Khrystyna - Sweet & Calm",
        "voice_id": "gF0lB8o9gaDnjqCxZayW",
        "public_owner_id": "07ca5585ac926e145b63e585117328cc6e3c2c1eda477825dc5122514fc28611",
        "fallback_id": "lkMXdLVaZ3W8mreYvUGj",
        "fallback_owner": "a37315a38f3f5f4f0980871a6c2a12b4982c9758dc4d150142e2cc45481c1c53",
        "settings": {
            "stability": 0.58,
            "similarity_boost": 0.80,
            "style": 0.28,
            "use_speaker_boost": True,
        },
        "target_lufs": -17.2,
    },
    "dove": {
        "name": "Dmytro - Serene Celestial Messenger",
        "voice_id": "GVYxfyhhakQOHOUnYfIG",
        "public_owner_id": "f6e1b7460632cafd281464bedcc3f4b2b057d541f745e77d8f5e04204658a9cd",
        "fallback_id": "dZde1M1SiLkAKiqjpqqT",
        "fallback_owner": "f13f94fabe2c9918229734195146ce3fda983f54a9907b8c04b9ccf9c23fa829",
        "settings": {
            "stability": 0.65,
            "similarity_boost": 0.80,
            "style": 0.25,
            "use_speaker_boost": True,
        },
        "target_lufs": -17.0,
    },
}

# Exact verbatim script (19 segments mapped to scenes 01-10)
SCRIPT_LINES = [
    {
        "id": "01_narrator_title",
        "scene": "01",
        "role": "narrator",
        "text": "Казка Пирожок.",
        "pause_after": 1.4,
        "prev_ctx": "",
        "next_ctx": "",
        "settings_override": {"stability": 0.64, "style": 0.22},
    },
    {
        "id": "02_boy_smell",
        "scene": "02",
        "role": "boy",
        "text": "Що це так пахне, мамо?!",
        "pause_after": 0.55,
        "prev_ctx": "Хлопчик радісно забіг додому з вулиці і вигукнув:",
        "next_ctx": "Хлопчик забіг додому і з порогу вчув смак малинового варення.",
        "settings_override": {"stability": 0.36, "style": 0.58},
    },
    {
        "id": "03_narrator_ran_in",
        "scene": "02",
        "role": "narrator",
        "text": "Хлопчик забіг додому і з порогу вчув смак малинового варення. А він так полюбляв це малинове варення.",
        "pause_after": 0.7,
        "prev_ctx": "Що це так пахне, мамо?!",
        "next_ctx": "Заходь, сину,",
    },
    {
        "id": "04_mom_come_in",
        "scene": "03",
        "role": "mom",
        "text": "Заходь, сину,",
        "pause_after": 0.25,
        "prev_ctx": "Мама лагідно усміхнулась синові:",
        "next_ctx": "пиріг допікається, будемо куштувати.",
    },
    {
        "id": "05_narrator_mom_ran",
        "scene": "03",
        "role": "narrator",
        "text": "вибігла назустріч мама,",
        "pause_after": 0.25,
        "prev_ctx": "«Заходь, сину,» —",
        "next_ctx": "— «пиріг допікається, будемо куштувати».",
    },
    {
        "id": "06_mom_pie_ready",
        "scene": "03",
        "role": "mom",
        "text": "пиріг допікається, будемо куштувати.",
        "pause_after": 0.95,
        "prev_ctx": "Заходь, сину,",
        "next_ctx": "Пішов хлопчик на кухню і побачив птаха на вікні.",
    },
    {
        "id": "07_narrator_saw_bird",
        "scene": "04",
        "role": "narrator",
        "text": "Пішов хлопчик на кухню і побачив птаха на вікні. Це був голуб білий.",
        "pause_after": 0.8,
        "prev_ctx": "пиріг допікається, будемо куштувати.",
        "next_ctx": "Він дивився на нього такими прозорими очима, як небо.",
    },
    {
        "id": "08_narrator_sky_eyes",
        "scene": "05",
        "role": "narrator",
        "text": "Він дивився на нього такими прозорими очима, як небо. І розплився простір тихий і так добре стало на душі.",
        "pause_after": 1.1,
        "prev_ctx": "Це був голуб білий.",
        "next_ctx": "Хто ти? — спитав хлопчик у Голуба.",
        "settings_override": {"stability": 0.62, "style": 0.34},
    },
    {
        "id": "09_boy_who",
        "scene": "06",
        "role": "boy",
        "text": "Хто ти?",
        "pause_after": 0.3,
        "prev_ctx": "Хлопчик тихо і здивовано подивився на білого голуба і запитав:",
        "next_ctx": "спитав хлопчик у Голуба.",
        "settings_override": {"stability": 0.48, "style": 0.35},
    },
    {
        "id": "10_narrator_asked",
        "scene": "06",
        "role": "narrator",
        "text": "спитав хлопчик у Голуба.",
        "pause_after": 0.8,
        "prev_ctx": "«Хто ти?» —",
        "next_ctx": "Я — посланець, я приношу радість і сміх.",
    },
    {
        "id": "11_dove_messenger",
        "scene": "07",
        "role": "dove",
        "text": "Я — посланець, я приношу радість і сміх, я — велич твоя і твій пиріг.",
        "pause_after": 1.0,
        "prev_ctx": "Білий голуб лагідно і світло відповів хлопчику:",
        "next_ctx": "Пиріг? — здивувався хлопчик.",
        "settings_override": {"stability": 0.66, "style": 0.28},
    },
    {
        "id": "12_boy_pie_q1",
        "scene": "08",
        "role": "boy",
        "text": "Пиріг?",
        "pause_after": 0.25,
        "prev_ctx": "Я — велич твоя і твій пиріг.",
        "next_ctx": "Як пиріг?",
        "settings_override": {"stability": 0.38, "style": 0.55},
    },
    {
        "id": "13_narrator_surprised",
        "scene": "08",
        "role": "narrator",
        "text": "здивувався хлопчик.",
        "pause_after": 0.25,
        "prev_ctx": "«Пиріг?» —",
        "next_ctx": "— «Як пиріг?»",
    },
    {
        "id": "14_boy_how_pie",
        "scene": "08",
        "role": "boy",
        "text": "Як пиріг?",
        "pause_after": 0.75,
        "prev_ctx": "Пиріг? — здивувався хлопчик.",
        "next_ctx": "А голуб стояв і лише головою кивав.",
        "settings_override": {"stability": 0.38, "style": 0.52},
    },
    {
        "id": "15_narrator_dove_nod",
        "scene": "08",
        "role": "narrator",
        "text": "А голуб стояв і лише головою кивав.",
        "pause_after": 1.05,
        "prev_ctx": "Як пиріг?",
        "next_ctx": "Хм, пиріг... Мамо, мамо, чому голуб сказав, що він мій пиріг?",
    },
    {
        "id": "16_boy_ask_mom",
        "scene": "09",
        "role": "boy",
        "text": "Хм, пиріг... Мамо, мамо, чому голуб сказав, що він мій пиріг? Як це?",
        "pause_after": 0.85,
        "prev_ctx": "Хлопчик замислився і побіг спитати у мами:",
        "next_ctx": "Мама лише тихо посміхнулась і погладила сина по голові.",
        "settings_override": {"stability": 0.40, "style": 0.50},
    },
    {
        "id": "17_narrator_mom_smile",
        "scene": "10",
        "role": "narrator",
        "text": "Мама лише тихо посміхнулась і погладила сина по голові:",
        "pause_after": 0.65,
        "prev_ctx": "Мамо, мамо, чому голуб сказав, що він мій пиріг? Як це?",
        "next_ctx": "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа...",
    },
    {
        "id": "18_mom_soul",
        "scene": "10",
        "role": "mom",
        "text": "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа...",
        "pause_after": 1.25,
        "prev_ctx": "Мама лише тихо посміхнулась і ніжно погладила сина по голові:",
        "next_ctx": "Хлопчик подивився на голуба і, наче, все зрозумів...",
        "settings_override": {"stability": 0.62, "style": 0.32},
    },
    {
        "id": "19_narrator_understood",
        "scene": "10",
        "role": "narrator",
        "text": "Хлопчик подивився на голуба і, наче, все зрозумів...",
        "pause_after": 2.5,
        "prev_ctx": "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа...",
        "next_ctx": "",
        "settings_override": {"stability": 0.65, "style": 0.28},
    },
]

SFX_SPECS = [
    {
        "filename": "sfx_footsteps.mp3",
        "prompt": "Light joyful barefoot child footsteps running quickly on a warm wooden house floor, cozy indoor home acoustic, soft and gentle, no voices",
        "duration_seconds": 3.5,
        "prompt_influence": 0.45,
    },
    {
        "filename": "sfx_kitchen_warm.mp3",
        "prompt": "Cozy quiet sunlit home kitchen ambiance, very soft warm baking oven gentle hum and subtle home stillness, peaceful fairytale mood, no voices",
        "duration_seconds": 5.0,
        "prompt_influence": 0.45,
    },
    {
        "filename": "sfx_dove_wings.mp3",
        "prompt": "Soft gentle flutter of white dove feathers landing on a wooden windowsill and peaceful warm morning breeze through an open window, delicate and calm",
        "duration_seconds": 4.0,
        "prompt_influence": 0.45,
    },
    {
        "filename": "sfx_magic_chime.mp3",
        "prompt": "Delicate shimmering ethereal celesta bell and soft angelic fairytale sparkle chime, warm crystalline acoustic magic, peaceful and gentle decay",
        "duration_seconds": 4.5,
        "prompt_influence": 0.5,
    },
]


def load_api_key() -> str:
    if not ENV_PATH.exists():
        raise FileNotFoundError(f"Missing .env file at {ENV_PATH}")
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            if k.strip() == "ELEVENLABS_API_KEY":
                return v.strip().strip('"').strip("'")
    raise ValueError("ELEVENLABS_API_KEY not found in .env")


def ensure_cast_voices(headers: dict) -> dict:
    """Ensure all 4 cast voices are present in the account library."""
    r = requests.get(f"{BASE_URL}/voices", headers=headers, timeout=30)
    r.raise_for_status()
    existing_ids = {v["voice_id"]: v["name"] for v in r.json().get("voices", [])}

    resolved = {}
    for role, cfg in VOICE_CAST.items():
        vid = cfg["voice_id"]
        owner = cfg["public_owner_id"]
        vname = cfg["name"]

        if vid in existing_ids:
            print(f"[CAST] {role:8s}: already in library -> {vname} ({vid})")
            resolved[role] = {"voice_id": vid, "name": vname}
            continue

        print(f"[CAST] {role:8s}: adding shared voice '{vname}' ({vid})...")
        add_r = requests.post(
            f"{BASE_URL}/voices/add/{owner}/{vid}",
            headers=headers,
            json={"new_name": f"KazkaPyrozhok_{role}_{vname[:20]}"},
            timeout=30,
        )
        if add_r.ok:
            new_id = add_r.json().get("voice_id", vid)
            print(f"       -> added cleanly as {new_id}")
            resolved[role] = {"voice_id": new_id, "name": vname}
        else:
            print(f"       -> primary add failed ({add_r.status_code}: {add_r.text[:160]}), trying fallback...")
            fb_id = cfg["fallback_id"]
            fb_owner = cfg["fallback_owner"]
            fb_r = requests.post(
                f"{BASE_URL}/voices/add/{fb_owner}/{fb_id}",
                headers=headers,
                json={"new_name": f"KazkaPyrozhok_{role}_fb"},
                timeout=30,
            )
            fb_r.raise_for_status()
            new_id = fb_r.json().get("voice_id", fb_id)
            print(f"       -> fallback added cleanly as {new_id}")
            resolved[role] = {"voice_id": new_id, "name": f"{vname} (fallback)"}
    return resolved


def probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    out = subprocess.check_output(cmd, text=True).strip()
    return float(out)


def postprocess_voice_line(raw_mp3: Path, out_wav: Path, role: str, target_lufs: float) -> float:
    """
    Studio polish per role:
    - 48kHz stereo float processing -> 16-bit PCM WAV
    - Gentle broadcast HPF (75-100Hz) & smooth tonal balance per role
    - Conservative silence trim (-54dB) preserving natural breath & soft consonant tails
    - Ethereal shimmering hall reverb on the White Dove voice
    - Active-speech RMS leveling + soft peak limiter + micro-fades (100% consistent even on <1s lines!)
    """
    import numpy as np
    from scipy.io import wavfile

    tmp_wav = out_wav.with_suffix(".tmp.wav")

    if role == "narrator":
        tone = "highpass=f=75,equalizer=f=180:t=q:w=1.2:g=1.2,equalizer=f=3200:t=q:w=1.5:g=1.0,equalizer=f=7500:t=q:w=1.5:g=-0.8"
    elif role == "boy":
        tone = "highpass=f=100,equalizer=f=2800:t=q:w=1.4:g=1.0,equalizer=f=6800:t=q:w=1.8:g=-1.2"
    elif role == "mom":
        tone = "highpass=f=85,equalizer=f=260:t=q:w=1.2:g=1.5,equalizer=f=4200:t=q:w=1.5:g=0.8,equalizer=f=8000:t=q:w=1.5:g=0.8"
    elif role == "dove":
        # White Dove: serene, luminous, airy celestial presence + tasteful soft hall shimmer
        tone = (
            "highpass=f=85,"
            "equalizer=f=240:t=q:w=1.2:g=0.8,"
            "equalizer=f=3800:t=q:w=1.4:g=1.2,"
            "highshelf=f=7500:g=2.5,"
            "apad=pad_dur=0.95,"
            "aecho=0.82:0.78:48|96|165|250:0.24|0.18|0.12|0.07,"
            "stereowiden=delay=12:feedback=0.12:crossfeed=0.35:drymix=0.85"
        )
    else:
        tone = "highpass=f=80"

    af_stage1 = f"aresample=48000,aformat=channel_layouts=stereo,{tone}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_mp3), "-af", af_stage1, "-c:a", "pcm_f32le", str(tmp_wav)],
        check=True,
    )

    sr, data = wavfile.read(tmp_wav)
    tmp_wav.unlink(missing_ok=True)
    x = data.astype(np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=-1)

    # Conservative envelope-based silence trim preserving breath onset (35ms) and soft consonant tail (100ms)
    mono_abs = np.max(np.abs(x), axis=1)
    # 10ms moving peak window
    win = int(0.010 * sr)
    kernel = np.ones(win, dtype=np.float64) / win
    env = np.convolve(mono_abs, kernel, mode="same")
    peak_all = float(np.max(env)) + 1e-12
    thresh = max(10 ** (-52.0 / 20.0), peak_all * 0.004)
    active = np.where(env > thresh)[0]
    if len(active) > 0:
        start_pad = int(0.035 * sr)
        end_pad = int((0.70 if role == "dove" else 0.11) * sr)
        i0 = max(0, int(active[0]) - start_pad)
        i1 = min(len(x), int(active[-1]) + end_pad)
        x = x[i0:i1]

    # Measure active-speech RMS (frames above -40 dB relative to clip peak) for consistent loudness across short & long lines
    frame = int(0.020 * sr)
    energies = []
    for k in range(0, len(x) - frame, frame):
        seg = x[k : k + frame]
        energies.append(float(np.mean(seg ** 2)))
    if energies:
        max_e = max(energies) + 1e-12
        voiced_e = [e for e in energies if e > max_e * 0.01]
        active_rms = float(np.sqrt(np.mean(voiced_e))) if voiced_e else float(np.sqrt(np.mean(x ** 2)))
    else:
        active_rms = float(np.sqrt(np.mean(x ** 2)))

    # Map target_lufs (-17.5..-16.8) cleanly to active RMS target (~ -18.5 to -17.8 dBFS)
    target_rms = 10.0 ** ((target_lufs - 1.2) / 20.0)
    if active_rms > 1e-6:
        x = x * (target_rms / active_rms)

    # Gentle transparent soft-knee limiter at -1.8 dBFS (0.8128) so zero clipping ever occurs
    ceiling = 0.8128
    abs_x = np.abs(x)
    over = abs_x > (ceiling * 0.85)
    if np.any(over):
        knee = ceiling * 0.85
        span = ceiling - knee
        x[over] = np.sign(x[over]) * (knee + span * np.tanh((abs_x[over] - knee) / span))

    # Smooth micro-fades (15ms in, 35ms out / 160ms out for dove reverb tail)
    fi = min(len(x) // 4, int(0.015 * sr))
    fo = min(len(x) // 3, int((0.160 if role == "dove" else 0.035) * sr))
    if fi > 0:
        x[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
    if fo > 0:
        x[-fo:] *= (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fo))))[:, None]

    pcm16 = np.clip(x * 32767.0, -32768, 32767).astype(np.int16)
    wavfile.write(str(out_wav), sr, pcm16)
    return len(pcm16) / sr


def generate_all_voices(headers: dict, cast: dict, force: bool = False) -> list:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    LINES_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    for line in SCRIPT_LINES:
        lid = line["id"]
        role = line["role"]
        voice_id = cast[role]["voice_id"]
        raw_mp3 = RAW_DIR / f"{lid}.mp3"
        out_wav = LINES_DIR / f"{lid}.wav"

        if force or not raw_mp3.exists() or raw_mp3.stat().st_size < 1000:
            settings = dict(VOICE_CAST[role]["settings"])
            if "settings_override" in line:
                settings.update(line["settings_override"])

            payload = {
                "text": line["text"],
                "model_id": "eleven_multilingual_v2",
                "voice_settings": settings,
            }
            if line.get("prev_ctx"):
                payload["previous_text"] = line["prev_ctx"]
            if line.get("next_ctx"):
                payload["next_text"] = line["next_ctx"]

            print(f"[TTS] Generating {lid} ({role}): {line['text']}")
            resp = requests.post(
                f"{BASE_URL}/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                headers={**headers, "Accept": "audio/mpeg", "Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            if not resp.ok:
                raise RuntimeError(f"ElevenLabs TTS failed for {lid}: {resp.status_code} {resp.text[:300]}")
            raw_mp3.write_bytes(resp.content)
            time.sleep(0.25)
        else:
            print(f"[TTS] Reusing existing {raw_mp3.name}")

        dur = postprocess_voice_line(raw_mp3, out_wav, role, VOICE_CAST[role]["target_lufs"])
        print(f"      -> {out_wav.name} | duration={dur:.3f}s | size={out_wav.stat().st_size // 1024}KB")

        results.append(
            {
                "id": lid,
                "scene": line["scene"],
                "role": role,
                "text": line["text"],
                "pause_after": line["pause_after"],
                "duration_sec": round(dur, 4),
                "audio_file": str(out_wav.relative_to(PROJECT_ROOT)),
            }
        )
    return results


def generate_sfx(headers: dict, force: bool = False) -> list:
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    sfx_meta = []
    for spec in SFX_SPECS:
        out_mp3 = SFX_DIR / spec["filename"]
        if force or not out_mp3.exists() or out_mp3.stat().st_size < 1000:
            print(f"[SFX] Generating {spec['filename']} ({spec['duration_seconds']}s)...")
            payload = {
                "text": spec["prompt"],
                "duration_seconds": spec["duration_seconds"],
                "prompt_influence": spec["prompt_influence"],
            }
            resp = requests.post(
                f"{BASE_URL}/sound-generation",
                headers={**headers, "Accept": "audio/mpeg", "Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            if not resp.ok:
                raise RuntimeError(f"ElevenLabs SFX failed for {spec['filename']}: {resp.status_code} {resp.text[:300]}")
            out_mp3.write_bytes(resp.content)
            time.sleep(0.3)
        else:
            print(f"[SFX] Reusing existing {out_mp3.name}")

        dur = probe_duration(out_mp3)
        print(f"      -> {out_mp3.name} | duration={dur:.3f}s | size={out_mp3.stat().st_size // 1024}KB")
        sfx_meta.append(
            {
                "filename": spec["filename"],
                "path": str(out_mp3.relative_to(PROJECT_ROOT)),
                "duration_sec": round(dur, 4),
            }
        )
    return sfx_meta


def main():
    force = "--force" in sys.argv
    api_key = load_api_key()
    headers = {"xi-api-key": api_key}

    print("=== Step 1: Casting & verifying 4 native Ukrainian voices ===")
    cast = ensure_cast_voices(headers)

    print("\n=== Step 2: Generating & studio-polishing 19 Ukrainian dialogue lines ===")
    lines = generate_all_voices(headers, cast, force=force)

    print("\n=== Step 3: Generating 4 cozy fairytale SFX via ElevenLabs ===")
    sfx = generate_sfx(headers, force=force)

    meta = {
        "voices_used": {
            role: {"name": info["name"], "voice_id": info["voice_id"]}
            for role, info in cast.items()
        },
        "lines": lines,
        "sfx": sfx,
    }
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved metadata to {META_PATH}")
    print(f"Total dialogue speech duration (without pauses): {sum(l['duration_sec'] for l in lines):.2f}s")


if __name__ == "__main__":
    main()
