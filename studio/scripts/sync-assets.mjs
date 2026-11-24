import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const STUDIO_DIR = path.resolve(import.meta.dirname, "..");
const ROOT_DIR = path.resolve(STUDIO_DIR, "..");
const ASSETS_SCENES_DIR = path.join(ROOT_DIR, "assets", "scenes");
const ASSETS_AUDIO_DIR = path.join(ROOT_DIR, "assets", "audio");
const PUBLIC_SCENES_DIR = path.join(STUDIO_DIR, "public", "scenes");
const PUBLIC_AUDIO_DIR = path.join(STUDIO_DIR, "public", "audio");
const GENERATED_TIMELINE_PATH = path.join(STUDIO_DIR, "src", "data", "timeline.generated.json");

const SCENE_IMAGE_MAP = {
  scene_01: "scene_01_title.jpg",
  scene_02: "scene_02_boy_runs_in.jpg",
  scene_03: "scene_03_mom_welcomes.jpg",
  scene_04: "scene_04_kitchen_dove.jpg",
  scene_05: "scene_05_dove_eyes.jpg",
  scene_06: "scene_06_boy_asks.jpg",
  scene_07: "scene_07_dove_speaks.jpg",
  scene_08a: "scene_08a_boy_surprised.jpg",
  scene_08b: "scene_08b_dove_nods.jpg",
  scene_09: "scene_09_mom_pie.jpg",
  scene_10: "scene_10_finale.jpg",
  scene_11_outro: undefined,
};

const DEFAULT_TRANSITIONS = {
  scene_01: 0,
  scene_02: 0.85,
  scene_03: 0.75,
  scene_04: 0.85,
  scene_05: 0.85,
  scene_06: 0.75,
  scene_07: 0.80,
  scene_08a: 0.65,
  scene_08b: 0.75,
  scene_09: 0.85,
  scene_10: 0.90,
  scene_11_outro: 0.95,
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dst);
  return true;
}

function getAudioDurationSec(audioPath) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: "utf-8" }
    ).trim();
    const val = parseFloat(out);
    return Number.isFinite(val) && val > 0 ? val : null;
  } catch {
    return null;
  }
}

function normalizeSceneId(rawId, imageHint = "") {
  const s = `${rawId || ""} ${imageHint || ""}`.toLowerCase();
  if (s.includes("11") || s.includes("outro") || s.includes("closing") || s.includes("end_card")) return "scene_11_outro";
  if (s.includes("10b") || s.includes("finale_b") || s.includes("beat_10b")) return "scene_10b";
  if (s.includes("10a") || s.includes("finale_a") || s.includes("beat_10a")) return "scene_10a";
  if (s.includes("10") || s.includes("finale")) return "scene_10";
  if (s.includes("09") || s.includes("scene_9") || s.includes("mom_pie")) return "scene_09";
  if (s.includes("08b") || s.includes("8b") || s.includes("nods")) return "scene_08b";
  if (s.includes("08a") || s.includes("8a") || s.includes("surprised")) return "scene_08a";
  if (s.includes("08") || s.includes("scene_8")) return "scene_08a";
  if (s.includes("07") || s.includes("scene_7") || s.includes("speaks")) return "scene_07";
  if (s.includes("06") || s.includes("scene_6") || s.includes("asks")) return "scene_06";
  if (s.includes("05") || s.includes("scene_5") || s.includes("eyes")) return "scene_05";
  if (s.includes("04") || s.includes("scene_4") || s.includes("kitchen_dove")) return "scene_04";
  if (s.includes("03") || s.includes("scene_3") || s.includes("welcomes")) return "scene_03";
  if (s.includes("02") || s.includes("scene_2") || s.includes("runs_in")) return "scene_02";
  if (s.includes("01") || s.includes("scene_1") || s.includes("title")) return "scene_01";
  return null;
}

function readSec(obj, keysSec, keysMs) {
  for (const k of keysSec) {
    if (typeof obj?.[k] === "number" && Number.isFinite(obj[k])) return obj[k];
  }
  for (const k of keysMs) {
    if (typeof obj?.[k] === "number" && Number.isFinite(obj[k])) return obj[k] / 1000;
  }
  return null;
}

