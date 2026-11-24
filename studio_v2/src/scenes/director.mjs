/**
 * Frame-Accurate 30fps Full-Motion Animation Director for "Казка Пирожок"
 * Drives living multi-plane environments + articulated Boy, Modern Mom & White Dove rigs
 * synced to locked broadcast audio timeline.json & 30fps lipsync.json!
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';

import { clamp, lerp, smoothstep } from '../engine/painterly.mjs';
import { drawBoy } from '../rigs/boyRig.mjs';
import { drawMom } from '../rigs/momRig.mjs';
import { drawDove, drawDoveEyeCloseup } from '../rigs/doveRig.mjs';
import {
  drawSunlitHallway,
  drawModernKitchen,
  drawSkyDreamscape,
  drawRaspberryAromaRibbons,
  drawWoodenStool,
  drawAtmosphereFX,
  drawOpeningTitleCard,
  drawClosingTitleCard,
} from '../environments/livingEnvironments.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.resolve(__dirname, '../../../assets/audio');

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

// Load locked timeline & 30fps per-character lip-sync data
export const TIMELINE = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, 'timeline.json'), 'utf8'));
export const LIPSYNC = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, 'lipsync.json'), 'utf8'));

export const TOTAL_FRAMES = LIPSYNC.total_frames || Math.round(TIMELINE.total_duration_sec * FPS);

// Reusable offscreen buffer for smooth golden cross-dissolves (allocated lazily once per worker)
let _blendCanvas = null;
let _blendCtx = null;
function getBlendBuffer() {
  if (!_blendCanvas) {
    _blendCanvas = createCanvas(WIDTH, HEIGHT);
    _blendCtx = _blendCanvas.getContext('2d');
  }
  return { canvas: _blendCanvas, ctx: _blendCtx };
}

/**
 * Natural stochastic blinking helper (organic 0.16s blink every ~3.0-4.2s, never robotic!)
 */
function naturalBlink(t, seedOffset = 0) {
  // Use slightly varying interval lengths via harmonic modulation
  const period = 3.45 + Math.sin(seedOffset * 7.3) * 0.45;
  const shifted = t + seedOffset * 1.9;
  const cycleIdx = Math.floor(shifted / period);
  const local = shifted - cycleIdx * period;
  const triggerAt = 1.1 + ((Math.sin(cycleIdx * 12.9898 + seedOffset * 78.233) * 0.5 + 0.5) * (period - 1.5));
  const dist = Math.abs(local - triggerAt);
  const halfDur = 0.085;
  if (dist >= halfDur) return 0;
  return Math.cos((dist / halfDur) * Math.PI * 0.5);
}

/**
 * Intentional poetic slow blink helper centered at centerT with half-duration halfDur
 */
function beatBlink(t, centerT, halfDur = 0.22) {
  const d = Math.abs(t - centerT);
  if (d >= halfDur) return 0;
  return Math.cos((d / halfDur) * Math.PI * 0.5);
}

/**
 * Sample smoothed lip-sync state { mouthOpen, viseme, isSpeaking } from lipsync.json
 */
function sampleLipsync(speaker, frameIdx, fallbackViseme = 'smile') {
  const track = LIPSYNC.characters?.[speaker];
  if (!track || track.length === 0) {
    return { mouthOpen: 0, viseme: fallbackViseme, isSpeaking: false };
  }
  const f = clamp(Math.round(frameIdx), 0, track.length - 1);
  const prev = track[Math.max(0, f - 1)];
  const curr = track[f];
  const next = track[Math.min(track.length - 1, f + 1)];

  // Smooth 3-frame energy interpolation so mouth opens & closes organically on every syllable!
  const smoothE = prev.e * 0.25 + curr.e * 0.5 + next.e * 0.25;
  const isSpeaking = smoothE > 0.045 || (curr.v !== 'closed' && curr.e > 0.035);
  if (!isSpeaking) {
    return { mouthOpen: 0, viseme: fallbackViseme, isSpeaking: false };
  }

  const mouthOpen = clamp(smoothE * 1.38, 0.08, 1.0);
  const viseme = curr.v && curr.v !== 'closed' ? curr.v : smoothE > 0.22 ? 'ah' : 'ee';
  return { mouthOpen, viseme, isSpeaking: true };
}

/**
 * Apply shared world camera transform (matches drawSunlitHallway & drawModernKitchen!)
 */
function applyCamera(ctx, cam = {}) {
  const { panX = 0, panY = 0, zoom = 1 } = cam;
  ctx.translate(WIDTH * 0.5, HEIGHT * 0.5);
  ctx.scale(zoom, zoom);
  ctx.translate(-WIDTH * 0.5 - panX, -HEIGHT * 0.5 - panY);
}

/**
 * =========================================================================
 * INDIVIDUAL SCENE RENDERERS (100% Continuous Living 2D Animation!)
 * =========================================================================
 */

/**
 * SCENE 01 (0.000s -> 4.022s): Sunlit Modern Kitchen + Opening Title Card ("Казка Пирожок.")
 */
