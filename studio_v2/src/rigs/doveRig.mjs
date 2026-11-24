/**
 * Full Articulated 2D Painterly Rig — Luminous White Dove
 * + Dedicated Ultra-Detailed Macro Sky-Blue Eye Close-Up Renderer (Scene 05!)
 * Matches approved character_sheet.jpg:
 * - Seamless pearlescent white head, curved neck & plump breast with golden-apricot watercolor aura
 * - Broad graceful storybook dove wings smoothly morphing from folded perched -> majestic arched spread
 * - Articulated nodding head & real lip-sync peach-coral beak (beakOpen 0..1)
 * - Coral-pink feet gripping perch/windowsill
 * - Crystal-clear transparent sky-blue eyes reflecting drifting clouds & sunlit sky!
 */

import {
  PALETTE,
  clamp,
  lerp,
  deg,
  setInkStyle,
  paintShape,
  drawSunlitRimArc,
} from '../engine/painterly.mjs';

/**
 * Draw a broad, soft, rounded storybook dove feather
 */
function drawBroadFeather(ctx, x, y, len, width, angle, tint = 'pure') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const grad = ctx.createLinearGradient(0, -width * 0.5, len, width * 0.5);
  if (tint === 'cool') {
    grad.addColorStop(0, PALETTE.dovePure);
    grad.addColorStop(0.65, '#eef3f9');
    grad.addColorStop(1, PALETTE.doveCoolShadow);
  } else if (tint === 'warm') {
    grad.addColorStop(0, PALETTE.doveHighlight);
    grad.addColorStop(0.55, PALETTE.doveCream);
    grad.addColorStop(1, PALETTE.doveWarmShadow);
  } else {
    grad.addColorStop(0, PALETTE.doveHighlight);
    grad.addColorStop(0.55, PALETTE.dovePure);
    grad.addColorStop(1, PALETTE.doveCream);
  }

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(0, -width * 0.25);
      c.bezierCurveTo(len * 0.35, -width * 0.58, len * 0.85, -width * 0.48, len, 0);
      c.bezierCurveTo(len * 0.85, width * 0.52, len * 0.35, width * 0.58, 0, width * 0.28);
      c.closePath();
    },
    {
      fill: grad,
      strokeWidth: 1.5,
      strokeColor: PALETTE.doveFeatherInk,
      innerPassFn: (c) => {
        setInkStyle(c, 0.85, 'rgba(154, 134, 114, 0.32)');
        c.beginPath();
        c.moveTo(len * 0.08, 0);
        c.quadraticCurveTo(len * 0.5, -width * 0.05, len * 0.88, 0);
        c.stroke();
      },
    }
  );
  ctx.restore();
}

/**
 * Draw majestic broad arched storybook dove wing (smoothly unfolds from wingSpread 0.01 -> 1.0!)
 * Broad overlapping soft feathers forming an elegant curved wing silhouette — ZERO spiky comb gaps!
 */
