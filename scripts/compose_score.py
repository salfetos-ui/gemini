#!/usr/bin/env python3
"""
Original Fairytale Chamber Musical Score Composer for "Казка Пирожок".

Synthesizes a lush, warm, acoustic-feeling 48kHz stereo score synchronized
precisely to the film's exact dialogue timeline and 3-Act emotional arc:
  - Intro & Act 1 (Scenes 01-03): Sunlit F Major waltz (plucked harp + celesta + warm strings)
  - Act 2 (Scenes 04-08): Timeless luminous stillness for the White Dove (Fmaj9 -> Dm9 -> Bbmaj7 -> C6add9,
    velvet bowed strings + sparkling high harp harmonics)
  - Act 3 (Scenes 09-10 + 11_outro): Tender return of the lullaby motif with heartfelt cello,
    blooming on "і твоє дитинство, і твоя Душа...", resolving on a radiant glowing Fmaj9 chord.
"""

import json
import math
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, sosfilt

PROJECT_ROOT = Path("/home/antigravity/salfetos-ui/gemini")
META_PATH = PROJECT_ROOT / "assets" / "audio" / "lines_meta.json"
OUT_SCORE = PROJECT_ROOT / "assets" / "music" / "fairytale_score.wav"

SR = 48000
INTRO_SEC = 1.80
OUTRO_TAIL_SEC = 3.80  # Closing title card hold after final narrator pause (total ~6.3s after last word)

# MIDI note to Hz
def midi_to_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


# ==============================================================================
# ACOUSTIC INSTRUMENT SYNTHESIZERS (Warm, Non-Harsh, High-Resolution)
# ==============================================================================

def synth_harp_note(midi: float, dur: float, vel: float = 0.7) -> np.ndarray:
    """
    Warm acoustic concert harp note using damped multi-partial plucked string model
    with nylon pluck transient and realistic high-partial decay.
    """
    f0 = midi_to_hz(midi)
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float64)
    t = np.arange(n, dtype=np.float64) / SR

    # Soft finger-pluck attack (4-8ms) + natural resonant decay
    attack = 1.0 - np.exp(-t / 0.0045)
    sig = np.zeros(n, dtype=np.float64)

    # Harp partial profile: strong warm fundamental, rich 2nd & 3rd, gentle upper shimmer
    partials = [
        (1.0, 1.00, 1.15),
        (2.0, 0.42, 1.85),
        (3.0, 0.16, 2.80),
        (4.0, 0.075, 4.20),
        (5.0, 0.032, 6.00),
        (6.0, 0.014, 8.50),
    ]
    # Slight pitch-dependent decay scaling (lower notes ring longer)
    pitch_scale = max(0.55, min(1.5, (72.0 / max(36.0, midi)) ** 1.15))

    rng = np.random.default_rng(int(midi * 1000) + n)
    for mult, amp, decay_rate in partials:
        freq = f0 * mult
        if freq > 9500.0:
            continue
        # Subtle string inharmonicity & random start phase
        inharm = 1.0 + 0.00012 * (mult ** 2)
        phase = rng.uniform(0, 0.25)
        env = np.exp(-t * (decay_rate / pitch_scale))
        sig += amp * env * np.sin(2.0 * np.pi * freq * inharm * t + phase)

    # Tiny warm nylon pluck thump transient (bandlimited 200-1400 Hz, 18ms)
    noise = rng.normal(0.0, 1.0, min(n, int(0.03 * SR)))
    sos = butter(2, [220, 1400], btype="bandpass", fs=SR, output="sos")
    pluck = sosfilt(sos, noise) * np.exp(-np.arange(len(noise)) / (0.005 * SR)) * 0.10
    sig[: len(pluck)] += pluck

    # Smooth release fade at buffer end
    fade_len = min(n, int(0.08 * SR))
    fade = np.linspace(1.0, 0.0, fade_len)
    sig[-fade_len:] *= fade

    return sig * attack * vel * 0.24


