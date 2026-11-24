import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const STUDIO_DIR = path.resolve(import.meta.dirname, "..");
const ROOT_DIR = path.resolve(STUDIO_DIR, "..");
const OUT_DIR = path.join(ROOT_DIR, "output");
const CACHE_PLATES_DIR = path.join(STUDIO_DIR, ".cache", "plates");
const FINAL_MP4 = path.join(OUT_DIR, "kazka_pyrozhok_1080p.mp4");

const W = 1920;
const H = 1080;

// -------------------- MATH & EASING (Identical to src/utils/easing.ts) --------------------
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutCubic = (t) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const easeInOutQuint = (t) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
};
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
};
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function computeClampedCamera(scale, focusX, focusY, rotateDeg = 0) {
  const rotRad = (Math.abs(rotateDeg) * Math.PI) / 180;
  const rotSafety = Math.sin(rotRad) * 0.6 + 0.004;
  const safeScale = Math.max(scale, 1.02 + rotSafety * 2);
  const desiredTx = (0.5 - focusX) * safeScale;
  const desiredTy = (0.5 - focusY) * safeScale;
  const maxShift = Math.max(0, 0.5 * (safeScale - 1) - rotSafety);
  const tx = clamp(desiredTx, -maxShift, maxShift);
  const ty = clamp(desiredTy, -maxShift, maxShift);
  return { scale: safeScale, txPx: tx * W, tyPx: ty * H, rotateRad: (rotateDeg * Math.PI) / 180 };
}

// -------------------- SCENE VISUAL PROFILES & CHOREOGRAPHY --------------------
const SCENE_PROFILES = {
  scene_01: { sunbeamSide: "left", sunbeamIntensity: 0.9, mood: "warm-gold", particleDensity: 1.0, bokehIntensity: 0.35, warmthBoost: 0.35 },
  scene_02: { sunbeamSide: "left", sunbeamIntensity: 0.65, mood: "rose-warm", particleDensity: 0.9, bokehIntensity: 0.25, warmthBoost: 0.3 },
  scene_03: { sunbeamSide: "left", sunbeamIntensity: 0.75, mood: "warm-gold", particleDensity: 0.85, bokehIntensity: 0.3, warmthBoost: 0.4 },
  scene_04: { sunbeamSide: "right", sunbeamIntensity: 0.95, mood: "warm-gold", particleDensity: 1.15, bokehIntensity: 0.45, warmthBoost: 0.3 },
  scene_05: { sunbeamSide: "left", sunbeamIntensity: 0.75, mood: "celestial", particleDensity: 1.35, bokehIntensity: 0.95, warmthBoost: 0.1 },
  scene_06: { sunbeamSide: "right", sunbeamIntensity: 0.85, mood: "warm-gold", particleDensity: 1.0, bokehIntensity: 0.55, warmthBoost: 0.25 },
  scene_07: { sunbeamSide: "right", sunbeamIntensity: 1.0, mood: "radiant", particleDensity: 1.45, bokehIntensity: 0.85, warmthBoost: 0.2 },
  scene_08a: { sunbeamSide: "right", sunbeamIntensity: 0.75, mood: "warm-gold", particleDensity: 0.9, bokehIntensity: 0.35, warmthBoost: 0.25 },
  scene_08b: { sunbeamSide: "right", sunbeamIntensity: 0.85, mood: "celestial", particleDensity: 1.05, bokehIntensity: 0.5, warmthBoost: 0.2 },
  scene_09: { sunbeamSide: "right", sunbeamIntensity: 0.88, mood: "rose-warm", particleDensity: 1.0, bokehIntensity: 0.4, warmthBoost: 0.45 },
  scene_10: { sunbeamSide: "right", sunbeamIntensity: 0.95, mood: "finale", particleDensity: 1.3, bokehIntensity: 0.75, warmthBoost: 0.35 },
  scene_11_outro: { sunbeamSide: "none", sunbeamIntensity: 0, mood: "warm-gold", particleDensity: 0.85, bokehIntensity: 0.4, warmthBoost: 0.2 },
};

const isCelestialMood = (mood) =>
  mood === "celestial" ? 0.92 : mood === "radiant" ? 0.85 : mood === "finale" ? 0.35 : 0;

