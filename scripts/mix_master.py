#!/usr/bin/env python3
"""
Multi-track Cinema Audio Mixer & EBU R128 Mastering Engine for "Казка Пирожок".

Assembles:
  - 19 studio-polished Ukrainian dialogue lines (4 distinct roles)
  - Original 3-act fairytale chamber score with smooth lookahead envelope ducking (~8 dB)
  - 4 ElevenLabs foley/ambient SFX layered tastefully at exact narrative moments (-20 to -24 dB)
  - Two-pass FFmpeg EBU R128 loudness normalization (I=-16 LUFS, TP=-1.5 dBTP, LRA=11)

Outputs:
  - assets/audio/master_audio.wav (48kHz stereo PCM)
  - assets/audio/master_audio.m4a (48kHz stereo 320kbps AAC)
  - assets/audio/timeline.json (exact frame-accurate scene & dialogue manifest)
"""

import json
import math
import re
import subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile

PROJECT_ROOT = Path("/home/antigravity/salfetos-ui/gemini")
META_PATH = PROJECT_ROOT / "assets" / "audio" / "lines_meta.json"
SCORE_PATH = PROJECT_ROOT / "assets" / "music" / "fairytale_score.wav"
SFX_DIR = PROJECT_ROOT / "assets" / "sfx"
OUT_WAV = PROJECT_ROOT / "assets" / "audio" / "master_audio.wav"
OUT_M4A = PROJECT_ROOT / "assets" / "audio" / "master_audio.m4a"
TIMELINE_PATH = PROJECT_ROOT / "assets" / "audio" / "timeline.json"

SR = 48000
INTRO_SEC = 1.80
OUTRO_TAIL_SEC = 3.80

SCENE_MOODS = {
    "01": "warm sunlit fairytale sunrise title card",
    "02": "joyful lively boy rushing home to raspberry jam aroma",
    "03": "cozy tender mother greeting in sunlit baking kitchen",
    "04": "gentle wonder discovering the luminous white dove on the windowsill",
    "05": "timeless serene expansive sky-blue stillness and peace of soul",
    "06": "soft curious childlike awe speaking to the white dove",
    "07": "celestial luminous wise revelation of the white dove messenger",
    "08": "playful innocent bewilderment and gentle silent dove nod",
    "09": "curious warm return to mother in the sunlit kitchen",
    "10": "deeply tender maternal embrace, revelation of soul and quiet understanding",
    "11_outro": "radiant glowing Fmaj9 musical resolution and peaceful closing title card",
}


def db_to_lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def load_wav_stereo(path: Path) -> np.ndarray:
    sr, data = wavfile.read(str(path))
    if sr != SR:
        raise ValueError(f"Expected {SR}Hz for {path}, got {sr}Hz")
    if data.dtype == np.int16:
        x = data.astype(np.float64) / 32768.0
    elif data.dtype == np.int32:
        x = data.astype(np.float64) / 2147483648.0
    else:
        x = data.astype(np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=-1)
    return x


def load_sfx_normalized(mp3_path: Path, target_rms_db: float = -20.0) -> np.ndarray:
    """Decode SFX MP3 to 48kHz stereo float64 and normalize active RMS to target_rms_db."""
    tmp = mp3_path.with_suffix(".tmp48k.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(mp3_path), "-ar", str(SR), "-ac", "2", "-c:a", "pcm_f32le", str(tmp)],
        check=True,
    )
    sr, data = wavfile.read(str(tmp))
    tmp.unlink(missing_ok=True)
    x = data.astype(np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=-1)

    # Normalize based on active energy (frames above -35dB of peak) so quiet ambient SFX isn't buried
    peak = float(np.max(np.abs(x))) + 1e-12
    mask = np.max(np.abs(x), axis=1) > peak * 0.02
    rms = float(np.sqrt(np.mean(x[mask] ** 2))) if np.any(mask) else float(np.sqrt(np.mean(x ** 2)))
    if rms > 1e-8:
        x = x * (db_to_lin(target_rms_db) / rms)
    # Soft safety ceiling at -3 dBFS
    max_v = float(np.max(np.abs(x)))
    if max_v > 0.7:
        x = x * (0.7 / max_v)
    return x


def place_audio(bus: np.ndarray, sig: np.ndarray, start_s: float, gain_db: float = 0.0, fade_in_s: float = 0.0, fade_out_s: float = 0.0):
    idx = int(round(start_s * SR))
    if idx < 0:
        sig = sig[-idx:]
        idx = 0
    if idx >= bus.shape[0] or len(sig) == 0:
        return
    seg = sig.copy()
    if fade_in_s > 0:
        fi = min(len(seg) // 2, int(fade_in_s * SR))
        if fi > 0:
            seg[:fi] *= (0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, fi))))[:, None]
    if fade_out_s > 0:
        fo = min(len(seg) // 2, int(fade_out_s * SR))
        if fo > 0:
            seg[-fo:] *= (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fo))))[:, None]

    end = min(bus.shape[0], idx + len(seg))
    bus[idx:end] += seg[: end - idx] * db_to_lin(gain_db)