function drawMajesticWing(ctx, shoulderX, shoulderY, spread, flapPhase, isBack = false) {
  const s = clamp(spread, 0, 1);
  if (s <= 0.04) return;

  ctx.save();
  ctx.translate(shoulderX, shoulderY);

  const flap = Math.sin(flapPhase + (isBack ? 0.55 : 0));
  const tipWave = Math.sin(flapPhase - 0.55 + (isBack ? 0.55 : 0));

  // Smooth elevation angle as wings lift & arch gracefully overhead
  const liftAngle = isBack
    ? lerp(deg(-8), deg(-28), s) - flap * deg(11) * s
    : lerp(deg(24), deg(-16), s) + flap * deg(14) * s;

  ctx.rotate(liftAngle);
  if (isBack) {
    // Mirror horizontally so back wing sweeps gracefully UP & OUT on the far side of the chest!
    ctx.scale(-0.78, 0.86);
  }

  // Span grows organically with spread
  const span = lerp(68, 152, s);
  const archH = lerp(24, 72, s);
  const tipBend = tipWave * 10 * s;

  // 1. Broad overlapping rounded primary flight feathers fanning cleanly off the wingtip
  const primaryCount = 6;
  for (let i = primaryCount - 1; i >= 0; i--) {
    const t = i / (primaryCount - 1); // 0 = outer long tip, 1 = inner shorter primary
    const px = -span * lerp(0.54, 0.34, t);
    const py = -archH * lerp(0.42, 0.06, t) + t * 18;
    const fLen = span * lerp(0.58, 0.36, t);
    const fW = lerp(19, 22, t);
    const fAng = deg(188 - t * 34) + tipWave * deg(6) * (1 - t * 0.4);
    drawBroadFeather(ctx, px, py, fLen, fW, fAng, isBack ? 'cool' : i % 2 === 0 ? 'pure' : 'warm');
  }

  // 2. Unified luminous arched wing body & secondary feathers (hides roots into ONE graceful cloud-white wing!)
  const wingGrad = ctx.createLinearGradient(12, -archH, -span * 0.9, 34);
  if (isBack) {
    wingGrad.addColorStop(0, PALETTE.dovePure);
    wingGrad.addColorStop(0.55, '#eef2f7');
    wingGrad.addColorStop(1, PALETTE.doveCoolShadow);
  } else {
    wingGrad.addColorStop(0, PALETTE.doveHighlight);
    wingGrad.addColorStop(0.45, PALETTE.dovePure);
    wingGrad.addColorStop(0.82, PALETTE.doveCream);
    wingGrad.addColorStop(1, PALETTE.doveWarmShadow);
  }

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      // Leading edge curving proudly UP & OUT into a graceful swan/dove arch!
      c.moveTo(14, -6);
      c.bezierCurveTo(-span * 0.22, -archH * 1.15, -span * 0.65, -archH * 1.05 + tipBend * 0.5, -span * 0.96, -archH * 0.42 + tipBend);
      // Soft scalloped trailing edge sweeping smoothly back toward torso
      c.bezierCurveTo(-span * 0.82, -archH * 0.08 + tipBend * 0.6, -span * 0.62, 16, -span * 0.4, 24);
      c.bezierCurveTo(-span * 0.2, 30, -2, 22, 16, 12);
      c.closePath();
    },
    {
      fill: wingGrad,
      strokeWidth: 1.85,
      strokeColor: PALETTE.doveFeatherInk,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: 0.8, y: -2.6 },
      innerPassFn: (c) => {
        // Lush soft scalloped covert feather arcs nested inside the arched wing!
        setInkStyle(c, 1.2, 'rgba(148, 126, 104, 0.48)');
        for (let row = 0; row < 2; row++) {
          const count = row === 0 ? 5 : 4;
          for (let k = 0; k < count; k++) {
            const u = (k + 0.5) / count;
            const cx = -span * lerp(0.14, 0.72, u);
            const cy = -archH * lerp(0.52, 0.28, u) + row * 16;
            c.beginPath();
            c.arc(cx, cy, 10.5 + row * 1.5, 0.12 * Math.PI, 0.88 * Math.PI);
            c.stroke();
          }
        }
        // Subtle sunlit golden upper edge glow
        drawSunlitRimArc(
          c,
          (cc) => {
            cc.beginPath();
            cc.moveTo(6, -11);
            cc.quadraticCurveTo(-span * 0.42, -archH * 0.96, -span * 0.84, -archH * 0.46 + tipBend * 0.7);
          },
          3.2,
          0.62
        );
      },
    }
  );

  ctx.restore();
}

/**
 * Draw sleek folded dove wing (resting perched state matching character_sheet.jpg!)
 */
function drawFoldedWing(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);

  const wingGrad = ctx.createLinearGradient(24, -26, -78, 52);
  wingGrad.addColorStop(0, PALETTE.doveHighlight);
  wingGrad.addColorStop(0.45, PALETTE.dovePure);
  wingGrad.addColorStop(0.8, PALETTE.doveCream);
  wingGrad.addColorStop(1, PALETTE.doveWarmShadow);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(22, -26);
      c.bezierCurveTo(4, -36, -34, -18, -58, 12);
      c.bezierCurveTo(-74, 30, -82, 46, -88, 52);
      c.bezierCurveTo(-68, 52, -42, 42, -16, 26);
      c.bezierCurveTo(12, 10, 32, -8, 22, -26);
      c.closePath();
    },
    {
      fill: wingGrad,
      strokeWidth: 1.85,
      strokeColor: PALETTE.doveFeatherInk,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: -1.4, y: -2.2 },
      innerPassFn: (c) => {
        setInkStyle(c, 1.25, 'rgba(146, 122, 98, 0.52)');
        const r1 = [
          [12, -16],
          [0, -10],
          [-12, -3],
          [-24, 5],
        ];
        for (const [fx, fy] of r1) {
          c.beginPath();
          c.arc(fx, fy, 9.2, 0.15 * Math.PI, 0.92 * Math.PI);
          c.stroke();
        }
        const r2 = [
          [4, -2],
          [-10, 6],
          [-24, 15],
          [-38, 24],
        ];
        for (const [fx, fy] of r2) {
          c.beginPath();
          c.arc(fx, fy, 10.5, 0.15 * Math.PI, 0.92 * Math.PI);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(-26, 22);
        c.quadraticCurveTo(-50, 36, -78, 48);
        c.moveTo(-14, 16);
        c.quadraticCurveTo(-40, 30, -68, 44);
        c.moveTo(-4, 10);
        c.quadraticCurveTo(-28, 22, -52, 34);
        c.stroke();
      },
    }
  );
  ctx.restore();
}

/**
 * Draw the Dove's signature crystal-clear transparent sky-blue eye
 */