function renderScene01(ctx, t, frameIdx) {
  const dur = 4.0216;
  const p = clamp(t / dur, 0, 1);

  const cam = {
    zoom: lerp(1.0, 1.07, smoothstep(0, 1, p)),
    panX: lerp(-36, 32, smoothstep(0, 1, p)),
    panY: lerp(10, -14, smoothstep(0, 1, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.72,
    pieOnCounter: false,
    showForegroundTable: true,
    windowGlowBoost: 0.2,
  });

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.85,
    skyBlend: 0.15,
    vignetteStrength: 0.25,
    paperGrainAlpha: 0.1,
  });

  // Opening Title Card smoothly synced to Narrator "Казка Пирожок." (1.80s -> 3.35s)
  const fadeIn = smoothstep(0.35, 1.35, t);
  const fadeOut = 1 - smoothstep(3.25, 3.95, t);
  const titleAlpha = fadeIn * fadeOut;
  drawOpeningTitleCard(ctx, titleAlpha, t);

  // Soft warm fade-in from sunrise parchment on first 0.55s
  if (t < 0.6) {
    const cover = 1 - smoothstep(0, 0.55, t);
    ctx.save();
    ctx.fillStyle = `rgba(255, 245, 224, ${cover})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }
}

/**
 * SCENE 02 (4.022s -> 14.906s): Sunlit Hallway — Boy ACTUALLY RUNS barefoot from open front door,
 * pauses joyfully to shout "Що це так пахне, мамо?!" (full lip-sync!), then skips into glowing kitchen!
 */
function renderScene02(ctx, t, frameIdx) {
  const sStart = 4.0216;
  const sDur = 10.884;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  // Tracking camera gently follows the Boy left -> right toward the glowing kitchen doorway
  const cam = {
    zoom: lerp(1.02, 1.1, smoothstep(0, 1, p)),
    panX: lerp(-68, 102, smoothstep(0.05, 0.96, p)),
    panY: lerp(6, -6, smoothstep(0, 1, p)),
  };

  drawSunlitHallway(ctx, t, cam);

  // Boy running -> joyful stop & shout ("Що це так пахне, мамо?!" 4.50s -> 6.58s) -> joyful run to kitchen!
  const lsBoy = sampleLipsync('boy', frameIdx, 'smile');
  const blink = naturalBlink(t, 1.1);

  let boyX;
  let runPhase = null;
  let walkPhase = null;
  let armPose = 'relaxed';
  let headTilt = 0;
  let eyeGazeX = 0.38;
  let eyeGazeY = -0.14;

  if (t < 4.72) {
    // Bursting barefoot through the open sunny front door!
    const u = smoothstep(4.02, 4.72, t);
    boyX = lerp(245, 650, u);
    runPhase = (t - 4.02) * 11.5;
    headTilt = -0.05;
  } else if (t < 6.72) {
    // Joyful pause sniffing swirling raspberry jam ribbons & shouting "Що це так пахне, мамо?!"
    const u = smoothstep(4.72, 6.72, t);
    boyX = lerp(650, 748, u);
    runPhase = null;
    walkPhase = null;
    armPose = 'openJoy';
    headTilt = -0.08 + Math.sin(t * 4.5) * 0.03;
    eyeGazeX = 0.45;
    eyeGazeY = -0.25;
  } else {
    // Delighted second joyful run/skip across the sunlit floorboards toward the glowing kitchen!
    const u = smoothstep(6.72, 14.85, t);
    boyX = lerp(748, 1440, u);
    runPhase = (t - 6.72) * 9.6;
    headTilt = -0.06 + Math.sin(t * 3.2) * 0.03;
    eyeGazeX = 0.55;
    eyeGazeY = -0.16;
  }

  ctx.save();
  applyCamera(ctx, cam);

  drawBoy(ctx, {
    x: boyX,
    y: 892,
    scale: 1.32,
    facing: 'right',
    runPhase,
    walkPhase,
    breathPhase: t * 3.4,
    headTilt,
    headTurn: 0.32,
    blink,
    eyeGazeX,
    eyeGazeY,
    mood: 'joyful',
    viseme: lsBoy.isSpeaking ? lsBoy.viseme : 'wide',
    mouthOpen: lsBoy.isSpeaking ? lsBoy.mouthOpen : 0.28,
    armPose,
    showShadow: true,
  });

  // Subtle translucent rosy-gold aroma veil passing IN FRONT of him so he runs RIGHT THROUGH the scent!
  drawRaspberryAromaRibbons(ctx, 1490, 560, t + 1.2, { width: 960, alpha: 0.34, dir: -1 });
  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.78,
    skyBlend: 0.08,
    vignetteStrength: 0.22,
    paperGrainAlpha: 0.1,
  });
}

/**
 * SCENE 03 (14.906s -> 21.652s): Cozy Kitchen Doorway — Modern Mom ACTUALLY WALKS forward,
 * spreads her arms warmly with a radiant smile & lip-syncs "Заходь, сину... пиріг допікається, будемо куштувати."!
 */
function renderScene03(ctx, t, frameIdx) {
  const sStart = 14.9056;
  const sDur = 6.746;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  const cam = {
    zoom: lerp(1.12, 1.19, smoothstep(0, 1, p)),
    panX: lerp(-120, -155, smoothstep(0, 1, p)),
    panY: lerp(22, 16, smoothstep(0, 1, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 1.0,
    pieInsideOven: true,
    pieOnCounter: false,
    showForegroundTable: false,
    windowGlowBoost: 0.18,
  });

  const lsMom = sampleLipsync('mom', frameIdx, 'smile');
  const blink = naturalBlink(t, 2.7);

  // Mom ACTUALLY WALKS forward out of the sunlit baking kitchen (14.91s -> 18.45s), then opens arms wide!
  const walkU = smoothstep(14.91, 18.45, t);
  const isWalking = t < 18.42;
  const momX = lerp(960, 805, walkU);
  const momY = lerp(928, 956, walkU);
  const momScale = lerp(1.24, 1.38, walkU);
  const openArms = t > 15.15;

  ctx.save();
  applyCamera(ctx, cam);

  drawMom(ctx, {
    x: momX,
    y: momY,
    scale: momScale,
    facing: 'front',
    walkPhase: isWalking ? (t - sStart) * 5.8 : null,
    skirtSway: isWalking ? Math.sin((t - sStart) * 5.8) * 0.35 : Math.sin(t * 1.4) * 0.14,
    breathPhase: t * 2.4,
    headTilt: Math.sin(t * 1.5) * 0.045,
    headTurn: lerp(-0.14, 0.04, walkU),
    blink,
    eyeGazeX: 0.04,
    eyeGazeY: 0.12,
    mood: 'welcoming',
    viseme: lsMom.viseme,
    mouthOpen: lsMom.mouthOpen,
    armMode: openArms ? 'openWelcome' : 'relaxed',
    leanDown: smoothstep(18.0, 20.5, t) * 0.08,
    showShadow: true,
  });

  // Subtle warm baking raspberry aroma rising softly from the glowing oven behind Mom!
  drawRaspberryAromaRibbons(ctx, 480, 620, t, { width: 420, alpha: 0.28, dir: 1 });
  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.72,
    skyBlend: 0.1,
    vignetteStrength: 0.24,
    paperGrainAlpha: 0.1,
  });
}

/**
 * SCENE 04 (21.652s -> 27.563s): Boy walks into the sunlit modern kitchen and stops in hushed awe,
 * looking up at the Luminous White Dove perched on the bright sunlit windowsill!
 */
function renderScene04(ctx, t, frameIdx) {
  const sStart = 21.6516;
  const sDur = 5.9115;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  const cam = {
    zoom: lerp(1.0, 1.1, smoothstep(0.1, 1.0, p)),
    panX: lerp(-22, 82, smoothstep(0.15, 1.0, p)),
    panY: lerp(4, -24, smoothstep(0.15, 1.0, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.85,
    pieOnCounter: false,
    showForegroundTable: true,
    windowGlowBoost: lerp(0.15, 0.45, smoothstep(0.35, 1.0, p)),
    celestialSkyTint: smoothstep(0.45, 1.0, p) * 0.35,
  });

  const boyBlink = naturalBlink(t, 4.1);
  const doveBlink = Math.max(naturalBlink(t, 8.2), beatBlink(t, 25.8, 0.2));

  // Boy walks in smoothly (21.65s -> 24.45s), then pauses gently in wonder gazing up at the Dove!
  const walkU = smoothstep(21.65, 24.45, t);
  const isWalking = t < 24.42;
  const boyX = lerp(240, 745, walkU);
  const wonderU = smoothstep(24.1, 25.2, t);

  // Dove softly settles her wings right on sfx_dove_wings (24.11s) and turns gently to look down at the boy!
  const settleFlutter =
    t >= 23.55 && t <= 24.85
      ? Math.sin(smoothstep(23.55, 24.85, t) * Math.PI) * 0.48
      : 0;

  ctx.save();
  applyCamera(ctx, cam);

  // Luminous White Dove on the sunlit oak windowsill!
  drawDove(ctx, {
    x: 1472,
    y: 526,
    scale: 1.38,
    facing: 'left',
    breathPhase: t * 2.1,
    headNod: lerp(0.02, 0.14, wonderU) + Math.sin(t * 1.4) * 0.02,
    headTurn: lerp(-0.05, 0.25, wonderU),
    blink: doveBlink,
    beakOpen: 0,
    wingSpread: settleFlutter,
    wingFlapPhase: (t - 23.55) * 6.5,
    auraGlow: lerp(0.62, 0.94, smoothstep(23.5, 26.8, t)),
    cloudDrift: t * 0.6,
    showPerch: false,
  });

  // Boy walking into kitchen & stopping in hushed awe
  drawBoy(ctx, {
    x: boyX,
    y: 954,
    scale: 1.28,
    facing: 'right',
    walkPhase: isWalking ? (t - sStart) * 6.8 : null,
    breathPhase: t * 2.4,
    headTilt: lerp(-0.02, -0.1, wonderU),
    headTurn: lerp(0.24, 0.42, wonderU),
    blink: boyBlink,
    eyeGazeX: lerp(0.35, 0.72, wonderU),
    eyeGazeY: lerp(-0.08, -0.46, wonderU),
    mood: wonderU > 0.35 ? 'amazed' : 'happy',
    viseme: wonderU > 0.4 ? 'oh' : 'smile',
    mouthOpen: wonderU * 0.18,
    armPose: 'relaxed',
    showShadow: true,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: lerp(0.75, 1.0, wonderU),
    skyBlend: wonderU * 0.42,
    vignetteStrength: 0.22,
    paperGrainAlpha: 0.1,
  });
}

/**
 * SCENE 05 (27.563s -> 37.295s): Poetic Macro Close-Up of the White Dove's Crystal-Clear Sky-Blue Eye!
 * As "І розплився простір тихий і так добре стало на душі" plays, space melts into serene sky-blue & gold light!
 */
function renderScene05(ctx, t, frameIdx) {
  const sStart = 27.5631;
  const sDur = 9.7319;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  // Dissolve strength blooms softly right around "І розплився простір тихий..." (31.4s -> 35.8s)
  const dreamDissolve = smoothstep(30.9, 35.6, t);

  // Slow meditative push-in focusing gracefully on the transparent sky-blue eye
  const zoom = lerp(1.02, 1.14, smoothstep(0, 1, p));
  const panX = lerp(-24, 34, smoothstep(0, 1, p));
  const panY = lerp(8, -16, smoothstep(0, 1, p));

  // Serene intentional slow blinks (one around 30.2s, one deeply peaceful blink around 34.8s!)
  const blink = Math.max(beatBlink(t, 30.15, 0.22), beatBlink(t, 34.75, 0.28));

  ctx.save();
  ctx.translate(WIDTH * 0.5, HEIGHT * 0.5);
  ctx.scale(zoom, zoom);
  ctx.translate(-WIDTH * 0.5 - panX, -HEIGHT * 0.5 - panY);

  drawDoveEyeCloseup(ctx, {
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    blink,
    cloudDrift: t * 0.85,
    gazeX: Math.sin(t * 0.55) * 0.16,
    gazeY: Math.cos(t * 0.45) * 0.1,
    auraGlow: lerp(0.84, 1.0, dreamDissolve),
  });
  ctx.restore();

  // Ethereal sky-blue & golden drifting cloud dreamscape softly melting across space ("розплився простір тихий")!
  if (dreamDissolve > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    drawSkyDreamscape(ctx, t, dreamDissolve * 0.44);
    ctx.restore();

    // Soft sky-gold luminous halo radiating from the crystal eye
    ctx.save();
    const eyeGlow = ctx.createRadialGradient(WIDTH * 0.49, HEIGHT * 0.48, 90, WIDTH * 0.49, HEIGHT * 0.48, 860);
    eyeGlow.addColorStop(0, `rgba(196, 238, 255, ${0.14 * dreamDissolve})`);
    eyeGlow.addColorStop(0.5, `rgba(255, 244, 206, ${0.18 * dreamDissolve})`);
    eyeGlow.addColorStop(1, 'rgba(255, 244, 206, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }

  drawAtmosphereFX(ctx, t, 'celestial', {
    sparkleIntensity: lerp(0.85, 1.25, dreamDissolve),
    skyBlend: lerp(0.58, 1.0, dreamDissolve),
    vignetteStrength: lerp(0.22, 0.14, dreamDissolve),
    paperGrainAlpha: 0.08,
  });
}

/**
 * SCENE 06 (37.295s -> 41.092s): Intimate two-shot near sunlit window —
 * Boy tilts his curly head inquisitively and asks "Хто ти?" (full lip-sync!) while the Dove listens attentively!
 */
function renderScene06(ctx, t, frameIdx) {
  const sStart = 37.295;
  const sDur = 3.7966;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  const cam = {
    zoom: lerp(1.36, 1.44, smoothstep(0, 1, p)),
    panX: lerp(248, 274, smoothstep(0, 1, p)),
    panY: lerp(-80, -90, smoothstep(0, 1, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.72,
    pieOnCounter: false,
    showForegroundTable: false,
    windowGlowBoost: 0.38,
    celestialSkyTint: 0.3,
  });

  const lsBoy = sampleLipsync('boy', frameIdx, 'closed');
  const boyBlink = naturalBlink(t, 5.4);
  const doveBlink = beatBlink(t, 39.4, 0.18);

  const stepU = smoothstep(0, 0.55, p);

  ctx.save();
  applyCamera(ctx, cam);

  drawDove(ctx, {
    x: 1472,
    y: 526,
    scale: 1.42,
    facing: 'left',
    breathPhase: t * 2.1,
    headNod: 0.12 + Math.sin(t * 1.6) * 0.025,
    headTurn: 0.22,
    blink: doveBlink,
    beakOpen: 0,
    wingSpread: 0,
    auraGlow: 0.88,
    cloudDrift: t * 0.7,
    showPerch: false,
  });

  drawBoy(ctx, {
    x: lerp(990, 1022, stepU),
    y: 966,
    scale: 1.42,
    facing: 'right',
    walkPhase: null,
    breathPhase: t * 2.5,
    headTilt: lerp(0.02, 0.09, smoothstep(0.1, 0.6, p)),
    headTurn: 0.44,
    blink: boyBlink,
    eyeGazeX: 0.65,
    eyeGazeY: -0.34,
    mood: 'curious',
    viseme: lsBoy.isSpeaking ? lsBoy.viseme : 'closed',
    mouthOpen: lsBoy.mouthOpen,
    armPose: 'relaxed',
    showShadow: true,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.92,
    skyBlend: 0.48,
    vignetteStrength: 0.22,
    paperGrainAlpha: 0.09,
  });
}

/**
 * SCENE 07 (41.092s -> 50.308s): MAGICAL CENTERPIECE!
 * White Dove gracefully spreads & flutters BOTH feathered wings in a burst of golden & sky-blue sparkles,
 * speaking "Я — посланець, я приношу радість і сміх, я — велич твоя і твій пиріг." with animated beak lip-sync!
 */
function renderScene07(ctx, t, frameIdx) {
  const sStart = 41.0916;
  const sDur = 9.2168;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  const cam = {
    zoom: lerp(1.56, 1.7, smoothstep(0, 0.85, p)),
    panX: lerp(420, 442, smoothstep(0, 1, p)),
    panY: lerp(-178, -196, smoothstep(0, 1, p)),
  };

  // Wing spread swells majestically open right at start, flutters throughout speech, settles gracefully at end
  const openIn = smoothstep(0.05, 1.25, lt);
  const foldOut = 1 - smoothstep(7.85, 9.1, lt) * 0.82;
  const wingSpread = clamp(openIn * foldOut, 0, 1);
  const celestialRise = smoothstep(0.15, 1.4, lt);

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.65,
    pieOnCounter: false,
    showForegroundTable: false,
    windowGlowBoost: 0.45 + celestialRise * 0.45,
    celestialSkyTint: 0.35 + celestialRise * 0.65,
  });

  // Radiant celestial bloom behind the Dove's spreading wings
  const lsDove = sampleLipsync('dove', frameIdx, 'closed');
  const beakOpen = lsDove.isSpeaking ? clamp(lsDove.mouthOpen * 1.15, 0.14, 1.0) : 0;
  const doveBlink = Math.max(naturalBlink(t, 9.3), beatBlink(t, 45.6, 0.2));

  ctx.save();
  applyCamera(ctx, cam);

  // Expanding sky-blue & gold celestial halo centered behind her wings
  const cx = 1472;
  const cy = 408;
  const haloR = 320 + wingSpread * 160 + Math.sin(t * 2.2) * 18;
  const cHalo = ctx.createRadialGradient(cx, cy, 35, cx, cy, haloR);
  cHalo.addColorStop(0, `rgba(255, 252, 232, ${0.65 * celestialRise})`);
  cHalo.addColorStop(0.42, `rgba(176, 228, 255, ${0.42 * celestialRise})`);
  cHalo.addColorStop(0.76, `rgba(255, 222, 148, ${0.22 * celestialRise})`);
  cHalo.addColorStop(1, 'rgba(255, 222, 148, 0)');
  ctx.fillStyle = cHalo;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();

  drawDove(ctx, {
    x: 1472,
    y: 526 - Math.sin(lt * 1.9) * 3 * wingSpread,
    scale: 1.54,
    facing: 'left',
    breathPhase: t * 2.4,
    headNod: 0.06 + Math.sin(t * 2.6) * 0.04 + beakOpen * 0.06,
    headTurn: 0.14,
    blink: doveBlink,
    beakOpen,
    wingSpread,
    wingFlapPhase: lt * 3.1,
    auraGlow: 0.85 + celestialRise * 0.15,
    cloudDrift: t * 0.9,
    showPerch: false,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'celestial', {
    sparkleIntensity: 1.25,
    skyBlend: 0.92,
    vignetteStrength: 0.2,
    paperGrainAlpha: 0.08,
  });
}

/**
 * SCENE 08A (50.308s -> 54.85s): Expressive Close-Up on the Boy —
 * eyebrows shooting up, wide amazed eyes, lip-syncing "Пиріг?" and "Як пиріг?"!
 */
function renderScene08a(ctx, t, frameIdx) {
  const sStart = 50.3084;
  const lt = clamp(t - sStart, 0, 4.6);
  const p = lt / 4.6;

  const cam = {
    zoom: lerp(1.48, 1.56, smoothstep(0, 1, p)),
    panX: lerp(-120, -96, smoothstep(0, 1, p)),
    panY: lerp(-88, -98, smoothstep(0, 1, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.78,
    pieOnCounter: false,
    showForegroundTable: false,
    windowGlowBoost: 0.22,
  });

  const lsBoy = sampleLipsync('boy', frameIdx, 'surprisedO');
  const boyBlink = Math.max(naturalBlink(t, 6.2), beatBlink(t, 52.35, 0.14));

  // Playful curious head tilt oscillating between "Пиріг?" and "Як пиріг?"
  const tilt = t < 52.4 ? -0.06 + Math.sin(lt * 3.2) * 0.03 : 0.08 + Math.sin(lt * 3.4) * 0.025;

  ctx.save();
  applyCamera(ctx, cam);

  drawBoy(ctx, {
    x: 840,
    y: 1095,
    scale: 1.98,
    facing: 'right',
    breathPhase: t * 3.0,
    headTilt: tilt,
    headTurn: 0.22,
    blink: boyBlink,
    eyeGazeX: 0.34,
    eyeGazeY: -0.18,
    mood: 'surprised',
    viseme: lsBoy.isSpeaking ? lsBoy.viseme : 'oh',
    mouthOpen: lsBoy.isSpeaking ? lsBoy.mouthOpen : 0.16,
    armPose: 'relaxed',
    showShadow: false,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.72,
    skyBlend: 0.28,
    vignetteStrength: 0.24,
    paperGrainAlpha: 0.1,
  });
}

/**
 * SCENE 08B (54.85s -> 58.539s): Calm White Dove with folded wings
 * PHYSICALLY NODDING HER HEAD smoothly up and down 3 gentle times ("А голуб стояв і лише головою кивав.")!
 */
function renderScene08b(ctx, t, frameIdx) {
  const sStart = 54.85;
  const sDur = 58.539 - sStart;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  const cam = {
    zoom: lerp(1.66, 1.72, smoothstep(0, 1, p)),
    panX: lerp(432, 444, smoothstep(0, 1, p)),
    panY: lerp(-158, -166, smoothstep(0, 1, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.72,
    pieOnCounter: false,
    showForegroundTable: false,
    windowGlowBoost: 0.42,
    celestialSkyTint: 0.4,
  });

  // 3 distinct, smooth, graceful downward head nods between 55.12s and 58.12s!
  let headNod = 0.04;
  if (t >= 55.12 && t <= 58.12) {
    const u = (t - 55.12) / 3.0; // 0..1 across 3 gentle nods (1.0s each!)
    const wave = Math.sin(u * Math.PI * 3); // 3 clean positive peaks
    const nodPulse = Math.pow(Math.max(0, wave), 1.15);
    headNod = -0.04 + nodPulse * 0.36; // dips gracefully downward ~20.6 degrees each nod!
  }

  // Serene knowing blink on the 2nd nod!
  const doveBlink = Math.max(beatBlink(t, 56.55, 0.2), naturalBlink(t, 11.4));

  ctx.save();
  applyCamera(ctx, cam);

  drawDove(ctx, {
    x: 1472,
    y: 526,
    scale: 1.56,
    facing: 'left',
    breathPhase: t * 2.0,
    headNod,
    headTurn: 0.16,
    blink: doveBlink,
    beakOpen: 0,
    wingSpread: 0,
    auraGlow: 0.9,
    cloudDrift: t * 0.75,
    showPerch: false,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.92,
    skyBlend: 0.56,
    vignetteStrength: 0.22,
    paperGrainAlpha: 0.09,
  });
}

/**
 * SCENE 09 (58.539s -> 66.184s): Modern Mom walks smoothly from the glowing oven holding the
 * freshly baked steaming raspberry lattice pie in quilted oven mitts; Boy turns up toward Mom,
 * pointing back toward the glowing White Dove on the window & lip-syncing his curious question!
 */
function renderScene09(ctx, t, frameIdx) {
  const sStart = 58.539;
  const sDur = 7.6448;
  const lt = clamp(t - sStart, 0, sDur);
  const p = lt / sDur;

  const cam = {
    zoom: lerp(1.06, 1.14, smoothstep(0, 1, p)),
    panX: lerp(-46, 12, smoothstep(0, 1, p)),
    panY: lerp(6, -6, smoothstep(0, 1, p)),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.55,
    pieInsideOven: false,
    pieOnCounter: false,
    showForegroundTable: false,
    windowGlowBoost: 0.32,
  });

  const lsBoy = sampleLipsync('boy', frameIdx, 'closed');
  const boyBlink = naturalBlink(t, 7.1);
  const momBlink = naturalBlink(t, 3.8);
  const doveBlink = naturalBlink(t, 12.1);

  // Mom walks smoothly from the glowing oven on the left holding the steaming raspberry pie!
  const walkU = smoothstep(58.54, 61.95, t);
  const isWalking = t < 61.9;
  const momX = lerp(420, 695, walkU);

  // Boy gestures/points back toward the sunlit window while turning his curly head up toward Mom!
  const pointActive = t >= 59.45 && t <= 65.85;

  ctx.save();
  applyCamera(ctx, cam);

  // Glowing White Dove watching gently from the sunlit windowsill in the right background
  drawDove(ctx, {
    x: 1472,
    y: 526,
    scale: 1.32,
    facing: 'left',
    breathPhase: t * 2.0,
    headNod: 0.08,
    headTurn: 0.2,
    blink: doveBlink,
    beakOpen: 0,
    wingSpread: 0,
    auraGlow: 0.84,
    cloudDrift: t * 0.65,
    showPerch: false,
  });

  // Modern Mom walking smoothly holding freshly baked steaming raspberry lattice pie in oven mitts!
  drawMom(ctx, {
    x: momX,
    y: 956,
    scale: 1.32,
    facing: 'right',
    walkPhase: isWalking ? (t - sStart) * 5.2 : null,
    skirtSway: isWalking ? Math.sin((t - sStart) * 5.2) * 0.32 : Math.sin(t * 1.2) * 0.08,
    breathPhase: t * 2.2,
    headTilt: 0.05,
    headTurn: 0.34,
    blink: momBlink,
    eyeGazeX: 0.45,
    eyeGazeY: 0.32,
    mood: 'warm',
    viseme: 'smile',
    mouthOpen: 0,
    armMode: 'holdingPie',
    leanDown: 0.04,
    showShadow: true,
  });

  // Boy standing beside Mom, turning curly head left toward Mom while pointing RIGHT toward the Dove!
  drawBoy(ctx, {
    x: 1035,
    y: 958,
    scale: 1.28,
    facing: 'right',
    breathPhase: t * 2.6,
    headTilt: -0.05 + Math.sin(t * 3.1) * 0.025,
    headTurn: -0.58,
    blink: boyBlink,
    eyeGazeX: -0.68,
    eyeGazeY: -0.34,
    mood: 'thoughtful',
    viseme: lsBoy.isSpeaking ? lsBoy.viseme : 'closed',
    mouthOpen: lsBoy.mouthOpen,
    armPose: pointActive ? 'pointingRight' : 'relaxed',
    showShadow: true,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.82,
    skyBlend: 0.24,
    vignetteStrength: 0.22,
    paperGrainAlpha: 0.1,
  });
}

/**
 * SCENE 10 (66.184s -> 83.115s): Two-Beat Emotional Climax!
 *  - Beat 10a (66.18s -> 77.10s): Steaming pie on oak counter, Boy sits on wooden oak stool,
 *    Modern Mom leans tenderly beside him & PHYSICALLY STROKES HIS CURLY HAIR while speaking
 *    "Так, серденько, він — твій пиріг, і твоє дитинство, і твоя Душа..." (full lip-sync!).
 *  - Beat 10b (77.10s -> 83.11s): On "Хлопчик подивився на голуба і, наче, все зрозумів...",
 *    Boy smoothly turns his head & eyes right toward the glowing White Dove with a radiant peaceful smile,
 *    while the camera smoothly pulls back wide uniting Mom, Boy, Pie & glowing Dove!
 */
function renderScene10(ctx, t, frameIdx) {
  const sStart = 66.1838;
  const beatBStart = 77.15;

  // Smooth pull-back wide during Beat 10b (77.15s -> 82.6s) uniting all four beloved elements!
  const pullBackU = smoothstep(77.2, 82.5, t);
  const beatBU = smoothstep(77.15, 78.8, t);
  const magicChimeBloom = smoothstep(73.2, 76.2, t);

  const cam = {
    zoom: lerp(1.31, 1.0, pullBackU),
    panX: lerp(-22, 14, pullBackU),
    panY: lerp(24, 0, pullBackU),
  };

  drawModernKitchen(ctx, t, cam, {
    ovenGlow: 0.42,
    pieInsideOven: false,
    pieOnCounter: true,
    pieCounterX: 605,
    pieCounterY: 622,
    showForegroundTable: pullBackU > 0.25,
    windowGlowBoost: lerp(0.28, 0.58, Math.max(magicChimeBloom * 0.6, pullBackU)),
    celestialSkyTint: lerp(0.2, 0.68, Math.max(magicChimeBloom * 0.5, pullBackU)),
  });

  const lsMom = sampleLipsync('mom', frameIdx, 'smile');
  const momBlink = Math.max(naturalBlink(t, 4.9), beatBlink(t, 78.2, 0.22));
  const boyBlink = Math.max(naturalBlink(t, 8.6), beatBlink(t, 79.85, 0.24));
  const doveBlink = Math.max(naturalBlink(t, 13.2), beatBlink(t, 79.4, 0.22));

  // Mom leans tenderly beside the seated boy and strokes his curly hair smoothly in Beat 10a!
  const leanIn = smoothstep(66.2, 67.4, t);
  const momLean = lerp(0.18, 0.36, leanIn) * (1 - beatBU * 0.65);
  const isStroking = t < 77.35;
  const strokePhase = (t - sStart) * 0.56; // graceful loving back-and-forth glide across his curls!

  // Boy's head & chestnut-brown eyes turn smoothly from Mom (left) -> glowing White Dove (right) in Beat 10b!
  const boyTurn = lerp(-0.42, 0.46, beatBU);
  const boyGazeX = lerp(-0.54, 0.66, beatBU);
  const boyGazeY = lerp(-0.34, -0.22, beatBU);
  const boyMood = beatBU > 0.45 ? 'serene' : 'happy';

  ctx.save();
  applyCamera(ctx, cam);

  // 1. Luminous White Dove on the sunlit windowsill radiating serene harmony!
  drawDove(ctx, {
    x: 1472,
    y: 526,
    scale: 1.38,
    facing: 'left',
    breathPhase: t * 1.9,
    headNod: 0.1 + Math.sin(t * 1.4) * 0.02,
    headTurn: 0.24,
    blink: doveBlink,
    beakOpen: 0,
    wingSpread: 0,
    auraGlow: lerp(0.84, 1.0, Math.max(magicChimeBloom * 0.5, pullBackU)),
    cloudDrift: t * 0.7,
    showPerch: false,
  });

  // 2. Grounded Warm Oak Wooden Kitchen Stool (centered solidly beneath Boy's denim seat!)
  drawWoodenStool(ctx, 1054, 976, { scale: 1.04, seatH: 148 });

  // 3. Boy seated comfortably on the wooden oak stool, bare feet gently swinging!
  drawBoy(ctx, {
    x: 1045,
    y: 952,
    scale: 1.26,
    facing: 'right',
    breathPhase: t * 2.1,
    headTilt: lerp(-0.04, 0.05, beatBU),
    headTurn: boyTurn,
    blink: boyBlink,
    eyeGazeX: boyGazeX,
    eyeGazeY: boyGazeY,
    mood: boyMood,
    viseme: 'smile',
    mouthOpen: 0,
    armPose: 'restingStool',
    sittingOnStool: true,
    showShadow: false,
  });

  // 4. Modern Mom leaning tenderly beside him & PHYSICALLY STROKING HIS CURLY HAIR!
  // Drawn AFTER Boy so her graceful warm stroking hand glides cleanly OVER the crown of his curls!
  drawMom(ctx, {
    x: 840,
    y: 966,
    scale: 1.32,
    facing: 'right',
    breathPhase: t * 2.0,
    skirtSway: Math.sin(t * 1.1) * 0.08,
    headTilt: lerp(0.08, 0.03, beatBU),
    headTurn: lerp(0.36, 0.44, beatBU),
    blink: momBlink,
    eyeGazeX: lerp(0.46, 0.62, beatBU),
    eyeGazeY: lerp(0.34, 0.14, beatBU),
    mood: beatBU > 0.5 ? 'serene' : 'tender',
    viseme: lsMom.viseme,
    mouthOpen: lsMom.mouthOpen,
    armMode: isStroking ? 'strokingHair' : 'relaxed',
    strokePhase,
    leanDown: momLean,
    showShadow: true,
  });

  ctx.restore();

  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: lerp(0.85, 1.18, Math.max(magicChimeBloom, pullBackU)),
    skyBlend: lerp(0.28, 0.72, Math.max(magicChimeBloom * 0.65, pullBackU)),
    vignetteStrength: 0.22,
    paperGrainAlpha: 0.09,
  });

  // Gentle warm golden sunlight bloom rising in final 0.75s leading into the Closing Card!
  if (t > 82.35) {
    const bloom = smoothstep(82.35, 83.12, t);
    ctx.save();
    ctx.fillStyle = `rgba(255, 246, 222, ${bloom * 0.55})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }
}

