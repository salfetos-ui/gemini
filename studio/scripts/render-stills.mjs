import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const STUDIO_DIR = path.resolve(import.meta.dirname, "..");
const ROOT_DIR = path.resolve(STUDIO_DIR, "..");
const OUT_DIR = path.join(ROOT_DIR, "output", "stills");

async function main() {
  execSync("node scripts/sync-assets.mjs", { cwd: STUDIO_DIR, stdio: "inherit" });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const timeline = JSON.parse(
    fs.readFileSync(path.join(STUDIO_DIR, "src", "data", "timeline.generated.json"), "utf-8")
  );
  const fps = timeline.fps || 30;

  const findMidFrame = (id, frac = 0.5) => {
    const sc = timeline.scenes.find((s) => s.id === id);
    if (!sc) return 30;
    const t = sc.startSec + (sc.endSec - sc.startSec) * frac;
    return Math.min(Math.round(timeline.totalDurationSec * fps) - 1, Math.max(0, Math.round(t * fps)));
  };

  console.log("[render-stills] Bundling Remotion project...");
  const t0 = Date.now();
  const serveUrl = await bundle({
    entryPoint: path.join(STUDIO_DIR, "src", "index.ts"),
    publicDir: path.join(STUDIO_DIR, "public"),
  });
  console.log(`[render-stills] Bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const comp = await selectComposition({
    serveUrl,
    id: "KazkaPyrozhok",
    browserExecutable: "/usr/bin/google-chrome",
    inputProps: { timeline, includeAudioInRemotion: false },
  });

  const shots = [
    { name: "still_01_title.png", frame: findMidFrame("scene_01", 0.48) },
    { name: "still_05_dove_eyes.png", frame: findMidFrame("scene_05", 0.55) },
    { name: "still_07_dove_speaks.png", frame: findMidFrame("scene_07", 0.50) },
    { name: "still_09_mom_pie.png", frame: findMidFrame("scene_09", 0.55) },
    { name: "still_10a_mom_boy.png", frame: findMidFrame("scene_10", 0.25) },
    { name: "still_10b_finale.png", frame: findMidFrame("scene_10", 0.88) },
    { name: "still_11_closing.png", frame: findMidFrame("scene_11_outro", 0.45) },
  ];

  for (const shot of shots) {
    const s0 = Date.now();
    const outPath = path.join(OUT_DIR, shot.name);
    await renderStill({
      composition: comp,
      serveUrl,
      output: outPath,
      frame: shot.frame,
      imageFormat: "png",
      browserExecutable: "/usr/bin/google-chrome",
      inputProps: { timeline, includeAudioInRemotion: false },
    });
    console.log(
      `[render-stills] Rendered ${shot.name} (frame ${shot.frame}) in ${((Date.now() - s0) / 1000).toFixed(2)}s`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