function drawDoveCrystalEye(ctx, x, y, r, opts = {}) {
  const { blink = 0, gazeX = 0, gazeY = 0, cloudDrift = 0 } = opts;
  const b = clamp(blink, 0, 1);

  ctx.save();
  ctx.translate(x, y);

  // Soft pearlescent eye-ring feathers around socket
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(218, 232, 245, 0.58)';
  ctx.fill();

  if (b > 0.85) {
    ctx.beginPath();
    ctx.moveTo(-r * 1.05, 0);
    ctx.quadraticCurveTo(0, r * 0.45, r * 1.05, 0);
    setInkStyle(ctx, Math.max(1.8, r * 0.18), PALETTE.doveFeatherInk);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const ry = r * (1 - b * 0.92);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  const skyGrad = ctx.createRadialGradient(
    -r * 0.15 + gazeX * r * 0.2,
    r * 0.3 + gazeY * r * 0.2,
    r * 0.08,
    0,
    0,
    r * 1.05
  );
  skyGrad.addColorStop(0, '#dbf4ff');
  skyGrad.addColorStop(0.38, PALETTE.doveEyeSky);
  skyGrad.addColorStop(0.72, PALETTE.doveEyeMid);
  skyGrad.addColorStop(0.92, PALETTE.doveEyeDeep);
  skyGrad.addColorStop(1, PALETTE.doveEyeRim);

  ctx.fillStyle = skyGrad;
  ctx.fillRect(-r - 2, -r - 2, r * 2 + 4, r * 2 + 4);

  const cx = (((cloudDrift * 0.4) % 1.8) - 0.9) * r;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.beginPath();
  ctx.ellipse(cx, r * 0.22, r * 0.45, r * 0.18, -0.1, 0, Math.PI * 2);
  ctx.fill();

  const px = gazeX * r * 0.22;
  const py = gazeY * r * 0.18;
  ctx.beginPath();
  ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#112540';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(px - r * 0.3, py - r * 0.32, r * 0.28, r * 0.22, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(218, 244, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(px + r * 0.32, py + r * 0.3, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI * 2);
  setInkStyle(ctx, Math.max(1.4, r * 0.15), '#3c5775');
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw coral-pink dove foot wrapping gently around perch/windowsill
 */
function drawDoveFoot(ctx, x, y, isBack = false) {
  ctx.save();
  ctx.translate(x, y);

  const footColor = isBack ? PALETTE.doveFootShadow : PALETTE.doveFootBase;
  setInkStyle(ctx, 4.2, footColor);

  ctx.beginPath();
  ctx.moveTo(-4, -22);
  ctx.lineTo(0, -4);
  ctx.stroke();
  setInkStyle(ctx, 1.4, PALETTE.inkDark);
  ctx.stroke();

  const toes = [
    [0, -4, 14, 1, 18, 9],
    [0, -4, 9, 4, 11, 13],
    [0, -4, 3, 5, 4, 13],
    [0, -4, -10, 2, -13, 8],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of toes) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    setInkStyle(ctx, 3.6, footColor);
    ctx.stroke();
    setInkStyle(ctx, 1.25, PALETTE.inkDark);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw full articulated Luminous White Dove!
 * Origin (x, y) is perch contact point beneath her coral-pink feet.
 */
export function drawDove(ctx, pose = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    facing = 'right',
    breathPhase = 0,
    headNod = 0,
    headTurn = 0,
    blink = 0,
    beakOpen = 0,
    wingSpread = 0,
    wingFlapPhase = 0,
    auraGlow = 0.65,
    cloudDrift = 0,
    showPerch = false,
  } = pose;

  const flipX = facing === 'left' ? -1 : 1;
  const breath = Math.sin(breathPhase);
  const spread = clamp(wingSpread, 0, 1);
  const glow = clamp(auraGlow, 0, 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flipX, scale);

  // === LAYER 0: GOLDEN-APRICOT & CELESTIAL SKY-BLUE RADIANT WATERCOLOR AURA ===
  if (glow > 0.02) {
    ctx.save();
    const auraRadius = (142 + spread * 55) * (0.95 + breath * 0.04);
    const auraGrad = ctx.createRadialGradient(-4, -84, 18, -4, -84, auraRadius);
    auraGrad.addColorStop(0, `rgba(255, 244, 206, ${0.76 * glow})`);
    auraGrad.addColorStop(0.45, `rgba(255, 220, 152, ${0.46 * glow})`);
    auraGrad.addColorStop(0.76, `rgba(182, 224, 255, ${0.22 * glow})`);
    auraGrad.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(-4, -84, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    if (glow > 0.45) {
      const motes = [
        [-72, -148, 3.2],
        [62, -154, 2.8],
        [-96, -88, 2.4],
        [78, -98, 3.0],
        [18, -174, 2.5],
      ];
      for (let i = 0; i < motes.length; i++) {
        const [mx, my, mr] = motes[i];
        const pulse = 0.5 + 0.5 * Math.sin(breathPhase * 1.6 + i * 1.4);
        ctx.fillStyle = `rgba(255, 252, 232, ${glow * pulse * 0.82})`;
        ctx.beginPath();
        ctx.arc(mx, my + Math.sin(breathPhase + i) * 4, mr * (0.7 + pulse * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (showPerch) {
    const perchGrad = ctx.createLinearGradient(-44, -6, 44, 14);
    perchGrad.addColorStop(0, '#d8c9b4');
    perchGrad.addColorStop(0.55, '#b8a58e');
    perchGrad.addColorStop(1, '#8c7a66');
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.roundRect(-42, -2, 86, 12, 6);
      },
      {
        fill: perchGrad,
        strokeWidth: 1.7,
        strokeColor: PALETTE.inkMid,
      }
    );
  }

  // === LAYER 1: BACK SPREAD WING (appears cleanly as wings lift!) ===
  if (spread > 0.12) {
    drawMajesticWing(ctx, 16, -98, spread, wingFlapPhase, true);
  }

  // === LAYER 2: LAYERED FANNED TAIL FEATHERS ===
  const tailFan = 1 + spread * 0.32;
  const tailAngles = [deg(138), deg(130), deg(122), deg(115)];
  for (let i = 0; i < tailAngles.length; i++) {
    const a = tailAngles[i] + (i - 1.5) * deg(3.5) * tailFan + breath * deg(1.5);
    drawBroadFeather(ctx, -32, -44, 82 - i * 4, 16.5, a, i < 2 ? 'warm' : 'pure');
  }

  // === LAYER 3: CORAL-PINK FEET ===
  drawDoveFoot(ctx, 14, -4, true);
  drawDoveFoot(ctx, -4, 0, false);

  // === LAYER 4: PLUMP PEARLESCENT BODY & GRACEFUL CURVED NECK ===
  const bExp = breath * 2.2;
  const bodyGrad = ctx.createRadialGradient(26, -108, 12, -2, -74, 96);
  bodyGrad.addColorStop(0, PALETTE.doveHighlight);
  bodyGrad.addColorStop(0.42, PALETTE.dovePure);
  bodyGrad.addColorStop(0.76, PALETTE.doveCream);
  bodyGrad.addColorStop(1, PALETTE.doveWarmShadow);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(10, -138);
      c.bezierCurveTo(-4, -118, -32, -98, -50, -64);
      c.bezierCurveTo(-56, -48, -46, -30, -28, -24);
      c.bezierCurveTo(6, -14, 52 + bExp, -28, 60 + bExp, -66);
      c.bezierCurveTo(64 + bExp, -94, 48, -118, 40, -138);
      c.closePath();
    },
    {
      fill: bodyGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.doveFeatherInk,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: 2.2, y: -2.2 },
      innerPassFn: (c) => {
        const chestGlow = c.createRadialGradient(42, -72, 4, 42, -72, 36);
        chestGlow.addColorStop(0, 'rgba(255, 240, 198, 0.56)');
        chestGlow.addColorStop(1, 'rgba(255, 240, 198, 0)');
        c.fillStyle = chestGlow;
        c.fillRect(0, -120, 75, 95);

        const bellyShadow = c.createLinearGradient(0, -40, 0, -16);
        bellyShadow.addColorStop(0, 'rgba(180, 192, 210, 0)');
        bellyShadow.addColorStop(1, 'rgba(180, 192, 210, 0.34)');
        c.fillStyle = bellyShadow;
        c.fillRect(-55, -45, 115, 35);
      },
    }
  );

  // === LAYER 5: ARTICULATED HEAD (SEAMLESS NECK BLEND + NODDING + LIP-SYNC BEAK + SKY-BLUE EYE!) ===
  ctx.save();
  ctx.translate(26, -136 - bExp * 0.5);
  ctx.rotate(headNod);

  const headGrad = ctx.createRadialGradient(2, -24, 4, 0, -12, 38);
  headGrad.addColorStop(0, PALETTE.doveHighlight);
  headGrad.addColorStop(0.55, PALETTE.dovePure);
  headGrad.addColorStop(1, PALETTE.doveCream);

  // Fill head seamlessly down into neck WITHOUT harsh bottom stroke line!
  ctx.beginPath();
  ctx.moveTo(-16, 12);
  ctx.bezierCurveTo(-21, -14, -14, -40, 6, -40);
  ctx.bezierCurveTo(22, -40, 29, -24, 24, -4);
  ctx.bezierCurveTo(21, 7, 17, 16, 14, 22);
  ctx.quadraticCurveTo(0, 24, -16, 12);
  ctx.closePath();
  ctx.fillStyle = headGrad;
  ctx.fill();

  // Warm sunlit golden rim highlight softly hugging crown & throat
  drawSunlitRimArc(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-14, -18);
      c.bezierCurveTo(-11, -35, 2, -40, 16, -34);
    },
    2.4,
    0.62
  );

  // Stroke ONLY the outer head/crown/throat contour (open at neck base so it blends like real feathers!)
  ctx.beginPath();
  ctx.moveTo(-16, 10);
  ctx.bezierCurveTo(-21, -14, -14, -40, 6, -40);
  ctx.bezierCurveTo(22, -40, 29, -24, 24, -4);
  ctx.bezierCurveTo(21, 6, 17, 13, 14, 18);
  setInkStyle(ctx, 1.9, PALETTE.doveFeatherInk);
  ctx.stroke();

  // Delicate articulated Peach-Coral Beak (upper & lower mandible open smoothly!)
  const beakAngle = clamp(beakOpen, 0, 1) * deg(24);
  const bx = 23 + headTurn * 4;
  const by = -18;

  if (beakOpen > 0.08) {
    ctx.beginPath();
    ctx.moveTo(bx - 1, by - 1);
    ctx.lineTo(bx + 15, by + 2);
    ctx.lineTo(bx + 12, by + 5 + beakOpen * 7);
    ctx.lineTo(bx - 1, by + 5);
    ctx.closePath();
    ctx.fillStyle = '#c86c64';
    ctx.fill();
  }

  // Lower mandible
  ctx.save();
  ctx.translate(bx, by + 3);
  ctx.rotate(beakAngle * 0.72);
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-2, -1.5);
      c.quadraticCurveTo(8, 0.5, 16.5, 2.5);
      c.quadraticCurveTo(7, 5.2, -2, 3.5);
      c.closePath();
    },
    {
      fill: PALETTE.doveBeakShadow,
      strokeWidth: 1.5,
      strokeColor: PALETTE.inkDark,
    }
  );
  ctx.restore();

  // Upper mandible
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-beakAngle * 0.35);
  const beakGrad = ctx.createLinearGradient(-2, -5, 19, 4);
  beakGrad.addColorStop(0, PALETTE.doveBeakLight);
  beakGrad.addColorStop(0.55, PALETTE.doveBeakBase);
  beakGrad.addColorStop(1, PALETTE.doveBeakShadow);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-2, -4.5);
      c.bezierCurveTo(7, -4.5, 15, -1, 19.5, 4.2);
      c.quadraticCurveTo(9, 4.0, -2, 2.5);
      c.closePath();
    },
    {
      fill: beakGrad,
      strokeWidth: 1.6,
      strokeColor: PALETTE.inkDark,
    }
  );
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.ellipse(0.5, -2.8, 3.8, 2.6, -0.25, 0, Math.PI * 2);
    },
    {
      fill: '#f7ece4',
      strokeWidth: 1.2,
      strokeColor: PALETTE.doveFeatherInk,
    }
  );
  ctx.restore();

  // Signature Crystal-Clear Transparent Sky-Blue Eye!
  drawDoveCrystalEye(ctx, 8 + headTurn * 5, -22, 6.8, {
    blink,
    cloudDrift,
  });

  ctx.restore(); // head nod

  // === LAYER 6: SINGLE COHESIVE FRONT WING (CLEAN FOLDED OR MAJESTIC SPREAD — NO GHOSTING!) ===
  if (spread <= 0.12) {
    drawFoldedWing(ctx, 4, -84);
  } else {
    drawMajesticWing(ctx, -4, -90, spread, wingFlapPhase, false);
  }

  ctx.restore();
}