/**
 * SCENE 11 OUTRO (83.115s -> 87.765s): Warm Storybook Parchment Closing Card
 * ("КНИГА ВЕДМЕДІВ" / "Казка «Пирожок»") fading peacefully to warm dark sepia-black!
 */
function renderScene11Outro(ctx, t, frameIdx) {
  const sStart = 83.1149;
  const lt = clamp(t - sStart, 0, 5.0);
  const cardAlpha = smoothstep(0.0, 0.7, lt);
  const fadeBlack = smoothstep(86.45, 87.72, t);

  // Subtle golden parchment base underneath during initial reveal
  ctx.save();
  ctx.fillStyle = '#fff5df';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  drawClosingTitleCard(ctx, cardAlpha, t, fadeBlack);
}

/**
 * Scene timeline table with smooth golden cross-dissolve windows
 */
export const SCENE_SLOTS = [
  { id: '01', start: 0.0, end: 4.0216, xfade: 0.5, render: renderScene01 },
  { id: '02', start: 4.0216, end: 14.9056, xfade: 0.55, render: renderScene02 },
  { id: '03', start: 14.9056, end: 21.6516, xfade: 0.5, render: renderScene03 },
  { id: '04', start: 21.6516, end: 27.5631, xfade: 0.55, render: renderScene04 },
  { id: '05', start: 27.5631, end: 37.295, xfade: 0.6, render: renderScene05 },
  { id: '06', start: 37.295, end: 41.0916, xfade: 0.45, render: renderScene06 },
  { id: '07', start: 41.0916, end: 50.3084, xfade: 0.48, render: renderScene07 },
  { id: '08a', start: 50.3084, end: 54.85, xfade: 0.36, render: renderScene08a },
  { id: '08b', start: 54.85, end: 58.539, xfade: 0.45, render: renderScene08b },
  { id: '09', start: 58.539, end: 66.1838, xfade: 0.55, render: renderScene09 },
  { id: '10', start: 66.1838, end: 83.1149, xfade: 0.65, render: renderScene10 },
  { id: '11_outro', start: 83.1149, end: 87.7649, xfade: 0, render: renderScene11Outro },
];