function evaluateSceneCamera(scene, progress, localTimeSec) {
  const p = clamp(progress, 0, 1);
  const breathX = Math.sin(localTimeSec * 0.65) * 0.0035;
  const breathY = Math.cos(localTimeSec * 0.52) * 0.003;
  const breathRoll = Math.sin(localTimeSec * 0.42) * 0.14;

  switch (scene.id) {
    case "scene_01": {
      const e = easeInOutSine(p);
      return computeClampedCamera(lerp(1.03, 1.11, e), lerp(0.42, 0.54, e) + breathX, lerp(0.49, 0.48, e) + breathY, breathRoll * 0.7);
    }
    case "scene_02": {
      const e = easeOutCubic(p);
      return computeClampedCamera(
        lerp(1.06, 1.14, e),
        lerp(0.32, 0.57, easeInOutCubic(p)) + breathX,
        lerp(0.54, 0.46, e) + Math.sin(localTimeSec * 3.2) * 0.0035,
        lerp(-0.35, 0.2, e) + breathRoll * 0.6
      );
    }
    case "scene_03": {
      const e = easeInOutCubic(p);
      return computeClampedCamera(lerp(1.29, 1.36, e), lerp(0.38, 0.41, e) + breathX, lerp(0.50, 0.42, e) + breathY, breathRoll * 0.4);
    }
    case "scene_04": {
      const e = easeInOutSine(p);
      return computeClampedCamera(lerp(1.10, 1.14, easeInOutCubic(p)), lerp(0.35, 0.65, e) + breathX, lerp(0.51, 0.48, e) + breathY, lerp(-0.2, 0.15, e));
    }
    case "scene_05": {
      const e = easeInOutQuint(p);
      return computeClampedCamera(lerp(1.04, 1.16, e), lerp(0.51, 0.498, e) + breathX * 0.6, lerp(0.45, 0.30, e) + breathY * 0.6, breathRoll * 0.45);
    }
    case "scene_06": {
      const e = easeInOutSine(p);
      const rock = Math.sin(p * Math.PI * 1.45) * 0.055;
      return computeClampedCamera(lerp(1.04, 1.11, e), 0.47 + rock + breathX, lerp(0.50, 0.46, e) + breathY, breathRoll * 0.5);
    }
    case "scene_07": {
      const e = easeInOutCubic(p);
      const speakPulse = Math.sin(localTimeSec * 1.8) * 0.008;
      return computeClampedCamera(lerp(1.03, 1.13, e) + speakPulse, lerp(0.50, 0.51, e) + breathX * 0.5, lerp(0.56, 0.41, e) + breathY * 0.5, breathRoll * 0.4);
    }
    case "scene_08a": {
      const e = easeOutCubic(p);
      const duration = Math.max(0.1, scene.endSec - scene.startSec);
      const beatStart = scene.beatSplitSec ? clamp((scene.beatSplitSec - scene.startSec) / duration, 0.25, 0.8) : 0.58;
      const secondBeat = smoothstep(beatStart - 0.05, beatStart + 0.14, p) * (1 - smoothstep(0.9, 1.0, p) * 0.2);
      return computeClampedCamera(
        lerp(1.04, 1.11, e) + secondBeat * 0.028,
        0.50 + breathX * 0.7,
        lerp(0.49, 0.45, e) + breathY * 0.7,
        Math.sin(p * Math.PI * 2) * 0.25
      );
    }
    case "scene_08b": {
      const e = easeInOutSine(p);
      const nodDown = Math.pow(Math.max(0, Math.sin(localTimeSec * 2.15)), 1.6);
      return computeClampedCamera(lerp(1.06, 1.11, e), lerp(0.53, 0.55, e) - nodDown * 0.006, lerp(0.50, 0.49, e) - nodDown * 0.015, -nodDown * 0.85);
    }
    case "scene_09": {
      const e = easeInOutCubic(p);
      return computeClampedCamera(lerp(1.05, 1.13, e), lerp(0.58, 0.42, e) + breathX, lerp(0.54, 0.48, e) + breathY, breathRoll * 0.5);
    }
    case "scene_10": {
      const duration = Math.max(0.1, scene.endSec - scene.startSec);
      const splitRatio = scene.beatSplitSec ? clamp((scene.beatSplitSec - scene.startSec) / duration, 0.28, 0.75) : 0.54;
      if (p < splitRatio) {
        const tA = easeInOutSine(p / splitRatio);
        return computeClampedCamera(lerp(1.66, 1.58, tA), lerp(0.28, 0.31, tA) + breathX * 0.5, lerp(0.35, 0.37, tA) + breathY * 0.5, breathRoll * 0.4);
      } else {
        const tB = easeInOutQuint((p - splitRatio) / Math.max(0.05, 1 - splitRatio));
        return computeClampedCamera(lerp(1.58, 1.03, tB), lerp(0.31, 0.50, tB) + breathX * 0.5, lerp(0.37, 0.50, tB) + breathY * 0.5, breathRoll * (1 - tB * 0.6) * 0.4);
      }
    }
    default:
      return computeClampedCamera(1.02, 0.5, 0.5, 0);
  }
}

// -------------------- PRE-BAKED SPRITES --------------------
function makeGlowSprite(size, stops) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  const half = size / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function makeFilmGrainTile() {
  const size = 160;
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const rng = mulberry32(99173);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() + rng() + rng()) / 3;
    const v = Math.round(92 + n * 76);
    img.data[i] = Math.min(255, v + 5);
    img.data[i + 1] = v;
    img.data[i + 2] = Math.max(0, v - 6);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function drawSteamRibbon(ctx, cx, baseY, height, amp, strokeW, time, phase, alpha) {
  const steps = 6;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const y = baseY - f * height;
    const sway =
      Math.sin(f * Math.PI * 2.2 - time * 1.45 + phase) * amp * (0.25 + f * 0.95) +
      Math.cos(f * Math.PI * 1.3 - time * 0.85 + phase * 1.7) * amp * 0.35 * f;
    pts.push([cx + sway, y]);
  }

  const grad = ctx.createLinearGradient(cx, baseY, cx, baseY - height);
  grad.addColorStop(0, "rgba(255, 247, 232, 0)");
  grad.addColorStop(0.2, `rgba(255, 249, 240, ${(0.52 * alpha).toFixed(3)})`);
  grad.addColorStop(0.65, `rgba(255, 238, 214, ${(0.26 * alpha).toFixed(3)})`);
  grad.addColorStop(1, "rgba(255, 245, 228, 0)");

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = grad;

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + curr[0]) / 2, (prev[1] + curr[1]) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
  };

  // Outer soft watercolor halo
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = strokeW * 2.2;
  trace();
  ctx.stroke();

  // Inner silky wisp core
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = strokeW;
  trace();
  ctx.stroke();
  ctx.restore();
}