def build_smooth_ducking_envelope(n_samples: int, line_intervals: list[tuple[float, float]], duck_db: float = -8.0) -> np.ndarray:
    """
    Build a butter-smooth lookahead music ducking envelope:
    - 1.0 (0 dB) during intro, dramatic pauses, and outro
    - Smoothly ducks down by `duck_db` (~ -8 dB) whenever dialogue speaks
    - Uses 0.22s lookahead pre-duck & 0.48s post-speech release smoothed with a Hann kernel
    """
    speech_mask = np.zeros(n_samples, dtype=np.float64)
    pre_s = 0.22
    post_s = 0.30
    for st, en in line_intervals:
        i0 = max(0, int((st - pre_s) * SR))
        i1 = min(n_samples, int((en + post_s) * SR))
        speech_mask[i0:i1] = 1.0

    # Smooth with a 0.55s Hann window via FFT convolution for zero pumping / click-free rides
    win_n = int(0.55 * SR)
    if win_n % 2 == 0:
        win_n += 1
    hann = np.hanning(win_n)
    hann /= np.sum(hann)

    # Fast downsample -> convolve -> upsample (exact smooth envelope in milliseconds!)
    step = 160  # 300 Hz control rate
    mask_ds = speech_mask[::step]
    win_ds = max(5, win_n // step)
    if win_ds % 2 == 0:
        win_ds += 1
    h_ds = np.hanning(win_ds)
    h_ds /= np.sum(h_ds)
    smooth_ds = np.convolve(mask_ds, h_ds, mode="same")
    smooth = np.interp(np.arange(n_samples), np.arange(len(smooth_ds)) * step, smooth_ds)
    smooth = np.clip(smooth, 0.0, 1.0)

    duck_lin = db_to_lin(duck_db)
    # Interpolate in dB space for perceptually linear fader rides
    gain_db_curve = smooth * duck_db
    return 10.0 ** (gain_db_curve / 20.0)


def run_two_pass_loudnorm(premaster_wav: Path, out_wav: Path, out_m4a: Path) -> dict:
    """Apply broadcast-grade two-pass EBU R128 loudness normalization (I=-16, TP=-1.5, LRA=11)."""
    # Pass 1: Measure exact integrated loudness & true peak
    p1_cmd = [
        "ffmpeg", "-y", "-i", str(premaster_wav),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ]
    p1 = subprocess.run(p1_cmd, capture_output=True, text=True, check=True)
    m = re.search(r"\{\s*\"input_i\".*?\}", p1.stderr, re.DOTALL)
    if not m:
        raise RuntimeError(f"Could not parse loudnorm pass 1 JSON:\n{p1.stderr[-600:]}")
    stats = json.loads(m.group(0))
    print(
        f"[MASTER] Pass 1 measured: I={stats['input_i']} LUFS, TP={stats['input_tp']} dBTP, "
        f"LRA={stats['input_lra']} LU, thresh={stats['input_thresh']} LUFS"
    )

    # Pass 2: Linear broadcast loudness normalization -> 48kHz 16-bit stereo WAV
    ln_filter = (
        f"loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:"
        f"measured_I={stats['input_i']}:"
        f"measured_TP={stats['input_tp']}:"
        f"measured_LRA={stats['input_lra']}:"
        f"measured_thresh={stats['input_thresh']}:"
        f"offset={stats['target_offset']}"
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(premaster_wav),
            "-af", ln_filter,
            "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le",
            str(out_wav),
        ],
        check=True,
    )

    # Encode 320kbps AAC M4A directly from mastered WAV
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(out_wav),
            "-c:a", "aac", "-b:a", "320k", "-ar", str(SR), "-ac", "2",
            "-movflags", "+faststart",
            str(out_m4A := out_m4a),
        ],
        check=True,
    )
    return stats


