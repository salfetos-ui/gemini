/**
 * Multi-Plane Living 2D Painterly Environments & Atmosphere FX for "Казка Пирожок"
 * Studio Ghibli / Cartoon Saloon watercolor & gouache aesthetic:
 *  - Sunlit Modern Home Hallway (Scene 02) with open sunny garden door & swirling raspberry aroma ribbons
 *  - Cozy Modern Sunlit Kitchen (Scenes 01, 03, 04, 06, 07, 08, 09, 10) with multi-plane parallax:
 *      Plane 0: Painted morning sky, drifting clouds, swaying sunlit garden trees
 *      Plane 1: Wooden kitchen window, volumetric sunbeams, physically billowing sheer curtains, teacup & swaying basil
 *      Plane 2: Modern warm-cream/sage cabinetry, oak countertops, glowing baking oven, hanging herbs, steaming pie
 *      Plane 3: Foreground depth parallax table & wildflowers + grounded wooden oak stool
 *  - Celestial Sky-Blue Dreamscape (Scene 05)
 *  - Atmospheric Dust Motes, Sky-Blue Sparkles, Watercolor Paper Grain & Cyrillic Storybook Title Cards
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import {
  PALETTE,
  clamp,
  lerp,
  smoothstep,
  mulberry32,
  setInkStyle,
  paintShape,
  drawSunlitRimArc,
  getWatercolorPaperTile,
} from '../engine/painterly.mjs';
import { drawRaspberryPieOnTray } from '../rigs/momRig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_FONTS_DIR = path.resolve(__dirname, '../../../studio/public/fonts');

// Register bundled Cyrillic + Latin Cormorant Garamond & Montserrat webfonts once!
let _fontsRegistered = false;
export function ensureStorybookFonts() {
  if (_fontsRegistered) return;
  _fontsRegistered = true;
  const reg = (file, family) => {
    try {
      GlobalFonts.registerFromPath(path.join(STUDIO_FONTS_DIR, file), family);
    } catch {
      // Graceful fallback to DejaVu Serif / Sans if font file missing
    }
  };
  // Cyrillic + Latin subsets for Cormorant Garamond (700 bold, 600 semibold, 400 italic, 600 italic)
  reg('CormorantGaramond_27.woff2', 'CormorantBoldCyr');
  reg('CormorantGaramond_30.woff2', 'CormorantBoldLat');
  reg('CormorantGaramond_22.woff2', 'CormorantSemiCyr');
  reg('CormorantGaramond_25.woff2', 'CormorantSemiLat');
  reg('CormorantGaramond_7.woff2', 'CormorantItalicCyr');
  reg('CormorantGaramond_10.woff2', 'CormorantItalicLat');
  // Cyrillic + Latin subsets for Montserrat (500 medium, 600 semibold)
  reg('Montserrat_37.woff2', 'MontserratMedCyr');
  reg('Montserrat_40.woff2', 'MontserratMedLat');
  reg('Montserrat_42.woff2', 'MontserratSemiCyr');
  reg('Montserrat_45.woff2', 'MontserratSemiLat');
}

const FONT_TITLE = '"CormorantBoldCyr", "CormorantBoldLat", "DejaVu Serif", serif';
const FONT_SUBTITLE = '"CormorantItalicCyr", "CormorantItalicLat", "DejaVu Serif", serif';
const FONT_LABEL = '"MontserratSemiCyr", "MontserratSemiLat", "DejaVu Sans", sans-serif';

// Deterministic pre-baked atmosphere particle fields (fast zero-alloc per frame!)
const DUST_MOTES = (() => {
  const rng = mulberry32(202611);
  const arr = [];
  for (let i = 0; i < 56; i++) {
    arr.push({
      x: rng() * 1920,
      y: rng() * 1080,
      r: 1.8 + rng() * 4.4,
      speedX: (rng() - 0.35) * 14,
      speedY: -(6 + rng() * 14),
      phase: rng() * Math.PI * 2,
      freq: 0.9 + rng() * 1.6,
      alpha: 0.24 + rng() * 0.48,
      skyTint: rng() > 0.52,
    });
  }
  return arr;
})();

const BOKEH_ORBS = (() => {
  const rng = mulberry32(99103);
  const arr = [];
  for (let i = 0; i < 18; i++) {
    arr.push({
      x: rng() * 1920,
      y: rng() * 1080,
      r: 34 + rng() * 84,
      speedX: (rng() - 0.5) * 10,
      speedY: -(4 + rng() * 8),
      phase: rng() * Math.PI * 2,
      alpha: 0.1 + rng() * 0.16,
      isSky: rng() > 0.42,
    });
  }
  return arr;
})();

/**
 * Helper: Draw painterly drifting morning cloud cluster
 */
function drawPaintedCloud(ctx, x, y, scale, alpha = 0.88, warmTint = 0.35) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  const grad = ctx.createLinearGradient(0, -42, 0, 36);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.58, warmTint > 0.5 ? '#fff8ec' : '#f4f9ff');
  grad.addColorStop(1, warmTint > 0.5 ? '#f5dfc0' : '#d8e8f8');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(-58, 8, 32, 0, Math.PI * 2);
  ctx.arc(-22, -12, 44, 0, Math.PI * 2);
  ctx.arc(28, -6, 38, 0, Math.PI * 2);
  ctx.arc(64, 10, 28, 0, Math.PI * 2);
  ctx.arc(6, 14, 34, 0, Math.PI * 2);
  ctx.fill();

  // Warm golden sunlit top rim
  ctx.fillStyle = `rgba(255, 252, 238, ${0.42 * alpha})`;
  ctx.beginPath();
  ctx.arc(-24, -18, 32, Math.PI * 1.05, Math.PI * 1.95);
  ctx.arc(26, -12, 28, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  ctx.restore();
}

/**
 * Helper: Draw gently swaying sunlit watercolor garden tree foliage
 */