function drawSceneTrackedVfx(ctx, scene, localTimeSec, progress, sprites) {
  const id = scene.id;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const drawEllipseSprite = (sprite, cx, cy, rx, ry, alpha) => {
    if (alpha <= 0.004) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.drawImage(sprite, cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();
  };

  if (id === "scene_01") {
    drawEllipseSprite(sprites.auraGold, 940, 520, 560, 330, 0.16 + Math.sin(localTimeSec * 0.9) * 0.04);
  } else if (id === "scene_02") {
    // Flowing rose-gold raspberry aroma ribbons
    const grad = ctx.createLinearGradient(1340, 440, 780, 120);
    grad.addColorStop(0, "rgba(255, 229, 180, 0)");
    grad.addColorStop(0.28, "rgba(255, 200, 184, 0.42)");
    grad.addColorStop(0.62, "rgba(255, 176, 184, 0.34)");
    grad.addColorStop(1, "rgba(255, 240, 212, 0)");
    ctx.strokeStyle = grad;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const phase = i * 1.45;
      const drift = Math.sin(localTimeSec * 1.35 + phase) * 26;
      const drift2 = Math.cos(localTimeSec * 1.05 + phase) * 22;
      const yOff = (i - 1.5) * 24;
      const op = 0.26 + Math.sin(localTimeSec * 1.2 + phase) * 0.07;
      ctx.setLineDash([420, 260]);
      ctx.lineDashOffset = -(localTimeSec * (85 + i * 18) + i * 140);

      const traceAroma = () => {
        ctx.beginPath();
        ctx.moveTo(1340, 425 + yOff * 0.5);
        ctx.bezierCurveTo(1180, 355 + drift + yOff, 1010, 455 - drift2 + yOff, 845, 395 + drift * 0.6);
        ctx.bezierCurveTo(740, 355 + drift2 * 0.5, 880, 210 + drift, 1150, 110 - drift2);
      };
      ctx.globalAlpha = op * 0.34;
      ctx.lineWidth = 42 - i * 4;
      traceAroma();
      ctx.stroke();

      ctx.globalAlpha = op * 0.68;
      ctx.lineWidth = 18 - i * 2;
      traceAroma();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    drawEllipseSprite(sprites.ovenGlow, 1305, 465, 125, 125, 0.22 + Math.sin(localTimeSec * 2.0) * 0.05);
  } else if (id === "scene_03") {
    drawEllipseSprite(sprites.ovenGlow, 1220, 682, 185, 135, 0.36 + Math.sin(localTimeSec * 2.4) * 0.09);
    drawEllipseSprite(sprites.auraGold, 340, 430, 320, 380, 0.16 + Math.sin(localTimeSec * 1.1) * 0.04);
  } else if (id === "scene_04") {
    drawEllipseSprite(sprites.auraGold, 1390, 520, 310, 280, 0.20 + Math.sin(localTimeSec * 1.4) * 0.05);
  } else if (id === "scene_05") {
    const exp = easeInOutSine(progress);
    drawEllipseSprite(sprites.auraSky, 940, 390, 520 + exp * 160, 410 + exp * 110, 0.22 + exp * 0.14 + Math.sin(localTimeSec * 1.3) * 0.04);
    drawEllipseSprite(sprites.auraGold, 650, 340, 370, 370, 0.20 + Math.sin(localTimeSec * 1.1) * 0.04);
    // Soft iris twinkle on upper-right rim
    const gleam = 0.22 + 0.36 * Math.pow(0.5 + 0.5 * Math.sin(localTimeSec * 1.8 - 0.5), 2);
    drawEllipseSprite(sprites.auraSky, 964, 250, 22, 22, gleam * 0.50);
    ctx.save();
    ctx.translate(964, 250);
    ctx.globalAlpha = gleam * 0.72;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(0.8, -0.8, 8, 0);
    ctx.quadraticCurveTo(0.8, 0.8, 0, 8);
    ctx.quadraticCurveTo(-0.8, 0.8, -8, 0);
    ctx.quadraticCurveTo(-0.8, -0.8, 0, -8);
    ctx.fill();
    ctx.restore();
  } else if (id === "scene_06") {
    drawEllipseSprite(sprites.auraGold, 1380, 520, 290, 250, 0.18 + Math.sin(localTimeSec * 1.45) * 0.05);
  } else if (id === "scene_07") {
    const breath = 0.5 + 0.5 * Math.sin(localTimeSec * 2.2);
    const secondary = 0.5 + 0.5 * Math.sin(localTimeSec * 3.7 + 1.1);
    const pulse = 0.72 + breath * 0.2 + secondary * 0.08;
    const cx = 978;
    const cy = 365;
    const rayAngles = [-54, -32, -12, 8, 28, 48];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.sin(localTimeSec * 0.55) * 4.0 * Math.PI) / 180);
    for (let idx = 0; idx < rayAngles.length; idx++) {
      ctx.save();
      ctx.rotate((rayAngles[idx] * Math.PI) / 180);
      ctx.globalAlpha = 0.16 * pulse * (0.55 + Math.sin(localTimeSec * 1.7 + idx) * 0.2);
      const beamSprite = idx % 2 === 0 ? sprites.beamGold : sprites.beamSky;
      ctx.drawImage(beamSprite, -75, -520, 150, 520);
      ctx.restore();
    }
    ctx.restore();
    // Subtle luminous halo preserving every delicate white feather contour!
    drawEllipseSprite(sprites.auraGold, cx, cy + 20, 440 * (0.94 + breath * 0.09), 340 * (0.94 + breath * 0.09), 0.24 * pulse);
    drawEllipseSprite(sprites.auraSky, cx + 20, cy + 70, 580 * (0.96 + secondary * 0.06), 310 * (0.96 + secondary * 0.06), 0.22 * pulse);
  } else if (id === "scene_08b") {
    drawEllipseSprite(sprites.auraGold, 1040, 470, 360, 300, 0.16 + Math.sin(localTimeSec * 1.6) * 0.04);
  } else if (id === "scene_09") {
    // Subtle crust warmth + 6 translucent organic steam curls above flipped raspberry pie (x≈41.5%, y≈59%)
    drawEllipseSprite(sprites.ovenGlow, 798, 632, 195, 82, 0.16 + Math.sin(localTimeSec * 1.8) * 0.04);
    const wisps = [
      { dx: -64, h: 255, amp: 24, w: 18, phase: 0.0, speed: 1.0, op: 0.28 },
      { dx: -26, h: 315, amp: 30, w: 22, phase: 1.2, speed: 0.88, op: 0.34 },
      { dx: 12, h: 295, amp: 26, w: 20, phase: 2.5, speed: 1.06, op: 0.32 },
      { dx: 52, h: 240, amp: 22, w: 16, phase: 3.7, speed: 0.94, op: 0.26 },
      { dx: -4, h: 345, amp: 34, w: 26, phase: 4.8, speed: 0.78, op: 0.22 },
      { dx: 34, h: 270, amp: 25, w: 15, phase: 5.9, speed: 1.15, op: 0.24 },
    ];
    for (let idx = 0; idx < wisps.length; idx++) {
      const s = wisps[idx];
      const cycle = (localTimeSec * 0.24 * s.speed + idx * 0.19) % 1;
      const riseOffset = cycle * 48;
      const env = Math.sin(cycle * Math.PI);
      drawSteamRibbon(
        ctx,
        798 + s.dx,
        628 - riseOffset * 0.35,
        s.h + riseOffset * 0.5,
        s.amp,
        s.w,
        localTimeSec * s.speed,
        s.phase,
        s.op * (0.45 + 0.55 * env)
      );
    }
  } else if (id === "scene_10") {
    const duration = Math.max(0.1, scene.endSec - scene.startSec);
    const splitRatio = scene.beatSplitSec ? clamp((scene.beatSplitSec - scene.startSec) / duration, 0.28, 0.75) : 0.54;
    const doveReveal = smoothstep(splitRatio - 0.04, splitRatio + 0.32, progress);
    const momWarmth = 1 - doveReveal * 0.35;

    drawEllipseSprite(sprites.auraGold, 620, 420, 400, 350, 0.12 * momWarmth + Math.sin(localTimeSec * 1.1) * 0.025);

    const wisps = [
      { dx: -26, h: 155, amp: 14, w: 11, phase: 0.4, speed: 0.9 },
      { dx: 4, h: 185, amp: 16, w: 13, phase: 2.1, speed: 0.82 },
      { dx: 30, h: 148, amp: 13, w: 10, phase: 4.0, speed: 1.02 },
    ];
    for (const s of wisps) {
      drawSteamRibbon(
        ctx,
        875 + s.dx,
        586,
        s.h,
        s.amp,
        s.w,
        localTimeSec * s.speed,
        s.phase,
        0.22 + Math.sin(localTimeSec * 1.3 + s.phase) * 0.05
      );
    }

    // Gentle luminous Dove bloom keeping every white feather detail crisp!
    drawEllipseSprite(sprites.auraGold, 1395, 515, lerp(250, 380, doveReveal), lerp(220, 330, doveReveal), lerp(0.12, 0.28, doveReveal) + Math.sin(localTimeSec * 1.6) * 0.04);
    drawEllipseSprite(sprites.auraSky, 1415, 505, lerp(220, 440, doveReveal), lerp(190, 350, doveReveal), lerp(0.05, 0.22, doveReveal));
  }

  ctx.restore();
}