def synth_celesta_note(midi: float, dur: float, vel: float = 0.65) -> np.ndarray:
    """
    Silky fairytale celesta / soft music-box bell: felt-hammer warmth,
    crystalline yet velvety upper partials, zero harsh digital piercing.
    """
    f0 = midi_to_hz(midi)
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float64)
    t = np.arange(n, dtype=np.float64) / SR

    attack = 1.0 - np.exp(-t / 0.003)
    sig = np.zeros(n, dtype=np.float64)

    # Classic celesta tone: pure fundamental + delicate 2nd + celesta steel-bar 3rd/4th
    partials = [
        (1.000, 1.00, 1.35),
        (2.001, 0.22, 2.60),
        (3.004, 0.055, 5.20),
        (4.010, 0.028, 7.80),
        (5.400, 0.010, 14.0),  # tiny crystalline bell ping that vanishes quickly
    ]
    for mult, amp, decay_rate in partials:
        freq = f0 * mult
        if freq > 11000.0:
            continue
        env = np.exp(-t * decay_rate)
        sig += amp * env * np.sin(2.0 * np.pi * freq * t)

    fade_len = min(n, int(0.06 * SR))
    sig[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)
    return sig * attack * vel * 0.16


def synth_harp_harmonic(midi: float, dur: float, vel: float = 0.5) -> np.ndarray:
    """Glistening, pure floating harp harmonic for celestial White Dove moments."""
    f0 = midi_to_hz(midi)
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float64)
    t = np.arange(n, dtype=np.float64) / SR
    attack = 1.0 - np.exp(-t / 0.018)
    env = np.exp(-t * 0.85)
    sig = (
        1.00 * np.sin(2.0 * np.pi * f0 * t)
        + 0.14 * np.exp(-t * 2.2) * np.sin(2.0 * np.pi * f0 * 2.0 * t)
        + 0.03 * np.exp(-t * 4.0) * np.sin(2.0 * np.pi * f0 * 3.0 * t)
    )
    fade_len = min(n, int(0.12 * SR))
    sig[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)
    return sig * attack * env * vel * 0.14