/**
 * Render exact frame index (0 .. TOTAL_FRAMES - 1) onto 1920x1080 ctx
 * Handles seamless golden cross-dissolves across scene cuts with zero overhead on non-transition frames!
 */
export function renderFrame(ctx, frameIdx) {
  const f = clamp(Math.round(frameIdx), 0, TOTAL_FRAMES - 1);
  const t = f / FPS;

  // Locate active scene slot
  let idx = SCENE_SLOTS.length - 1;
  for (let i = 0; i < SCENE_SLOTS.length; i++) {
    if (t >= SCENE_SLOTS[i].start && t < SCENE_SLOTS[i].end) {
      idx = i;
      break;
    }
  }

  const slot = SCENE_SLOTS[idx];
  const nextSlot = idx < SCENE_SLOTS.length - 1 ? SCENE_SLOTS[idx + 1] : null;

  // Render primary scene directly onto output canvas
  slot.render(ctx, t, f);

  // Check if we are inside the smooth golden cross-dissolve tail into the next scene!
  if (nextSlot && slot.xfade > 0) {
    const xStart = slot.end - slot.xfade;
    if (t > xStart) {
      const u = smoothstep(xStart, slot.end, t);
      const { canvas: bCan, ctx: bCtx } = getBlendBuffer();
      bCtx.clearRect(0, 0, WIDTH, HEIGHT);
      nextSlot.render(bCtx, Math.max(nextSlot.start, t), f);

      ctx.save();
      ctx.globalAlpha = u;
      ctx.drawImage(bCan, 0, 0);
      ctx.restore();

      // Delicate warm golden sunlight kiss peaking softly at the midpoint of the cross-dissolve
      const kiss = Math.sin(u * Math.PI) * 0.14;
      if (kiss > 0.005) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 244, 212, ${kiss})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.restore();
      }
    }
  }
}

/**
 * Render a specific scene at a specific global timestamp (used by preview-scenes tool!)
 */
export function renderAtTimestamp(ctx, sec) {
  const f = clamp(Math.round(sec * FPS), 0, TOTAL_FRAMES - 1);
  renderFrame(ctx, f);
}