function drawSwayingGardenTrees(ctx, x, y, w, h, t, seed = 101) {
  ctx.save();
  const sway1 = Math.sin(t * 1.15 + seed) * 7;
  const sway2 = Math.sin(t * 0.85 + seed + 1.4) * 9;

  // Distant sunlit meadow hills
  const hillGrad = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
  hillGrad.addColorStop(0, '#b5d49e');
  hillGrad.addColorStop(0.55, '#8fb878');
  hillGrad.addColorStop(1, '#6f985d');
  ctx.fillStyle = hillGrad;
  ctx.beginPath();
  ctx.moveTo(x - 40, y + h);
  ctx.quadraticCurveTo(x + w * 0.28, y + h * 0.6, x + w * 0.58, y + h * 0.72);
  ctx.quadraticCurveTo(x + w * 0.82, y + h * 0.58, x + w + 40, y + h * 0.74);
  ctx.lineTo(x + w + 40, y + h);
  ctx.closePath();
  ctx.fill();

  // Soft warm tree trunks
  ctx.fillStyle = '#8b684b';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h);
  ctx.quadraticCurveTo(x + w * 0.21 + sway1 * 0.2, y + h * 0.65, x + w * 0.23 + sway1 * 0.4, y + h * 0.44);
  ctx.lineTo(x + w * 0.27 + sway1 * 0.4, y + h * 0.44);
  ctx.quadraticCurveTo(x + w * 0.25 + sway1 * 0.2, y + h * 0.65, x + w * 0.26, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.78, y + h);
  ctx.quadraticCurveTo(x + w * 0.76 + sway2 * 0.2, y + h * 0.62, x + w * 0.74 + sway2 * 0.4, y + h * 0.4);
  ctx.lineTo(x + w * 0.79 + sway2 * 0.4, y + h * 0.4);
  ctx.quadraticCurveTo(x + w * 0.8 + sway2 * 0.2, y + h * 0.62, x + w * 0.83, y + h);
  ctx.closePath();
  ctx.fill();

  // Layered lush Ghibli foliage puffs (deep -> mid -> sunlit gold-green)
  const drawCanopy = (cx, cy, rad, swayPx, palette) => {
    const puffs = [
      [-0.55, 0.2, 0.78],
      [0.52, 0.16, 0.74],
      [0, -0.22, 0.92],
      [-0.25, -0.05, 0.75],
      [0.26, 0.02, 0.72],
    ];
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = palette[layer];
      const lOffY = layer === 0 ? 10 : layer === 1 ? 0 : -11;
      const lScale = layer === 0 ? 1.05 : layer === 1 ? 0.92 : 0.72;
      for (let i = 0; i < puffs.length; i++) {
        const [px, py, pr] = puffs[i];
        const micro = Math.sin(t * 1.5 + i * 1.3 + layer) * 2.5;
        ctx.beginPath();
        ctx.arc(
          cx + px * rad + swayPx * (0.6 + layer * 0.22) + micro,
          cy + py * rad + lOffY,
          rad * pr * lScale,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  };

  drawCanopy(x + w * 0.22, y + h * 0.36, w * 0.24, sway1, ['#5d8553', '#82ad69', '#c4dc88']);
  drawCanopy(x + w * 0.78, y + h * 0.32, w * 0.27, sway2, ['#557d4d', '#7aa764', '#bdd783']);
  drawCanopy(x + w * 0.5, y + h * 0.54, w * 0.18, sway1 * 0.7, ['#689159', '#92bd75', '#d0e596']);

  // Delicate dappled golden morning leaves
  ctx.fillStyle = 'rgba(255, 245, 190, 0.45)';
  for (let i = 0; i < 9; i++) {
    const lx = x + w * (0.1 + i * 0.1) + sway1 * 0.8;
    const ly = y + h * (0.24 + (i % 3) * 0.12) + Math.sin(t * 1.8 + i) * 3;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 10, 5.5, 0.4 + Math.sin(t + i) * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Helper: Animated translucent swirling rosy-gold raspberry jam aroma ribbons!
 */
export function drawRaspberryAromaRibbons(ctx, originX, originY, t, opts = {}) {
  const { width = 920, alpha = 0.72, dir = -1 } = opts;
  ctx.save();
  ctx.lineCap = 'round';

  const ribbons = [
    { yOff: -90, amp: 44, freq: 0.008, speed: 1.55, w: 30, hue: 'rose' },
    { yOff: 10, amp: 56, freq: 0.007, speed: 1.25, w: 38, hue: 'gold' },
    { yOff: 95, amp: 38, freq: 0.009, speed: 1.8, w: 26, hue: 'berry' },
    { yOff: -35, amp: 48, freq: 0.0075, speed: 1.4, w: 22, hue: 'cream' },
  ];

  for (let r = 0; r < ribbons.length; r++) {
    const rb = ribbons[r];
    const startX = originX;
    const endX = originX + dir * width;
    const grad = ctx.createLinearGradient(startX, originY + rb.yOff, endX, originY + rb.yOff - 80);

    if (rb.hue === 'rose') {
      grad.addColorStop(0, `rgba(240, 126, 142, ${0.42 * alpha})`);
      grad.addColorStop(0.5, `rgba(255, 196, 168, ${0.34 * alpha})`);
      grad.addColorStop(1, 'rgba(255, 224, 198, 0)');
    } else if (rb.hue === 'gold') {
      grad.addColorStop(0, `rgba(255, 212, 138, ${0.45 * alpha})`);
      grad.addColorStop(0.55, `rgba(252, 166, 152, ${0.3 * alpha})`);
      grad.addColorStop(1, 'rgba(255, 232, 180, 0)');
    } else if (rb.hue === 'berry') {
      grad.addColorStop(0, `rgba(218, 86, 114, ${0.36 * alpha})`);
      grad.addColorStop(0.5, `rgba(248, 162, 156, ${0.26 * alpha})`);
      grad.addColorStop(1, 'rgba(248, 186, 178, 0)');
    } else {
      grad.addColorStop(0, `rgba(255, 250, 238, ${0.5 * alpha})`);
      grad.addColorStop(0.55, `rgba(255, 216, 186, ${0.32 * alpha})`);
      grad.addColorStop(1, 'rgba(255, 244, 224, 0)');
    }

    // Soft glowing outer wash
    ctx.beginPath();
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const px = lerp(startX, endX, u);
      const wave =
        Math.sin(u * 8.5 - t * rb.speed + r * 1.4) * rb.amp * (0.35 + u * 0.85) +
        Math.cos(u * 4.2 - t * rb.speed * 0.7 + r) * 16;
      const py = originY + rb.yOff - u * 105 + wave;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = rb.w;
    ctx.stroke();

    // Crisp luminous inner silk filament
    ctx.lineWidth = rb.w * 0.26;
    ctx.strokeStyle = `rgba(255, 248, 236, ${0.42 * alpha})`;
    ctx.stroke();
  }

  // Tiny floating rosy-gold scent sparkles riding the aroma currents!
  for (let i = 0; i < 16; i++) {
    const cycle = (t * 0.24 + i * 0.19) % 1;
    const px = lerp(originX, originX + dir * width * 0.92, cycle);
    const py =
      originY -
      40 +
      Math.sin(i * 2.7) * 90 -
      cycle * 90 +
      Math.sin(cycle * 9 - t * 1.5 + i) * 32;
    const fade = Math.sin(cycle * Math.PI);
    ctx.fillStyle = i % 2 === 0
      ? `rgba(255, 210, 152, ${fade * 0.72 * alpha})`
      : `rgba(246, 146, 162, ${fade * 0.65 * alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 2.8 + (i % 3) * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Helper: Physically billowing sheer cream kitchen curtain panel
 */
function drawBillowingCurtain(ctx, anchorX, topY, width, height, t, side = 1) {
  ctx.save();
  const sway1 = Math.sin(t * 1.45 + (side > 0 ? 0.6 : 0)) * 24;
  const sway2 = Math.sin(t * 2.1 + 1.2 + (side > 0 ? 0.5 : 0)) * 16;
  const pullIn = side * -1; // drapes subtly inward toward window edge when breeze blows!

  const innerTopX = anchorX;
  const outerTopX = anchorX + side * width;
  const innerMidX = anchorX + pullIn * 16 + sway1 * 0.65;
  const innerBotX = anchorX + pullIn * 28 + sway1 * 1.15 + sway2 * 0.45;
  const outerMidX = outerTopX + sway1 * 0.3;
  const outerBotX = outerTopX + sway1 * 0.55 + sway2 * 0.2;

  const grad = ctx.createLinearGradient(anchorX, topY, outerTopX, topY + height);
  grad.addColorStop(0, 'rgba(255, 252, 244, 0.9)');
  grad.addColorStop(0.45, 'rgba(250, 241, 224, 0.72)');
  grad.addColorStop(0.82, 'rgba(242, 228, 204, 0.56)');
  grad.addColorStop(1, 'rgba(255, 246, 226, 0.75)');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(innerTopX, topY);
      c.lineTo(outerTopX, topY);
      c.bezierCurveTo(
        outerMidX,
        topY + height * 0.36,
        outerMidX + sway2 * 0.25,
        topY + height * 0.7,
        outerBotX,
        topY + height
      );
      // Soft undulating hem catching the breeze
      c.quadraticCurveTo(
        (outerBotX + innerBotX) * 0.5,
        topY + height + 14 + Math.sin(t * 1.8) * 6,
        innerBotX,
        topY + height - 6
      );
      c.bezierCurveTo(
        innerMidX + sway2 * 0.45,
        topY + height * 0.66,
        innerMidX,
        topY + height * 0.34,
        innerTopX,
        topY
      );
      c.closePath();
    },
    {
      fill: grad,
      strokeWidth: 1.5,
      strokeColor: 'rgba(128, 98, 72, 0.52)',
      innerPassFn: (c) => {
        // Translucent sunlit vertical pleat folds
        for (let f = 1; f <= 3; f++) {
          const u = f / 4;
          const tx = lerp(innerTopX, outerTopX, u);
          const mx = lerp(innerMidX, outerMidX, u);
          const bx = lerp(innerBotX, outerBotX, u);
          c.beginPath();
          c.moveTo(tx, topY + 12);
          c.quadraticCurveTo(mx, topY + height * 0.52, bx, topY + height - 6);
          setInkStyle(c, 5.5, 'rgba(255, 252, 240, 0.38)');
          c.stroke();
          setInkStyle(c, 1.15, 'rgba(156, 128, 102, 0.34)');
          c.stroke();
        }
      },
    }
  );
  ctx.restore();
}

/**
 * Helper: Terracotta potted basil with gently swaying green leaves
 */
function drawPottedBasil(ctx, x, y, t, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const sway = Math.sin(t * 1.65) * 4.5;

  // Leaves behind rim
  const leaves = [
    [-20, -44, -0.55, 16, 9, '#5e9150'],
    [18, -46, 0.48, 17, 9.5, '#699c58'],
    [-8, -60, -0.25, 18, 10, '#7eb266'],
    [10, -58, 0.22, 16, 9, '#8bc070'],
    [0, -72, 0.05, 15, 8.5, '#a4d17c'],
    [-26, -32, -0.82, 13, 7.5, '#73a65d'],
    [26, -30, 0.78, 13, 7.5, '#7eb266'],
  ];
  for (let i = 0; i < leaves.length; i++) {
    const [lx, ly, ang, rx, ry, col] = leaves[i];
    const m = sway * (0.45 + Math.abs(ly) / 80);
    ctx.save();
    ctx.translate(lx + m, ly);
    ctx.rotate(ang + m * 0.025);
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      },
      {
        fill: col,
        strokeWidth: 1.5,
        strokeColor: PALETTE.inkDark,
      }
    );
    ctx.restore();
  }

  // Warm terracotta pot
  const potGrad = ctx.createLinearGradient(-24, -24, 24, 0);
  potGrad.addColorStop(0, '#dc8b67');
  potGrad.addColorStop(0.55, '#c4714e');
  potGrad.addColorStop(1, '#985035');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-22, -26);
      c.lineTo(22, -26);
      c.lineTo(16, 0);
      c.quadraticCurveTo(0, 4, -16, 0);
      c.closePath();
    },
    { fill: potGrad, strokeWidth: 1.85, strokeColor: PALETTE.inkDark }
  );

  // Terracotta lip rim
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(-25, -33, 50, 9, 3);
    },
    { fill: '#e19572', strokeWidth: 1.85, strokeColor: PALETTE.inkDark }
  );

  ctx.restore();
}

/**
 * Helper: Painted ceramic floral teacup on windowsill
 */
function drawCeramicTeacup(ctx, x, y, t, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Subtle warm tea steam curl
  const ph = t * 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(-8 * Math.sin(ph), -48, 8 * Math.cos(ph), -62, Math.sin(ph) * 6, -74);
  ctx.strokeStyle = 'rgba(255, 252, 245, 0.42)';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Saucer
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.ellipse(0, 0, 28, 6.5, 0, 0, Math.PI * 2);
    },
    { fill: '#f6efe2', strokeWidth: 1.7, strokeColor: PALETTE.inkDark }
  );

  // Cup handle
  ctx.beginPath();
  ctx.arc(20, -16, 9, -Math.PI * 0.45, Math.PI * 0.45);
  setInkStyle(ctx, 4.5, '#f4ece0');
  ctx.stroke();
  setInkStyle(ctx, 1.8, PALETTE.inkDark);
  ctx.stroke();

  // Cup body
  const cupGrad = ctx.createLinearGradient(-20, -28, 20, -2);
  cupGrad.addColorStop(0, '#fffdf8');
  cupGrad.addColorStop(0.6, '#f2e8d8');
  cupGrad.addColorStop(1, '#d8cab4');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-20, -28);
      c.lineTo(20, -28);
      c.bezierCurveTo(20, -8, 12, -1, 0, -1);
      c.bezierCurveTo(-12, -1, -20, -8, -20, -28);
      c.closePath();
    },
    {
      fill: cupGrad,
      strokeWidth: 1.85,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        // Delicate sky-blue & rose painted floral band
        c.fillStyle = '#79b4d9';
        c.beginPath();
        c.arc(-7, -15, 3.2, 0, Math.PI * 2);
        c.arc(8, -14, 3.0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#df8d84';
        c.beginPath();
        c.arc(0, -17, 3.5, 0, Math.PI * 2);
        c.fill();
      },
    }
  );
  ctx.restore();
}

/**
 * Helper: Grounded warm oak wooden kitchen stool (drawn behind/under seated Boy in Scene 10!)
 * Origin (x, y) is the floor contact plane beneath the stool legs.
 * Seat top sits at y - seatH * scale.
 */
export function drawWoodenStool(ctx, x, y, opts = {}) {
  const { scale = 1, seatH = 148 } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Floor contact shadow
  const shGrad = ctx.createRadialGradient(0, 4, 8, 0, 4, 72);
  shGrad.addColorStop(0, 'rgba(96, 68, 46, 0.28)');
  shGrad.addColorStop(1, 'rgba(96, 68, 46, 0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(0, 4, 72, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  const legGrad = ctx.createLinearGradient(-45, -seatH, 45, 0);
  legGrad.addColorStop(0, '#d8aa76');
  legGrad.addColorStop(0.55, '#ba8854');
  legGrad.addColorStop(1, '#8f6239');

  // Back two legs (slightly darker)
  for (const side of [-1, 1]) {
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(side * 24, -seatH + 8);
        c.lineTo(side * 34, -seatH + 8);
        c.lineTo(side * 46, -6);
        c.lineTo(side * 36, -6);
        c.closePath();
      },
      { fill: '#9f7045', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
    );
  }

  // Horizontal wooden rung brace
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(-48, -seatH * 0.36, 96, 11, 4);
    },
    { fill: '#b3814e', strokeWidth: 1.9, strokeColor: PALETTE.inkDark }
  );

  // Front two splayed oak legs
  for (const side of [-1, 1]) {
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(side * 30, -seatH + 10);
        c.lineTo(side * 42, -seatH + 10);
        c.lineTo(side * 58, 2);
        c.lineTo(side * 45, 2);
        c.closePath();
      },
      { fill: legGrad, strokeWidth: 2.1, strokeColor: PALETTE.inkDark }
    );
  }

  // Rounded thick oak seat cushion
  const seatGrad = ctx.createLinearGradient(-64, -seatH - 12, 64, -seatH + 16);
  seatGrad.addColorStop(0, '#ecc492');
  seatGrad.addColorStop(0.5, '#d5a36e');
  seatGrad.addColorStop(1, '#b17f4d');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(-64, -seatH - 6, 128, 22, 11);
    },
    {
      fill: seatGrad,
      strokeWidth: 2.2,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: -2, y: -2 },
      innerPassFn: (c) => {
        setInkStyle(c, 1.15, 'rgba(116, 76, 42, 0.38)');
        c.beginPath();
        c.moveTo(-48, -seatH + 2);
        c.quadraticCurveTo(0, -seatH - 2, 46, -seatH + 3);
        c.moveTo(-36, -seatH + 9);
        c.quadraticCurveTo(8, -seatH + 6, 42, -seatH + 10);
        c.stroke();
      },
    }
  );

  ctx.restore();
}

/**
 * =========================================================================
 * ENVIRONMENT 1: SUNLIT MODERN HOME HALLWAY (Scene 02)
 * Multi-plane parallax: Open sunny front door + garden -> oak floorboards ->
 * framed botanical art + potted monstera -> glowing kitchen doorway + aroma!
 * =========================================================================
 */
export function drawSunlitHallway(ctx, t, cam = {}) {
  const { panX = 0, panY = 0, zoom = 1 } = cam;
  const W = 1920;
  const H = 1080;

  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);
  ctx.scale(zoom, zoom);
  ctx.translate(-W * 0.5 - panX, -H * 0.5 - panY);

  // --- PLANE 0: SUNLIT MORNING GARDEN OUTSIDE OPEN FRONT DOOR (LEFT) ---
  ctx.save();
  const doorX = 76;
  const doorY = 148;
  const doorW = 340;
  const doorH = 656;

  // Sky visible through open front door
  const skyGrad = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH * 0.65);
  skyGrad.addColorStop(0, '#9bd4f7');
  skyGrad.addColorStop(0.55, '#dff3ff');
  skyGrad.addColorStop(1, '#fff2cf');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(doorX - 30, doorY - 20, doorW + 60, doorH + 40);

  // Drifting clouds outside doorway (0.3x parallax)
  ctx.save();
  ctx.beginPath();
  ctx.rect(doorX, doorY, doorW, doorH);
  ctx.clip();
  const cloudShift = ((t * 14) % 420) - 80;
  drawPaintedCloud(ctx, doorX + cloudShift + panX * 0.45, doorY + 115, 0.72, 0.9, 0.55);
  drawPaintedCloud(ctx, doorX + ((cloudShift + 220) % 420) - 60 + panX * 0.45, doorY + 178, 0.52, 0.8, 0.4);
  // Sunlit swaying green garden trees & sunlit stone porch
  drawSwayingGardenTrees(ctx, doorX - 20 + panX * 0.35, doorY + 140, doorW + 40, doorH - 120, t, 31);
  // Warm morning sun glare at top of open door
  const glare = ctx.createRadialGradient(doorX + 160, doorY + 90, 20, doorX + 160, doorY + 140, 280);
  glare.addColorStop(0, 'rgba(255, 250, 224, 0.72)');
  glare.addColorStop(1, 'rgba(255, 240, 194, 0)');
  ctx.fillStyle = glare;
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.restore();
  ctx.restore();

  // --- PLANE 1: WARM CREAM MODERN HALLWAY WALLS & OAK FLOORBOARDS ---
  const wallGrad = ctx.createLinearGradient(0, 0, W, 760);
  wallGrad.addColorStop(0, '#fcf3e0');
  wallGrad.addColorStop(0.55, '#f6e7cf');
  wallGrad.addColorStop(1, '#ecd6b6');

  // Paint wall around the open front door cutout & kitchen doorway cutout
  ctx.fillStyle = wallGrad;
  ctx.fillRect(-160, -120, doorX + 160, H + 240); // far left margin
  ctx.fillRect(doorX, -120, W + 320, doorY + 120); // above door
  ctx.fillRect(doorX + doorW, doorY, W - (doorX + doorW) + 220, 680); // main middle/right wall

  // Subtle modern vertical wainscoting paneling on lower hallway wall
  const wainscotY = 580;
  const wainGrad = ctx.createLinearGradient(0, wainscotY, 0, 815);
  wainGrad.addColorStop(0, '#efe2ce');
  wainGrad.addColorStop(1, '#dfd0b8');
  ctx.fillStyle = wainGrad;
  ctx.fillRect(doorX + doorW, wainscotY, 960, 235);
  setInkStyle(ctx, 2.2, 'rgba(116, 86, 62, 0.45)');
  ctx.beginPath();
  ctx.moveTo(doorX + doorW, wainscotY);
  ctx.lineTo(1375, wainscotY);
  ctx.stroke();

  // Warm white-oak perspective floorboards
  const floorY = 800;
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, H + 120);
  floorGrad.addColorStop(0, '#d8aa74');
  floorGrad.addColorStop(0.45, '#c8955d');
  floorGrad.addColorStop(1, '#a97441');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(-160, floorY, W + 360, H - floorY + 140);

  // Floorboard planks & warm wood grain lines
  setInkStyle(ctx, 1.5, 'rgba(92, 58, 32, 0.34)');
  for (let row = 0; row < 6; row++) {
    const py = floorY + row * 48 + row * row * 4;
    ctx.beginPath();
    ctx.moveTo(-160, py);
    ctx.lineTo(W + 200, py);
    ctx.stroke();
    // Staggered plank seams
    for (let s = 0; s < 7; s++) {
      const sx = -80 + s * 320 + (row % 2) * 140;
      ctx.beginPath();
      ctx.moveTo(sx, py);
      ctx.lineTo(sx - 24, py + 48 + (row + 1) * 4);
      ctx.stroke();
    }
  }

  // Crisp white baseboard along hallway wall
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(doorX + doorW, floorY - 26, 956, 28);
    },
    { fill: '#fbf6ec', strokeWidth: 1.8, strokeColor: PALETTE.inkMid }
  );

  // --- OPEN WHITE FRONT DOOR FRAME & SWUNG-OPEN DOOR PANEL ---
  // Clean white door casing
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(doorX - 24, doorY - 24, 24, doorH + 28);
      c.rect(doorX + doorW, doorY - 24, 24, doorH + 28);
      c.rect(doorX - 24, doorY - 24, doorW + 48, 24);
    },
    { fill: '#fcf8ef', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
  );

  // Swung-open modern paneled white front door angled inside on left edge
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(doorX, doorY);
      c.lineTo(doorX + 108, doorY + 26);
      c.lineTo(doorX + 108, doorY + doorH + 22);
      c.lineTo(doorX, doorY + doorH);
      c.closePath();
    },
    {
      fill: '#f7f1e6',
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        setInkStyle(c, 1.4, 'rgba(130, 104, 80, 0.48)');
        c.strokeRect(doorX + 18, doorY + 62, 68, 220);
        c.strokeRect(doorX + 18, doorY + 322, 68, 265);
        // Brass handle
        c.fillStyle = '#d4a659';
        c.beginPath();
        c.arc(doorX + 86, doorY + 345, 7, 0, Math.PI * 2);
        c.fill();
        setInkStyle(c, 1.3, PALETTE.inkDark);
        c.stroke();
      },
    }
  );

  // --- FRAMED BOTANICAL LEAF PRINTS ON HALLWAY WALL ---
  const drawBotanicalFrame = (fx, fy, fw, fh, variant) => {
    // Soft frame drop shadow
    ctx.fillStyle = 'rgba(110, 78, 52, 0.14)';
    ctx.beginPath();
    ctx.roundRect(fx + 6, fy + 8, fw, fh, 4);
    ctx.fill();

    // Warm oak outer frame
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.roundRect(fx, fy, fw, fh, 4);
      },
      { fill: '#c89762', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
    );
    // Cream mat
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.rect(fx + 12, fy + 12, fw - 24, fh - 24);
      },
      { fill: '#fbf7ee', strokeWidth: 1.2, strokeColor: 'rgba(120, 90, 64, 0.45)' }
    );
    // Botanical painted watercolor sprig inside
    ctx.save();
    const cx = fx + fw * 0.5;
    const cy = fy + fh * 0.56;
    setInkStyle(ctx, 2.0, '#6a8758');
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 56);
    ctx.quadraticCurveTo(cx + 6, cy, cx + (variant === 0 ? -8 : 10), cy - 52);
    ctx.stroke();

    const leafPos = [
      [-18, 20, -0.7],
      [18, 8, 0.65],
      [-20, -14, -0.55],
      [16, -24, 0.55],
      [0, -48, 0.05],
    ];
    for (const [lx, ly, ang] of leafPos) {
      ctx.save();
      ctx.translate(cx + lx, cy + ly);
      ctx.rotate(ang);
      ctx.fillStyle = variant === 0 ? '#87ab71' : '#96b67c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (variant === 1) {
      // Little painted raspberry berries!
      ctx.fillStyle = '#d3566d';
      ctx.beginPath();
      ctx.arc(cx - 10, cy + 28, 6, 0, Math.PI * 2);
      ctx.arc(cx + 12, cy - 4, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  drawBotanicalFrame(545, 228, 178, 224, 0);
  drawBotanicalFrame(776, 248, 162, 202, 1);

  // --- COZY CONSOLE BENCH & POTTED MONSTERA / FICUS PLANT ---
  // Modern oak entryway console table under frames
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(535, 622, 340, 22, 5);
    },
    { fill: '#d6a46e', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
  );
  for (const lx of [558, 840]) {
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.rect(lx, 644, 15, 158);
      },
      { fill: '#be8c57', strokeWidth: 1.9, strokeColor: PALETTE.inkDark }
    );
  }
  // Small woven basket on floor under console
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(625, 720, 118, 80, 14);
    },
    { fill: '#d8b585', strokeWidth: 1.9, strokeColor: PALETTE.inkDark }
  );

  // Potted green monstera/ficus beside the kitchen doorway
  ctx.save();
  const plantX = 1230;
  const plantY = 804;
  const pSway = Math.sin(t * 1.15) * 4;
  // Ceramic cream planter
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(plantX - 42, plantY - 92);
      c.lineTo(plantX + 42, plantY - 92);
      c.lineTo(plantX + 32, plantY);
      c.quadraticCurveTo(plantX, plantY + 8, plantX - 32, plantY);
      c.closePath();
    },
    { fill: '#f3eadb', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
  );
  // Broad swaying glossy green botanical leaves
  const stems = [
    [-46, -185, -0.65, 38, 24, '#609255'],
    [42, -192, 0.58, 40, 25, '#6b9d5e'],
    [-16, -245, -0.22, 42, 26, '#7cb06a'],
    [22, -238, 0.28, 36, 22, '#88bb73'],
    [-56, -138, -0.9, 32, 20, '#5a8a50'],
    [52, -142, 0.85, 32, 20, '#72a462'],
  ];
  for (let i = 0; i < stems.length; i++) {
    const [sx, sy, ang, rx, ry, col] = stems[i];
    const sw = pSway * (0.6 + i * 0.1);
    setInkStyle(ctx, 3.0, '#4f7644');
    ctx.beginPath();
    ctx.moveTo(plantX, plantY - 88);
    ctx.quadraticCurveTo(plantX + sx * 0.5, plantY + sy * 0.5, plantX + sx + sw, plantY + sy);
    ctx.stroke();

    ctx.save();
    ctx.translate(plantX + sx + sw, plantY + sy);
    ctx.rotate(ang + sw * 0.012);
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      },
      { fill: col, strokeWidth: 1.75, strokeColor: PALETTE.inkDark }
    );
    ctx.restore();
  }
  ctx.restore();

  // --- PLANE 2: WIDE OPEN GLOWING KITCHEN DOORWAY ON RIGHT ---
  const kDoorX = 1385;
  const kDoorY = 128;
  const kDoorW = 470;
  const kDoorH = 676;

  // Warm golden sunlit interior glow visible through the kitchen archway!
  ctx.save();
  ctx.beginPath();
  ctx.rect(kDoorX, kDoorY, kDoorW, kDoorH);
  ctx.clip();

  const kGlow = ctx.createRadialGradient(kDoorX + 260, kDoorY + 340, 30, kDoorX + 240, kDoorY + 340, 460);
  kGlow.addColorStop(0, '#fff5d1');
  kGlow.addColorStop(0.5, '#fde2aa');
  kGlow.addColorStop(1, '#ecc086');
  ctx.fillStyle = kGlow;
  ctx.fillRect(kDoorX, kDoorY, kDoorW, kDoorH);

  // Soft hint of cozy modern cabinetry & warm flickering oven glow inside kitchen!
  ctx.fillStyle = '#e7decb';
  ctx.fillRect(kDoorX + 120, kDoorY + 390, 350, 290);
  ctx.fillStyle = '#cf9e68';
  ctx.fillRect(kDoorX + 112, kDoorY + 382, 360, 22);
  // Warm glowing oven door inside kitchen
  const ovenPulse = 0.8 + Math.sin(t * 2.8) * 0.14;
  ctx.fillStyle = '#524943';
  ctx.fillRect(kDoorX + 180, kDoorY + 432, 165, 148);
  const ovenWin = ctx.createRadialGradient(kDoorX + 262, kDoorY + 506, 10, kDoorX + 262, kDoorY + 506, 76);
  ovenWin.addColorStop(0, `rgba(255, 222, 128, ${0.95 * ovenPulse})`);
  ovenWin.addColorStop(0.65, `rgba(242, 144, 62, ${0.85 * ovenPulse})`);
  ovenWin.addColorStop(1, 'rgba(166, 72, 28, 0.9)');
  ctx.fillStyle = ovenWin;
  ctx.fillRect(kDoorX + 202, kDoorY + 454, 122, 92);
  ctx.restore();

  // Crisp oak-trimmed kitchen doorway casing
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(kDoorX - 24, kDoorY - 22, 24, kDoorH + 26);
      c.rect(kDoorX - 24, kDoorY - 22, kDoorW + 64, 24);
    },
    { fill: '#fbf6ec', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
  );

  // --- SUNBEAM PATCHES ON OAK FLOORBOARDS FROM OPEN FRONT DOOR ---
  ctx.save();
  const beamGrad = ctx.createLinearGradient(doorX + 80, doorY + 40, doorX + 760, H);
  beamGrad.addColorStop(0, 'rgba(255, 248, 212, 0.42)');
  beamGrad.addColorStop(0.55, 'rgba(255, 234, 174, 0.22)');
  beamGrad.addColorStop(1, 'rgba(255, 234, 174, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(doorX + 100, doorY);
  ctx.lineTo(doorX + doorW, doorY);
  ctx.lineTo(doorX + doorW + 460, H + 40);
  ctx.lineTo(doorX + 90, H + 40);
  ctx.closePath();
  ctx.fill();

  // Warm golden sunlit rectangle cast directly onto the wooden floorboards
  ctx.fillStyle = 'rgba(255, 244, 200, 0.34)';
  ctx.beginPath();
  ctx.moveTo(doorX + 120, floorY + 12);
  ctx.lineTo(doorX + doorW + 90, floorY + 12);
  ctx.lineTo(doorX + doorW + 310, H - 18);
  ctx.lineTo(doorX + 250, H - 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- ANIMATED SWIRLING ROSY-GOLD RASPBERRY AROMA RIBBONS DRIFTING OUT OF KITCHEN! ---
  drawRaspberryAromaRibbons(ctx, kDoorX + 120, 490, t, { width: 1080, alpha: 0.85, dir: -1 });

  ctx.restore();
}

/**
 * Pre-baked static kitchen interior architectural canvas (with transparent window aperture!)
 * Cuts per-frame CPU time >50% with ZERO visual compromise!
 */
let _kitchenStaticCanvas = null;
const KITCHEN_PAD_X = 240;
const KITCHEN_PAD_Y = 180;
const KITCHEN_CANVAS_W = 1920 + KITCHEN_PAD_X * 2;
const KITCHEN_CANVAS_H = 1080 + KITCHEN_PAD_Y * 2;

function getKitchenStaticLayer(winX, winY, winW, winH, sillY) {
  if (_kitchenStaticCanvas) return _kitchenStaticCanvas;

  const can = createCanvas(KITCHEN_CANVAS_W, KITCHEN_CANVAS_H);
  const ctx = can.getContext('2d');
  const W = 1920;
  const H = 1080;

  ctx.save();
  ctx.translate(KITCHEN_PAD_X, KITCHEN_PAD_Y);

  // Warm cream plaster kitchen walls (built cleanly around transparent window opening!)
  const wallGrad = ctx.createLinearGradient(0, 0, W, 760);
  wallGrad.addColorStop(0, '#f5e7cf');
  wallGrad.addColorStop(0.52, '#faf0de');
  wallGrad.addColorStop(1, '#f4e2c5');

  ctx.fillStyle = wallGrad;
  ctx.fillRect(-KITCHEN_PAD_X, -KITCHEN_PAD_Y, winX + KITCHEN_PAD_X, H + KITCHEN_PAD_Y * 2); // left of window
  ctx.fillRect(winX, -KITCHEN_PAD_Y, winW + KITCHEN_PAD_X + 200, winY + KITCHEN_PAD_Y); // above window
  ctx.fillRect(winX + winW, winY, W - (winX + winW) + KITCHEN_PAD_X, H + KITCHEN_PAD_Y); // right of window
  ctx.fillRect(winX, sillY, winW + 60, H - sillY + KITCHEN_PAD_Y); // below window

  // Subtle cream ceramic subway backsplash tiles above counter
  const tileTop = 438;
  const tileBot = 656;
  ctx.fillStyle = '#fbf6eb';
  ctx.fillRect(42, tileTop, 1085, tileBot - tileTop);
  setInkStyle(ctx, 1.0, 'rgba(176, 152, 126, 0.34)');
  for (let ty = tileTop; ty <= tileBot; ty += 36) {
    ctx.beginPath();
    ctx.moveTo(42, ty);
    ctx.lineTo(1127, ty);
    ctx.stroke();
    const offset = ((ty - tileTop) / 36) % 2 === 0 ? 0 : 42;
    for (let tx = 42 + offset; tx < 1127; tx += 84) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx, Math.min(tileBot, ty + 36));
      ctx.stroke();
    }
  }

  // Warm oak wooden kitchen floorboards
  const floorY = 852;
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, H + 180);
  floorGrad.addColorStop(0, '#d6a874');
  floorGrad.addColorStop(0.45, '#c4915a');
  floorGrad.addColorStop(1, '#a3703f');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(-KITCHEN_PAD_X, floorY, W + KITCHEN_PAD_X * 2, H - floorY + KITCHEN_PAD_Y);

  setInkStyle(ctx, 1.4, 'rgba(92, 58, 32, 0.32)');
  for (let row = 0; row < 5; row++) {
    const py = floorY + row * 48 + row * row * 4;
    ctx.beginPath();
    ctx.moveTo(-KITCHEN_PAD_X, py);
    ctx.lineTo(W + KITCHEN_PAD_X, py);
    ctx.stroke();
  }

  // Left upper modern sage-cream cabinet
  const cabGrad = ctx.createLinearGradient(60, 40, 60, 380);
  cabGrad.addColorStop(0, '#ede7d8');
  cabGrad.addColorStop(1, '#ddd4c1');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(52, 32, 228, 344, 5);
    },
    {
      fill: cabGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        setInkStyle(c, 1.35, 'rgba(116, 94, 72, 0.45)');
        c.strokeRect(72, 54, 188, 300);
        c.fillStyle = '#c89b52';
        c.fillRect(236, 286, 8, 42);
      },
    }
  );

  // Sleek modern matte-stainless range hood above built-in oven
  const hoodGrad = ctx.createLinearGradient(320, 40, 610, 310);
  hoodGrad.addColorStop(0, '#ebe7e1');
  hoodGrad.addColorStop(0.5, '#d7d1c9');
  hoodGrad.addColorStop(1, '#bab2a7');
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(410, -40);
      c.lineTo(548, -40);
      c.lineTo(548, 194);
      c.lineTo(632, 290);
      c.lineTo(326, 290);
      c.lineTo(410, 194);
      c.closePath();
    },
    {
      fill: hoodGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        const taskGlow = c.createLinearGradient(326, 274, 326, 290);
        taskGlow.addColorStop(0, 'rgba(255, 240, 188, 0)');
        taskGlow.addColorStop(1, 'rgba(255, 232, 162, 0.55)');
        c.fillStyle = taskGlow;
        c.fillRect(326, 270, 306, 20);
      },
    }
  );

  // Floating warm oak wall shelf (raised cleanly to y=218 for generous Mom headroom!)
  const shelfY = 218;
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(692, shelfY, 392, 20, 4);
    },
    { fill: '#cf9d66', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
  );
  // Ceramic flour canister, ruby raspberry jam jar & sage pitcher on oak shelf
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(722, shelfY - 68, 54, 68, 10);
    },
    { fill: '#fbf6ec', strokeWidth: 1.8, strokeColor: PALETTE.inkDark }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(796, shelfY - 54, 48, 54, 12);
    },
    {
      fill: '#c93c57',
      strokeWidth: 1.8,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        c.fillStyle = '#faf3e4';
        c.fillRect(802, shelfY - 38, 36, 22);
      },
    }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(793, shelfY - 63, 54, 11, 4);
    },
    { fill: '#e6c58b', strokeWidth: 1.6, strokeColor: PALETTE.inkDark }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(872, shelfY - 80, 56, 80, 18);
    },
    { fill: '#d6e3df', strokeWidth: 1.8, strokeColor: PALETTE.inkDark }
  );

  // Hanging herb rail bar (swaying herb pots rendered live each frame!)
  setInkStyle(ctx, 2.2, '#5f534a');
  ctx.beginPath();
  ctx.moveTo(724, shelfY + 42);
  ctx.lineTo(1056, shelfY + 42);
  ctx.stroke();

  // Lower modern cream-sage cabinetry bank
  const lowerCabGrad = ctx.createLinearGradient(0, 650, 0, floorY);
  lowerCabGrad.addColorStop(0, '#ece5d6');
  lowerCabGrad.addColorStop(1, '#d8ceb9');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(42, 652, 1098, floorY - 652);
    },
    { fill: lowerCabGrad, strokeWidth: 2.1, strokeColor: PALETTE.inkDark }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(1140, 652, 740, floorY - 652);
    },
    { fill: '#e5ddcd', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
  );

  const doors = [
    [66, 676, 224, 152],
    [674, 676, 206, 152],
    [896, 676, 218, 152],
    [1168, 676, 210, 152],
    [1396, 676, 210, 152],
    [1624, 676, 210, 152],
  ];
  for (const [dx, dy, dw, dh] of doors) {
    setInkStyle(ctx, 1.5, 'rgba(116, 94, 72, 0.48)');
    ctx.strokeRect(dx, dy, dw, dh);
    ctx.fillStyle = '#c89a54';
    ctx.fillRect(dx + dw * 0.5 - 22, dy + 16, 44, 6);
  }

  // Oven chassis & stainless handle bar
  const ovenX = 336;
  const ovenY = 668;
  const ovenW = 296;
  const ovenH = 182;
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(ovenX, ovenY, ovenW, ovenH, 6);
    },
    { fill: '#4e4640', strokeWidth: 2.2, strokeColor: PALETTE.inkDark }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(ovenX + 34, ovenY + 16, ovenW - 68, 10, 5);
    },
    { fill: '#ded9d1', strokeWidth: 1.5, strokeColor: PALETTE.inkDark }
  );

  // Continuous warm oak wood countertop
  const counterGrad = ctx.createLinearGradient(0, 628, 0, 662);
  counterGrad.addColorStop(0, '#e9be89');
  counterGrad.addColorStop(0.55, '#d09d66');
  counterGrad.addColorStop(1, '#af7d49');
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(30, 628, 1862, 30, 5);
    },
    {
      fill: counterGrad,
      strokeWidth: 2.1,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: 0, y: -2 },
    }
  );

  // Wooden cutting board & copper kettle
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(108, 616, 136, 14, 5);
    },
    { fill: '#c8925a', strokeWidth: 1.7, strokeColor: PALETTE.inkDark }
  );
  ctx.save();
  ctx.translate(425, 628);
  ctx.beginPath();
  ctx.arc(0, -44, 34, Math.PI * 1.05, Math.PI * 1.95);
  setInkStyle(ctx, 5.5, '#5b4334');
  ctx.stroke();
  const kettleGrad = ctx.createRadialGradient(-14, -34, 6, 0, -24, 42);
  kettleGrad.addColorStop(0, '#f4b583');
  kettleGrad.addColorStop(0.55, '#cc7848');
  kettleGrad.addColorStop(1, '#8c4928');
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-34, 0);
      c.bezierCurveTo(-40, -34, -22, -52, 0, -52);
      c.bezierCurveTo(22, -52, 40, -34, 34, 0);
      c.closePath();
    },
    { fill: kettleGrad, strokeWidth: 1.9, strokeColor: PALETTE.inkDark }
  );
  ctx.restore();

  // Window mullions, warm-oak outer casing, sunlit windowsill & brass curtain rod
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(winX + winW * 0.5 - 8, winY, 16, winH);
      c.rect(winX, winY + winH * 0.44 - 7, winW, 14);
    },
    { fill: '#f3e7d5', strokeWidth: 1.6, strokeColor: PALETTE.inkMid }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.rect(winX - 24, winY - 24, 24, winH + 24);
      c.rect(winX + winW, winY - 24, 24, winH + 24);
      c.rect(winX - 24, winY - 24, winW + 48, 24);
    },
    { fill: '#eeddc4', strokeWidth: 2.1, strokeColor: PALETTE.inkDark }
  );
  const sillGrad = ctx.createLinearGradient(winX - 36, sillY - 4, winX - 36, sillY + 30);
  sillGrad.addColorStop(0, '#f4d29e');
  sillGrad.addColorStop(0.5, '#d6a46d');
  sillGrad.addColorStop(1, '#b17f4d');
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(winX - 38, sillY - 4, winW + 76, 30, 5);
    },
    {
      fill: sillGrad,
      strokeWidth: 2.1,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: 0, y: -2.5 },
    }
  );
  setInkStyle(ctx, 6.0, '#7c624b');
  ctx.beginPath();
  ctx.moveTo(winX - 74, winY - 42);
  ctx.lineTo(winX + winW + 74, winY - 42);
  ctx.stroke();
  ctx.fillStyle = '#c89b56';
  for (const fx of [winX - 78, winX + winW + 78]) {
    ctx.beginPath();
    ctx.arc(fx, winY - 42, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  _kitchenStaticCanvas = can;
  return can;
}

/**
 * =========================================================================
 * ENVIRONMENT 2: COZY MODERN SUNLIT KITCHEN (Scenes 01, 03, 04, 06, 07, 08, 09, 10)
 * =========================================================================
 */
export function drawModernKitchen(ctx, t, cam = {}, opts = {}) {
  const { panX = 0, panY = 0, zoom = 1 } = cam;
  const {
    ovenGlow = 0.85,
    pieInsideOven = true,
    pieOnCounter = false,
    pieCounterX = 605,
    pieCounterY = 622,
    showForegroundTable = true,
    windowGlowBoost = 0,
    celestialSkyTint = 0,
  } = opts;

  const W = 1920;
  const H = 1080;

  // Canonical Kitchen Window Geometry (right half of kitchen — Dove perches on sillY = 530!)
  const winX = 1155;
  const winY = 102;
  const winW = 635;
  const winH = 428;
  const sillY = winY + winH; // 530

  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);
  ctx.scale(zoom, zoom);
  ctx.translate(-W * 0.5 - panX, -H * 0.5 - panY);

  // =========================================================================
  // PLANE 0: FAR EXTERIOR (MORNING SKY, DRIFTING CLOUDS, SWAYING GARDEN TREES)
  // =========================================================================
  ctx.save();
  ctx.beginPath();
  ctx.rect(winX - 20, winY - 20, winW + 40, winH + 40);
  ctx.clip();

  const skyGrad = ctx.createLinearGradient(winX, winY, winX, sillY);
  skyGrad.addColorStop(0, celestialSkyTint > 0.2 ? '#6ec4f7' : '#85ccf5');
  skyGrad.addColorStop(0.52, celestialSkyTint > 0.2 ? '#c4ecff' : '#d8f1ff');
  skyGrad.addColorStop(1, '#fff3cf');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(winX - 20, winY - 20, winW + 40, winH + 40);

  const extShiftX = panX * 0.42;
  const extShiftY = panY * 0.35;

  const c1 = ((t * 11) % (winW + 260)) - 130;
  const c2 = ((t * 7.5 + 320) % (winW + 260)) - 130;
  drawPaintedCloud(ctx, winX + c1 + extShiftX, winY + 95 + extShiftY, 0.88, 0.9, 0.48);
  drawPaintedCloud(ctx, winX + c2 + extShiftX, winY + 158 + extShiftY, 0.66, 0.82, 0.35);

  drawSwayingGardenTrees(ctx, winX - 30 + extShiftX * 0.85, winY + 115 + extShiftY * 0.7, winW + 60, winH - 95, t, 73);

  const sunGlow = ctx.createRadialGradient(
    winX + winW * 0.62,
    winY + winH * 0.28,
    18,
    winX + winW * 0.62,
    winY + winH * 0.28,
    360
  );
  sunGlow.addColorStop(0, `rgba(255, 252, 228, ${0.72 + windowGlowBoost * 0.22})`);
  sunGlow.addColorStop(0.5, `rgba(255, 238, 184, ${0.32 + windowGlowBoost * 0.18})`);
  sunGlow.addColorStop(1, 'rgba(255, 238, 184, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(winX - 20, winY - 20, winW + 40, winH + 40);
  ctx.restore();

  // =========================================================================
  // PLANE 2: CACHED MODERN KITCHEN INTERIOR + LIVE ANIMATED ELEMENTS!
  // =========================================================================
  const staticPlate = getKitchenStaticLayer(winX, winY, winW, winH, sillY);
  ctx.drawImage(staticPlate, -KITCHEN_PAD_X, -KITCHEN_PAD_Y);

  // Live swaying hanging 3-pot herb rack (raised to match shelfY = 218!)
  const shelfY = 218;
  for (let h = 0; h < 3; h++) {
    const hx = 780 + h * 112;
    const swayH = Math.sin(t * 1.45 + h * 1.3) * 3.5;
    setInkStyle(ctx, 1.8, '#5f534a');
    ctx.beginPath();
    ctx.moveTo(hx, shelfY + 42);
    ctx.lineTo(hx + swayH * 0.4, shelfY + 64);
    ctx.stroke();
    ctx.save();
    ctx.translate(hx + swayH, shelfY + 112);
    drawPottedBasil(ctx, 0, 0, t + h * 1.1, 0.56);
    ctx.restore();
  }

  // Live animated flickering golden baking oven glow!
  const ovenX = 336;
  const ovenY = 668;
  const ovenW = 296;
  const flicker = 0.88 + Math.sin(t * 4.2) * 0.07 + Math.sin(t * 7.6) * 0.05;
  const gStrength = clamp(ovenGlow * flicker, 0, 1);
  const ovenWinGrad = ctx.createRadialGradient(
    ovenX + ovenW * 0.5,
    ovenY + 104,
    12,
    ovenX + ovenW * 0.5,
    ovenY + 104,
    115
  );
  ovenWinGrad.addColorStop(0, `rgba(255, 232, 146, ${0.95 * gStrength})`);
  ovenWinGrad.addColorStop(0.55, `rgba(244, 154, 66, ${0.86 * gStrength})`);
  ovenWinGrad.addColorStop(1, `rgba(148, 66, 30, ${0.92 * gStrength})`);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(ovenX + 32, ovenY + 42, ovenW - 64, 118, 6);
    },
    {
      fill: gStrength > 0.05 ? ovenWinGrad : '#35302d',
      strokeWidth: 1.8,
      strokeColor: '#2d2622',
      innerPassFn: (c) => {
        if (gStrength > 0.35 && pieInsideOven && !pieOnCounter) {
          c.fillStyle = 'rgba(136, 58, 22, 0.58)';
          c.beginPath();
          c.ellipse(ovenX + ovenW * 0.5, ovenY + 124, 62, 18, 0, 0, Math.PI * 2);
          c.fill();
        }
        setInkStyle(c, 2.0, 'rgba(72, 42, 24, 0.55)');
        c.beginPath();
        c.moveTo(ovenX + 34, ovenY + 134);
        c.lineTo(ovenX + ovenW - 34, ovenY + 134);
        c.stroke();
      },
    }
  );

  if (gStrength > 0.15) {
    const spill = ctx.createRadialGradient(
      ovenX + ovenW * 0.5,
      ovenY + 120,
      20,
      ovenX + ovenW * 0.5,
      ovenY + 170,
      240
    );
    spill.addColorStop(0, `rgba(255, 198, 108, ${0.24 * gStrength})`);
    spill.addColorStop(1, 'rgba(255, 198, 108, 0)');
    ctx.fillStyle = spill;
    ctx.beginPath();
    ctx.arc(ovenX + ovenW * 0.5, ovenY + 150, 240, 0, Math.PI * 2);
    ctx.fill();
  }

  // Optional freshly baked steaming golden raspberry lattice pie resting cleanly on the oak counter!
  if (pieOnCounter) {
    drawRaspberryPieOnTray(ctx, pieCounterX, pieCounterY, t * 2.1, 1.24);
  }

  // Physically billowing translucent sheer cream curtains & live windowsill teacup + swaying basil
  drawBillowingCurtain(ctx, winX + 78, winY - 38, 148, winH + 92, t, -1);
  drawBillowingCurtain(ctx, winX + winW - 72, winY - 38, 148, winH + 92, t + 0.5, 1);
  drawCeramicTeacup(ctx, winX + 86, sillY - 4, t, 1.05);
  drawPottedBasil(ctx, winX + winW - 66, sillY - 4, t, 1.02);

  // Volumetric golden morning sunbeams streaming through the window
  ctx.save();
  const beamBreath = 0.85 + Math.sin(t * 0.9) * 0.12 + windowGlowBoost * 0.35;
  const beamGrad = ctx.createLinearGradient(winX + winW * 0.6, winY + 40, winX - 620, H);
  beamGrad.addColorStop(0, `rgba(255, 248, 210, ${0.34 * beamBreath})`);
  beamGrad.addColorStop(0.45, `rgba(255, 236, 178, ${0.18 * beamBreath})`);
  beamGrad.addColorStop(1, 'rgba(255, 236, 178, 0)');
  ctx.fillStyle = beamGrad;

  ctx.beginPath();
  ctx.moveTo(winX + 40, winY + 12);
  ctx.lineTo(winX + winW - 20, winY + 12);
  ctx.lineTo(winX + winW - 580, H + 80);
  ctx.lineTo(winX - 720, H + 80);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(winX + 180, winY + 18);
  ctx.lineTo(winX + 440, winY + 18);
  ctx.lineTo(winX - 180, H + 80);
  ctx.lineTo(winX - 460, H + 80);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // =========================================================================
  // PLANE 3: OPTIONAL FOREGROUND PARALLAX CORNER TABLE & WILDFLOWERS (1.25x)
  // =========================================================================
  if (showForegroundTable) {
    ctx.save();
    const fgX = -panX * 1.25;
    const fgY = -panY * 1.25;
    ctx.translate(fgX, fgY);

    ctx.globalAlpha = 0.92;
    const tblGrad = ctx.createLinearGradient(0, 965, 360, 1080);
    tblGrad.addColorStop(0, '#c69058');
    tblGrad.addColorStop(1, '#8c5d33');
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(-60, 990);
        c.quadraticCurveTo(180, 965, 355, 1018);
        c.lineTo(395, 1120);
        c.lineTo(-60, 1120);
        c.closePath();
      },
      { fill: tblGrad, strokeWidth: 2.2, strokeColor: PALETTE.inkDark }
    );

    const fSway = Math.sin(t * 1.3) * 3;
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(64, 1002);
        c.bezierCurveTo(42, 956, 48, 916, 72, 898);
        c.lineTo(114, 898);
        c.bezierCurveTo(138, 916, 144, 956, 122, 1002);
        c.closePath();
      },
      { fill: '#f3eadb', strokeWidth: 2.0, strokeColor: PALETTE.inkDark }
    );
    const blooms = [
      [56, 858, '#fff7d6'],
      [94, 838, '#fffaf0'],
      [130, 862, '#fbe0e6'],
    ];
    for (const [bx, by, bCol] of blooms) {
      setInkStyle(ctx, 2.2, '#698f54');
      ctx.beginPath();
      ctx.moveTo(93, 900);
      ctx.quadraticCurveTo((93 + bx) * 0.5, 882, bx + fSway, by);
      ctx.stroke();
      ctx.fillStyle = bCol;
      ctx.beginPath();
      ctx.arc(bx + fSway, by, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b648';
      ctx.beginPath();
      ctx.arc(bx + fSway, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * =========================================================================
 * ENVIRONMENT 3: CELESTIAL SKY-BLUE & GOLD DREAMSCAPE (Scene 05)
 * Framing drifting clouds & luminous bokeh cleanly in outer sky space (never obscuring the dove's eye/beak!)
 * =========================================================================
 */
export function drawSkyDreamscape(ctx, t, dissolveAlpha = 1) {
  const a = clamp(dissolveAlpha, 0, 1);
  if (a <= 0.005) return;

  const W = 1920;
  const H = 1080;

  ctx.save();
  ctx.globalAlpha = a;

  // Ethereal cerulean-to-warm-gold outer sky halo framing the dove's portrait
  const skyGrad = ctx.createRadialGradient(W * 0.45, H * 0.48, 280, W * 0.5, H * 0.5, 1180);
  skyGrad.addColorStop(0, 'rgba(186, 232, 255, 0.06)');
  skyGrad.addColorStop(0.55, 'rgba(148, 214, 255, 0.38)');
  skyGrad.addColorStop(1, 'rgba(255, 232, 178, 0.62)');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Drifting painterly sky clouds gliding serenely in the open upper-left & far-right margins
  const cloudSpots = [
    { x0: 140, y: 155, sc: 1.25, sp: 14 },
    { x0: 1620, y: 185, sc: 1.35, sp: 12 },
    { x0: 1710, y: 860, sc: 1.2, sp: 16 },
    { x0: 165, y: 365, sc: 0.95, sp: 10 },
  ];
  for (let i = 0; i < cloudSpots.length; i++) {
    const cs = cloudSpots[i];
    const cx = cs.x0 + Math.sin(t * 0.25 + i * 1.6) * 58;
    const cy = cs.y + Math.cos(t * 0.35 + i) * 14;
    drawPaintedCloud(ctx, cx, cy, cs.sc, 0.62, i % 2 === 0 ? 0.55 : 0.25);
  }

  // Luminous expanding bokeh orbs floating gracefully around the serene sky perimeter
  for (let i = 0; i < BOKEH_ORBS.length; i++) {
    const o = BOKEH_ORBS[i];
    const ox = ((o.x + t * o.speedX) % (W + 200) + W + 200) % (W + 200) - 100;
    const oy = ((o.y + t * o.speedY) % (H + 200) + H + 200) % (H + 200) - 100;
    // Keep center crystal eye & beak razor-clean!
    const distEye = Math.hypot(ox - W * 0.46, oy - H * 0.48);
    if (distEye < 380) continue;
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.4 + o.phase);
    const rad = o.r * pulse;
    const g = ctx.createRadialGradient(ox, oy, rad * 0.1, ox, oy, rad);
    if (o.isSky) {
      g.addColorStop(0, `rgba(218, 246, 255, ${o.alpha * 1.65})`);
      g.addColorStop(0.7, `rgba(146, 214, 255, ${o.alpha * 0.7})`);
      g.addColorStop(1, 'rgba(146, 214, 255, 0)');
    } else {
      g.addColorStop(0, `rgba(255, 250, 224, ${o.alpha * 1.65})`);
      g.addColorStop(0.7, `rgba(255, 224, 152, ${o.alpha * 0.7})`);
      g.addColorStop(1, 'rgba(255, 224, 152, 0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, oy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * =========================================================================
 * ATMOSPHERE VFX PASS (Dust Motes, Celestial Sky-Blue Sparkles, Paper Grain & Vignette)
 * =========================================================================
 */
export function drawAtmosphereFX(ctx, t, mood = 'warm', options = {}) {
  const {
    sparkleIntensity = 0.65,
    skyBlend = 0, // 0 = golden morning dust, 1 = celestial sky-blue + gold sparkles
    vignetteStrength = 0.26,
    paperGrainAlpha = 0.11,
  } = options;

  const W = 1920;
  const H = 1080;

  // 1. Floating golden dust motes & sky-blue sparkles
  ctx.save();
  for (let i = 0; i < DUST_MOTES.length; i++) {
    const m = DUST_MOTES[i];
    const px = ((m.x + t * m.speedX + Math.sin(t * 0.7 + m.phase) * 26) % (W + 80) + W + 80) % (W + 80) - 40;
    const py = ((m.y + t * m.speedY) % (H + 80) + H + 80) % (H + 80) - 40;
    const twinkle = 0.45 + 0.55 * Math.sin(t * m.freq * 2.1 + m.phase);
    const a = m.alpha * twinkle * sparkleIntensity;
    if (a < 0.03) continue;

    const useSky = m.skyTint && skyBlend > 0.25;
    const rad = m.r * (0.85 + twinkle * 0.45);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, rad * 2.6);
    if (useSky) {
      grad.addColorStop(0, `rgba(232, 248, 255, ${a * 1.15})`);
      grad.addColorStop(0.45, `rgba(142, 214, 255, ${a * 0.65})`);
      grad.addColorStop(1, 'rgba(142, 214, 255, 0)');
    } else {
      grad.addColorStop(0, `rgba(255, 253, 236, ${a * 1.15})`);
      grad.addColorStop(0.45, `rgba(255, 224, 146, ${a * 0.62})`);
      grad.addColorStop(1, 'rgba(255, 224, 146, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, rad * 2.6, 0, Math.PI * 2);
    ctx.fill();

    if (skyBlend > 0.4 && twinkle > 0.84 && i % 3 === 0) {
      ctx.strokeStyle = useSky
        ? `rgba(230, 248, 255, ${a * 0.85})`
        : `rgba(255, 246, 206, ${a * 0.85})`;
      ctx.lineWidth = 1.4;
      const s = rad * 2.2;
      ctx.beginPath();
      ctx.moveTo(px - s, py);
      ctx.lineTo(px + s, py);
      ctx.moveTo(px, py - s);
      ctx.lineTo(px, py + s);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 2. Subtle warm watercolor paper grain overlay
  if (paperGrainAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = paperGrainAlpha;
    ctx.globalCompositeOperation = 'multiply';
    const tile = getWatercolorPaperTile();
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // 3. Soft golden storybook edge vignette
  if (vignetteStrength > 0.01) {
    ctx.save();
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.34, W * 0.5, H * 0.5, W * 0.66);
    vig.addColorStop(0, 'rgba(255, 250, 238, 0)');
    vig.addColorStop(0.72, 'rgba(130, 92, 58, 0.04)');
    vig.addColorStop(
      1,
      mood === 'celestial'
        ? `rgba(42, 74, 108, ${vignetteStrength * 0.72})`
        : `rgba(92, 58, 34, ${vignetteStrength})`
    );
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/**
 * =========================================================================
 * STORYBOOK TYPOGRAPHY PLATES (STRICTLY Ukrainian Cyrillic, ZERO dialogue subtitles!)
 * =========================================================================
 */
function drawGoldOrnamentRule(ctx, cx, y, halfW, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(cx - halfW, y, cx + halfW, y);
  grad.addColorStop(0, 'rgba(196, 146, 68, 0)');
  grad.addColorStop(0.25, 'rgba(196, 146, 68, 0.85)');
  grad.addColorStop(0.5, 'rgba(232, 186, 102, 0.98)');
  grad.addColorStop(0.75, 'rgba(196, 146, 68, 0.85)');
  grad.addColorStop(1, 'rgba(196, 146, 68, 0)');

  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, y);
  ctx.lineTo(cx + halfW, y);
  ctx.stroke();

  ctx.fillStyle = '#d49a45';
  ctx.beginPath();
  ctx.moveTo(cx, y - 6.5);
  ctx.lineTo(cx + 6.5, y);
  ctx.lineTo(cx, y + 6.5);
  ctx.lineTo(cx - 6.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawOpeningTitleCard(ctx, alpha, t) {
  if (alpha <= 0.01) return;
  ensureStorybookFonts();

  const W = 1920;
  const H = 1080;
  const cx = W * 0.5;
  const cy = H * 0.44;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Soft luminous sunlit-parchment storybook mist halo behind title (warm & radiant, never muddy!)
  const plateGlow = ctx.createRadialGradient(cx, cy, 45, cx, cy, 540);
  plateGlow.addColorStop(0, 'rgba(255, 249, 234, 0.92)');
  plateGlow.addColorStop(0.52, 'rgba(252, 241, 214, 0.72)');
  plateGlow.addColorStop(1, 'rgba(252, 241, 214, 0)');
  ctx.fillStyle = plateGlow;
  ctx.fillRect(0, 0, W, H);

  const floatY = Math.sin(t * 1.1) * 3.5;

  // Small tracked uppercase kicker: "КНИГА ВЕДМЕДІВ · КАЗКА 1"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 26px ${FONT_LABEL}`;
  ctx.fillStyle = '#7c5130';
  ctx.fillText('К Н И Г А   В Е Д М Е Д І В   ·   К А З К А   1', cx, cy - 94 + floatY);

  drawGoldOrnamentRule(ctx, cx, cy - 54 + floatY, 230, alpha);

  // Main Regal Storybook Calligraphy Title: "Пирожок"
  const titleGrad = ctx.createLinearGradient(cx, cy - 32 + floatY, cx, cy + 78 + floatY);
  titleGrad.addColorStop(0, '#6a3c1d');
  titleGrad.addColorStop(0.45, '#9d5e28');
  titleGrad.addColorStop(1, '#583016');

  ctx.font = `700 138px ${FONT_TITLE}`;
  ctx.shadowColor = 'rgba(255, 232, 174, 0.9)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = titleGrad;
  ctx.fillText('Пирожок', cx, cy + 26 + floatY);

  ctx.shadowBlur = 0;
  drawGoldOrnamentRule(ctx, cx, cy + 106 + floatY, 270, alpha);

  ctx.restore();
}

export function drawClosingTitleCard(ctx, alpha, t, fadeBlack = 0) {
  ensureStorybookFonts();
  const W = 1920;
  const H = 1080;
  const cx = W * 0.5;
  const cy = H * 0.48;

  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);

  // Warm painterly storybook parchment backdrop with golden sunlight bloom
  const bg = ctx.createRadialGradient(cx, cy - 40, 80, cx, cy, 1180);
  bg.addColorStop(0, '#fff8e8');
  bg.addColorStop(0.48, '#f5e4c3');
  bg.addColorStop(1, '#dec092');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative parchment border frame
  setInkStyle(ctx, 2.0, 'rgba(156, 112, 62, 0.42)');
  ctx.strokeRect(76, 68, W - 152, H - 136);
  setInkStyle(ctx, 1.1, 'rgba(156, 112, 62, 0.28)');
  ctx.strokeRect(90, 82, W - 180, H - 164);

  // Floating gentle golden sparkles across parchment
  drawAtmosphereFX(ctx, t, 'warm', {
    sparkleIntensity: 0.72,
    skyBlend: 0.25,
    vignetteStrength: 0.18,
    paperGrainAlpha: 0.14,
  });

  const floatY = Math.sin(t * 0.9) * 3;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Kicker: "КНИГА ВЕДМЕДІВ"
  ctx.font = `600 30px ${FONT_LABEL}`;
  ctx.fillStyle = '#7e5332';
  ctx.fillText('К Н И Г А   В Е Д М Е Д І В', cx, cy - 86 + floatY);

  drawGoldOrnamentRule(ctx, cx, cy - 42 + floatY, 210, alpha);

  // Main Closing Title: "Казка «Пирожок»"
  ctx.font = `700 108px ${FONT_TITLE}`;
  ctx.fillStyle = PALETTE.inkDark;
  ctx.shadowColor = 'rgba(255, 244, 214, 0.85)';
  ctx.shadowBlur = 14;
  ctx.fillText('Казка «Пирожок»', cx, cy + 32 + floatY);

  ctx.shadowBlur = 0;
  drawGoldOrnamentRule(ctx, cx, cy + 106 + floatY, 250, alpha);

  // Small delicate sunlit dove silhouette flourish beneath rule
  ctx.fillStyle = 'rgba(184, 134, 68, 0.58)';
  ctx.beginPath();
  ctx.arc(cx, cy + 148 + floatY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Serene final fade to warm dark sepia-black
  if (fadeBlack > 0.005) {
    ctx.save();
    ctx.fillStyle = `rgba(22, 14, 9, ${clamp(fadeBlack, 0, 1)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