function buildFallbackTimeline(fps = 30) {
  const scenes = [
    { id: "scene_01", startSec: 0.0, endSec: 5.5 },
    { id: "scene_02", startSec: 5.5, endSec: 12.0 },
    { id: "scene_03", startSec: 12.0, endSec: 18.0 },
    { id: "scene_04", startSec: 18.0, endSec: 25.0 },
    { id: "scene_05", startSec: 25.0, endSec: 33.5 },
    { id: "scene_06", startSec: 33.5, endSec: 39.0 },
    { id: "scene_07", startSec: 39.0, endSec: 49.0 },
    { id: "scene_08a", startSec: 49.0, endSec: 54.0 },
    { id: "scene_08b", startSec: 54.0, endSec: 60.0 },
    { id: "scene_09", startSec: 60.0, endSec: 68.5 },
    { id: "scene_10", startSec: 68.5, endSec: 81.5, beatSplitSec: 75.5 },
    { id: "scene_11_outro", startSec: 81.5, endSec: 87.5 },
  ].map((s) => ({
    ...s,
    imageFile: SCENE_IMAGE_MAP[s.id],
    transitionSec: DEFAULT_TRANSITIONS[s.id] ?? 0.75,
  }));

  return {
    fps,
    width: 1920,
    height: 1080,
    totalDurationSec: 87.5,
    hasAudio: false,
    isFallback: true,
    scenes,
  };
}