def main():
    if not META_PATH.exists():
        raise FileNotFoundError(f"Missing {META_PATH}. Run generate_voices.py first.")
    if not SCORE_PATH.exists():
        raise FileNotFoundError(f"Missing {SCORE_PATH}. Run compose_score.py first.")

    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    lines_in = meta["lines"]

    # 1. Build exact dialogue timeline
    t = INTRO_SEC
    timeline_lines = []
    line_lookup = {}
    for ln in lines_in:
        wav_path = PROJECT_ROOT / ln["audio_file"]
        sig = load_wav_stereo(wav_path)
        dur = len(sig) / SR
        st = t
        en = st + dur
        entry = {
            "id": ln["id"],
            "scene": ln["scene"],
            "role": ln["role"],
            "text": ln["text"],
            "start_sec": round(st, 4),
            "end_sec": round(en, 4),
            "duration_sec": round(dur, 4),
            "audio_file": ln["audio_file"],
        }
        timeline_lines.append(entry)
        line_lookup[ln["id"]] = entry
        t = en + ln["pause_after"]

    total_dur = round(t + OUTRO_TAIL_SEC, 4)
    n_samples = int(math.ceil(total_dur * SR))

    # 2. Build seamless scene boundaries spanning 0.0 -> total_dur (including 11_outro!)
    scene_order = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]
    scene_line_groups = {s: [l for l in timeline_lines if l["scene"] == s] for s in scene_order}

    scenes = []
    cur_start = 0.0
    for idx, sc_id in enumerate(scene_order):
        grp = scene_line_groups[sc_id]
        last_end = grp[-1]["end_sec"]
        if idx < len(scene_order) - 1:
            next_first_start = scene_line_groups[scene_order[idx + 1]][0]["start_sec"]
            # Transition cleanly right in the musical breath between scenes (60% through the pause)
            sc_end = round(last_end + 0.60 * (next_first_start - last_end), 4)
        else:
            # Scene 10 holds 1.4s after final narrator line ("...наче, все зрозумів...") before closing title card
            sc_end = round(last_end + 1.40, 4)
        scenes.append(
            {
                "scene_id": sc_id,
                "start_sec": round(cur_start, 4),
                "end_sec": sc_end,
                "duration_sec": round(sc_end - cur_start, 4),
                "mood": SCENE_MOODS[sc_id],
            }
        )
        cur_start = sc_end

    # Closing title card scene 11_outro
    scenes.append(
        {
            "scene_id": "11_outro",
            "start_sec": round(cur_start, 4),
            "end_sec": total_dur,
            "duration_sec": round(total_dur - cur_start, 4),
            "mood": SCENE_MOODS["11_outro"],
        }
    )

    scene_map = {s["scene_id"]: s for s in scenes}

    # 3. Assemble Dialogue Bus (48kHz stereo float64)
    print(f"[MIX] Assembling 19 dialogue clips across {total_dur:.2f}s timeline...")
    voice_bus = np.zeros((n_samples, 2), dtype=np.float64)
    line_intervals = []
    for entry in timeline_lines:
        sig = load_wav_stereo(PROJECT_ROOT / entry["audio_file"])
        place_audio(voice_bus, sig, entry["start_sec"], gain_db=0.0)
        line_intervals.append((entry["start_sec"], entry["end_sec"]))

    # 4. Assemble Musical Score Bus with smooth lookahead envelope ducking (-8.0 dB during speech)
    print("[MIX] Applying smooth musical ducking (-8.0 dB under dialogue, warm swells in pauses/intro/outro)...")
    score_raw = load_wav_stereo(SCORE_PATH)
    music_bus = np.zeros((n_samples, 2), dtype=np.float64)
    copy_len = min(n_samples, len(score_raw))
    music_bus[:copy_len] = score_raw[:copy_len]

    # Normalize score active RMS to -20 dBFS first so our musical bed gain is exact
    score_rms = float(np.sqrt(np.mean(music_bus ** 2))) + 1e-12
    music_bus *= db_to_lin(-20.0) / score_rms

    # Base music level: -7.0 dB relative to dialogue during open swells -> ducks smoothly to -15.0 dB during speech!
    duck_env = build_smooth_ducking_envelope(n_samples, line_intervals, duck_db=-8.0)

    # Extra tender +2.5 dB bloom during the closing title card (11_outro) so the Fmaj9 chord glows warmly!
    outro_env = np.ones(n_samples, dtype=np.float64)
    outro_st_i = int(scene_map["11_outro"]["start_sec"] * SR)
    ramp_i = int(1.4 * SR)
    if outro_st_i + ramp_i < n_samples:
        outro_env[outro_st_i : outro_st_i + ramp_i] = np.linspace(1.0, db_to_lin(2.5), ramp_i)
        outro_env[outro_st_i + ramp_i :] = db_to_lin(2.5)

    music_bus = music_bus * db_to_lin(-7.0) * duck_env[:, None] * outro_env[:, None]

    # 5. Layer Subtle ElevenLabs Foley & Magical SFX (-19 to -23 dB relative to dialogue)
    print("[MIX] Layering 4 ElevenLabs foley & magic SFX cues...")
    sfx_bus = np.zeros((n_samples, 2), dtype=np.float64)

    sfx_footsteps = load_sfx_normalized(SFX_DIR / "sfx_footsteps.mp3", target_rms_db=-20.0)
    sfx_kitchen = load_sfx_normalized(SFX_DIR / "sfx_kitchen_warm.mp3", target_rms_db=-20.0)
    sfx_wings = load_sfx_normalized(SFX_DIR / "sfx_dove_wings.mp3", target_rms_db=-20.0)
    sfx_chime = load_sfx_normalized(SFX_DIR / "sfx_magic_chime.mp3", target_rms_db=-20.0)

    sfx_cues = [
        # Joyful barefoot footsteps as boy runs in (Scene 02)
        ("sfx_footsteps.mp3", sfx_footsteps, max(0.0, line_lookup["02_boy_smell"]["start_sec"] - 0.35), -20.5, 0.25, 0.70),
        # Warm cozy sunlit kitchen & oven ambiance (Scene 03)
        ("sfx_kitchen_warm.mp3", sfx_kitchen, scene_map["03"]["start_sec"] + 0.15, -22.5, 0.80, 1.00),
        # White dove soft feather flutter on windowsill (Scene 04)
        ("sfx_dove_wings.mp3", sfx_wings, line_lookup["07_narrator_saw_bird"]["start_sec"] + 2.40, -19.5, 0.40, 0.90),
        # Delicate angelic celesta shimmer on "простір тихий і так добре стало на душі" (Scene 05)
        ("sfx_magic_chime.mp3", sfx_chime, line_lookup["08_narrator_sky_eyes"]["start_sec"] + 4.40, -19.5, 0.50, 1.20),
        # Soft dove wing rustle just before Dove speaks (Scene 07)
        ("sfx_dove_wings.mp3", sfx_wings, max(0.0, line_lookup["11_dove_messenger"]["start_sec"] - 0.55), -21.5, 0.35, 1.00),
        # Delicate celestial sparkle shimmering gently with Dove's message (Scene 07)
        ("sfx_magic_chime.mp3", sfx_chime, line_lookup["11_dove_messenger"]["start_sec"] + 0.40, -21.0, 0.45, 1.20),
        # Cozy kitchen warmth returns as boy runs back to Mom (Scene 09)
        ("sfx_kitchen_warm.mp3", sfx_kitchen, scene_map["09"]["start_sec"] + 0.20, -23.0, 0.90, 1.10),
        # Final radiant gentle sparkle on Mom's "...і твоє дитинство, і твоя Душа..." (Scene 10)
        ("sfx_magic_chime.mp3", sfx_chime, line_lookup["18_mom_soul"]["start_sec"] + 2.10, -19.5, 0.55, 1.40),
    ]

    sfx_manifest = []
    for name, sig, st_s, g_db, fi, fo in sfx_cues:
        place_audio(sfx_bus, sig, st_s, gain_db=g_db, fade_in_s=fi, fade_out_s=fo)
        sfx_manifest.append({"sfx": name, "start_sec": round(st_s, 3), "gain_db": g_db})

    # 6. Sum Stems & Write Pre-Master Float WAV
    premaster = voice_bus + music_bus + sfx_bus

    # Gentle safety tail fade (last 0.6s) to guarantee pristine digital black silence at end
    tail_n = int(0.60 * SR)
    premaster[-tail_n:] *= (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, tail_n))))[:, None]

    # Scale gently if premaster peak exceeds -2 dBFS before loudnorm
    pm_peak = float(np.max(np.abs(premaster)))
    if pm_peak > 0.79:
        premaster *= 0.79 / pm_peak

    premaster_path = OUT_WAV.with_suffix(".premaster.wav")
    wavfile.write(str(premaster_path), SR, premaster.astype(np.float32))

    # 7. Two-pass EBU R128 Broadcast Mastering (-16 LUFS, -1.5 dBTP) -> WAV & M4A
    print("[MASTER] Running two-pass EBU R128 loudness normalization (-16 LUFS / -1.5 dBTP)...")
    run_two_pass_loudnorm(premaster_path, OUT_WAV, OUT_M4A)
    premaster_path.unlink(missing_ok=True)

    # 8. Export timeline.json (NO API KEYS!)
    timeline = {
        "title": "Казка Пирожок",
        "language": "uk",
        "total_duration_sec": total_dur,
        "sample_rate": SR,
        "channels": 2,
        "fps_recommendation": 24,
        "master_files": {
            "wav": str(OUT_WAV.relative_to(PROJECT_ROOT)),
            "m4a": str(OUT_M4A.relative_to(PROJECT_ROOT)),
            "score": str(SCORE_PATH.relative_to(PROJECT_ROOT)),
        },
        "voices_used": meta["voices_used"],
        "lines": timeline_lines,
        "scenes": scenes,
        "sfx_cues": sfx_manifest,
    }
    TIMELINE_PATH.write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[DONE] Master WAV : {OUT_WAV}")
    print(f"[DONE] Master M4A : {OUT_M4A}")
    print(f"[DONE] Timeline   : {TIMELINE_PATH} ({total_dur:.2f}s, {len(timeline_lines)} lines, {len(scenes)} scenes)")


if __name__ == "__main__":
    main()
