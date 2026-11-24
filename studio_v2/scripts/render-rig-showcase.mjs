/**
 * Renders two high-resolution 1920x1080 showcase plates to inspect all 3 articulated rigs:
 *  1. preview/showcase_characters.png
 *  2. preview/showcase_dove_and_faces.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';

import {
  PALETTE,
  drawWatercolorPaperBackground,
  setInkStyle,
  drawExpressiveMouth,
} from '../src/engine/painterly.mjs';
import { drawBoy, drawBoyHead } from '../src/rigs/boyRig.mjs';
import { drawMom, drawMomHead } from '../src/rigs/momRig.mjs';
import { drawDove, drawDoveEyeCloseup } from '../src/rigs/doveRig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.resolve(__dirname, '../preview');
fs.mkdirSync(previewDir, { recursive: true });

const FONT_SERIF = '"DejaVu Serif", "Liberation Serif", serif';

function drawPlateHeader(ctx, title, subtitle) {
  ctx.save();
  ctx.fillStyle = PALETTE.inkDark;
  ctx.font = `bold 29px ${FONT_SERIF}`;
  ctx.fillText(title, 54, 56);

  ctx.fillStyle = PALETTE.inkWarm;
  ctx.font = `italic 17px ${FONT_SERIF}`;
  ctx.fillText(subtitle, 54, 84);

  ctx.beginPath();
  ctx.moveTo(54, 100);
  ctx.lineTo(1866, 100);
  setInkStyle(ctx, 1.4, 'rgba(92, 60, 40, 0.25)');
  ctx.stroke();
  ctx.restore();
}

function drawCaption(ctx, x, y, text) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.inkMid;
  ctx.font = `600 17px ${FONT_SERIF}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCardFrame(ctx, x, y, w, h, title = null) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fillStyle = 'rgba(255, 252, 245, 0.5)';
  ctx.fill();
  setInkStyle(ctx, 1.4, 'rgba(116, 86, 62, 0.28)');
  ctx.stroke();
  if (title) {
    ctx.fillStyle = PALETTE.inkWarm;
    ctx.font = `600 16px ${FONT_SERIF}`;
    ctx.fillText(title, x + 18, y + 28);
  }
  ctx.restore();
}

/**
 * PLATE 1: Boy + Modern Mom full poses & expression showcase
 */