function parseExternalTimeline(raw, audioFile, audioDurationSec, fps = 30) {
  const rawScenes =
    raw.scenes ||
    raw.scene_timings ||
    raw.sceneTimings ||
    raw.visual_scenes ||
    raw.visualScenes ||
    raw.cues ||
    raw.segments ||
    [];

  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    console.warn("[sync-assets] timeline.json had no recognizable scenes array; using fallback.");
    return buildFallbackTimeline(fps);
  }

  const parsed = [];
  let scene10a = null;
  let scene10b = null;

  for (const item of rawScenes) {
    const id = normalizeSceneId(
      item.id ?? item.scene_id ?? item.sceneId ?? item.scene ?? item.name,
      item.image ?? item.imageFile ?? item.asset ?? item.file ?? ""
    );
    if (!id) continue;

    const startSec = readSec(
      item,
      ["startSec", "start_sec", "start", "startTime", "start_time", "t_start"],
      ["startMs", "start_ms"]
    );
    let endSec = readSec(
      item,
      ["endSec", "end_sec", "end", "endTime", "end_time", "t_end"],
      ["endMs", "end_ms"]
    );
    const durSec = readSec(item, ["durationSec", "duration_sec", "duration"], ["durationMs", "duration_ms"]);
    if (endSec === null && startSec !== null && durSec !== null) {
      endSec = startSec + durSec;
    }
    if (startSec === null || endSec === null) continue;

    const beatSplitSec = readSec(
      item,
      ["beatSplitSec", "beat_split_sec", "splitSec", "split_sec", "beat2_start_sec"],
      ["beatSplitMs", "beat_split_ms"]
    );

    if (id === "scene_10a") {
      scene10a = { startSec, endSec };
      continue;
    }
    if (id === "scene_10b") {
      scene10b = { startSec, endSec };
      continue;
    }

    parsed.push({
      id,
      imageFile: SCENE_IMAGE_MAP[id],
      startSec,
      endSec,
      transitionSec:
        typeof item.transitionSec === "number"
          ? item.transitionSec
          : typeof item.transition_sec === "number"
            ? item.transition_sec
            : DEFAULT_TRANSITIONS[id] ?? 0.75,
      ...(beatSplitSec !== null ? { beatSplitSec } : {}),
    });
  }

  // Merge scene_10a + scene_10b into continuous two-beat cinematic camera move on scene_10!
  if (scene10a || scene10b) {
    const startSec = scene10a ? scene10a.startSec : scene10b.startSec;
    const endSec = scene10b ? scene10b.endSec : scene10a.endSec;
    const beatSplitSec = scene10b ? scene10b.startSec : startSec + (endSec - startSec) * 0.54;
    parsed.push({
      id: "scene_10",
      imageFile: SCENE_IMAGE_MAP.scene_10,
      startSec,
      endSec,
      beatSplitSec,
      transitionSec: DEFAULT_TRANSITIONS.scene_10,
    });
  }

  // Sort chronologically
  parsed.sort((a, b) => a.startSec - b.startSec);

  const rawLines = raw.lines || raw.dialogue || raw.clips || [];

  // Split single scene_08 into scene_08a (boy surprised) + scene_08b (dove nods) using exact line timestamps!
  const has08b = parsed.some((s) => s.id === "scene_08b");
  const idx08 = parsed.findIndex((s) => s.id === "scene_08a");
  if (!has08b && idx08 !== -1 && Array.isArray(rawLines)) {
    const s08 = parsed[idx08];
    const nodLine = rawLines.find((l) => {
      const id = `${l.id || ""}`.toLowerCase();
      const txt = `${l.text || l.line || ""}`.toLowerCase();
      return id.includes("dove_nod") || txt.includes("головою кивав");
    });
    const prevLine = rawLines.find((l) => {
      const id = `${l.id || ""}`.toLowerCase();
      const txt = `${l.text || l.line || ""}`.toLowerCase();
      return id.includes("how_pie") || txt.includes("як пиріг");
    });

    const nodStart = nodLine
      ? readSec(nodLine, ["startSec", "start_sec", "start"], ["startMs", "start_ms"])
      : null;
    const prevEnd = prevLine
      ? readSec(prevLine, ["endSec", "end_sec", "end"], ["endMs", "end_ms"])
      : null;

    const split08 =
      nodStart !== null && prevEnd !== null
        ? (prevEnd + nodStart) / 2
        : nodStart !== null
          ? nodStart - 0.35
          : s08.startSec + (s08.endSec - s08.startSec) * 0.5;

    const secondPulse = prevLine
      ? readSec(prevLine, ["startSec", "start_sec", "start"], ["startMs", "start_ms"])
      : null;

    if (split08 > s08.startSec + 0.5 && split08 < s08.endSec - 0.5) {
      const origEnd = s08.endSec;
      s08.endSec = split08;
      if (secondPulse !== null) {
        s08.beatSplitSec = secondPulse;
      }
      parsed.splice(idx08 + 1, 0, {
        id: "scene_08b",
        imageFile: SCENE_IMAGE_MAP.scene_08b,
        startSec: split08,
        endSec: origEnd,
        transitionSec: DEFAULT_TRANSITIONS.scene_08b,
      });
    }
  }

  // If scene_10 doesn't have an explicit beatSplitSec, sync it right in the breath before "Хлопчик подивився на голуба..."
  const s10 = parsed.find((s) => s.id === "scene_10");
  if (s10 && !s10.beatSplitSec && Array.isArray(rawLines)) {
    const lookBeat = rawLines.find((l) => {
      const id = `${l.id || ""}`.toLowerCase();
      const txt = `${l.text || l.line || ""}`.toLowerCase();
      return id.includes("understood") || txt.includes("подивився на голуба") || txt.includes("все зрозумів");
    });
    const momSoul = rawLines.find((l) => {
      const id = `${l.id || ""}`.toLowerCase();
      const txt = `${l.text || l.line || ""}`.toLowerCase();
      return id.includes("mom_soul") || txt.includes("твоя душа");
    });
    const lookStart = lookBeat
      ? readSec(lookBeat, ["startSec", "start_sec", "start", "startTime", "start_time"], ["startMs", "start_ms"])
      : null;
    const momEnd = momSoul
      ? readSec(momSoul, ["endSec", "end_sec", "end"], ["endMs", "end_ms"])
      : null;

    if (lookStart !== null) {
      // Begin the sweeping camera pull-back right in the golden breath as Mom finishes "...і твоя Душа..."
      const split = momEnd !== null ? momEnd + (lookStart - momEnd) * 0.45 : lookStart - 0.5;
      if (split > s10.startSec + 0.5 && split < s10.endSec - 0.5) {
        s10.beatSplitSec = split;
      }
    }
  }

  // Ensure scene_11_outro exists at the end
  const hasOutro = parsed.some((s) => s.id === "scene_11_outro");
  const lastEnd = parsed.length > 0 ? parsed[parsed.length - 1].endSec : 0;
  const declaredTotal = readSec(
    raw,
    ["totalDurationSec", "total_duration_sec", "total_duration", "duration_sec", "duration"],
    ["totalDurationMs", "total_duration_ms", "duration_ms"]
  );

  if (!hasOutro) {
    const outroStart = lastEnd;
    const targetEnd = Math.max(outroStart + 5.0, audioDurationSec || 0, declaredTotal || 0);
    parsed.push({
      id: "scene_11_outro",
      startSec: outroStart,
      endSec: targetEnd,
      transitionSec: DEFAULT_TRANSITIONS.scene_11_outro,
    });
  }

  const finalSceneEnd = parsed[parsed.length - 1].endSec;
  const totalDurationSec = Math.max(
    finalSceneEnd,
    audioDurationSec || 0,
    declaredTotal || 0
  );

  // Stretch final outro to cover exact totalDurationSec if audio tail is slightly longer
  if (parsed[parsed.length - 1].endSec < totalDurationSec) {
    parsed[parsed.length - 1].endSec = totalDurationSec;
  }

  return {
    fps,
    width: 1920,
    height: 1080,
    totalDurationSec,
    hasAudio: Boolean(audioFile),
    audioFile: audioFile || undefined,
    isFallback: false,
    scenes: parsed,
  };
}

