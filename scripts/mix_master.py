#!/usr/bin/env python3
"""
Multi-track Cinema Audio Mixer, EBU R128 Mastering & 30fps Lip-Sync Engine (v2) for "Казка Пирожок".

Assembles:
  - 19 studio-polished Ukrainian dialogue lines (eleven_v4, 4 distinct native Ukrainian roles)
  - Original 3-act fairytale chamber score with smooth lookahead envelope ducking (~8 dB)
  - 4 ElevenLabs foley/ambient SFX layered tastefully at exact narrative moments (-19.5 to -23 dB)
  - Two-pass FFmpeg EBU R128 loudness normalization (I=-16 LUFS, TP=-1.5 dBTP, LRA=11)

Outputs:
  - assets/audio/master_audio.wav (48kHz stereo PCM)
  - assets/audio/master_audio.m4a (48kHz stereo 320kbps AAC)
  - assets/audio/timeline.json    (exact frame-accurate scene & dialogue manifest)
  - assets/audio/lipsync.json     (30fps per-frame vocal energy, brightness & visemes for boy, mom, dove)
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
LIPSYNC_PATH = PROJECT_ROOT / "assets" / "audio" / "lipsync.json"

SR = 48000
LIPSYNC_FPS = 30
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

    peak = float(np.max(np.abs(x))) + 1e-12
    mask = np.max(np.abs(x), axis=1) > peak * 0.02
    rms = float(np.sqrt(np.mean(x[mask] ** 2))) if np.any(mask) else float(np.sqrt(np.mean(x ** 2)))
    if rms > 1e-8:
        x = x * (db_to_lin(target_rms_db) / rms)
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
    Butter-smooth lookahead music ducking envelope:
    - 1.0 (0 dB) during intro, poetic pauses, and closing title card
    - Smoothly ducks down by `duck_db` (~ -8 dB) under dialogue
    - Bridges short inline dialogue pauses (<0.5s) cleanly with zero pumping!
    """
    speech_mask = np.zeros(n_samples, dtype=np.float64)
    pre_s = 0.24
    post_s = 0.30
    for st, en in line_intervals:
        i0 = max(0, int((st - pre_s) * SR))
        i1 = min(n_samples, int((en + post_s) * SR))
        speech_mask[i0:i1] = 1.0

    step = 160  # 300 Hz control rate
    mask_ds = speech_mask[::step]
    win_ds = max(5, int(0.55 * SR) // step)
    if win_ds % 2 == 0:
        win_ds += 1
    h_ds = np.hanning(win_ds)
    h_ds /= np.sum(h_ds)
    smooth_ds = np.convolve(mask_ds, h_ds, mode="same")
    smooth = np.interp(np.arange(n_samples), np.arange(len(smooth_ds)) * step, smooth_ds)
    smooth = np.clip(smooth, 0.0, 1.0)

    gain_db_curve = smooth * duck_db
    return 10.0 ** (gain_db_curve / 20.0)


def generate_lipsync_json(timeline_lines: list[dict], total_dur: float, n_samples: int) -> dict:
    """
    Compute 30fps per-frame vocal energy, spectral brightness, and viseme classification
    (`closed`, `ah`, `oh`, `ee`, `wide`) for each on-screen speaking character (`boy`, `mom`, `dove`)
    directly from their isolated DRY dialogue WAV tracks!
    """
    fps = LIPSYNC_FPS
    total_frames = int(math.ceil(total_dur * fps))
    hop = SR / fps  # exact 1600.0 samples per frame at 48kHz / 30fps
    win_len = 2048
    hann = np.hanning(win_len)
    freqs = np.fft.rfftfreq(win_len, d=1.0 / SR)

    band_low = (freqs >= 220.0) & (freqs < 750.0)
    band_mid = (freqs >= 750.0) & (freqs < 1750.0)
    band_high = (freqs >= 1750.0) & (freqs < 4600.0)
    band_full = (freqs >= 120.0) & (freqs < 6000.0)

    speaking_roles = ["boy", "mom", "dove"]
    characters_data = {}
    speaking_segments = {r: [] for r in speaking_roles}

    for role in speaking_roles:
        # Build isolated dry mono bus for this character
        char_bus = np.zeros(n_samples, dtype=np.float64)
        for entry in timeline_lines:
            if entry["role"] != role:
                continue
            dry_path = PROJECT_ROOT / entry["dry_audio_file"]
            sig = load_wav_stereo(dry_path)
            mono = 0.5 * (sig[:, 0] + sig[:, 1])
            i0 = int(round(entry["start_sec"] * SR))
            i1 = min(n_samples, i0 + len(mono))
            if i0 < n_samples and i1 > i0:
                char_bus[i0:i1] += mono[: i1 - i0]
            speaking_segments[role].append(
                {
                    "line_id": entry["id"],
                    "scene": entry["scene"],
                    "start_sec": entry["start_sec"],
                    "end_sec": round(entry["start_sec"] + len(mono) / SR, 4),
                    "start_frame": int(round(entry["start_sec"] * fps)),
                    "end_frame": int(round((entry["start_sec"] + len(mono) / SR) * fps)),
                }
            )

        raw_rms = np.zeros(total_frames, dtype=np.float64)
        raw_bright = np.zeros(total_frames, dtype=np.float64)
        low_ratio = np.zeros(total_frames, dtype=np.float64)
        mid_ratio = np.zeros(total_frames, dtype=np.float64)
        high_ratio = np.zeros(total_frames, dtype=np.float64)

        for f in range(total_frames):
            center = int(round((f + 0.5) * hop))
            a = center - win_len // 2
            b = a + win_len
            frame_sig = np.zeros(win_len, dtype=np.float64)
            src_a = max(0, a)
            src_b = min(n_samples, b)
            if src_b > src_a:
                frame_sig[src_a - a : src_b - a] = char_bus[src_a:src_b]

            rms = float(np.sqrt(np.mean(frame_sig ** 2)))
            raw_rms[f] = rms

            if rms > 1e-5:
                spec = np.abs(np.fft.rfft(frame_sig * hann))
                mag2 = spec ** 2
                tot_e = float(np.sum(mag2[band_full])) + 1e-12
                centroid = float(np.sum(freqs[band_full] * mag2[band_full]) / tot_e)
                # Normalize brightness smoothly across 450 Hz .. 3400 Hz
                raw_bright[f] = float(np.clip((centroid - 450.0) / (3400.0 - 450.0), 0.0, 1.0))

                e_l = float(np.sum(mag2[band_low]))
                e_m = float(np.sum(mag2[band_mid]))
                e_h = float(np.sum(mag2[band_high]))
                denom = e_l + e_m + e_h + 1e-12
                low_ratio[f] = e_l / denom
                mid_ratio[f] = e_m / denom
                high_ratio[f] = e_h / denom

        # Normalize vocal energy against this character's 95th percentile voiced RMS
        active_vals = raw_rms[raw_rms > 0.004]
        ref_rms = float(np.percentile(active_vals, 95)) if len(active_vals) > 0 else 0.1
        norm_e = np.clip(raw_rms / (ref_rms + 1e-12), 0.0, 1.0)
        # Light 3-frame smoothing [0.22, 0.56, 0.22] for organic mouth motion without losing syllables
        smooth_e = np.convolve(norm_e, np.array([0.22, 0.56, 0.22]), mode="same")
        smooth_b = np.convolve(raw_bright, np.array([0.20, 0.60, 0.20]), mode="same")

        # Per-frame viseme classification (calibrated for Ukrainian vowel formants)
        visemes = []
        for f in range(total_frames):
            e = float(smooth_e[f])
            b = float(smooth_b[f])
            if e < 0.075:
                v = "closed"
            elif e >= 0.66 and mid_ratio[f] >= 0.16:
                v = "wide"
            elif high_ratio[f] >= 0.28 or b >= 0.44:
                v = "ee"
            elif low_ratio[f] >= 0.68 and b <= 0.24:
                v = "oh"
            else:
                v = "ah"
            visemes.append(v)

        # Gentle 1-frame anti-flicker cleanup (only remove isolated 1-frame glitch sandwiched by identical neighbors)
        cleaned_v = list(visemes)
        for f in range(1, total_frames - 1):
            if visemes[f - 1] == visemes[f + 1] and visemes[f] != visemes[f - 1]:
                cleaned_v[f] = visemes[f - 1]

        frames_out = []
        for f in range(total_frames):
            frames_out.append(
                {
                    "f": f,
                    "t": round(f / fps, 4),
                    "e": round(float(smooth_e[f]), 4),
                    "b": round(float(smooth_b[f]), 4),
                    "v": cleaned_v[f],
                }
            )
        characters_data[role] = frames_out

    payload = {
        "title": "Казка Пирожок",
        "fps": fps,
        "total_duration_sec": round(total_dur, 4),
        "total_frames": total_frames,
        "visemes": ["closed", "ah", "oh", "ee", "wide"],
        "field_legend": {
            "f": "0-based frame index at 30fps",
            "t": "timestamp in seconds",
            "e": "normalized vocal amplitude energy [0.0..1.0] from isolated dry vocal track",
            "b": "normalized spectral brightness [0.0..1.0]",
            "v": "classified viseme (closed|ah|oh|ee|wide)",
        },
        "speaking_segments": speaking_segments,
        "characters": characters_data,
    }
    LIPSYNC_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return payload


def run_two_pass_loudnorm(premaster_wav: Path, out_wav: Path, out_m4a: Path) -> dict:
    """Apply broadcast-grade two-pass EBU R128 loudness normalization (I=-16, TP=-1.5, LRA=11)."""
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

    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(out_wav),
            "-c:a", "aac", "-b:a", "320k", "-ar", str(SR), "-ac", "2",
            "-movflags", "+faststart",
            str(out_m4a),
        ],
        check=True,
    )

    # Verify final mastered loudness & true peak
    v_cmd = [
        "ffmpeg", "-y", "-i", str(out_wav),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ]
    vp = subprocess.run(v_cmd, capture_output=True, text=True, check=True)
    vm = re.search(r"\{\s*\"input_i\".*?\}", vp.stderr, re.DOTALL)
    if vm:
        vstats = json.loads(vm.group(0))
        print(
            f"[MASTER] Final verified: I={vstats['input_i']} LUFS, TP={vstats['input_tp']} dBTP, "
            f"LRA={vstats['input_lra']} LU"
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
        dry_dur = float(ln.get("dry_duration_sec", dur))
        entry = {
            "id": ln["id"],
            "scene": ln["scene"],
            "role": ln["role"],
            "text": ln["text"],
            "start_sec": round(st, 4),
            "end_sec": round(en, 4),
            "dry_end_sec": round(st + dry_dur, 4),
            "duration_sec": round(dur, 4),
            "audio_file": ln["audio_file"],
            "dry_audio_file": ln.get("dry_audio_file", ln["audio_file"]),
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
            sc_end = round(last_end + 0.58 * (next_first_start - last_end), 4)
        else:
            sc_end = round(last_end + 1.35, 4)
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
        # Duck music cleanly against actual speech body (dry_end_sec + tiny reverb grace for Dove)
        duck_end = entry["dry_end_sec"] + (0.35 if entry["role"] == "dove" else 0.0)
        line_intervals.append((entry["start_sec"], duck_end))

    # 4. Assemble Musical Score Bus with smooth lookahead envelope ducking (-8.0 dB during speech)
    print("[MIX] Applying smooth musical ducking (-8.0 dB under dialogue, warm swells in pauses/intro/outro)...")
    score_raw = load_wav_stereo(SCORE_PATH)
    music_bus = np.zeros((n_samples, 2), dtype=np.float64)
    copy_len = min(n_samples, len(score_raw))
    music_bus[:copy_len] = score_raw[:copy_len]

    score_rms = float(np.sqrt(np.mean(music_bus ** 2))) + 1e-12
    music_bus *= db_to_lin(-20.0) / score_rms

    duck_env = build_smooth_ducking_envelope(n_samples, line_intervals, duck_db=-8.0)

    outro_env = np.ones(n_samples, dtype=np.float64)
    outro_st_i = int(scene_map["11_outro"]["start_sec"] * SR)
    ramp_i = int(1.4 * SR)
    if outro_st_i + ramp_i < n_samples:
        outro_env[outro_st_i : outro_st_i + ramp_i] = np.linspace(1.0, db_to_lin(2.5), ramp_i)
        outro_env[outro_st_i + ramp_i :] = db_to_lin(2.5)

    music_bus = music_bus * db_to_lin(-7.0) * duck_env[:, None] * outro_env[:, None]

    # 5. Layer Subtle ElevenLabs Foley & Magical SFX (-19.5 to -23 dB relative to dialogue)
    print("[MIX] Layering 4 ElevenLabs foley & magic SFX cues...")
    sfx_bus = np.zeros((n_samples, 2), dtype=np.float64)

    sfx_footsteps = load_sfx_normalized(SFX_DIR / "sfx_footsteps.mp3", target_rms_db=-20.0)
    sfx_kitchen = load_sfx_normalized(SFX_DIR / "sfx_kitchen_warm.mp3", target_rms_db=-20.0)
    sfx_wings = load_sfx_normalized(SFX_DIR / "sfx_dove_wings.mp3", target_rms_db=-20.0)
    sfx_chime = load_sfx_normalized(SFX_DIR / "sfx_magic_chime.mp3", target_rms_db=-20.0)

    sfx_cues = [
        ("sfx_footsteps.mp3", sfx_footsteps, max(0.0, line_lookup["02_boy_smell"]["start_sec"] - 0.35), -20.5, 0.25, 0.70),
        ("sfx_kitchen_warm.mp3", sfx_kitchen, scene_map["03"]["start_sec"] + 0.15, -22.5, 0.80, 1.00),
        ("sfx_dove_wings.mp3", sfx_wings, line_lookup["07_narrator_saw_bird"]["start_sec"] + 2.10, -19.5, 0.40, 0.90),
        ("sfx_magic_chime.mp3", sfx_chime, line_lookup["08_narrator_sky_eyes"]["start_sec"] + 3.90, -19.5, 0.50, 1.20),
        ("sfx_dove_wings.mp3", sfx_wings, max(0.0, line_lookup["11_dove_messenger"]["start_sec"] - 0.55), -21.5, 0.35, 1.00),
        ("sfx_magic_chime.mp3", sfx_chime, line_lookup["11_dove_messenger"]["start_sec"] + 0.35, -21.5, 0.45, 1.20),
        ("sfx_kitchen_warm.mp3", sfx_kitchen, scene_map["09"]["start_sec"] + 0.20, -23.0, 0.90, 1.10),
        ("sfx_magic_chime.mp3", sfx_chime, line_lookup["18_mom_soul"]["start_sec"] + 2.40, -19.5, 0.55, 1.40),
    ]

    sfx_manifest = []
    for name, sig, st_s, g_db, fi, fo in sfx_cues:
        place_audio(sfx_bus, sig, st_s, gain_db=g_db, fade_in_s=fi, fade_out_s=fo)
        sfx_manifest.append({"sfx": name, "start_sec": round(st_s, 3), "gain_db": g_db})

    # 6. Sum Stems & Write Pre-Master Float WAV
    premaster = voice_bus + music_bus + sfx_bus

    tail_n = int(0.60 * SR)
    premaster[-tail_n:] *= (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, tail_n))))[:, None]

    pm_peak = float(np.max(np.abs(premaster)))
    if pm_peak > 0.79:
        premaster *= 0.79 / pm_peak

    premaster_path = OUT_WAV.with_suffix(".premaster.wav")
    wavfile.write(str(premaster_path), SR, premaster.astype(np.float32))

    # 7. Two-pass EBU R128 Broadcast Mastering (-16 LUFS, -1.5 dBTP) -> WAV & M4A
    print("[MASTER] Running two-pass EBU R128 loudness normalization (-16 LUFS / -1.5 dBTP)...")
    run_two_pass_loudnorm(premaster_path, OUT_WAV, OUT_M4A)
    premaster_path.unlink(missing_ok=True)

    # 8. Generate 30fps Lip-Sync Data from Isolated Dry Character Tracks
    print(f"[LIPSYNC] Computing {LIPSYNC_FPS}fps energy, brightness & visemes for boy, mom, dove...")
    ls = generate_lipsync_json(timeline_lines, total_dur, n_samples)
    print(f"          -> {LIPSYNC_PATH} ({ls['total_frames']} frames @ {LIPSYNC_FPS}fps)")

    # 9. Export timeline.json (NO API KEYS!)
    timeline = {
        "title": "Казка Пирожок",
        "language": "uk",
        "model_id": meta.get("model_id", "eleven_v4"),
        "total_duration_sec": total_dur,
        "sample_rate": SR,
        "channels": 2,
        "fps_recommendation": LIPSYNC_FPS,
        "master_files": {
            "wav": str(OUT_WAV.relative_to(PROJECT_ROOT)),
            "m4a": str(OUT_M4A.relative_to(PROJECT_ROOT)),
            "score": str(SCORE_PATH.relative_to(PROJECT_ROOT)),
            "lipsync": str(LIPSYNC_PATH.relative_to(PROJECT_ROOT)),
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
    print(f"[DONE] Lip-sync   : {LIPSYNC_PATH}")


if __name__ == "__main__":
    main()