def synth_string_voice(
    midi: float,
    dur: float,
    vel: float = 0.5,
    attack_s: float = 0.85,
    release_s: float = 1.1,
    cutoff_hz: float = 1650.0,
    is_cello: bool = False,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Velvet chamber string ensemble voice (stereo pair) using 3 slightly detuned
    warm bandlimited saw/triangle oscillators with gentle natural vibrato
    and warm resonant lowpass body filtering.
    """
    f0 = midi_to_hz(midi)
    n = int(dur * SR)
    if n <= 0:
        z = np.zeros(0, dtype=np.float64)
        return z, z
    t = np.arange(n, dtype=np.float64) / SR

    # Smooth cosine-shaped ADSR envelope (ultra-silky bowed swell)
    env = np.ones(n, dtype=np.float64)
    atk_n = min(n // 2, int(attack_s * SR))
    rel_n = min(n // 2, int(release_s * SR))
    if atk_n > 0:
        env[:atk_n] = 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, atk_n)))
    if rel_n > 0:
        env[-rel_n:] *= 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, rel_n)))

    # 3 ensemble players with gentle detuning & independent slow vibrato
    detunes_cents = [-6.5, 0.0, +6.2] if not is_cello else [-4.0, 0.0, +4.2]
    vib_rates = [4.9, 5.3, 5.6]
    vib_depth = 0.0028 if not is_cello else 0.0020
    pans = [0.28, 0.50, 0.72] if not is_cello else [0.38, 0.48, 0.58]

    left = np.zeros(n, dtype=np.float64)
    right = np.zeros(n, dtype=np.float64)

    max_h = 10 if is_cello else 7
    rng = np.random.default_rng(int(midi * 100) + n)

    for det_c, vr, pan in zip(detunes_cents, vib_rates, pans):
        freq = f0 * (2.0 ** (det_c / 1200.0))
        vib_delay = np.clip((t - 0.35) / 0.8, 0.0, 1.0)
        # Integrate instantaneous frequency for phase-coherent vibrato
        inst_f = freq * (1.0 + vib_depth * vib_delay * np.sin(2.0 * np.pi * vr * t + rng.uniform(0, 6.28)))
        phase = 2.0 * np.pi * np.cumsum(inst_f) / SR + rng.uniform(0, 6.28)

        voice = np.zeros(n, dtype=np.float64)
        for h in range(1, max_h + 1):
            if freq * h > 5500.0:
                break
            # Warm bowed harmonic rolloff (~ 1 / h^1.35)
            h_amp = 1.0 / (h ** 1.35)
            voice += h_amp * np.sin(h * phase)

        gl = math.cos(pan * math.pi / 2.0)
        gr = math.sin(pan * math.pi / 2.0)
        left += voice * gl
        right += voice * gr

    # Warm wooden string body lowpass filter
    sos = butter(2, min(cutoff_hz, SR * 0.4), btype="lowpass", fs=SR, output="sos")
    left = sosfilt(sos, left) * env * vel * (0.095 if is_cello else 0.072)
    right = sosfilt(sos, right) * env * vel * (0.095 if is_cello else 0.072)
    return left, right


# ==============================================================================
# STEREO ALGORITHMIC CONCERT HALL REVERB (Schroeder/Moorer with Warm Damping)
# ==============================================================================

def apply_chamber_hall_reverb(stereo: np.ndarray, wet: float = 0.34) -> np.ndarray:
    """
    Lush, warm stereo chamber hall reverb:
    - Asymmetric early reflections for realistic room width
    - 4 parallel lowpass-damped comb filters per channel (decorrelated L/R prime delays)
    - 2 series allpass diffusers per channel
    """
    n = stereo.shape[0]
    L_in = stereo[:, 0]
    R_in = stereo[:, 1]
    mono_send = 0.5 * (L_in + R_in)

    # Pre-filter reverb send (cut mud < 140Hz and harshness > 5800Hz)
    sos_send = butter(2, [140, 5800], btype="bandpass", fs=SR, output="sos")
    send = sosfilt(sos_send, mono_send)

    # Early reflections (stereo)
    er_L = np.zeros(n, dtype=np.float64)
    er_R = np.zeros(n, dtype=np.float64)
    for ms, g in [(14.2, 0.24), (27.8, 0.17), (43.5, 0.11), (61.0, 0.07)]:
        d = int(ms * SR / 1000.0)
        if d < n:
            er_L[d:] += send[:-d] * g
    for ms, g in [(17.9, 0.23), (32.4, 0.16), (48.7, 0.11), (66.3, 0.07)]:
        d = int(ms * SR / 1000.0)
        if d < n:
            er_R[d:] += send[:-d] * g

    def comb_filter(x: np.ndarray, delay_samples: int, feedback: float) -> np.ndarray:
        # Exact block-vectorized recurrence: y[n] = x[n - D] + g * y[n - D]
        y = np.zeros_like(x)
        D = delay_samples
        n_x = len(x)
        for i in range(D, n_x, D):
            end = min(n_x, i + D)
            span = end - i
            y[i:end] = x[i - D : i - D + span] + feedback * y[i - D : i - D + span]
        return y

    def allpass_filter(x: np.ndarray, delay_samples: int, g: float = 0.5) -> np.ndarray:
        # Exact block-vectorized recurrence: y[n] = -g*x[n] + x[n - D] + g*y[n - D]
        y = np.empty_like(x)
        D = delay_samples
        n_x = len(x)
        y[:D] = -g * x[:D]
        for i in range(D, n_x, D):
            end = min(n_x, i + D)
            span = end - i
            y[i:end] = -g * x[i:end] + x[i - D : i - D + span] + g * y[i - D : i - D + span]
        return y

    # Decorrelated prime delays (in samples at 48kHz) -> ~2.4s warm RT60
    combs_L = [(1687, 0.805), (1951, 0.790), (2237, 0.775), (2543, 0.760)]
    combs_R = [(1723, 0.805), (1993, 0.790), (2281, 0.775), (2591, 0.760)]

    tail_L = sum(comb_filter(send, d, g) for d, g in combs_L) * 0.25
    tail_R = sum(comb_filter(send, d, g) for d, g in combs_R) * 0.25

    # Warm high-frequency absorption in hall tail
    sos_damp = butter(2, 3400, btype="lowpass", fs=SR, output="sos")
    tail_L = sosfilt(sos_damp, tail_L)
    tail_R = sosfilt(sos_damp, tail_R)

    # Series allpass diffusion
    tail_L = allpass_filter(allpass_filter(tail_L, 263, 0.52), 541, 0.48)
    tail_R = allpass_filter(allpass_filter(tail_R, 281, 0.52), 569, 0.48)

    wet_L = er_L * 0.45 + tail_L * 0.75
    wet_R = er_R * 0.45 + tail_R * 0.75

    out = np.empty_like(stereo)
    out[:, 0] = stereo[:, 0] * (1.0 - wet * 0.35) + wet_L * wet
    out[:, 1] = stereo[:, 1] * (1.0 - wet * 0.35) + wet_R * wet
    return out


# ==============================================================================
# HELPER: STEREO PLACEMENT
# ==============================================================================

def add_mono_event(buf: np.ndarray, start_s: float, sig: np.ndarray, pan: float = 0.5):
    idx = int(round(start_s * SR))
    if idx < 0 or idx >= buf.shape[0] or len(sig) == 0:
        return
    end = min(buf.shape[0], idx + len(sig))
    seg = sig[: end - idx]
    gl = math.cos(pan * math.pi / 2.0)
    gr = math.sin(pan * math.pi / 2.0)
    buf[idx:end, 0] += seg * gl
    buf[idx:end, 1] += seg * gr


def add_stereo_event(buf: np.ndarray, start_s: float, left: np.ndarray, right: np.ndarray):
    idx = int(round(start_s * SR))
    if idx < 0 or idx >= buf.shape[0] or len(left) == 0:
        return
    end = min(buf.shape[0], idx + len(left))
    buf[idx:end, 0] += left[: end - idx]
    buf[idx:end, 1] += right[: end - idx]


# ==============================================================================
# TIMELINE COMPUTATION (SHARED CONTRACT WITH mix_master.py)
# ==============================================================================

def compute_act_boundaries() -> dict:
    """Compute exact narrative timing markers from lines_meta.json."""
    if not META_PATH.exists():
        raise FileNotFoundError(f"Run generate_voices.py first! Missing {META_PATH}")
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    lines = meta["lines"]

    t = INTRO_SEC
    scene_starts = {"01": 0.0}
    line_times = {}
    for ln in lines:
        sc = ln["scene"]
        if sc not in scene_starts:
            # Start new scene gently mid-way through preceding pause
            scene_starts[sc] = max(0.0, t - 0.35)
        start = t
        end = start + ln["duration_sec"]
        line_times[ln["id"]] = (start, end)
        t = end + ln["pause_after"]

    total_dur = t + OUTRO_TAIL_SEC
    return {
        "total_dur": total_dur,
        "scene_starts": scene_starts,
        "line_times": line_times,
        "outro_start": t - 0.6,
    }


# ==============================================================================
# 3-ACT FAIRYTALE SCORE COMPOSITION
# ==============================================================================

def compose_score(timing: dict) -> np.ndarray:
    total_dur = timing["total_dur"]
    sc = timing["scene_starts"]
    lt = timing["line_times"]

    act2_start = sc.get("04", total_dur * 0.34)
    act3_start = sc.get("09", total_dur * 0.72)
    mom_soul_start = lt.get("18_mom_soul", (act3_start + 6.0, act3_start + 11.0))[0]
    final_line_end = lt.get("19_narrator_understood", (total_dur - 6.0, total_dur - 5.0))[1]
    dove_line_start = lt.get("11_dove_messenger", (act2_start + 10.0, act2_start + 15.0))[0]
    sky_eyes_start = lt.get("08_narrator_sky_eyes", (act2_start + 4.0, act2_start + 9.0))[0]

    n_samples = int(math.ceil(total_dur * SR))
    buf = np.zeros((n_samples, 2), dtype=np.float64)

    print(
        f"[SCORE] Composing {total_dur:.2f}s fairytale score | "
        f"Act1: 0.0-{act2_start:.1f}s | Act2 (Dove): {act2_start:.1f}-{act3_start:.1f}s | "
        f"Act3 (Mom/Outro): {act3_start:.1f}-{total_dur:.1f}s"
    )

    # --------------------------------------------------------------------------
    # INTRO SUNRISE (0.0s -> ~1.9s): Sparkling welcoming harp & celesta roll in F Major
    # --------------------------------------------------------------------------
    intro_harp = [53, 60, 65, 69, 72, 74, 77]  # F3 C4 F4 A4 C5 D5 F5
    for i, m in enumerate(intro_harp):
        t0 = 0.08 + i * 0.16
        pan = 0.28 + 0.44 * (i / (len(intro_harp) - 1))
        add_mono_event(buf, t0, synth_harp_note(m, 3.2, vel=0.58 + 0.04 * i), pan=pan)
    add_mono_event(buf, 0.95, synth_celesta_note(81, 2.8, vel=0.62), pan=0.56)  # A5
    add_mono_event(buf, 1.38, synth_celesta_note(84, 2.8, vel=0.58), pan=0.60)  # C6
    for m, cut in [(53, 900), (60, 1200), (69, 1450)]:
        l, r = synth_string_voice(m, 4.2, vel=0.45, attack_s=1.1, release_s=1.4, cutoff_hz=cut, is_cello=(m < 58))
        add_stereo_event(buf, 0.05, l, r)

    # --------------------------------------------------------------------------
    # ACT 1 (Home & Raspberry Pie): Warm 3/4 Fairytale Waltz in F Major
    # --------------------------------------------------------------------------
    beat1 = 0.56  # ~107 BPM gentle storybook waltz
    bar1 = beat1 * 3.0

    # 8-bar cozy fairytale progression in F Major
    act1_chords = [
        # (bass, [harp_arpeggio_6_notes], [string_voicing], [celesta_melody: (beat_offset, midi, vel)])
        (53, [53, 60, 65, 69, 72, 69], [53, 65, 69], [(0.0, 81, 0.52), (2.0, 79, 0.42)]),           # Fmaj
        (52, [52, 60, 64, 67, 72, 67], [52, 64, 67], [(0.0, 76, 0.48), (1.5, 79, 0.44)]),           # C/E
        (50, [50, 57, 62, 65, 69, 65], [50, 62, 69], [(0.0, 77, 0.50), (2.0, 74, 0.44)]),           # Dm7
        (46, [46, 53, 58, 62, 65, 62], [46, 58, 65], [(0.0, 74, 0.48), (1.5, 77, 0.44), (2.5, 79, 0.40)]),  # Bbmaj7
        (45, [45, 53, 60, 65, 69, 65], [45, 60, 69], [(0.0, 81, 0.52), (2.0, 84, 0.48)]),           # F/A
        (43, [43, 50, 55, 58, 62, 65], [43, 58, 65], [(0.0, 82, 0.46), (1.5, 81, 0.44), (2.5, 79, 0.40)]),  # Gm7
        (48, [48, 55, 60, 65, 67, 65], [48, 60, 67], [(0.0, 79, 0.48), (2.0, 77, 0.44)]),           # C9sus4
        (48, [48, 55, 60, 64, 67, 72], [48, 64, 67], [(0.0, 76, 0.46), (1.5, 79, 0.44)]),           # C7(add9)
    ]

    t_cur = 1.85
    bar_idx = 0
    while t_cur < act2_start - 0.5:
        bass, arp, str_notes, mel = act1_chords[bar_idx % len(act1_chords)]
        # Fade gently approaching Act 2
        dist_to_act2 = act2_start - t_cur
        act_fade = min(1.0, max(0.35, dist_to_act2 / 3.5))

        # Plucked harp 6 eighth-notes per 3/4 bar
        for k, m in enumerate(arp):
            note_t = t_cur + k * (beat1 * 0.5)
            if note_t >= act2_start:
                break
            pan = 0.25 + 0.50 * ((m - 43) / 36.0)
            vel = (0.58 if k == 0 else 0.44 + 0.03 * (k % 3)) * act_fade
            add_mono_event(buf, note_t, synth_harp_note(m, 2.3, vel=vel), pan=np.clip(pan, 0.18, 0.82))

        # Celesta lyrical motif
        for b_off, m, v in mel:
            note_t = t_cur + b_off * beat1
            if note_t >= act2_start - 0.2:
                break
            add_mono_event(buf, note_t, synth_celesta_note(m, 2.2, vel=v * act_fade), pan=0.58)

        # Warm strings every 2 bars (smooth overlapping legato)
        if bar_idx % 2 == 0:
            s_dur = min(bar1 * 2.4, act2_start - t_cur + 1.8)
            for sm in str_notes:
                l, r = synth_string_voice(
                    sm, s_dur, vel=0.42 * act_fade, attack_s=0.9, release_s=1.2,
                    cutoff_hz=1250 if sm < 58 else 1600, is_cello=(sm < 56)
                )
                add_stereo_event(buf, t_cur, l, r)

        t_cur += bar1
        bar_idx += 1

    # --------------------------------------------------------------------------
    # ACT 2 (The White Dove): Timeless Celestial Stillness (Fmaj9 -> Dm9 -> Bbmaj7 -> C6add9)
    # --------------------------------------------------------------------------
    act2_chords = [
        # (str_voicing, harp_shimmer_notes, duration_sec)
        ([41, 53, 60, 64, 67, 69], [65, 72, 76, 79, 81, 84], 4.6),  # Fmaj9 (luminous open sky!)
        ([38, 50, 57, 60, 64, 69], [62, 69, 72, 76, 81, 84], 4.6),  # Dm9 (tender wonder)
        ([46, 58, 62, 65, 69, 72], [58, 65, 69, 72, 77, 81], 4.6),  # Bbmaj7(add9) (warm expanding space)
        ([48, 55, 62, 64, 69, 72], [60, 67, 69, 74, 79, 84], 4.4),  # C6add9 (serene suspension)
        ([45, 57, 60, 64, 67, 74], [60, 67, 72, 74, 79, 84], 4.6),  # Am7(add11)
        ([46, 53, 62, 65, 69, 74], [62, 65, 72, 74, 81, 86], 4.6),  # Bbmaj9
    ]

    t_cur = act2_start - 0.3
    c_idx = 0
    while t_cur < act3_start - 0.8:
        str_notes, shimmer, c_dur = act2_chords[c_idx % len(act2_chords)]
        seg_dur = min(c_dur + 1.4, act3_start - t_cur + 1.5)

        # Velvet airy string ensemble pads
        for sm in str_notes:
            is_low = sm < 54
            v = 0.44 if is_low else 0.36
            l, r = synth_string_voice(
                sm, seg_dur, vel=v, attack_s=1.35, release_s=1.6,
                cutoff_hz=1100 if is_low else 1850, is_cello=is_low
            )
            add_stereo_event(buf, t_cur, l, r)

        # Gentle slow rolling harp chords & high glistening harmonics
        for k, m in enumerate(shimmer):
            nt = t_cur + 0.15 + k * 0.58
            if nt >= act3_start:
                break
            pan = 0.22 + 0.56 * (k / max(1, len(shimmer) - 1))
            if k < 4:
                add_mono_event(buf, nt, synth_harp_note(m, 3.6, vel=0.38), pan=pan)
            else:
                # Sparkling high harp harmonics!
                add_mono_event(buf, nt, synth_harp_harmonic(m + 12 if m < 80 else m, 3.8, vel=0.45), pan=1.0 - pan)

        t_cur += c_dur
        c_idx += 1

    # Special shimmering celesta constellation right on "простір тихий" (Scene 05) & Dove's revelation (Scene 07)
    for anchor_t in [sky_eyes_start + 1.6, dove_line_start - 0.35]:
        constellation = [(0.0, 81, 0.36), (0.65, 84, 0.34), (1.35, 88, 0.38), (2.20, 86, 0.30), (3.10, 84, 0.34)]
        for off, m, v in constellation:
            add_mono_event(buf, anchor_t + off, synth_harp_harmonic(m, 3.8, vel=v), pan=0.32 + (off * 0.12) % 0.42)
            add_mono_event(buf, anchor_t + off + 0.25, synth_celesta_note(m, 2.8, vel=v * 0.65), pan=0.62)

    # --------------------------------------------------------------------------
    # ACT 3 (Mom's Embrace, Understanding & Radiant Outro): Tender Emotional Lullaby Return
    # --------------------------------------------------------------------------
    beat3 = 0.68  # ~88 BPM deeply tender lullaby tempo
    bar3 = beat3 * 3.0

    act3_chords = [
        # Warm heartfelt progression building gently to Mom's "і твоя Душа..."
        (41, [53, 60, 65, 69, 72, 69], [41, 53, 65, 69, 72], [(0.0, 81, 0.48), (2.0, 79, 0.44)]),  # F
        (40, [52, 60, 64, 67, 72, 67], [40, 52, 64, 67, 72], [(0.0, 76, 0.46), (1.5, 79, 0.44)]),  # C/E
        (38, [50, 57, 62, 65, 69, 72], [38, 50, 62, 65, 69], [(0.0, 77, 0.52), (2.0, 74, 0.46)]),  # Dm7
        (46, [46, 53, 58, 62, 65, 69], [46, 58, 62, 65, 69], [(0.0, 77, 0.50), (1.5, 79, 0.48), (2.5, 81, 0.52)]),  # Bbmaj7
        (45, [45, 53, 60, 65, 69, 72], [45, 53, 60, 69, 72], [(0.0, 84, 0.55), (2.0, 81, 0.50)]),  # F/A
        (43, [43, 50, 58, 62, 65, 69], [43, 55, 58, 65, 69], [(0.0, 82, 0.50), (1.5, 81, 0.48), (2.5, 79, 0.45)]),  # Gm9
        (48, [48, 55, 60, 65, 67, 72], [48, 55, 60, 65, 67], [(0.0, 79, 0.50), (2.0, 76, 0.46)]),  # C9sus4 -> C
    ]

    t_cur = act3_start - 0.25
    b3 = 0
    finale_trigger = final_line_end - 0.45
    while t_cur < finale_trigger:
        bass, arp, str_notes, mel = act3_chords[b3 % len(act3_chords)]
        # Emotional bloom right around Mom's "і твоє дитинство, і твоя Душа..."
        bloom = 1.22 if (mom_soul_start - 1.5 <= t_cur <= final_line_end) else 0.95

        for k, m in enumerate(arp):
            nt = t_cur + k * (beat3 * 0.5)
            if nt >= finale_trigger:
                break
            pan = 0.26 + 0.48 * ((m - 43) / 36.0)
            vel = (0.54 if k == 0 else 0.42) * bloom
            add_mono_event(buf, nt, synth_harp_note(m, 2.8, vel=vel), pan=np.clip(pan, 0.20, 0.80))

        for b_off, m, v in mel:
            nt = t_cur + b_off * beat3
            if nt >= finale_trigger:
                break
            add_mono_event(buf, nt, synth_celesta_note(m, 2.7, vel=v * bloom), pan=0.56)

        # Lush warm cello + upper strings on every bar for deep emotional warmth
        if b3 % 2 == 0 or (mom_soul_start - 2.0 <= t_cur <= final_line_end):
            s_dur = min(bar3 * 2.3, total_dur - t_cur - 0.5)
            for sm in str_notes:
                is_c = sm < 55
                l, r = synth_string_voice(
                    sm, s_dur, vel=(0.50 if is_c else 0.40) * bloom,
                    attack_s=0.95, release_s=1.4,
                    cutoff_hz=1200 if is_c else 1750, is_cello=is_c
                )
                add_stereo_event(buf, t_cur, l, r)

        t_cur += bar3
        b3 += 1

    # --------------------------------------------------------------------------
    # RADIANT FINALE RESOLUTION (Fmaj9 Glowing Chord + Ascending Harp Glissando)
    # --------------------------------------------------------------------------
    res_t = finale_trigger
    res_dur = max(4.2, total_dur - res_t - 0.35)
    # Deep cello + glowing Fmaj9 chord (F2, C3, F3, A3, C4, G4, A4, E5)
    finale_strings = [41, 48, 53, 57, 60, 67, 69, 76]
    for sm in finale_strings:
        is_c = sm < 54
        l, r = synth_string_voice(
            sm, res_dur, vel=0.52 if is_c else 0.42,
            attack_s=1.2, release_s=2.4,
            cutoff_hz=1250 if is_c else 2100, is_cello=is_c
        )
        add_stereo_event(buf, res_t, l, r)

    # Gentle ascending fairytale harp glissando across Fmaj9
    gliss = [53, 60, 65, 67, 69, 72, 76, 79, 81, 84]
    for i, m in enumerate(gliss):
        nt = res_t + 0.25 + i * 0.14
        pan = 0.22 + 0.56 * (i / (len(gliss) - 1))
        add_mono_event(buf, nt, synth_harp_note(m, 4.2, vel=0.48 + 0.02 * i), pan=pan)

    # Final two tender celesta lullaby resolution notes (G5 -> A5 -> F6 harmonic)
    add_mono_event(buf, res_t + 1.35, synth_celesta_note(79, 3.2, vel=0.45), pan=0.55)
    add_mono_event(buf, res_t + 2.05, synth_celesta_note(81, 3.6, vel=0.50), pan=0.58)
    add_mono_event(buf, res_t + 2.55, synth_harp_harmonic(89, 3.5, vel=0.42), pan=0.45)

    # --------------------------------------------------------------------------
    # APPLY WARM CONCERT HALL REVERB & GENTLE MASTER POLISH
    # --------------------------------------------------------------------------
    print("[SCORE] Applying stereo chamber hall reverb & warm mastering...")
    buf = apply_chamber_hall_reverb(buf, wet=0.36)

    # Gentle warm mastering EQ: remove sub-35Hz DC/rumble & smooth airy top above 11kHz
    sos_hp = butter(2, 38, btype="highpass", fs=SR, output="sos")
    sos_lp = butter(2, 11500, btype="lowpass", fs=SR, output="sos")
    buf[:, 0] = sosfilt(sos_lp, sosfilt(sos_hp, buf[:, 0]))
    buf[:, 1] = sosfilt(sos_lp, sosfilt(sos_hp, buf[:, 1]))

    # Smooth intro fade-in (0.35s) and graceful outro fade-out (2.6s)
    fi_n = int(0.35 * SR)
    fo_n = int(2.60 * SR)
    buf[:fi_n] *= np.linspace(0.0, 1.0, fi_n)[:, None]
    buf[-fo_n:] *= (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fo_n))))[:, None]

    # Peak normalize to comfortable -3 dBFS headroom (no clipping!)
    peak = float(np.max(np.abs(buf)))
    if peak > 1e-6:
        buf = buf * (0.7079 / peak)  # -3.0 dBFS

    return buf


def main():
    OUT_SCORE.parent.mkdir(parents=True, exist_ok=True)
    timing = compute_act_boundaries()
    stereo = compose_score(timing)

    pcm16 = np.clip(stereo * 32767.0, -32768, 32767).astype(np.int16)
    wavfile.write(str(OUT_SCORE), SR, pcm16)
    print(f"[SCORE] Wrote {OUT_SCORE} | duration={len(pcm16)/SR:.3f}s | peak={np.max(np.abs(stereo)):.3f}")


if __name__ == "__main__":
    main()