function main() {
  ensureDir(PUBLIC_SCENES_DIR);
  ensureDir(PUBLIC_AUDIO_DIR);
  ensureDir(path.dirname(GENERATED_TIMELINE_PATH));

  // 1. Copy all scene images to studio/public/scenes/
  let copiedScenes = 0;
  if (fs.existsSync(ASSETS_SCENES_DIR)) {
    for (const fname of fs.readdirSync(ASSETS_SCENES_DIR)) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(fname)) {
        syncFile(path.join(ASSETS_SCENES_DIR, fname), path.join(PUBLIC_SCENES_DIR, fname));
        copiedScenes++;
      }
    }
  }

  // 2. Check master audio file
  let audioFile = null;
  let audioDurationSec = null;
  for (const candidate of ["master_audio.wav", "master_audio.mp3", "master_audio.m4a"]) {
    const src = path.join(ASSETS_AUDIO_DIR, candidate);
    if (fs.existsSync(src)) {
      syncFile(src, path.join(PUBLIC_AUDIO_DIR, candidate));
      audioFile = candidate;
      audioDurationSec = getAudioDurationSec(src);
      break;
    }
  }

  // 3. Parse timeline.json if available, else generate realistic fallback
  const timelinePath = path.join(ASSETS_AUDIO_DIR, "timeline.json");
  let timeline;
  if (fs.existsSync(timelinePath)) {
    const raw = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
    syncFile(timelinePath, path.join(PUBLIC_AUDIO_DIR, "timeline.json"));
    timeline = parseExternalTimeline(raw, audioFile, audioDurationSec, 30);
    console.log(
      `[sync-assets] Loaded live timeline.json: ${timeline.scenes.length} scenes, total ${timeline.totalDurationSec.toFixed(2)}s, audio=${audioFile || "none"}`
    );
  } else {
    timeline = buildFallbackTimeline(30);
    if (audioFile) {
      timeline.hasAudio = true;
      timeline.audioFile = audioFile;
    }
    console.log(
      `[sync-assets] timeline.json not yet present — generated fallback timeline (${timeline.scenes.length} scenes, ${timeline.totalDurationSec.toFixed(1)}s).`
    );
  }

  fs.writeFileSync(GENERATED_TIMELINE_PATH, JSON.stringify(timeline, null, 2));
  console.log(`[sync-assets] Synced ${copiedScenes} scenes -> public/scenes/ and wrote src/data/timeline.generated.json`);
}

main();
