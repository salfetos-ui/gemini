#!/usr/bin/env python3
"""
Studio-grade Ukrainian voice acting & foley SFX generation (v2) for "Казка Пирожок".
Uses ElevenLabs `eleven_v4` (native `uk`) with 4 distinct, expressive native Ukrainian voices:
  - narrator : Pavlo Lysenko - Premium Audiobook (warm, intimate, melodic fairytale storyteller)
  - boy      : Torri Miles (bright, lively, genuinely childlike Ukrainian voice)
  - mom      : Kateryna - Native Ukrainian (tender, warm, radiant maternal female voice)
  - dove     : Leonid Drapei - Wise, Calm Teacher (poetic, serene, resonant wise voice + silky diffuse stereo shimmer reverb)

Saves both:
  - assets/audio/lines/{id}.wav     (final studio-processed dialogue line for mastering)
  - assets/audio/lines_dry/{id}.wav (dry isolated vocal track for accurate 30fps lip-sync analysis)
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
import numpy as np
import requests
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

PROJECT_ROOT = Path("/home/antigravity/salfetos-ui/gemini")
ENV_PATH = PROJECT_ROOT / ".env"
RAW_DIR = PROJECT_ROOT / "assets" / "audio" / "raw"
LINES_DIR = PROJECT_ROOT / "assets" / "audio" / "lines"
DRY_DIR = PROJECT_ROOT / "assets" / "audio" / "lines_dry"
SFX_DIR = PROJECT_ROOT / "assets" / "sfx"
META_PATH = PROJECT_ROOT / "assets" / "audio" / "lines_meta.json"

BASE_URL = "https://api.elevenlabs.io/v1"
MODEL_ID = "eleven_v4"
SR = 48000

VOICE_CAST = {
    "narrator": {
        "name": "Pavlo Lysenko - Premium Audiobook",
        "voice_id": "9oLzyMRRRWl0OdCCVwlU",
        "public_owner_id": "ec835d7a08186302ebb3f4096ef4a2beb6f459414c8b48e3ecf1267b8a9468b0",
        "settings": {
            "stability": 0.48,
            "similarity_boost": 0.80,
        },
        "target_lufs": -17.2,
    },
    "boy": {
        "name": "Torri Miles - Bright Childlike",
        "voice_id": "a30ekmfK56EKHR341YaO",
        "public_owner_id": "a1619e4c4df7b47c002ab4ed46be676b603ec0102a1b11da011a2193310a0a85",
        "settings": {
            "stability": 0.36,
            "similarity_boost": 0.78,
        },
        "target_lufs": -16.8,
    },
    "mom": {
        "name": "Kateryna - Warm Maternal",
        "voice_id": "X1WtgMmQUBwtiAPn4j1P",
        "public_owner_id": "94fa3c1c4cf3046db2d7a0937b0199a2facbacb3d2793b0a7ea7ef761d274760",
        "settings": {
            "stability": 0.45,
            "similarity_boost": 0.80,
        },
        "target_lufs": -17.0,
    },
    "dove": {
        "name": "Leonid Drapei - Serene Celestial Messenger",
        "voice_id": "eLDtXX7z65CuLasDRxrP",
        "public_owner_id": "21d1eb992a69e10e8099f386c4398e5c714dbfbef24154419d7408c5433f0f94",
        "settings": {
            "stability": 0.54,
            "similarity_boost": 0.82,
        },
        "target_lufs": -17.0,
    },
}

# Exact verbatim script (19 segments mapped to scenes 01-10)
# `text` is the exact canonical story text exported to timeline.json.
# Optional `tts_text` adds subtle punctuation/pauses only where needed for flawless Ukrainian prosody/enunciation.
SCRIPT_LINES = [
    {
        "id": "01_narrator_title",
        "scene": "01",
        "role": "narrator",
        "text": "Казка Пирожок.",
        "tts_text": "Казка Пирожок.",
        "pause_after": 1.15,
        "prev_ctx": "",
        "next_ctx": "",
        "seed": 101,
        "settings_override": {"stability": 0.52},
    },
    {
        "id": "02_boy_smell",
        "scene": "02",
        "role": "boy",
        "text": "Що це так пахне, мамо?!",
        "pause_after": 0.42,
        "prev_ctx": "Хлопчик радісно забіг додому з вулиці і вигукнув:",
        "next_ctx": "",
        "seed": 202,
        "settings_override": {"stability": 0.34},
    },
    {
        "id": "03_narrator_ran_in",
        "scene": "02",
        "role": "narrator",
        "text": "Хлопчик забіг додому і з порогу вчув смак малинового варення. А він так полюбляв це малинове варення.",
        "pause_after": 0.65,
        "prev_ctx": "Що це так пахне, мамо?!",
        "next_ctx": "Заходь, сину, вибігла назустріч мама.",
        "seed": 303,
        "settings_override": {"stability": 0.48},
    },
    {
        "id": "04_mom_come_in",
        "scene": "03",
        "role": "mom",
        "text": "Заходь, сину,",
        "tts_text": "Заходь, сину!",
        "pause_after": 0.16,
        "prev_ctx": "Мама лагідно усміхнулась і вибігла назустріч синові:",
        "next_ctx": "",
        "seed": 404,
        "settings_override": {"stability": 0.42},
    },
    {
        "id": "05_narrator_mom_ran",
        "scene": "03",
        "role": "narrator",
        "text": "вибігла назустріч мама,",
        "pause_after": 0.14,
        "prev_ctx": "«Заходь, сину,» —",
        "next_ctx": "— «пиріг допікається, будемо куштувати».",
        "seed": 505,
        "settings_override": {"stability": 0.48},
    },
    {
        "id": "06_mom_pie_ready",
        "scene": "03",
        "role": "mom",
        "text": "пиріг допікається, будемо куштувати.",
        "tts_text": "Пиріг допікається, будемо куштувати.",
        "pause_after": 0.85,
        "prev_ctx": "Заходь, сину,",
        "next_ctx": "",
        "seed": 606,
        "settings_override": {"stability": 0.44},
    },
    {
        "id": "07_narrator_saw_bird",
        "scene": "04",
        "role": "narrator",
        "text": "Пішов хлопчик на кухню і побачив птаха на вікні. Це був голуб білий.",
        "pause_after": 0.72,
        "prev_ctx": "Пиріг допікається, будемо куштувати.",
        "next_ctx": "Він дивився на нього такими прозорими очима, як небо.",
        "seed": 707,
        "settings_override": {"stability": 0.50},
    },
    {
        "id": "08_narrator_sky_eyes",
        "scene": "05",
        "role": "narrator",
        "text": "Він дивився на нього такими прозорими очима, як небо. І розплився простір тихий і так добре стало на душі.",
        "tts_text": "Він дивився на нього такими прозорими очима, як небо. І розплився простір тихий, і так добре стало на душі.",
        "pause_after": 0.95,
        "prev_ctx": "Це був голуб білий.",
        "next_ctx": "",
        "seed": 808,
        "settings_override": {"stability": 0.52},
    },
    {
        "id": "09_boy_who",
        "scene": "06",
        "role": "boy",
        "text": "Хто ти?",
        "pause_after": 0.18,
        "prev_ctx": "Хлопчик тихо і здивовано подивився на білого голуба і лагідно запитав:",
        "next_ctx": "",
        "seed": 909,
        "settings_override": {"stability": 0.44},
    },
    {
        "id": "10_narrator_asked",
        "scene": "06",
        "role": "narrator",
        "text": "спитав хлопчик у Голуба.",
        "pause_after": 0.72,
        "prev_ctx": "«Хто ти?» —",
        "next_ctx": "",
        "trim_end_sec": 1.84,
        "seed": 1010,
        "settings_override": {"stability": 0.50},
    },
    {
        "id": "11_dove_messenger",
        "scene": "07",
        "role": "dove",
        "text": "Я — посланець, я приношу радість і сміх, я — велич твоя і твій пиріг.",
        "pause_after": 0.18,  # Plus ~0.95s silky reverb decay tail inside WAV = ~1.13s natural breath!
        "prev_ctx": "Білий голуб лагідно, спокійно і світло відповів хлопчику:",
        "next_ctx": "",
        "seed": 1111,
        "settings_override": {"stability": 0.54},
    },
    {
        "id": "12_boy_pie_q1",
        "scene": "08",
        "role": "boy",
        "text": "Пиріг?",
        "pause_after": 0.16,
        "prev_ctx": "Хлопчик дуже здивувався і перепитав:",
        "next_ctx": "",
        "seed": 1212,
        "settings_override": {"stability": 0.36},
    },
    {
        "id": "13_narrator_surprised",
        "scene": "08",
        "role": "narrator",
        "text": "здивувався хлопчик.",
        "pause_after": 0.18,
        "prev_ctx": "«Пиріг?» —",
        "next_ctx": "— «Як пиріг?»",
        "seed": 1313,
        "settings_override": {"stability": 0.48},
    },
    {
        "id": "14_boy_how_pie",
        "scene": "08",
        "role": "boy",
        "text": "Як пиріг?",
        "pause_after": 0.65,
        "prev_ctx": "Пиріг? — здивувався хлопчик і знову щиро спитав:",
        "next_ctx": "",
        "seed": 1414,
        "settings_override": {"stability": 0.36},
    },
    {
        "id": "15_narrator_dove_nod",
        "scene": "08",
        "role": "narrator",
        "text": "А голуб стояв і лише головою кивав.",
        "pause_after": 0.90,
        "prev_ctx": "Як пиріг?",
        "next_ctx": "",
        "seed": 1515,
        "settings_override": {"stability": 0.50},
    },
    {
        "id": "16_boy_ask_mom",
        "scene": "09",
        "role": "boy",
        "text": "Хм, пиріг... Мамо, мамо, чому голуб сказав, що він мій пиріг? Як це?",
        "pause_after": 0.75,
        "prev_ctx": "Хлопчик замислився, а потім весело побіг спитати у мами:",
        "next_ctx": "",
        "seed": 1616,
        "settings_override": {"stability": 0.36},
    },
    {
        "id": "17_narrator_mom_smile",
        "scene": "10",
        "role": "narrator",
        "text": "Мама лише тихо посміхнулась і погладила сина по голові:",
        "pause_after": 0.55,
        "prev_ctx": "Мамо, мамо, чому голуб сказав, що він мій пиріг? Як це?",
        "next_ctx": "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа...",
        "seed": 1717,
        "settings_override": {"stability": 0.52},
    },
    {
        "id": "18_mom_soul",
        "scene": "10",
        "role": "mom",
        "text": "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа...",
        "pause_after": 1.05,
        "prev_ctx": "Мама лише тихо посміхнулась і ніжно погладила сина по голові:",
        "next_ctx": "",
        "seed": 1818,
        "settings_override": {"stability": 0.46},
    },
    {
        "id": "19_narrator_understood",
        "scene": "10",
        "role": "narrator",
        "text": "Хлопчик подивився на голуба і, наче, все зрозумів...",
        "tts_text": "Хлопчик подивився на голуба — і, наче, все зрозумів...",
        "pause_after": 2.20,
        "prev_ctx": "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа...",
        "next_ctx": "",
        "seed": 1919,
        "settings_override": {"stability": 0.54},
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
            print(f"[CAST] {role:8s}: ready -> {vname} ({vid})")
            resolved[role] = {"voice_id": vid, "name": vname}
            continue

        print(f"[CAST] {role:8s}: adding shared voice '{vname}' ({vid})...")
        add_r = requests.post(
            f"{BASE_URL}/voices/add/{owner}/{vid}",
            headers=headers,
            json={"new_name": f"KazkaV2_{role}_{vname[:18]}"},
            timeout=30,
        )
        add_r.raise_for_status()
        new_id = add_r.json().get("voice_id", vid)
        print(f"       -> added cleanly as {new_id}")
        resolved[role] = {"voice_id": new_id, "name": vname}
    return resolved


def probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    return float(subprocess.check_output(cmd, text=True).strip())


def apply_celestial_hall_reverb(dry_stereo: np.ndarray, sr: int = SR) -> np.ndarray:
    """
    Build a lush, silky, diffuse stereo concert-hall shimmer reverb (ZERO metallic slapback!).
    Uses decorrelated stereo Velvet/Gaussian diffuse IR with 26ms pre-delay, warm bandpass
    damping (240 Hz - 7800 Hz), subtle high-air sheen, and 1.15s smooth exponential decay.
    """
    tail_sec = 1.15
    ir_len = int(tail_sec * sr)
    t = np.arange(ir_len, dtype=np.float64) / sr

    rng = np.random.default_rng(20261124)
    # Two decorrelated stereo noise bursts shaped into a smooth velvet hall tail
    noise_l = rng.normal(0.0, 1.0, ir_len)
    noise_r = rng.normal(0.0, 1.0, ir_len)

    # Smooth onset bloom after 26ms pre-delay (no discrete metallic echo taps!)
    predelay_n = int(0.026 * sr)
    env_main = np.zeros(ir_len, dtype=np.float64)
    t_tail = t[predelay_n:] - t[predelay_n]
    bloom = 1.0 - np.exp(-t_tail / 0.045)
    # Dual-slope warm hall decay: lush body (RT60 ~0.95s) + airy whisper halo (RT60 ~1.35s)
    decay_body = np.exp(-t_tail * 6.9 / 0.95)
    decay_air = np.exp(-t_tail * 6.9 / 1.35)
    env_main[predelay_n:] = bloom * (0.78 * decay_body + 0.22 * decay_air)

    # Warm body band (240 Hz - 5200 Hz) + delicate celestial air shimmer (3500 Hz - 8800 Hz)
    sos_body = butter(2, [240.0, 5200.0], btype="bandpass", fs=sr, output="sos")
    sos_air = butter(2, [3500.0, 8800.0], btype="bandpass", fs=sr, output="sos")

    ir_l = (0.82 * sosfilt(sos_body, noise_l) + 0.26 * sosfilt(sos_air, noise_l)) * env_main
    ir_r = (0.82 * sosfilt(sos_body, noise_r) + 0.26 * sosfilt(sos_air, noise_r)) * env_main

    # Subtle early-diffusion stereo cross-blend for natural wide hall cohesion
    ir_l_mix = 0.85 * ir_l + 0.15 * ir_r
    ir_r_mix = 0.85 * ir_r + 0.15 * ir_l

    # Normalize IR energy so wet blend level is exact and predictable
    ir_norm = np.sqrt(0.5 * (np.sum(ir_l_mix ** 2) + np.sum(ir_r_mix ** 2))) + 1e-12
    ir_l_mix /= ir_norm
    ir_r_mix /= ir_norm

    # Pad dry audio with 1.05s tail room before convolution
    pad_n = int(1.05 * sr)
    padded = np.pad(dry_stereo, ((0, pad_n), (0, 0)), mode="constant")

    wet_l = fftconvolve(padded[:, 0], ir_l_mix, mode="full")[: len(padded)]
    wet_r = fftconvolve(padded[:, 1], ir_r_mix, mode="full")[: len(padded)]
    wet = np.stack([wet_l, wet_r], axis=-1)

    # Blend 100% crisp dry voice + 20% silky diffuse stereo hall shimmer
    out = padded + 0.20 * wet
    return out


def level_and_limit(x: np.ndarray, target_lufs: float, fade_in_s: float = 0.035, fade_out_s: float = 0.035) -> np.ndarray:
    """Active-speech RMS leveling + transparent soft-knee limiter + smooth raised-cosine fades."""
    frame = int(0.020 * SR)
    energies = []
    for k in range(0, max(1, len(x) - frame), frame):
        seg = x[k : k + frame]
        energies.append(float(np.mean(seg ** 2)))
    if energies:
        max_e = max(energies) + 1e-12
        voiced_e = [e for e in energies if e > max_e * 0.015]
        active_rms = float(np.sqrt(np.mean(voiced_e))) if voiced_e else float(np.sqrt(np.mean(x ** 2)))
    else:
        active_rms = float(np.sqrt(np.mean(x ** 2)))

    target_rms = 10.0 ** ((target_lufs - 1.2) / 20.0)
    if active_rms > 1e-6:
        x = x * (target_rms / active_rms)

    # Transparent soft-knee limiter at -1.8 dBFS (0.8128)
    ceiling = 0.8128
    knee = ceiling * 0.84
    abs_x = np.abs(x)
    over = abs_x > knee
    if np.any(over):
        span = ceiling - knee
        x[over] = np.sign(x[over]) * (knee + span * np.tanh((abs_x[over] - knee) / span))

    # Smooth raised-cosine fades (zero clicks, zero clipped consonants!)
    fi = min(len(x) // 5, int(fade_in_s * SR))
    fo = min(len(x) // 3, int(fade_out_s * SR))
    if fi > 0:
        x[:fi] *= (0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, fi))))[:, None]
    if fo > 0:
        x[-fo:] *= (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fo))))[:, None]
    return x


def postprocess_voice_line(
    raw_mp3: Path,
    out_wav: Path,
    dry_wav: Path,
    role: str,
    target_lufs: float,
    trim_end_sec: float | None = None,
) -> tuple[float, float]:
    """
    Studio polish per role with ZERO edge clipping:
    - 48kHz stereo float processing -> 16-bit PCM WAV
    - Gentle per-role broadcast EQ
    - Ultra-conservative envelope trim (-56dB) keeping 75ms natural breath onset & 180ms room tail!
    - Saves isolated dry WAV to `dry_wav` (used for 30fps lip-sync!)
    - Applies silky diffuse stereo hall shimmer reverb on White Dove for `out_wav`
    Returns (final_duration_sec, dry_duration_sec).
    """
    tmp_wav = out_wav.with_suffix(".tmp.wav")

    if role == "narrator":
        tone = "highpass=f=75,equalizer=f=200:t=q:w=1.2:g=0.8,equalizer=f=3200:t=q:w=1.4:g=1.2,equalizer=f=8500:t=q:w=1.5:g=0.5"
    elif role == "boy":
        tone = "highpass=f=105,equalizer=f=2800:t=q:w=1.4:g=1.0,equalizer=f=7200:t=q:w=1.6:g=-0.8"
    elif role == "mom":
        tone = "highpass=f=85,equalizer=f=250:t=q:w=1.2:g=1.2,equalizer=f=3800:t=q:w=1.5:g=0.9,equalizer=f=9000:t=q:w=1.5:g=0.8"
    elif role == "dove":
        tone = "highpass=f=80,equalizer=f=220:t=q:w=1.2:g=0.8,equalizer=f=3600:t=q:w=1.4:g=1.2,highshelf=f=7500:g=1.8"
    else:
        tone = "highpass=f=80"

    af_stage1 = f"aresample={SR},aformat=channel_layouts=stereo,{tone}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_mp3), "-af", af_stage1, "-c:a", "pcm_f32le", str(tmp_wav)],
        check=True,
    )

    sr, data = wavfile.read(tmp_wav)
    tmp_wav.unlink(missing_ok=True)
    x = data.astype(np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=-1)

    # Ultra-conservative envelope trim: NEVER chop initial breath or final consonant decay!
    mono_abs = np.max(np.abs(x), axis=1)
    win = int(0.012 * sr)
    env = np.convolve(mono_abs, np.ones(win, dtype=np.float64) / win, mode="same")
    peak_all = float(np.max(env)) + 1e-12
    thresh = max(10.0 ** (-56.0 / 20.0), peak_all * 0.002)
    active = np.where(env > thresh)[0]
    if len(active) > 0:
        start_pad = int(0.075 * sr)  # 75ms natural lead-in breath
        end_pad = int(0.180 * sr)    # 180ms natural vocal & consonant decay tail
        i0 = max(0, int(active[0]) - start_pad)
        i1 = min(len(x), int(active[-1]) + end_pad)
        x = x[i0:i1]

    if trim_end_sec is not None:
        max_n = int(round(trim_end_sec * sr))
        if len(x) > max_n:
            x = x[:max_n]

    # Save clean dry vocal track (leveled + smooth 35ms fades) for 30fps lip-sync analysis
    x_dry = level_and_limit(x.copy(), target_lufs, fade_in_s=0.035, fade_out_s=0.035)
    dry_pcm16 = np.clip(x_dry * 32767.0, -32768, 32767).astype(np.int16)
    wavfile.write(str(dry_wav), sr, dry_pcm16)
    dry_dur = len(dry_pcm16) / sr

    if role == "dove":
        # Add silky lush stereo concert-hall shimmer reverb on top of leveled dry signal
        x_wet = apply_celestial_hall_reverb(x_dry, sr=sr)
        # Re-check safety ceiling & apply smooth 220ms reverb tail fade-out
        x_wet = level_and_limit(x_wet, target_lufs, fade_in_s=0.035, fade_out_s=0.220)
        wet_pcm16 = np.clip(x_wet * 32767.0, -32768, 32767).astype(np.int16)
        wavfile.write(str(out_wav), sr, wet_pcm16)
        final_dur = len(wet_pcm16) / sr
    else:
        wavfile.write(str(out_wav), sr, dry_pcm16)
        final_dur = dry_dur

    return final_dur, dry_dur


def generate_all_voices(headers: dict, cast: dict, force: bool = False, only_ids: set[str] | None = None) -> list:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    LINES_DIR.mkdir(parents=True, exist_ok=True)
    DRY_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    for line in SCRIPT_LINES:
        lid = line["id"]
        role = line["role"]
        voice_id = cast[role]["voice_id"]
        raw_mp3 = RAW_DIR / f"{lid}.mp3"
        out_wav = LINES_DIR / f"{lid}.wav"
        dry_wav = DRY_DIR / f"{lid}.wav"

        should_gen = (
            (only_ids is not None and lid in only_ids)
            or (only_ids is None and (force or not raw_mp3.exists() or raw_mp3.stat().st_size < 1000))
        )

        if should_gen:
            settings = dict(VOICE_CAST[role]["settings"])
            if "settings_override" in line:
                settings.update(line["settings_override"])

            tts_text = line.get("tts_text", line["text"])
            payload = {
                "text": tts_text,
                "model_id": MODEL_ID,
                "language_code": "uk",
                "voice_settings": settings,
            }
            if line.get("prev_ctx"):
                payload["previous_text"] = line["prev_ctx"]
            if line.get("next_ctx"):
                payload["next_text"] = line["next_ctx"]
            if "seed" in line:
                payload["seed"] = line["seed"]

            print(f"[TTS/{MODEL_ID}] Generating {lid} ({role}): {tts_text}")
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

        dur, dry_dur = postprocess_voice_line(
            raw_mp3, out_wav, dry_wav, role, VOICE_CAST[role]["target_lufs"],
            trim_end_sec=line.get("trim_end_sec"),
        )
        print(f"      -> {out_wav.name} | dur={dur:.3f}s (dry={dry_dur:.3f}s) | size={out_wav.stat().st_size // 1024}KB")

        results.append(
            {
                "id": lid,
                "scene": line["scene"],
                "role": role,
                "text": line["text"],
                "pause_after": line["pause_after"],
                "duration_sec": round(dur, 4),
                "dry_duration_sec": round(dry_dur, 4),
                "audio_file": str(out_wav.relative_to(PROJECT_ROOT)),
                "dry_audio_file": str(dry_wav.relative_to(PROJECT_ROOT)),
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
        sfx_meta.append(
            {
                "filename": spec["filename"],
                "path": str(out_mp3.relative_to(PROJECT_ROOT)),
                "duration_sec": round(dur, 4),
            }
        )
    return sfx_meta


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Regenerate all 19 voice lines")
    parser.add_argument("--force-sfx", action="store_true", help="Regenerate all 4 SFX files")
    parser.add_argument("--only", nargs="+", help="Regenerate only specific line IDs")
    args = parser.parse_args()

    api_key = load_api_key()
    headers = {"xi-api-key": api_key}

    print(f"=== Step 1: Casting & verifying 4 native Ukrainian voices ({MODEL_ID}) ===")
    cast = ensure_cast_voices(headers)

    print("\n=== Step 2: Generating & studio-polishing 19 Ukrainian dialogue lines ===")
    only_ids = set(args.only) if args.only else None
    lines = generate_all_voices(headers, cast, force=args.force, only_ids=only_ids)

    print("\n=== Step 3: Checking 4 cozy fairytale SFX ===")
    sfx = generate_sfx(headers, force=args.force_sfx)

    meta = {
        "model_id": MODEL_ID,
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
