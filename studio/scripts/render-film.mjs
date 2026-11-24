import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const STUDIO_DIR = path.resolve(import.meta.dirname, "..");
const ROOT_DIR = path.resolve(STUDIO_DIR, "..");
const OUT_DIR = path.join(ROOT_DIR, "output");
const FINAL_MP4 = path.join(OUT_DIR, "kazka_pyrozhok_1080p.mp4");
const VIDEO_ONLY_MP4 = path.join(OUT_DIR, "_kazka_pyrozhok_video_only.mp4");

async function main() {
  execSync("node scripts/sync-assets.mjs", { cwd: STUDIO_DIR, stdio: "inherit" });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const timeline = JSON.parse(
    fs.readFileSync(path.join(STUDIO_DIR, "src", "data", "timeline.generated.json"), "utf-8")
  );
  const audioSrc = timeline.audioFile
    ? path.join(ROOT_DIR, "assets", "audio", timeline.audioFile)
    : null;
  const hasMasterAudio = Boolean(audioSrc && fs.existsSync(audioSrc));

  console.log(
    `[render-film] Preparing 1920x1080 @ ${timeline.fps}fps (${timeline.totalDurationSec.toFixed(2)}s, ${Math.round(timeline.totalDurationSec * timeline.fps)} frames), masterAudio=${hasMasterAudio ? audioSrc : "NONE"}`
  );

  const tStart = Date.now();
  const serveUrl = await bundle({
    entryPoint: path.join(STUDIO_DIR, "src", "index.ts"),
    publicDir: path.join(STUDIO_DIR, "public"),
  });

  const comp = await selectComposition({
    serveUrl,
    id: "KazkaPyrozhok",
    browserExecutable: "/usr/bin/google-chrome",
    inputProps: {
      timeline,
      // Mux master audio via FFmpeg at exact AAC 320kbps 48kHz stereo for highest mastering quality
      includeAudioInRemotion: false,
    },
  });

  const targetVideoPath = hasMasterAudio ? VIDEO_ONLY_MP4 : FINAL_MP4;
  const concurrency = Math.max(2, Math.min(4, os.cpus().length));
  let lastLoggedPct = -5;

  await renderMedia({
    composition: comp,
    serveUrl,
    codec: "h264",
    crf: 16,
    pixelFormat: "yuv420p",
    imageFormat: "jpeg",
    jpegQuality: 95,
    x264Preset: "fast",
    concurrency,
    muted: true,
    outputLocation: targetVideoPath,
    browserExecutable: "/usr/bin/google-chrome",
    inputProps: {
      timeline,
      includeAudioInRemotion: false,
    },
    onProgress: ({ progress, renderedFrames }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastLoggedPct + 5 || pct === 100) {
        lastLoggedPct = pct;
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`[render-film] ${pct}% (${renderedFrames} frames) — elapsed ${elapsed}s`);
      }
    },
  });

  if (hasMasterAudio) {
    console.log("[render-film] Muxing H.264 video + AAC 320kbps 48kHz stereo audio with +faststart...");
    execSync(
      `ffmpeg -y -i "${VIDEO_ONLY_MP4}" -i "${audioSrc}" -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart -shortest "${FINAL_MP4}"`,
      { stdio: "inherit" }
    );
    fs.unlinkSync(VIDEO_ONLY_MP4);
  } else {
    // Still apply faststart
    const tmpFast = path.join(OUT_DIR, "_faststart.mp4");
    execSync(`ffmpeg -y -i "${FINAL_MP4}" -c copy -movflags +faststart "${tmpFast}"`, {
      stdio: "inherit",
    });
    fs.renameSync(tmpFast, FINAL_MP4);
  }

  const totalElapsed = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`[render-film] SUCCESS! Final film saved to ${FINAL_MP4} in ${totalElapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