function renderCharactersPlate() {
  const W = 1920;
  const H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawWatercolorPaperBackground(ctx, W, H);
  drawPlateHeader(
    ctx,
    '«Казка Пирожок» — Articulated 2D Painterly Rigs (Boy & Modern Mom)',
    'Faithful to character_sheet.jpg: cream waffle-knit shirt, rolled denim, dusty-rose tee, oatmeal linen apron, beige midi skirt, white sneakers'
  );

  // --- LEFT SECTION: BOY POSES ---
  drawCardFrame(ctx, 44, 118, 886, 920, 'BOY RIG (~5–6yo) — Skeletal Poses & Facial Close-Ups');

  // 1. Boy Standing Relaxed
  drawBoy(ctx, {
    x: 205,
    y: 615,
    scale: 1.14,
    facing: 'front',
    breathPhase: 0.4,
    mood: 'happy',
    viseme: 'smile',
    armPose: 'relaxed',
  });
  drawCaption(ctx, 205, 656, 'Standing Relaxed');

  // 2. Boy Running Joyful Mid-Stride!
  drawBoy(ctx, {
    x: 495,
    y: 615,
    scale: 1.14,
    facing: 'right',
    runPhase: 1.15,
    breathPhase: 1.2,
    mood: 'joyful',
    viseme: 'wide',
    mouthOpen: 0.65,
    eyeGazeX: 0.35,
  });
  drawCaption(ctx, 495, 656, 'Running Mid-Stride');

  // 3. Boy Sitting & Pointing
  drawBoy(ctx, {
    x: 765,
    y: 585,
    scale: 1.0,
    facing: 'threeQuarter',
    breathPhase: 2.1,
    mood: 'curious',
    viseme: 'oh',
    mouthOpen: 0.35,
    armPose: 'pointingRight',
    sittingOnStool: true,
    eyeGazeX: 0.45,
    eyeGazeY: -0.2,
  });
  drawCaption(ctx, 765, 656, 'Sitting & Pointing');

  // 4. Boy Surprised & Serene Close-Up Portraits (clean framed inset at bottom)
  drawCardFrame(ctx, 72, 690, 830, 322, 'Boy Facial Close-Ups — Surprised / Amazed vs Serene Happy Blink');

  ctx.save();
  ctx.translate(285, 868);
  ctx.scale(1.75, 1.75);
  drawBoyHead(ctx, {
    headTurn: 0.12,
    headTilt: -0.04,
    hairBounce: 0.35,
    mood: 'surprised',
    viseme: 'surprisedO',
    mouthOpen: 0.72,
    eyeGazeX: 0.16,
    eyeGazeY: -0.14,
  });
  ctx.restore();
  drawCaption(ctx, 285, 994, 'Surprised / Amazed Close-Up');

  ctx.save();
  ctx.translate(675, 868);
  ctx.scale(1.75, 1.75);
  drawBoyHead(ctx, {
    headTurn: -0.1,
    headTilt: 0.05,
    blink: 0.96,
    mood: 'serene',
    viseme: 'smile',
    mouthOpen: 0,
  });
  ctx.restore();
  drawCaption(ctx, 675, 994, 'Serene Happy Blink');

  // --- RIGHT SECTION: MODERN MOM POSES ---
  drawCardFrame(ctx, 954, 118, 922, 920, 'MODERN MOM RIG (Early 30s) — Strictly Modern Wardrobe & Poses');

  // Mom portrait inset cleanly at top (NO overlap with full bodies below!)
  drawCardFrame(ctx, 982, 160, 866, 216, 'Modern Mom — Messy Chestnut Bun & Facial Expressions');

  ctx.save();
  ctx.translate(1205, 294);
  ctx.scale(1.32, 1.32);
  drawMomHead(ctx, {
    headTurn: 0.1,
    headTilt: -0.04,
    mood: 'welcoming',
    viseme: 'smile',
    mouthOpen: 0,
  });
  ctx.restore();
  drawCaption(ctx, 1205, 366, 'Warm Loving Gaze');

  ctx.save();
  ctx.translate(1615, 294);
  ctx.scale(1.32, 1.32);
  drawMomHead(ctx, {
    headTurn: -0.12,
    headTilt: 0.05,
    mood: 'serene',
    viseme: 'smile',
    blink: 0.95,
  });
  ctx.restore();
  drawCaption(ctx, 1615, 366, 'Tender Serene Blink');

  // 3 Full-Body Modern Mom Poses cleanly positioned below the portrait inset!
  // 1. Mom Welcoming Open Arms
  drawMom(ctx, {
    x: 1125,
    y: 970,
    scale: 1.15,
    facing: 'front',
    breathPhase: 0.5,
    skirtSway: 0.12,
    mood: 'welcoming',
    viseme: 'smile',
    mouthOpen: 0.12,
    armMode: 'openWelcome',
  });
  drawCaption(ctx, 1125, 1014, 'Welcoming Open Arms');

  // 2. Mom Holding Steaming Raspberry Lattice Pie in Quilted Oven Mitts
  drawMom(ctx, {
    x: 1425,
    y: 970,
    scale: 1.15,
    facing: 'front',
    breathPhase: 1.8,
    skirtSway: -0.08,
    mood: 'warm',
    viseme: 'ah',
    mouthOpen: 0.42,
    armMode: 'holdingPie',
  });
  drawCaption(ctx, 1425, 1014, 'Holding Raspberry Pie');

  // 3. Mom Leaning Down Lovingly & Stroking Boy's Hair
  drawMom(ctx, {
    x: 1715,
    y: 970,
    scale: 1.15,
    facing: 'left',
    breathPhase: 2.6,
    skirtSway: -0.2,
    mood: 'tender',
    viseme: 'smile',
    mouthOpen: 0,
    armMode: 'strokingHair',
    strokePhase: 0.22,
    leanDown: 0.65,
    eyeGazeX: 0.35,
    eyeGazeY: 0.35,
  });
  drawCaption(ctx, 1715, 1014, 'Leaning & Stroking Hair');

  const outPath = path.join(previewDir, 'showcase_characters.png');
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Saved:', outPath);
}

/**
 * PLATE 2: Luminous White Dove (3 poses + Macro Sky-Blue Eye Close-Up) + 7-Viseme Lip-Sync Chart
 */