/**
 * Dedicated Ultra-Detailed Macro Close-Up Renderer for Scene 05:
 * "А очі в нього були чисті-чисті, прозорі, як саме небо..."
 * Studio Ghibli painterly macro portrait of the White Dove's luminous pearlescent head
 * & crystal-clear transparent sky-blue eye reflecting drifting sunlit clouds!
 */
export function drawDoveEyeCloseup(ctx, pose = {}) {
  const {
    x = 0,
    y = 0,
    width = 640,
    height = 400,
    blink = 0,
    cloudDrift = 0,
    gazeX = 0,
    gazeY = 0,
    auraGlow = 0.88,
  } = pose;

  const b = clamp(blink, 0, 1);

  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 14);
  ctx.clip();

  // 1. Dreamy morning sky-and-sunlight watercolor backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#d8efff');
  bgGrad.addColorStop(0.45, '#f6f5ea');
  bgGrad.addColorStop(1, '#f8e2bd');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft golden sunlight bokeh orbs
  const bokeh = [
    [0.78, 0.18, 48, 0.34],
    [0.88, 0.42, 34, 0.28],
    [0.14, 0.2, 42, 0.3],
    [0.84, 0.78, 52, 0.26],
  ];
  for (const [bx, by, br, ba] of bokeh) {
    ctx.fillStyle = `rgba(255, 250, 232, ${ba * auraGlow})`;
    ctx.beginPath();
    ctx.arc(width * bx, height * by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Sculpted Anatomical Pearlescent Dove Head & Graceful Neck
  const cx = width * 0.44;
  const cy = height * 0.56;
  const sc = Math.min(width, height) / 400;

  // Radiant golden-white halo behind dove's crown
  const halo = ctx.createRadialGradient(cx + 20 * sc, cy - 30 * sc, 60 * sc, cx + 20 * sc, cy - 30 * sc, 270 * sc);
  halo.addColorStop(0, `rgba(255, 246, 208, ${0.78 * auraGlow})`);
  halo.addColorStop(0.6, `rgba(255, 224, 162, ${0.32 * auraGlow})`);
  halo.addColorStop(1, 'rgba(255, 224, 162, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  const headGrad = ctx.createRadialGradient(cx - 30 * sc, cy - 85 * sc, 18 * sc, cx + 10 * sc, cy, 260 * sc);
  headGrad.addColorStop(0, '#ffffff');
  headGrad.addColorStop(0.42, '#fffef9');
  headGrad.addColorStop(0.78, '#f4ebdb');
  headGrad.addColorStop(1, '#ded2c0');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      // Graceful curved dove back-of-neck sweeping smoothly up into crown
      c.moveTo(cx - 210 * sc, height + 25);
      c.bezierCurveTo(cx - 195 * sc, cy + 20 * sc, cx - 155 * sc, cy - 115 * sc, cx - 45 * sc, cy - 155 * sc);
      // Rounded delicate dove forehead curving gracefully down to beak root
      c.bezierCurveTo(cx + 45 * sc, cy - 185 * sc, cx + 132 * sc, cy - 122 * sc, cx + 160 * sc, cy - 38 * sc);
      // Cheek & soft chin curve sweeping down into proud sunlit chest
      c.bezierCurveTo(cx + 168 * sc, cy + 12 * sc, cx + 132 * sc, cy + 65 * sc, cx + 92 * sc, cy + 108 * sc);
      c.bezierCurveTo(cx + 75 * sc, cy + 145 * sc, cx + 98 * sc, height + 20, cx + 115 * sc, height + 25);
      c.closePath();
    },
    {
      fill: headGrad,
      strokeWidth: 2.35,
      strokeColor: PALETTE.doveFeatherInk,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: 2.4, y: -3.2 },
      innerPassFn: (c) => {
        // Soft painterly cheek-plume shading & warm sunlit cream wash
        const cheekWash = c.createRadialGradient(cx + 58 * sc, cy + 52 * sc, 10, cx + 58 * sc, cy + 52 * sc, 125 * sc);
        cheekWash.addColorStop(0, 'rgba(244, 226, 198, 0.52)');
        cheekWash.addColorStop(1, 'rgba(244, 226, 198, 0)');
        c.fillStyle = cheekWash;
        c.fillRect(0, 0, width, height);

        // Soft warm golden sunlit crown & upper-neck inner sheen!
        const crownGold = c.createRadialGradient(cx - 42 * sc, cy - 125 * sc, 8, cx - 10 * sc, cy - 95 * sc, 165 * sc);
        crownGold.addColorStop(0, `rgba(255, 238, 178, ${0.58 * auraGlow})`);
        crownGold.addColorStop(0.55, `rgba(255, 226, 152, ${0.24 * auraGlow})`);
        crownGold.addColorStop(1, 'rgba(255, 226, 152, 0)');
        c.fillStyle = crownGold;
        c.fillRect(0, 0, width, height);

        // Soft painterly white & warm-pearl layered feather contour wisps flowing down cheek & neck!
        for (let row = 0; row < 4; row++) {
          const count = 6;
          for (let i = 0; i < count; i++) {
            const u = i / (count - 1);
            const fx = cx - 155 * sc + u * 235 * sc + (row % 2) * 14 * sc;
            const fy = cy + (46 + row * 34) * sc + Math.sin(u * Math.PI) * 14 * sc;
            // Bright painterly white feather highlight wisp
            setInkStyle(c, 3.6 * sc, 'rgba(255, 255, 255, 0.68)');
            c.beginPath();
            c.moveTo(fx, fy);
            c.quadraticCurveTo(fx - 16 * sc, fy + 14 * sc, fx - 34 * sc, fy + 22 * sc);
            c.stroke();
            // Delicate soft warm-sepia feather edge contour
            setInkStyle(c, 1.15 * sc, 'rgba(168, 148, 126, 0.34)');
            c.beginPath();
            c.moveTo(fx - 2 * sc, fy + 4 * sc);
            c.quadraticCurveTo(fx - 18 * sc, fy + 18 * sc, fx - 36 * sc, fy + 25 * sc);
            c.stroke();
          }
        }

        // Delicate sweeping painterly crown & temple white feather wisps curving over the brow
        for (let i = 0; i < 11; i++) {
          const t = i / 10;
          const a = -2.42 + t * 1.48;
          const radX = 112 * sc;
          const radY = 104 * sc;
          const fx = cx + 8 * sc + Math.cos(a) * radX;
          const fy = cy - 30 * sc + Math.sin(a) * radY;
          const tx = fx - Math.sin(a) * 26 * sc - 12 * sc;
          const ty = fy + Math.cos(a) * 14 * sc + 12 * sc;

          setInkStyle(c, 3.2 * sc, 'rgba(255, 255, 255, 0.62)');
          c.beginPath();
          c.moveTo(fx, fy);
          c.quadraticCurveTo((fx + tx) * 0.5 - 4 * sc, (fy + ty) * 0.5 - 3 * sc, tx, ty);
          c.stroke();

          setInkStyle(c, 1.05 * sc, 'rgba(176, 158, 138, 0.30)');
          c.beginPath();
          c.moveTo(fx, fy + 2.5 * sc);
          c.quadraticCurveTo((fx + tx) * 0.5 - 4 * sc, (fy + ty) * 0.5, tx, ty + 2.5 * sc);
          c.stroke();
        }

        // Luminous warm sunlit golden rim-light curve along crown, forehead & upper neck!
        drawSunlitRimArc(
          c,
          (cc) => {
            cc.beginPath();
            cc.moveTo(cx - 178 * sc, cy + 32 * sc);
            cc.bezierCurveTo(cx - 166 * sc, cy - 68 * sc, cx - 122 * sc, cy - 134 * sc, cx - 38 * sc, cy - 152 * sc);
            cc.bezierCurveTo(cx + 38 * sc, cy - 168 * sc, cx + 106 * sc, cy - 128 * sc, cx + 144 * sc, cy - 62 * sc);
          },
          5.2 * sc,
          0.72 * auraGlow
        );
      },
    }
  );

  // Subtle exterior warm-gold sunlit halo wisps kissing the outer crown & back-of-neck contour
  drawSunlitRimArc(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(cx - 164 * sc, cy - 42 * sc);
      c.bezierCurveTo(cx - 134 * sc, cy - 120 * sc, cx - 68 * sc, cy - 158 * sc, cx + 18 * sc, cy - 162 * sc);
      c.bezierCurveTo(cx + 76 * sc, cy - 164 * sc, cx + 124 * sc, cy - 120 * sc, cx + 148 * sc, cy - 68 * sc);
    },
    3.0 * sc,
    0.58 * auraGlow
  );

  // 3. Sculpted Delicate Peach-Coral Dove Beak (upper & lower curve + soft pale cere)
  const beakX = cx + 154 * sc;
  const beakY = cy - 18 * sc;
  const beakGrad = ctx.createLinearGradient(beakX, beakY - 24 * sc, beakX + 95 * sc, beakY + 34 * sc);
  beakGrad.addColorStop(0, PALETTE.doveBeakLight);
  beakGrad.addColorStop(0.55, PALETTE.doveBeakBase);
  beakGrad.addColorStop(1, PALETTE.doveBeakShadow);

  // Lower mandible
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(beakX - 6 * sc, beakY + 12 * sc);
      c.quadraticCurveTo(beakX + 46 * sc, beakY + 18 * sc, beakX + 92 * sc, beakY + 26 * sc);
      c.quadraticCurveTo(beakX + 42 * sc, beakY + 36 * sc, beakX - 10 * sc, beakY + 28 * sc);
      c.closePath();
    },
    {
      fill: PALETTE.doveBeakShadow,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
    }
  );

  // Upper mandible
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(beakX - 8 * sc, beakY - 22 * sc);
      c.bezierCurveTo(beakX + 40 * sc, beakY - 22 * sc, beakX + 78 * sc, beakY - 4 * sc, beakX + 106 * sc, beakY + 24 * sc);
      c.quadraticCurveTo(beakX + 46 * sc, beakY + 24 * sc, beakX - 10 * sc, beakY + 14 * sc);
      c.closePath();
    },
    {
      fill: beakGrad,
      strokeWidth: 2.15,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        // Soft sunlit ridge highlight along top of beak
        setInkStyle(c, 3.0, 'rgba(255, 240, 228, 0.55)');
        c.beginPath();
        c.moveTo(beakX + 8 * sc, beakY - 12 * sc);
        c.quadraticCurveTo(beakX + 48 * sc, beakY - 10 * sc, beakX + 82 * sc, beakY + 8 * sc);
        c.stroke();
      },
    }
  );

  // Pale pearl-pink dove cere at beak root
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.ellipse(beakX + 2 * sc, beakY - 12 * sc, 18 * sc, 11 * sc, -0.25, 0, Math.PI * 2);
    },
    {
      fill: '#f8eee6',
      strokeWidth: 1.5,
      strokeColor: PALETTE.doveFeatherInk,
    }
  );

  // 4. GRACEFULLY PROPORTIONED CRYSTAL-CLEAR TRANSPARENT SKY-BLUE EYE REFLECTING DRIFTING SUNLIT CLOUDS!
  // (~20% more naturally proportioned within the dove's graceful head!)
  const ex = cx + 22 * sc;
  const ey = cy - 42 * sc;
  const eyeR = 60 * sc;

  // Soft feathered pearl-blue eye-ring framing the socket + delicate white contour wisps
  const ringGrad = ctx.createRadialGradient(ex, ey, eyeR * 0.88, ex, ey, eyeR * 1.34);
  ringGrad.addColorStop(0, 'rgba(186, 218, 244, 0.72)');
  ringGrad.addColorStop(0.52, 'rgba(220, 234, 246, 0.38)');
  ringGrad.addColorStop(1, 'rgba(220, 234, 246, 0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(ex, ey, eyeR * 1.34, 0, Math.PI * 2);
  ctx.fill();

  // Delicate radial soft white downy feather wisps hugging the eye-ring
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r0 = eyeR * 1.12;
    const r1 = eyeR * 1.38;
    setInkStyle(ctx, 2.2 * sc, 'rgba(255, 255, 255, 0.65)');
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0);
    ctx.quadraticCurveTo(
      ex + Math.cos(a + 0.08) * (r0 + r1) * 0.5,
      ey + Math.sin(a + 0.08) * (r0 + r1) * 0.5,
      ex + Math.cos(a + 0.14) * r1,
      ey + Math.sin(a + 0.14) * r1
    );
    ctx.stroke();
  }

  const openRy = eyeR * (1 - b * 0.94);

  if (b > 0.88) {
    ctx.beginPath();
    ctx.moveTo(ex - eyeR * 1.06, ey);
    ctx.quadraticCurveTo(ex, ey + eyeR * 0.34, ex + eyeR * 1.06, ey);
    setInkStyle(ctx, 3.6, PALETTE.doveFeatherInk);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR, openRy, 0, 0, Math.PI * 2);
    ctx.clip();

    // Transparent cerulean-to-azure celestial sky dome inside the eye!
    const irisGrad = ctx.createRadialGradient(
      ex + gazeX * 14,
      ey + eyeR * 0.34 + gazeY * 10,
      eyeR * 0.08,
      ex,
      ey,
      eyeR * 1.05
    );
    irisGrad.addColorStop(0, '#e6f8ff');
    irisGrad.addColorStop(0.32, '#99dcff');
    irisGrad.addColorStop(0.62, '#4ba8ee');
    irisGrad.addColorStop(0.86, '#2366aa');
    irisGrad.addColorStop(1, '#143963');

    ctx.fillStyle = irisGrad;
    ctx.fillRect(ex - eyeR - 4, ey - eyeR - 4, eyeR * 2 + 8, eyeR * 2 + 8);

    // Subtle crystalline radial iris light-rays
    ctx.save();
    ctx.translate(ex + gazeX * 12, ey + gazeY * 10);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * eyeR * 0.42, Math.sin(a) * eyeR * 0.42);
      ctx.lineTo(Math.cos(a) * eyeR * 0.92, Math.sin(a) * eyeR * 0.92);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(220, 246, 255, 0.24)' : 'rgba(24, 78, 140, 0.16)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.restore();

    // Animated drifting sunlit clouds reflected inside the transparent sky eye!
    const drawMiniCloud = (offsetX, offsetY, csc) => {
      const drift = ((cloudDrift * 22 + offsetX) % (eyeR * 2.8)) - eyeR * 1.4;
      const mx = ex + drift;
      const my = ey + offsetY;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.54)';
      ctx.beginPath();
      ctx.arc(mx, my, 15 * csc * sc, 0, Math.PI * 2);
      ctx.arc(mx + 14 * csc * sc, my - 4 * csc * sc, 18 * csc * sc, 0, Math.PI * 2);
      ctx.arc(mx + 30 * csc * sc, my + 1 * csc * sc, 13 * csc * sc, 0, Math.PI * 2);
      ctx.fill();
    };
    drawMiniCloud(0, eyeR * 0.24, 1.0);
    drawMiniCloud(eyeR * 1.35, -eyeR * 0.3, 0.75);
    drawMiniCloud(eyeR * 2.1, eyeR * 0.48, 0.62);

    // Deep luminous sapphire-navy pupil
    const px = ex + gazeX * eyeR * 0.18;
    const py = ey + gazeY * eyeR * 0.14;
    const pupGrad = ctx.createRadialGradient(px - 6, py - 6, 3, px, py, eyeR * 0.4);
    pupGrad.addColorStop(0, '#1c3a62');
    pupGrad.addColorStop(0.6, '#0c1c34');
    pupGrad.addColorStop(1, '#060f1e');
    ctx.fillStyle = pupGrad;
    ctx.beginPath();
    ctx.arc(px, py, eyeR * 0.39, 0, Math.PI * 2);
    ctx.fill();

    // Soft curved upper eyelid shadow inside glassy cornea
    const topShade = ctx.createLinearGradient(ex, ey - eyeR, ex, ey);
    topShade.addColorStop(0, 'rgba(18, 48, 86, 0.44)');
    topShade.addColorStop(1, 'rgba(18, 48, 86, 0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(ex - eyeR, ey - eyeR, eyeR * 2, eyeR);

    // Brilliant sunlit window/sky primary catchlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.ellipse(ex - eyeR * 0.34, ey - eyeR * 0.34, eyeR * 0.27, eyeR * 0.2, -0.42, 0, Math.PI * 2);
    ctx.fill();

    // Secondary sky-sparkle catchlight
    ctx.fillStyle = 'rgba(235, 250, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(ex + eyeR * 0.34, ey + eyeR * 0.3, eyeR * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Luminous lower sky bounce glow crescent
    ctx.beginPath();
    ctx.arc(ex, ey + eyeR * 0.12, eyeR * 0.78, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.strokeStyle = 'rgba(216, 246, 255, 0.62)';
    ctx.lineWidth = 6 * sc;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();

    // Expressive feathered upper & lower eyelid framing arcs
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR, openRy, 0, 0, Math.PI * 2);
    setInkStyle(ctx, 2.8, '#2d4d70');
    ctx.stroke();

    // Delicate soft upper feathered eyelid crease
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR * 1.14, -Math.PI * 0.86, -Math.PI * 0.14);
    setInkStyle(ctx, 1.8, 'rgba(136, 122, 108, 0.46)');
    ctx.stroke();

    // Subtle lower pearl eye-rim highlight
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR * 1.1, Math.PI * 0.18, Math.PI * 0.82);
    setInkStyle(ctx, 2.2, 'rgba(255, 252, 244, 0.72)');
    ctx.stroke();
  }

  ctx.restore();
}
