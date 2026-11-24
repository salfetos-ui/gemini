"""2-core parallel 1080p 30fps feature-film renderer for 'Казка Пирожок' (studio_v3)."""

import multiprocessing as mp
import subprocess
import sys
import time
from pathlib import Path
import cv2

STUDIO_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = STUDIO_DIR.parent
AUDIO_WAV = PROJECT_ROOT / "assets" / "audio" / "master_audio.wav"
OUT_MP4 = PROJECT_ROOT / "output" / "kazka_pyrozhok_1080p.mp4"
TMP_DIR = Path("/tmp/v3_render_parts")


def _render_worker(args: tuple[int, int, int, str]):
    part_idx, start_f, end_f, out_path = args
    sys.path.insert(0, str(STUDIO_DIR))
    cv2.setNumThreads(1)

    from director import SceneDirector

    director = SceneDirector(out_w=1920, out_h=1080)
    fps = director.fps
    n_frames = end_f - start_f

    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        "1920x1080",
        "-r",
        str(fps),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "16",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-pix_fmt",
        "yuv420p",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        "-video_track_timescale",
        "30000",
        "-g",
        "60",
        out_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None

    t0 = time.time()
    for i, f_idx in enumerate(range(start_f, end_f)):
        frame = director.render_frame(f_idx)
        proc.stdin.write(frame.tobytes())
        if (i + 1) % 150 == 0 or (i + 1) == n_frames:
            elapsed = time.time() - t0
            fps_rate = (i + 1) / max(1e-3, elapsed)
            print(
                f"[Part {part_idx}] {i + 1}/{n_frames} frames (global {f_idx}) | "
                f"{fps_rate:.2f} fps | elapsed {elapsed:.1f}s",
                flush=True,
            )

    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"FFmpeg part {part_idx} failed with exit code {rc}")
    return out_path


def main():
    sys.path.insert(0, str(STUDIO_DIR))
    from director import SceneDirector

    probe = SceneDirector(out_w=1920, out_h=1080)
    total_frames = probe.total_frames
    fps = probe.fps
    del probe

    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUT_MP4.parent.mkdir(parents=True, exist_ok=True)

    # 4 balanced chunks across 2 workers -> fast, load-balanced & crash-resumable
    n_workers = 2
    n_parts = 4
    edges = [int(round(i * total_frames / n_parts)) for i in range(n_parts + 1)]
    jobs = []
    all_parts = []
    for p_i in range(n_parts):
        p_path = str(TMP_DIR / f"part_{p_i}.mp4")
        all_parts.append(p_path)
        jobs.append((p_i, edges[p_i], edges[p_i + 1], p_path))

    print(f"=== Studio v3 Feature-Film Render: {total_frames} frames @ {fps}fps (1920x1080) across {n_workers} cores ({n_parts} parts) ===", flush=True)
    t_start = time.time()

    ctx = mp.get_context("spawn")
    with ctx.Pool(processes=n_workers) as pool:
        pool.map(_render_worker, jobs)
    parts = all_parts

    # Lossless concat + master broadcast audio mux (AAC 320k, 48kHz, +faststart)
    concat_txt = TMP_DIR / "concat.txt"
    concat_txt.write_text("\n".join(f"file '{p}'" for p in parts) + "\n")

    mux_cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "warning",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_txt),
        "-i",
        str(AUDIO_WAV),
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "320k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        "-shortest",
        str(OUT_MP4),
    ]
    print("=== Muxing lossless H.264 segments + master_audio.wav -> kazka_pyrozhok_1080p.mp4 ===", flush=True)
    subprocess.run(mux_cmd, check=True)

    total_time = time.time() - t_start
    size_mb = OUT_MP4.stat().st_size / (1024 * 1024)
    print(f"=== COMPLETE! {OUT_MP4} ({size_mb:.2f} MB) rendered in {total_time:.1f}s ({total_frames / total_time:.2f} eff fps) ===", flush=True)


if __name__ == "__main__":
    main()