function renderDoveAndFacesPlate() {
  const W = 1920;
  const H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawWatercolorPaperBackground(ctx, W, H);
  drawPlateHeader(
    ctx,
    '«Казка Пирожок» — Luminous White Dove Rig, Macro Sky-Blue Eye & Lip-Sync Visemes',
    'Folded perched stance, broad arched spread wings, nodding & speaking beak, Scene 05 macro sky-blue eye close-up, and 7-viseme chart'
  );

  // --- TOP LEFT: 3 FULL DOVE POSES ---
  drawCardFrame(ctx, 48, 120, 1140, 505, 'LUMINOUS WHITE DOVE RIG — Articulated Wings, Head Nod & Beak Lip-Sync');

  // 1. Folded Perched
  drawDove(ctx, {
    x: 230,
    y: 530,
    scale: 1.52,
    facing: 'right',
    breathPhase: 0.5,
    headNod: 0,
    wingSpread: 0,
    auraGlow: 0.74,
    showPerch: true,
  });
  drawCaption(ctx, 230, 598, 'Dove — Folded Perched');

  // 2. Majestic Wide-Spread Arched Wings!
  drawDove(ctx, {
    x: 645,
    y: 530,
    scale: 1.44,
    facing: 'right',
    breathPhase: 1.4,
    headNod: -0.1,
    wingSpread: 1.0,
    wingFlapPhase: 0.35,
    auraGlow: 0.98,
    beakOpen: 0.12,
    showPerch: true,
  });
  drawCaption(ctx, 645, 598, 'Dove — Majestic Spread Wings');

  // 3. Head Nodding & Speaking (Beak Open Lip-Sync!)
  drawDove(ctx, {
    x: 1005,
    y: 530,
    scale: 1.5,
    facing: 'left',
    breathPhase: 2.2,
    headNod: 0.32,
    wingSpread: 0.45,
    wingFlapPhase: 0.9,
    beakOpen: 0.78,
    auraGlow: 0.82,
    showPerch: true,
  });
  drawCaption(ctx, 1005, 598, 'Dove — Nodding & Speaking');

  // --- TOP RIGHT: SCENE 05 MACRO SKY-BLUE EYE CLOSE-UP ---
  drawCardFrame(ctx, 1212, 120, 660, 505, 'SCENE 05 MACRO CLOSE-UP — Transparent Sky-Blue Eye');
  drawDoveEyeCloseup(ctx, {
    x: 1236,
    y: 168,
    width: 612,
    height: 392,
    blink: 0,
    cloudDrift: 1.6,
    gazeX: 0.08,
    gazeY: -0.04,
    auraGlow: 0.94,
  });
  drawCaption(ctx, 1542, 598, 'Crystal Sky-Blue Eye Reflecting Drifting Clouds');

  // --- BOTTOM ROW: 7-VISEME LIP-SYNC MOUTH & EXPRESSION CHART ---
  drawCardFrame(ctx, 48, 648, 1824, 386, 'LIP-SYNC VISEME CHART — 7 Articulated Mouth Shapes (Boy & Mom)');

  const visemes = [
    { key: 'closed', open: 0, label: 'closed' },
    { key: 'smile', open: 0, label: 'smile' },
    { key: 'ah', open: 0.75, label: 'ah (open)' },
    { key: 'oh', open: 0.65, label: 'oh' },
    { key: 'ee', open: 0.55, label: 'ee' },
    { key: 'wide', open: 0.8, label: 'wide (joy)' },
    { key: 'surprisedO', open: 0.85, label: 'surprisedO' },
  ];

  const startX = 186;
  const stepX = 258;

  visemes.forEach((v, i) => {
    const cx = startX + i * stepX;

    ctx.save();
    ctx.translate(cx, 774);
    ctx.scale(0.95, 0.95);
    drawBoyHead(ctx, {
      mood: v.key === 'surprisedO' ? 'surprised' : v.key === 'wide' ? 'joyful' : 'happy',
      viseme: v.key,
      mouthOpen: v.open,
      headTurn: 0.06,
    });
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - 56, 870, 112, 54, 10);
    ctx.fillStyle = PALETTE.skinBase;
    ctx.fill();
    setInkStyle(ctx, 1.3, 'rgba(92, 60, 40, 0.35)');
    ctx.stroke();
    drawExpressiveMouth(ctx, cx, 894, 1.55, v.key, v.open, { isMom: i % 2 === 1 });
    ctx.restore();

    drawCaption(ctx, cx, 958, v.label);
  });

  ctx.fillStyle = PALETTE.inkWarm;
  ctx.font = `italic 16px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    'Lower swatches alternate Boy & Mom lip-tint styling across all 7 speech visemes (smoothly driven by audio RMS + phoneme schedule)',
    W * 0.5,
    1008
  );

  const outPath = path.join(previewDir, 'showcase_dove_and_faces.png');
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Saved:', outPath);
}

renderCharactersPlate();
renderDoveAndFacesPlate();