// -------------------- REMOTION TYPOGRAPHY PLATES --------------------
async function renderRemotionTypographyPlates(timeline) {
  fs.mkdirSync(CACHE_PLATES_DIR, { recursive: true });
  const titlePlatePath = path.join(CACHE_PLATES_DIR, "title_overlay.png");
  const closingPlatePath = path.join(CACHE_PLATES_DIR, "closing_overlay.png");
  if (fs.existsSync(titlePlatePath) && fs.existsSync(closingPlatePath) && !process.env.REBUILD_PLATES) {
    console.log("[render-hybrid] Using cached Remotion Chromium typography plates.");
    return { titlePlatePath, closingPlatePath };
  }

  console.log("[render-hybrid] Rendering crisp Cyrillic typography plates via Remotion Chromium...");
  const t0 = Date.now();
  const serveUrl = await bundle({
    entryPoint: path.join(STUDIO_DIR, "src", "index.ts"),
    publicDir: path.join(STUDIO_DIR, "public"),
  });

  const titleComp = await selectComposition({
    serveUrl,
    id: "TitleOverlayPlate",
    browserExecutable: "/usr/bin/google-chrome",
  });
  await renderStill({
    composition: titleComp,
    serveUrl,
    output: titlePlatePath,
    frame: 0,
    imageFormat: "png",
    omitBackground: true,
    browserExecutable: "/usr/bin/google-chrome",
  });

  const closingComp = await selectComposition({
    serveUrl,
    id: "ClosingOverlayPlate",
    browserExecutable: "/usr/bin/google-chrome",
  });
  await renderStill({
    composition: closingComp,
    serveUrl,
    output: closingPlatePath,
    frame: 0,
    imageFormat: "png",
    omitBackground: true,
    browserExecutable: "/usr/bin/google-chrome",
  });

  console.log(`[render-hybrid] Typography plates ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { titlePlatePath, closingPlatePath };
}

// -------------------- MAIN HYBRID RENDERER --------------------
async function main() {
  execSync("node scripts/sync-assets.mjs", { cwd: STUDIO_DIR, stdio: "inherit" });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const timeline = JSON.parse(
    fs.readFileSync(path.join(STUDIO_DIR, "src", "data", "timeline.generated.json"), "utf-8")
  );
  const fps = timeline.fps || 30;
  const totalFrames = Math.round(timeline.totalDurationSec * fps);
  const audioSrc = timeline.audioFile ? path.join(ROOT_DIR, "assets", "audio", timeline.audioFile) : null;
  const hasAudio = Boolean(audioSrc && fs.existsSync(audioSrc));

  const { titlePlatePath, closingPlatePath } = await renderRemotionTypographyPlates(timeline);

  // Pre-load all scene images & plates
  console.log("[render-hybrid] Loading all 11 HD scene illustrations & typography plates...");
  const sceneImages = new Map();
  for (const sc of timeline.scenes) {
    if (sc.imageFile && !sceneImages.has(sc.imageFile)) {
      const img = await loadImage(path.join(STUDIO_DIR, "public", "scenes", sc.imageFile));
      sceneImages.set(sc.imageFile, img);
    }
  }
  const titlePlate = await loadImage(titlePlatePath);
  const closingPlate = await loadImage(closingPlatePath);

  // Pre-bake reusable Skia sprites
  const sprites = {
    goldMote: makeGlowSprite(32, [
      [0, "rgba(255,253,245,1)"],
      [0.35, "rgba(255,232,166,0.85)"],
      [0.7, "rgba(255,220,130,0.24)"],
      [1, "rgba(255,255,255,0)"],
    ]),
    roseMote: makeGlowSprite(32, [
      [0, "rgba(255,252,246,1)"],
      [0.35, "rgba(255,205,186,0.82)"],
      [0.7, "rgba(255,188,166,0.22)"],
      [1, "rgba(255,255,255,0)"],
    ]),
    skyMote: makeGlowSprite(32, [
      [0, "rgba(255,254,255,1)"],
      [0.35, "rgba(165,232,255,0.86)"],
      [0.7, "rgba(130,218,255,0.24)"],
      [1, "rgba(255,255,255,0)"],
    ]),
    goldBokeh: makeGlowSprite(64, [
      [0, "rgba(255,235,174,0.72)"],
      [0.65, "rgba(255,222,145,0.42)"],
      [0.92, "rgba(255,222,145,0.16)"],
      [1, "rgba(255,255,255,0)"],
    ]),
    skyBokeh: makeGlowSprite(64, [
      [0, "rgba(175,234,255,0.74)"],
      [0.65, "rgba(135,218,255,0.44)"],
      [0.92, "rgba(135,218,255,0.16)"],
      [1, "rgba(255,255,255,0)"],
    ]),
    ovenGlow: makeGlowSprite(128, [
      [0, "rgba(255,210,125,0.76)"],
      [0.38, "rgba(255,162,76,0.34)"],
      [0.72, "rgba(255,136,48,0.10)"],
      [1, "rgba(255,123,41,0)"],
    ]),
    auraGold: makeGlowSprite(128, [
      [0, "rgba(255,253,242,0.76)"],
      [0.28, "rgba(255,230,154,0.42)"],
      [0.62, "rgba(156,224,255,0.16)"],
      [0.86, "rgba(133,214,255,0.04)"],
      [1, "rgba(133,214,255,0)"],
    ]),
    auraSky: makeGlowSprite(128, [
      [0, "rgba(230,248,255,0.60)"],
      [0.40, "rgba(139,217,255,0.28)"],
      [0.76, "rgba(114,207,255,0.07)"],
      [1, "rgba(114,207,255,0)"],
    ]),
    // Soft feathered volumetric sunbeam sprites (smooth fade on BOTH horizontal & vertical axes -> zero hard polygon lines!)
    beamGold: (() => {
      const c = createCanvas(128, 256);
      const bCtx = c.getContext("2d");
      const hGrad = bCtx.createLinearGradient(0, 0, 128, 0);
      hGrad.addColorStop(0, "rgba(255, 236, 178, 0)");
      hGrad.addColorStop(0.28, "rgba(255, 238, 184, 0.65)");
      hGrad.addColorStop(0.5, "rgba(255, 246, 210, 1)");
      hGrad.addColorStop(0.72, "rgba(255, 238, 184, 0.65)");
      hGrad.addColorStop(1, "rgba(255, 236, 178, 0)");
      bCtx.fillStyle = hGrad;
      bCtx.fillRect(0, 0, 128, 256);
      bCtx.globalCompositeOperation = "destination-in";
      const vGrad = bCtx.createLinearGradient(0, 0, 0, 256);
      vGrad.addColorStop(0, "rgba(0,0,0,0.95)");
      vGrad.addColorStop(0.45, "rgba(0,0,0,0.52)");
      vGrad.addColorStop(1, "rgba(0,0,0,0)");
      bCtx.fillStyle = vGrad;
      bCtx.fillRect(0, 0, 128, 256);
      return c;
    })(),
    beamSky: (() => {
      const c = createCanvas(128, 256);
      const bCtx = c.getContext("2d");
      const hGrad = bCtx.createLinearGradient(0, 0, 128, 0);
      hGrad.addColorStop(0, "rgba(182, 236, 255, 0)");
      hGrad.addColorStop(0.28, "rgba(196, 240, 255, 0.65)");
      hGrad.addColorStop(0.5, "rgba(232, 250, 255, 1)");
      hGrad.addColorStop(0.72, "rgba(196, 240, 255, 0.65)");
      hGrad.addColorStop(1, "rgba(182, 236, 255, 0)");
      bCtx.fillStyle = hGrad;
      bCtx.fillRect(0, 0, 128, 256);
      bCtx.globalCompositeOperation = "destination-in";
      const vGrad = bCtx.createLinearGradient(0, 0, 0, 256);
      vGrad.addColorStop(0, "rgba(0,0,0,0.92)");
      vGrad.addColorStop(0.45, "rgba(0,0,0,0.48)");
      vGrad.addColorStop(1, "rgba(0,0,0,0)");
      bCtx.fillStyle = vGrad;
      bCtx.fillRect(0, 0, 128, 256);
      return c;
    })(),
  };

  // Pre-generate deterministic 64 multi-depth particles
  const rng = mulberry32(20261124);
  const particles = [];
  for (let i = 0; i < 64; i++) {
    const rDepth = rng();
    const depth = rDepth < 0.45 ? 0 : rDepth < 0.82 ? 1 : 2;
    const radius = depth === 0 ? lerp(1.6, 3.2, rng()) : depth === 1 ? lerp(3.6, 7.4, rng()) : lerp(14, 34, rng());
    const speedMult = depth === 0 ? 0.55 : depth === 1 ? 1.0 : 1.55;
    particles.push({
      x0: rng() * W,
      y0: rng() * H,
      vx: lerp(-12, 18, rng()) * speedMult,
      vy: lerp(-24, -7, rng()) * speedMult,
      radius,
      depth,
      phase: rng() * Math.PI * 2,
      twinkleSpeed: lerp(0.8, 2.5, rng()),
      swayAmp: lerp(10, 36, rng()) * (depth === 2 ? 1.3 : 1),
      swayFreq: lerp(0.25, 0.75, rng()),
      hueSlot: rng(),
    });
  }

  const sunbeams = [
    { offsetPct: 0.05, width: 220, angleDeg: 26, phase: 0.0, speed: 0.45, baseAlpha: 0.13 },
    { offsetPct: 0.18, width: 310, angleDeg: 31, phase: 1.3, speed: 0.36, baseAlpha: 0.16 },
    { offsetPct: 0.31, width: 185, angleDeg: 35, phase: 2.6, speed: 0.52, baseAlpha: 0.11 },
    { offsetPct: 0.44, width: 260, angleDeg: 39, phase: 4.1, speed: 0.41, baseAlpha: 0.10 },
    { offsetPct: 0.12, width: 150, angleDeg: 22, phase: 5.2, speed: 0.58, baseAlpha: 0.09 },
  ];

  const grainTile = makeFilmGrainTile();

  // Reusable canvases (zero per-frame GC allocations!)
  const mainCanvas = createCanvas(W, H);
  const ctx = mainCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const sceneBuf = createCanvas(W, H);
  const sCtx = sceneBuf.getContext("2d");
  sCtx.imageSmoothingEnabled = true;
  sCtx.imageSmoothingQuality = "high";

  const titleScratch = createCanvas(W, H);
  const tCtx = titleScratch.getContext("2d");

  const grainPattern = ctx.createPattern(grainTile, "repeat");

  // Pre-build static vignette & closing background gradients
  const vignetteGrad = ctx.createRadialGradient(W * 0.5, H * 0.48, W * 0.34, W * 0.5, H * 0.5, W * 0.72);
  vignetteGrad.addColorStop(0, "rgba(32, 20, 10, 0)");
  vignetteGrad.addColorStop(0.76, "rgba(36, 22, 12, 0.07)");
  vignetteGrad.addColorStop(1, "rgba(28, 16, 8, 0.28)");

  const closingBgGrad = ctx.createRadialGradient(W * 0.5, H * 0.44, 20, W * 0.5, H * 0.5, W * 0.68);
  closingBgGrad.addColorStop(0, "#FBF3E2");
  closingBgGrad.addColorStop(0.42, "#F2E1C2");
  closingBgGrad.addColorStop(0.78, "#DEC39A");
  closingBgGrad.addColorStop(1, "#C4A173");

  const closingInnerVig = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.22, W * 0.5, H * 0.5, W * 0.65);
  closingInnerVig.addColorStop(0, "rgba(255, 250, 238, 0.25)");
  closingInnerVig.addColorStop(0.6, "rgba(120, 78, 36, 0.08)");
  closingInnerVig.addColorStop(1, "rgba(58, 32, 12, 0.42)");

  const dissolveSheenGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.45, W * 0.62);
  dissolveSheenGrad.addColorStop(0, "rgba(255, 240, 198, 0.32)");
  dissolveSheenGrad.addColorStop(0.55, "rgba(255, 220, 150, 0.14)");
  dissolveSheenGrad.addColorStop(1, "rgba(255, 210, 130, 0)");

  const startFrame = Math.max(0, parseInt(process.env.START_FRAME || "0", 10));
  const endFrame = Math.min(totalFrames, parseInt(process.env.END_FRAME || String(totalFrames), 10));
  const outMp4 = process.env.OUT_FILE ? path.resolve(process.env.OUT_FILE) : FINAL_MP4;
  const muxAudio = hasAudio && !process.env.SKIP_AUDIO;
  const chunkCount = endFrame - startFrame;

  // Spawn FFmpeg encoder receiving raw 1920x1080 RGBA stream
  const ffmpegArgs = [
    "-y",
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "-s", `${W}x${H}`,
    "-r", String(fps),
    "-i", "pipe:0",
    ...(muxAudio ? ["-i", audioSrc] : []),
    "-c:v", "libx264",
    "-crf", "16",
    "-preset", "fast",
    "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    ...(muxAudio ? ["-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", "-shortest"] : []),
    "-movflags", "+faststart",
    outMp4,
  ];

  console.log(
    `[render-hybrid] Rendering frames [${startFrame}..${endFrame - 1}] (${chunkCount} frames @ ${fps}fps, 1920x1080, CRF 16) -> ${path.basename(outMp4)}`
  );
  const ff = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "inherit", "pipe"] });
  let ffStderr = "";
  ff.stderr.on("data", (d) => {
    ffStderr += d.toString();
    if (ffStderr.length > 8000) ffStderr = ffStderr.slice(-8000);
  });

  const scenes = timeline.scenes;
  const scene01 = scenes.find((s) => s.id === "scene_01");
  const tStart = Date.now();
  let lastPct = -5;

  for (let frame = startFrame; frame < endFrame; frame++) {
    const t = frame / fps;

    // 1. Clear main frame to warm espresso black
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#120B06";
    ctx.fillRect(0, 0, W, H);

    // 2. Determine active scenes & golden cross-dissolve weights
    const active = [];
    let dominantIndex = 0;
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const next = scenes[i + 1];
      const transIn = i === 0 ? 0 : Math.max(0.35, sc.transitionSec || 0.75);
      const transOut = next ? Math.max(0.35, next.transitionSec || 0.75) : 0;

      const inStart = i === 0 ? 0 : sc.startSec - transIn * 0.5;
      const inEnd = i === 0 ? 0 : sc.startSec + transIn * 0.5;
      const outEnd = next ? next.startSec + transOut * 0.5 : sc.endSec + 0.5;
      if (t < inStart - 0.05 || t > outEnd + 0.05) continue;

      const fadeIn = i === 0 ? 1 : easeInOutSine(clamp((t - inStart) / Math.max(0.01, inEnd - inStart), 0, 1));
      const inGlow = i === 0 ? 0 : Math.sin(fadeIn * Math.PI);
      let outWeight = 1;
      if (next) {
        const nextInStart = next.startSec - transOut * 0.5;
        const nextInEnd = next.startSec + transOut * 0.5;
        if (t > nextInStart) {
          outWeight = 1 - easeInOutSine(clamp((t - nextInStart) / Math.max(0.01, nextInEnd - nextInStart), 0, 1));
        }
      }
      const weight = fadeIn * outWeight;
      if (weight >= 0.5) dominantIndex = i;
      active.push({ scene: sc, opacity: fadeIn, transitionGlow: inGlow, weight });
    }

    // 3. Render active scenes in chronological order
    for (const item of active) {
      const { scene, opacity, transitionGlow } = item;
      if (opacity <= 0.002) continue;

      if (scene.id === "scene_11_outro") {
        const localT = Math.max(0, t - scene.startSec);
        const dur = Math.max(1, scene.endSec - scene.startSec);
        const textIn = easeOutQuart(clamp((localT - 0.35) / 1.25, 0, 1));
        const fadeOutDur = Math.min(1.45, dur * 0.32);
        const fadeOutStart = Math.max(dur - fadeOutDur, 1.5);
        const fadeOut = easeInOutCubic(clamp((localT - fadeOutStart) / fadeOutDur, 0, 1));
        const introBloom = 1 - easeOutCubic(clamp(localT / 1.2, 0, 1));
        const contentOp = (1 - fadeOut) * opacity;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = "#120B06";
        ctx.fillRect(0, 0, W, H);

        if (contentOp > 0.002) {
          ctx.globalAlpha = contentOp;
          ctx.fillStyle = closingBgGrad;
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = closingInnerVig;
          ctx.fillRect(0, 0, W, H);

          // Ornamental double border
          ctx.strokeStyle = `rgba(158, 114, 58, ${(0.26 * textIn).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(58, 58, W - 116, H - 116);
          ctx.strokeStyle = `rgba(158, 114, 58, ${(0.14 * textIn).toFixed(3)})`;
          ctx.strokeRect(68, 68, W - 136, H - 136);

          // Remotion crisp Ukrainian closing typography plate
          ctx.globalAlpha = contentOp * textIn;
          ctx.drawImage(closingPlate, 0, lerp(18, 0, textIn));
        }

        if (introBloom > 0.01) {
          ctx.globalAlpha = introBloom * 0.78 * opacity;
          ctx.fillStyle = "rgba(255, 240, 198, 0.75)";
          ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
        continue;
      }

      const img = sceneImages.get(scene.imageFile);
      if (!img) continue;

      const dur = Math.max(0.1, scene.endSec - scene.startSec);
      const localT = clamp(t - scene.startSec, -1, dur + 2);
      const progress = clamp((t - scene.startSec) / dur, 0, 1);
      const cam = evaluateSceneCamera(scene, progress, Math.max(0, localT));
      const entryScale = lerp(1.015, 1.0, easeInOutCubic(opacity));
      const finalScale = cam.scale * entryScale;

      // Choose direct draw on main canvas if full opaque single layer, else render to sceneBuf for clean alpha cross-dissolve
      const useBuf = opacity < 0.998;
      const targetCtx = useBuf ? sCtx : ctx;
      if (useBuf) {
        sCtx.clearRect(0, 0, W, H);
      }

      targetCtx.save();
      targetCtx.translate(W / 2 + cam.txPx, H / 2 + cam.tyPx);
      if (Math.abs(cam.rotateRad) > 0.00005) targetCtx.rotate(cam.rotateRad);
      targetCtx.scale(finalScale, finalScale);
      targetCtx.translate(-W / 2, -H / 2);

      // Exact object-fit: cover math (zero aspect distortion!)
      const coverScale = Math.max(W / img.width, H / img.height);
      const drawW = img.width * coverScale;
      const drawH = img.height * coverScale;
      targetCtx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);

      // Scene-space tracked 2.5D VFX (moves with camera!)
      drawSceneTrackedVfx(targetCtx, scene, Math.max(0, localT), progress, sprites);
      targetCtx.restore();

      if (useBuf) {
        ctx.save();
        ctx.globalAlpha = clamp(opacity, 0, 1);
        ctx.drawImage(sceneBuf, 0, 0);
        ctx.restore();
      }

      // Soft golden dissolve sheen
      if (transitionGlow > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = transitionGlow * 0.34;
        ctx.fillStyle = dissolveSheenGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // 4. Blend atmospheric profile smoothly across transitions
    let totalW = 0;
    let sunbeamIntensity = 0;
    let particleDensity = 0;
    let bokehIntensity = 0;
    let warmthBoost = 0;
    let celestialBlend = 0;
    for (const item of active) {
      const prof = SCENE_PROFILES[item.scene.id];
      const w = Math.max(0.0001, item.weight);
      totalW += w;
      sunbeamIntensity += prof.sunbeamIntensity * w;
      particleDensity += prof.particleDensity * w;
      bokehIntensity += prof.bokehIntensity * w;
      warmthBoost += prof.warmthBoost * w;
      let scCel = isCelestialMood(prof.mood);
      if (item.scene.id === "scene_10") {
        const dur = Math.max(0.1, item.scene.endSec - item.scene.startSec);
        const prog = clamp((t - item.scene.startSec) / dur, 0, 1);
        const split = item.scene.beatSplitSec ? clamp((item.scene.beatSplitSec - item.scene.startSec) / dur, 0.28, 0.75) : 0.54;
        const beatB = smoothstep(split - 0.04, split + 0.35, prog);
        scCel = lerp(0.05, 0.72, beatB);
      }
      celestialBlend += scCel * w;
    }
    if (totalW > 0) {
      sunbeamIntensity /= totalW;
      particleDensity /= totalW;
      bokehIntensity /= totalW;
      warmthBoost /= totalW;
      celestialBlend /= totalW;
    }

    const domScene = scenes[dominantIndex] || scenes[0];
    const domProfile = SCENE_PROFILES[domScene.id];
    const openingFadeIn = easeInOutCubic(clamp(t / 0.75, 0, 1));
    const outroFadeOut = 1 - easeInOutCubic(clamp((t - (timeline.totalDurationSec - 1.35)) / 1.25, 0, 1));
    const atmOpacity = openingFadeIn * outroFadeOut;

    // 5. VOLUMETRIC FEATHERED SUNLIT GOD-RAYS (soft feathered sprites -> ZERO hard polygon edges!)
    if (atmOpacity > 0.005 && domProfile.sunbeamSide !== "none" && sunbeamIntensity > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const isRight = domProfile.sunbeamSide === "right";
      const useSkyBeam = celestialBlend > 0.5;
      for (const beam of sunbeams) {
        const sway = Math.sin(t * beam.speed + beam.phase);
        const breath = 0.68 + 0.32 * Math.sin(t * (beam.speed * 1.35) + beam.phase + 0.8);
        const alpha = beam.baseAlpha * sunbeamIntensity * breath * atmOpacity * 0.92;
        if (alpha <= 0.003) continue;
        const originX = (isRight ? W * (1 - beam.offsetPct * 0.72) : W * (beam.offsetPct * 0.72)) + sway * 38;
        const rad = ((isRight ? 180 - beam.angleDeg : beam.angleDeg) * Math.PI) / 180;
        const length = 1650;
        const beamW = beam.width * 2.1;

        ctx.save();
        ctx.translate(originX, -140);
        ctx.rotate(rad - Math.PI / 2 + sway * 0.025);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.drawImage(useSkyBeam ? sprites.beamSky : sprites.beamGold, -beamW * 0.5, 0, beamW, length);
        ctx.restore();
      }
      ctx.restore();
    }

    // 6. MULTI-DEPTH FLOATING GOLDEN DUST MOTES & LUMINOUS CELESTIAL BOKEH
    if (atmOpacity > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const activeCount = Math.min(particles.length, Math.round(particles.length * clamp(particleDensity, 0.4, 1.5) * 0.88));
      const pad = 60;
      const spanX = W + pad * 2;
      const spanY = H + pad * 2;
      for (let i = 0; i < activeCount; i++) {
        const p = particles[i];
        if (p.depth === 2 && bokehIntensity < 0.05) continue;
        const rawX = p.x0 + p.vx * t + Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;
        const rawY = p.y0 + p.vy * t + Math.cos(t * p.swayFreq * 0.8 + p.phase) * p.swayAmp * 0.4;
        const x = (((rawX + pad) % spanX) + spanX) % spanX - pad;
        const y = (((rawY + pad) % spanY) + spanY) % spanY - pad;
        const twinkle = 0.42 + 0.58 * Math.pow(0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.phase), 1.6);
        const alpha =
          (p.depth === 0 ? 0.45 * twinkle : p.depth === 1 ? 0.68 * twinkle : 0.28 * bokehIntensity * (0.65 + 0.35 * twinkle)) *
          atmOpacity;
        if (alpha < 0.015) continue;

        const isSky = celestialBlend > 0.22 && p.hueSlot > 1 - celestialBlend * 0.65;
        const sprite =
          p.depth === 2
            ? isSky
              ? sprites.skyBokeh
              : sprites.goldBokeh
            : isSky
              ? sprites.skyMote
              : domProfile.mood === "rose-warm" && p.hueSlot > 0.6
                ? sprites.roseMote
                : sprites.goldMote;
        const r = p.depth === 2 ? p.radius * lerp(0.85, 1.38, bokehIntensity) : p.radius;
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    // 7. WARM STORYBOOK VIGNETTE
    ctx.save();
    ctx.globalAlpha = atmOpacity;
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 8. OPENING TITLE CARD (Synced to Scene 01 "Казка Пирожок" — NO dialogue subtitles!)
    if (scene01 && t <= scene01.endSec + 0.5) {
      const localT = t - scene01.startSec;
      const dur = Math.max(2, scene01.endSec - scene01.startSec);
      const enterStart = 0.35;
      const enterDur = Math.min(1.25, dur * 0.28);
      const exitDur = Math.min(0.95, dur * 0.22);
      const exitStart = Math.max(enterStart + enterDur + 0.3, dur - exitDur - 0.1);
      const inEase = easeOutQuart(clamp((localT - enterStart) / enterDur, 0, 1));
      const outEase = easeInOutCubic(clamp((localT - exitStart) / exitDur, 0, 1));
      const titleAlpha = inEase * (1 - outEase);

      if (titleAlpha > 0.002) {
        const yShift = lerp(22, 0, inEase) - lerp(0, 14, outEase);

        // Soft warm scrim behind title (full-canvas fillRect so radial fade has ZERO clipped rectangle edges!)
        ctx.save();
        ctx.globalAlpha = titleAlpha;
        const scrim = ctx.createRadialGradient(W * 0.52, H * 0.48, 30, W * 0.52, H * 0.48, 520);
        scrim.addColorStop(0, "rgba(46, 26, 12, 0.34)");
        scrim.addColorStop(0.48, "rgba(56, 33, 16, 0.14)");
        scrim.addColorStop(1, "rgba(56, 33, 16, 0)");
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, W, H);

        // Animate sunlit golden sheen sweep across the calligraphy plate!
        const sweepT = easeInOutCubic(clamp((localT - 1.1) / 1.9, 0, 1));
        const sweepX = lerp(520, 1480, sweepT);
        tCtx.clearRect(0, 0, W, H);
        tCtx.globalCompositeOperation = "source-over";
        tCtx.drawImage(titlePlate, 0, 0);
        if (sweepT > 0.01 && sweepT < 0.99) {
          tCtx.globalCompositeOperation = "source-atop";
          const sg = tCtx.createLinearGradient(sweepX - 160, 380, sweepX + 160, 620);
          sg.addColorStop(0, "rgba(255, 255, 240, 0)");
          sg.addColorStop(0.5, "rgba(255, 252, 232, 0.58)");
          sg.addColorStop(1, "rgba(255, 255, 240, 0)");
          tCtx.fillStyle = sg;
          tCtx.fillRect(0, 0, W, H);
        }

        ctx.drawImage(titleScratch, 0, yShift);
        ctx.restore();
      }
    }

    // 9. SUBTLE 35MM WARM PAINTERLY FILM GRAIN (15fps organic cadence)
    if (outroFadeOut > 0.01 && grainPattern) {
      const step = Math.floor(frame / 2);
      const ox = (step * 53) % 160;
      const oy = (step * 37) % 160;
      ctx.save();
      ctx.globalAlpha = 0.026 * outroFadeOut;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = grainPattern;
      ctx.fillRect(ox, oy, W + 160, H + 160);
      ctx.restore();
    }

    // 10. OPENING WARM ESPRESSO-BLACK CURTAIN DISSOLVE
    if (openingFadeIn < 0.998) {
      ctx.save();
      ctx.globalAlpha = 1 - openingFadeIn;
      ctx.fillStyle = "#120B06";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Pipe raw RGBA frame into FFmpeg with backpressure
    const rawBuf = mainCanvas.data();
    if (!ff.stdin.write(rawBuf)) {
      await once(ff.stdin, "drain");
    }

    const done = frame - startFrame + 1;
    const pct = Math.floor((done / chunkCount) * 100);
    if (pct >= lastPct + 10 || frame === endFrame - 1) {
      lastPct = pct;
      const elapsed = (Date.now() - tStart) / 1000;
      const curFps = done / Math.max(0.01, elapsed);
      const eta = (chunkCount - done) / Math.max(0.1, curFps);
      console.log(
        `[render-hybrid] ${path.basename(outMp4)} ${pct}% (${done}/${chunkCount}) — ${curFps.toFixed(1)} fps | elapsed ${elapsed.toFixed(1)}s | ETA ${eta.toFixed(0)}s`
      );
    }
  }

  ff.stdin.end();
  const [exitCode] = await once(ff, "close");
  if (exitCode !== 0) {
    console.error("[render-hybrid] FFmpeg failed:\n", ffStderr);
    process.exit(exitCode);
  }

  const totalSec = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`[render-hybrid] SUCCESS! Saved ${outMp4} in ${totalSec}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
