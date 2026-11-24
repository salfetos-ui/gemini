/**
 * Full Articulated 2D Painterly Rig — The Boy (~5-6yo)
 * Matches approved character_sheet.jpg:
 * - Lush fluffy curly chestnut-brown hair (soft layered curls with spring bounce, NOT spiky!)
 * - Big warm chestnut-brown eyes with dark pupils & bright specular catchlights
 * - Rosy freckled cheeks, endearing storybook child proportions (~1:4.1)
 * - Soft cream waffle-knit long-sleeve shirt with pushed-up cuffs
 * - Rolled-up light denim jeans with front pockets & cuffs, barefoot with 5 toes!
 */

import {
  PALETTE,
  clamp,
  lerp,
  deg,
  solve2BoneIK,
  setInkStyle,
  paintShape,
  drawSunlitRimArc,
  buildTaperedLimbPath,
  drawSoftBlush,
  drawWaffleTexture,
  drawDenimTexture,
  drawGroundShadow,
  drawStorybookEye,
  drawExpressiveMouth,
} from '../engine/painterly.mjs';

/**
 * Draw a soft rounded curving curl tuft (tangential S-curve, never a sharp radial spike!)
 */
function drawSoftCurlyTuft(ctx, x, y, rx, ry, angle, curlDir = 1, tone = 'mid') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, curlDir);

  const grad = ctx.createRadialGradient(-rx * 0.25, -ry * 0.35, 2, 0, 0, Math.max(rx, ry) * 1.25);
  if (tone === 'light') {
    grad.addColorStop(0, PALETTE.hairHighlight);
    grad.addColorStop(0.45, PALETTE.hairLight);
    grad.addColorStop(1, PALETTE.hairBase);
  } else if (tone === 'deep') {
    grad.addColorStop(0, PALETTE.hairBase);
    grad.addColorStop(0.65, PALETTE.hairShadow);
    grad.addColorStop(1, PALETTE.hairDeep);
  } else {
    grad.addColorStop(0, PALETTE.hairLight);
    grad.addColorStop(0.45, PALETTE.hairMid);
    grad.addColorStop(1, PALETTE.hairShadow);
  }

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      // Rounded lush puff tapering gently into a curved comma tip
      c.moveTo(-rx * 0.72, -ry * 0.35);
      c.bezierCurveTo(-rx * 0.2, -ry * 1.18, rx * 0.78, -ry * 0.98, rx * 0.98, -ry * 0.08);
      c.bezierCurveTo(rx * 1.06, ry * 0.42, rx * 0.65, ry * 0.76, rx * 0.28, ry * 0.48);
      c.bezierCurveTo(rx * 0.32, ry * 0.92, -rx * 0.45, ry * 0.98, -rx * 0.85, ry * 0.35);
      c.bezierCurveTo(-rx * 1.04, 0, -rx * 0.98, -ry * 0.22, -rx * 0.72, -ry * 0.35);
      c.closePath();
    },
    {
      fill: grad,
      strokeWidth: 1.9,
      strokeColor: PALETTE.inkDark,
      rimColor: tone === 'light' ? PALETTE.sunGoldRim : null,
      rimOffset: { x: -1.8, y: -1.8 },
      innerPassFn: (c) => {
        // Warm caramel-gold curl highlight arc
        if (tone !== 'deep') {
          c.beginPath();
          c.moveTo(-rx * 0.38, -ry * 0.45);
          c.quadraticCurveTo(rx * 0.15, -ry * 0.78, rx * 0.62, -ry * 0.22);
          setInkStyle(c, Math.max(1.8, ry * 0.22), 'rgba(232, 178, 122, 0.42)');
          c.stroke();
        }
        // Subtle inner curl swirl ink line
        c.beginPath();
        c.moveTo(-rx * 0.25, ry * 0.05);
        c.quadraticCurveTo(rx * 0.25, -ry * 0.2, rx * 0.62, ry * 0.25);
        setInkStyle(c, 1.15, 'rgba(72, 40, 20, 0.46)');
        c.stroke();
      },
    }
  );
  ctx.restore();
}

/**
 * Draw Boy's cute bare foot with 5 articulated storybook toes
 */
function drawBareFoot(ctx, ankleX, ankleY, angle, isFront = true, side = 1) {
  ctx.save();
  ctx.translate(ankleX, ankleY);
  ctx.rotate(angle);

  const skinGrad = ctx.createLinearGradient(-10, -8, 22, 12);
  skinGrad.addColorStop(0, PALETTE.skinLight);
  skinGrad.addColorStop(0.58, PALETTE.skinBase);
  skinGrad.addColorStop(1, PALETTE.skinShadow);

  const buildFoot = (c) => {
    c.beginPath();
    if (isFront) {
      c.moveTo(-7 * side, -6);
      c.bezierCurveTo(-10 * side, 4, -9 * side, 12, -3 * side, 14);
      c.bezierCurveTo(6 * side, 16, 20 * side, 15, 25 * side, 10.5);
      c.bezierCurveTo(27.5 * side, 6.5, 22 * side, 2.5, 14 * side, 0.5);
      c.bezierCurveTo(9 * side, -1.5, 7 * side, -5.5, 6.5 * side, -8.5);
      c.closePath();
    } else {
      c.moveTo(-10, -5);
      c.bezierCurveTo(-12, 5, -9, 12, -1, 13.5);
      c.bezierCurveTo(10, 14.5, 23, 13, 27.5, 8.5);
      c.bezierCurveTo(29.5, 4.5, 23.5, 0.5, 15.5, -0.5);
      c.bezierCurveTo(10, -2.5, 7.5, -6, 6.5, -8.5);
      c.closePath();
    }
  };

  paintShape(ctx, buildFoot, {
    fill: skinGrad,
    strokeWidth: 2.0,
    strokeColor: PALETTE.inkDark,
    innerPassFn: (c) => {
      c.beginPath();
      c.moveTo(-9, 11.5);
      c.quadraticCurveTo(10, 15, 26, 9.5);
      setInkStyle(c, 2.6, 'rgba(186, 122, 92, 0.34)');
      c.stroke();
    },
  });

  // 4 delicate toe division notches
  const dir = isFront ? side : 1;
  setInkStyle(ctx, 1.25, PALETTE.inkMid);
  for (let i = 0; i < 4; i++) {
    const tx = (21 - i * 2.4) * dir;
    const ty = 11.4 + i * 0.65;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx - 1.4 * dir, ty - 2.3, tx - 0.5 * dir, ty - 3.8);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw Boy's cute expressive 5-finger hand
 */
function drawBoyHand(ctx, wx, wy, angle, mode = 'relaxed', side = 1) {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(angle);
  ctx.scale(1, side);

  const handGrad = ctx.createLinearGradient(-4, -9, 18, 12);
  handGrad.addColorStop(0, PALETTE.skinLight);
  handGrad.addColorStop(0.6, PALETTE.skinBase);
  handGrad.addColorStop(1, PALETTE.skinShadow);

  const buildHand = (c) => {
    c.beginPath();
    if (mode === 'pointing') {
      c.moveTo(-2, -6);
      c.quadraticCurveTo(6, -10.5, 11.5, -7.5);
      c.quadraticCurveTo(13.5, -4.5, 10, -3);
      c.lineTo(24.5, -4);
      c.quadraticCurveTo(27.5, -1.8, 24.5, 1.2);
      c.lineTo(12.5, 2.2);
      c.bezierCurveTo(15, 5.5, 13, 10, 7.5, 10);
      c.bezierCurveTo(2.5, 10.5, -2, 8.5, -3.5, 4.5);
      c.closePath();
    } else if (mode === 'openJoy') {
      c.moveTo(-3, -6);
      c.bezierCurveTo(4, -12.5, 9.5, -13.5, 10.5, -9.5);
      c.bezierCurveTo(10.5, -6.5, 7.5, -5, 9.5, -4);
      c.bezierCurveTo(16.5, -6.8, 22, -6.5, 22, -3.2);
      c.bezierCurveTo(22, -0.8, 16.5, -0.8, 13.5, 0);
      c.bezierCurveTo(20.5, -0.5, 24.5, 1, 23.5, 3.8);
      c.bezierCurveTo(22.5, 6, 15.5, 4.5, 12.5, 4.5);
      c.bezierCurveTo(18.5, 6.5, 20, 8.5, 18, 10.2);
      c.bezierCurveTo(15, 11.5, 9.5, 8.5, 6.5, 9);
      c.bezierCurveTo(2, 10, -2.5, 8, -3.5, 4);
      c.closePath();
    } else {
      c.moveTo(-3, -5.8);
      c.bezierCurveTo(2, -9.8, 8, -10.5, 9.8, -7);
      c.bezierCurveTo(10.2, -4.8, 8, -3.2, 9, -2.2);
      c.bezierCurveTo(14.5, -3.2, 19.8, -0.8, 19.8, 2.2);
      c.bezierCurveTo(19.8, 5.2, 17.8, 8.2, 14, 9.2);
      c.bezierCurveTo(9.5, 10.5, 4, 10, -1, 7.8);
      c.quadraticCurveTo(-3.8, 5.8, -3.8, 2);
      c.closePath();
    }
  };

  paintShape(ctx, buildHand, {
    fill: handGrad,
    strokeWidth: 1.85,
    strokeColor: PALETTE.inkDark,
  });

  if (mode === 'relaxed' || mode === 'running') {
    setInkStyle(ctx, 1.1, 'rgba(92, 58, 38, 0.52)');
    ctx.beginPath();
    ctx.moveTo(11.5, 0.6);
    ctx.quadraticCurveTo(15.5, 1.5, 18.2, 3.0);
    ctx.moveTo(10, 4.0);
    ctx.quadraticCurveTo(14, 5.0, 16.8, 6.0);
    ctx.moveTo(8, 7.0);
    ctx.quadraticCurveTo(11, 7.8, 13.5, 8.2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw Boy's articulated leg (light denim jeans + rolled reverse-denim cuff + bare ankle & foot)
 */
function drawBoyLeg(ctx, hipX, hipY, kneeX, kneeY, ankleX, ankleY, footAngle, opts = {}) {
  const { isBack = false, side = 1, isFrontFoot = true } = opts;

  const dx = ankleX - kneeX;
  const dy = ankleY - kneeY;
  const shinLen = Math.hypot(dx, dy) || 1;
  const ux = dx / shinLen;
  const uy = dy / shinLen;
  const cuffX = ankleX - ux * 20;
  const cuffY = ankleY - uy * 20;

  // 1. Bare lower shin & ankle
  const skinGrad = ctx.createLinearGradient(cuffX - 10, cuffY, ankleX + 10, ankleY);
  skinGrad.addColorStop(0, isBack ? PALETTE.skinMid : PALETTE.skinLight);
  skinGrad.addColorStop(0.55, isBack ? PALETTE.skinShadow : PALETTE.skinBase);
  skinGrad.addColorStop(1, PALETTE.skinShadow);

  paintShape(
    ctx,
    (c) => buildTaperedLimbPath(c, cuffX - ux * 4, cuffY - uy * 4, ankleX, ankleY, 9.2, 7.6, 0.04),
    {
      fill: skinGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
    }
  );

  // 2. Bare foot
  drawBareFoot(ctx, ankleX, ankleY, footAngle, isFrontFoot, side);

  // 3. Denim trouser leg (hip -> knee -> cuff)
  const denimGrad = ctx.createLinearGradient(hipX - 24, hipY, hipX + 24, cuffY);
  if (isBack) {
    denimGrad.addColorStop(0, PALETTE.denimMid);
    denimGrad.addColorStop(1, PALETTE.denimShadow);
  } else {
    denimGrad.addColorStop(0, PALETTE.denimHighlight);
    denimGrad.addColorStop(0.48, PALETTE.denimBase);
    denimGrad.addColorStop(1, PALETTE.denimShadow);
  }

  const tdx = kneeX - hipX;
  const tdy = kneeY - hipY;
  const tlen = Math.hypot(tdx, tdy) || 1;
  const tnx = -tdy / tlen;
  const tny = tdx / tlen;
  const cnx = -uy;
  const cny = ux;

  // Normalized averaged knee normal
  let knx = tnx + cnx;
  let kny = tny + cny;
  const klen = Math.hypot(knx, kny) || 1;
  knx /= klen;
  kny /= klen;

  const rHip = 19.5;
  const rKnee = 16.0;
  const rCuff = 14.0;

  const buildPantLeg = (c) => {
    c.beginPath();
    c.moveTo(hipX + tnx * rHip, hipY + tny * rHip);
    c.quadraticCurveTo(
      (hipX + kneeX) * 0.5 + tnx * rHip * 0.96,
      (hipY + kneeY) * 0.5 + tny * rHip * 0.96,
      kneeX + knx * rKnee,
      kneeY + kny * rKnee
    );
    c.quadraticCurveTo(
      (kneeX + cuffX) * 0.5 + cnx * rCuff * 1.05,
      (kneeY + cuffY) * 0.5 + cny * rCuff * 1.05,
      cuffX + cnx * rCuff,
      cuffY + cny * rCuff
    );
    c.lineTo(cuffX - cnx * rCuff, cuffY - cny * rCuff);
    c.quadraticCurveTo(
      (kneeX + cuffX) * 0.5 - cnx * rCuff * 1.04,
      (kneeY + cuffY) * 0.5 - cny * rCuff * 1.04,
      kneeX - knx * rKnee,
      kneeY - kny * rKnee
    );
    c.quadraticCurveTo(
      (hipX + kneeX) * 0.5 - tnx * rHip * 0.96,
      (hipY + kneeY) * 0.5 - tny * rHip * 0.96,
      hipX - tnx * rHip,
      hipY - tny * rHip
    );
    c.closePath();
  };

  paintShape(ctx, buildPantLeg, {
    fill: denimGrad,
    strokeWidth: 2.15,
    strokeColor: PALETTE.inkDark,
    textureFn: (c) =>
      drawDenimTexture(
        c,
        Math.min(hipX, cuffX, kneeX) - 35,
        Math.min(hipY, cuffY, kneeY) - 25,
        140,
        180,
        0.11
      ),
    innerPassFn: (c) => {
      // Soft knee fabric fold creases
      setInkStyle(c, 1.3, 'rgba(56, 78, 98, 0.52)');
      c.beginPath();
      c.moveTo(kneeX - knx * 8, kneeY - kny * 8);
      c.quadraticCurveTo(kneeX, kneeY + 3, kneeX + knx * 7, kneeY + kny * 7);
      c.stroke();

      if (!isBack) {
        const hl = c.createRadialGradient(
          lerp(hipX, kneeX, 0.45) - 3,
          lerp(hipY, kneeY, 0.45),
          2,
          lerp(hipX, kneeX, 0.45),
          lerp(hipY, kneeY, 0.45),
          24
        );
        hl.addColorStop(0, 'rgba(225, 238, 248, 0.34)');
        hl.addColorStop(1, 'rgba(225, 238, 248, 0)');
        c.fillStyle = hl;
        c.fillRect(hipX - 45, hipY - 25, 110, 160);
      }
    },
  });

  // 4. Rolled-up lighter reverse-denim cuff!
  const cuffAngle = Math.atan2(dy, dx) - Math.PI / 2;
  ctx.save();
  ctx.translate(cuffX, cuffY);
  ctx.rotate(cuffAngle);

  const cuffGrad = ctx.createLinearGradient(-16, -6, 16, 10);
  cuffGrad.addColorStop(0, '#c6d8e3');
  cuffGrad.addColorStop(0.55, PALETTE.denimCuff);
  cuffGrad.addColorStop(1, '#849fb2');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(-16, -5.5, 32, 13.5, 4.5);
    },
    {
      fill: cuffGrad,
      strokeWidth: 2.05,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        setInkStyle(c, 1.0, 'rgba(84, 108, 128, 0.5)');
        c.beginPath();
        c.moveTo(-13.5, 5.0);
        c.lineTo(13.5, 5.0);
        c.stroke();
      },
    }
  );
  ctx.restore();
}

/**
 * Draw Boy's articulated arm (baggy waffle-knit upper sleeve + pushed-up cuff + bare forearm + hand)
 */
function drawBoyArm(ctx, sx, sy, ex, ey, wx, wy, opts = {}) {
  const { isBack = false, handMode = 'relaxed', side = 1, blendShoulder = false } = opts;

  const fdx = wx - ex;
  const fdy = wy - ey;
  const flen = Math.hypot(fdx, fdy) || 1;
  const fux = fdx / flen;
  const fuy = fdy / flen;
  const cuffX = ex + fux * 8;
  const cuffY = ey + fuy * 8;

  // 1. Bare warm forearm
  const skinGrad = ctx.createLinearGradient(cuffX - 8, cuffY, wx + 8, wy);
  skinGrad.addColorStop(0, isBack ? PALETTE.skinMid : PALETTE.skinLight);
  skinGrad.addColorStop(0.6, isBack ? PALETTE.skinShadow : PALETTE.skinBase);
  skinGrad.addColorStop(1, PALETTE.skinShadow);

  paintShape(
    ctx,
    (c) => buildTaperedLimbPath(c, cuffX - fux * 4, cuffY - fuy * 4, wx, wy, 8.6, 6.8, 0.04),
    {
      fill: skinGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
    }
  );

  // 2. Expressive 5-finger hand
  const handAngle = Math.atan2(fdy, fdx);
  drawBoyHand(ctx, wx, wy, handAngle, handMode, side);

  // 3. Relaxed waffle-knit upper sleeve (shoulder -> pushed-up elbow cuff)
  const sleeveGrad = ctx.createLinearGradient(sx - 18, sy, cuffX + 18, cuffY);
  if (isBack) {
    sleeveGrad.addColorStop(0, PALETTE.creamBase);
    sleeveGrad.addColorStop(1, PALETTE.creamShadow);
  } else {
    sleeveGrad.addColorStop(0, PALETTE.creamHighlight);
    sleeveGrad.addColorStop(0.55, PALETTE.creamBase);
    sleeveGrad.addColorStop(1, PALETTE.creamShadow);
  }

  const sdx = cuffX - sx;
  const sdy = cuffY - sy;
  const slen = Math.hypot(sdx, sdy) || 1;
  const sux = sdx / slen;
  const suy = sdy / slen;
  const snx = -suy;
  const sny = sux;
  const rSh = 15.6;
  const rCuff = 13.0;
  const smx = (sx + cuffX) * 0.5;
  const smy = (sy + cuffY) * 0.5;
  const srm = (rSh + rCuff) * 0.5 * 1.13;

  paintShape(
    ctx,
    (c) => buildTaperedLimbPath(c, sx, sy, cuffX, cuffY, rSh, rCuff, 0.13),
    {
      fill: sleeveGrad,
      noStroke: blendShoulder,
      strokeWidth: blendShoulder ? 0 : 2.1,
      strokeColor: PALETTE.inkDark,
      rimColor: isBack ? null : 'rgba(255, 240, 198, 0.55)',
      rimOffset: { x: -1.8, y: -1.6 },
      textureFn: (c) =>
        drawWaffleTexture(
          c,
          Math.min(sx, cuffX) - 28,
          Math.min(sy, cuffY) - 28,
          Math.abs(cuffX - sx) + 64,
          Math.abs(cuffY - sy) + 64,
          7.0,
          0.18
        ),
    }
  );

  if (blendShoulder) {
    // Stroke outer sleeve contours so the shoulder blends smoothly into the shirt silhouette!
    // (Leaves inner chest-facing shoulder side seamlessly open — zero floating oval across chest!)
    const aPlus = Math.atan2(sny, snx);
    const aMinus = aPlus + Math.PI;
    setInkStyle(ctx, 2.05, PALETTE.inkDark);

    // Side 1 (+n) from slightly past shoulder center down to cuff
    ctx.beginPath();
    ctx.moveTo(sx + snx * rSh * 0.96 + sux * 2, sy + sny * rSh * 0.96 + suy * 2);
    ctx.quadraticCurveTo(smx + snx * srm, smy + sny * srm, cuffX + snx * rCuff, cuffY + sny * rCuff);
    ctx.stroke();

    // Side 2 (-n) from shoulder down to cuff (+ smooth top-outer shoulder arc when not side-running!)
    ctx.beginPath();
    if (opts.outerShoulderCap) {
      ctx.arc(sx, sy, rSh, aMinus - Math.PI * 0.56, aMinus, false);
    } else {
      ctx.moveTo(sx - snx * rSh * 0.96 + sux * 2, sy - sny * rSh * 0.96 + suy * 2);
    }
    ctx.quadraticCurveTo(smx - snx * srm, smy - sny * srm, cuffX - snx * rCuff, cuffY - sny * rCuff);
    ctx.stroke();

    // Subtle soft-sepia cloth fold crease near armpit/shoulder join (instead of harsh closed seam!)
    setInkStyle(ctx, 1.15, 'rgba(128, 104, 80, 0.42)');
    ctx.beginPath();
    ctx.arc(sx, sy, rSh * 0.88, aMinus + 0.35, aPlus - 0.35, true);
    ctx.stroke();
  }

  // 4. Pushed-up bunched waffle cuff folds!
  const cuffAngle = Math.atan2(sdy, sdx) - Math.PI / 2;
  ctx.save();
  ctx.translate(cuffX, cuffY);
  ctx.rotate(cuffAngle);

  const cuffGrad = ctx.createLinearGradient(-15, -8, 15, 8);
  cuffGrad.addColorStop(0, PALETTE.creamHighlight);
  cuffGrad.addColorStop(0.6, PALETTE.creamBase);
  cuffGrad.addColorStop(1, PALETTE.creamDeep);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(-14.2, -7.2, 28.4, 12.2, 5.5);
    },
    {
      fill: cuffGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        setInkStyle(c, 1.15, 'rgba(120, 96, 72, 0.5)');
        c.beginPath();
        c.moveTo(-11, -1.2);
        c.quadraticCurveTo(0, 1.8, 11, -1.2);
        c.stroke();
      },
    }
  );
  ctx.restore();
}

/**
 * Draw Boy's complete expressive head + LUSH FLUFFY CURLY CHESTNUT HAIR!
 * Faithfully matches the soft rounded overlapping curls of character_sheet.jpg!
 */
export function drawBoyHead(ctx, opts = {}) {
  const {
    headTurn = 0,
    headTilt = 0,
    hairBounce = 0,
    breathPhase = 0,
    blink = 0,
    eyeGazeX = 0,
    eyeGazeY = 0,
    mood = 'happy',
    viseme = 'smile',
    mouthOpen = 0,
  } = opts;

  const turn = clamp(headTurn, -0.75, 0.75);
  const bounce = clamp(hairBounce, -1.5, 1.5);
  const hairBreath = Math.sin(breathPhase) * 1.2;

  ctx.save();
  ctx.rotate(headTilt);

  // === 1. BACK FLUFFY HAIR MASS (rich deep chestnut cloud behind ears & neck) ===
  ctx.save();
  ctx.translate(0, bounce * 2.5);
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-40, 20);
      c.bezierCurveTo(-58, 14, -64, -14, -52, -32);
      c.bezierCurveTo(-54, -52, -32, -68, -10, -64);
      c.bezierCurveTo(6, -72, 34, -68, 46, -46);
      c.bezierCurveTo(62, -32, 62, -2, 48, 14);
      c.bezierCurveTo(46, 26, 30, 32, 16, 28);
      c.quadraticCurveTo(0, 32, -40, 20);
      c.closePath();
    },
    {
      fill: PALETTE.hairDeep,
      strokeWidth: 2.15,
      strokeColor: PALETTE.inkDark,
    }
  );
  ctx.restore();

  // === 2. CUTE ROUNDED EARS ===
  const earScaleL = clamp(1 - turn * 0.45, 0.4, 1.15);
  const earScaleR = clamp(1 + turn * 0.45, 0.4, 1.15);
  for (const [side, sc] of [[-1, earScaleL], [1, earScaleR]]) {
    ctx.save();
    ctx.translate(side * 40.5 - turn * 6, 5);
    ctx.scale(side * sc, 1);
    const earGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 12);
    earGrad.addColorStop(0, PALETTE.skinLight);
    earGrad.addColorStop(0.65, PALETTE.skinBase);
    earGrad.addColorStop(1, PALETTE.skinShadow);
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.ellipse(0, 0, 9.0, 11.6, 0.12, 0, Math.PI * 2);
      },
      {
        fill: earGrad,
        strokeWidth: 1.95,
        strokeColor: PALETTE.inkDark,
        innerPassFn: (c) => {
          setInkStyle(c, 1.35, 'rgba(138, 86, 62, 0.55)');
          c.beginPath();
          c.arc(-1, 0, 4.8, -0.9, 1.4);
          c.stroke();
        },
      }
    );
    ctx.restore();
  }

  // === 3. SOFT STORYBOOK CHILD FACE CONTOUR ===
  const faceGrad = ctx.createRadialGradient(-12 + turn * 8, -12, 6, 0, 4, 52);
  faceGrad.addColorStop(0, PALETTE.skinLight);
  faceGrad.addColorStop(0.58, PALETTE.skinBase);
  faceGrad.addColorStop(0.88, PALETTE.skinMid);
  faceGrad.addColorStop(1, PALETTE.skinShadow);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(0, -40);
      c.bezierCurveTo(31, -40, 41.5, -17, 40, 6);
      c.bezierCurveTo(38.5, 25, 22, 38.5, 0 + turn * 3.5, 40.5);
      c.bezierCurveTo(-22, 38.5, -38.5, 25, -40, 6);
      c.bezierCurveTo(-41.5, -17, -31, -40, 0, -40);
      c.closePath();
    },
    {
      fill: faceGrad,
      strokeWidth: 2.15,
      strokeColor: PALETTE.inkDark,
      rimColor: 'rgba(255, 248, 232, 0.5)',
      rimOffset: { x: -2.0, y: -1.6 },
      innerPassFn: (c) => {
        // Warm forehead shadow cast by fluffy curls
        const bangShadow = c.createLinearGradient(0, -40, 0, -10);
        bangShadow.addColorStop(0, 'rgba(166, 108, 76, 0.34)');
        bangShadow.addColorStop(1, 'rgba(166, 108, 76, 0)');
        c.fillStyle = bangShadow;
        c.fillRect(-44, -42, 88, 34);
      },
    }
  );

  // === 4. EXPRESSIVE FACIAL FEATURES ===
  const fx = turn * 12;
  const surprised = mood === 'surprised' || mood === 'amazed' ? 1 : 0;

  drawSoftBlush(ctx, fx - 23, 15.5, 11.2, 7.0, mood === 'joyful' ? 0.52 : 0.42, {
    freckles: true,
    hatches: mood === 'joyful' || mood === 'surprised',
  });
  drawSoftBlush(ctx, fx + 23, 15.5, 11.2, 7.0, mood === 'joyful' ? 0.52 : 0.42, {
    freckles: true,
    hatches: mood === 'joyful' || mood === 'surprised',
  });

  const eyeY = 2.8;
  const eyeSpacing = 17.6;
  drawStorybookEye(ctx, {
    x: fx - eyeSpacing * (1 - turn * 0.14),
    y: eyeY,
    rx: 9.5,
    ry: 10.5,
    gazeX: eyeGazeX,
    gazeY: eyeGazeY,
    blink,
    surprised,
    irisDark: '#472512',
    irisMid: '#6e3d20',
    irisWarm: '#b6783f',
    side: -1,
  });
  drawStorybookEye(ctx, {
    x: fx + eyeSpacing * (1 + turn * 0.14),
    y: eyeY,
    rx: 9.5,
    ry: 10.5,
    gazeX: eyeGazeX,
    gazeY: eyeGazeY,
    blink,
    surprised,
    irisDark: '#472512',
    irisMid: '#6e3d20',
    irisWarm: '#b6783f',
    side: 1,
  });

  // Expressive chestnut eyebrows
  let browLiftL = 0;
  let browLiftR = 0;
  let browTiltL = 0;
  let browTiltR = 0;
  if (mood === 'surprised' || mood === 'amazed') {
    browLiftL = -5.2;
    browLiftR = -5.2;
  } else if (mood === 'curious') {
    browLiftL = -3.6;
    browLiftR = 0.8;
    browTiltR = 0.14;
  } else if (mood === 'thoughtful') {
    browLiftL = 1.5;
    browLiftR = -1.5;
    browTiltL = 0.16;
  } else if (mood === 'joyful') {
    browLiftL = -2.6;
    browLiftR = -2.6;
  }

  for (const [side, lift, tilt] of [
    [-1, browLiftL, browTiltL],
    [1, browLiftR, browTiltR],
  ]) {
    ctx.save();
    ctx.translate(fx + side * (eyeSpacing * (1 + side * turn * 0.12)), eyeY - 15.8 + lift);
    ctx.rotate(side * tilt);
    ctx.beginPath();
    ctx.moveTo(-8.2, 1.4);
    ctx.quadraticCurveTo(0, -3.0, 8.2, 1.1);
    setInkStyle(ctx, 2.6, '#5a351e');
    ctx.stroke();
    ctx.restore();
  }

  // Cute small button nose
  const noseX = fx + turn * 3.2;
  const noseY = 12.2;
  ctx.beginPath();
  ctx.arc(noseX, noseY + 1.4, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fillStyle = 'rgba(206, 140, 106, 0.36)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(noseX - 3.0, noseY);
  ctx.quadraticCurveTo(noseX + turn * 1.8, noseY + 2.8, noseX + 2.8, noseY + 0.4);
  setInkStyle(ctx, 1.65, PALETTE.inkMid);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(noseX - 0.8, noseY - 1.2, 1.5, 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 248, 236, 0.65)';
  ctx.fill();

  // Lip-sync mouth
  drawExpressiveMouth(ctx, fx + turn * 1.8, 25.0, 0.94, viseme, mouthOpen, {
    isMom: false,
    mood,
  });

  // === 5. LUSH FLUFFY CURLY CHESTNUT HAIR (Soft rounded overlapping cloud of curls!) ===
  ctx.save();
  ctx.translate(0, bounce * 3.0 + hairBreath * 0.4);

  // Unified sculpted fluffy curly crown silhouette (soft billowing lobes — ZERO spiky triangles!)
  const crownGrad = ctx.createRadialGradient(-16, -48, 8, 2, -26, 66);
  crownGrad.addColorStop(0, PALETTE.hairHighlight);
  crownGrad.addColorStop(0.28, PALETTE.hairLight);
  crownGrad.addColorStop(0.62, PALETTE.hairBase);
  crownGrad.addColorStop(1, PALETTE.hairShadow);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      // Start at left sideburn cheek curl
      c.moveTo(-40, 4);
      // Left ear-hugging billowing curl lobes
      c.bezierCurveTo(-56, -2, -59, -24, -46, -34);
      // Upper-left fluffy cloud curl
      c.bezierCurveTo(-52, -52, -32, -65, -14, -58);
      // Top-center lush double-wave crown
      c.bezierCurveTo(-6, -72, 18, -70, 24, -56);
      // Upper-right fluffy cloud curl
      c.bezierCurveTo(42, -62, 56, -44, 48, -28);
      // Right temple billowing curl lobe
      c.bezierCurveTo(60, -16, 54, 4, 40, 6);
      // Sweeping curved inner bangs framing forehead smoothly above eyebrows!
      c.bezierCurveTo(38, -10, 32, -20, 24, -18);
      c.bezierCurveTo(22, -27, 10, -29, 4, -21);
      c.bezierCurveTo(-4, -29, -18, -28, -22, -18);
      c.bezierCurveTo(-30, -22, -38, -10, -40, 4);
      c.closePath();
    },
    {
      fill: crownGrad,
      strokeWidth: 2.15,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: -2.4, y: -2.2 },
      innerPassFn: (c) => {
        // Rich internal watercolor curl depth shadows & sunlit honey-gold rim ribbons!
        drawSunlitRimArc(
          c,
          (cc) => {
            cc.beginPath();
            cc.moveTo(-36, -42);
            cc.quadraticCurveTo(-12, -62, 16, -52);
          },
          3.0,
          0.54
        );
        setInkStyle(c, 3.6, 'rgba(232, 178, 122, 0.36)');
        c.beginPath();
        c.moveTo(-38, -26);
        c.quadraticCurveTo(-24, -40, -6, -34);
        c.moveTo(14, -42);
        c.quadraticCurveTo(32, -46, 40, -26);
        c.stroke();

        // Delicate curving curl-separation ink strokes (gives authentic hand-drawn curly hair feel!)
        setInkStyle(c, 1.45, 'rgba(72, 40, 20, 0.56)');
        const swirls = [
          [-38, -22, -26, -38, -12, -30],
          [-18, -52, -2, -58, 8, -44],
          [10, -52, 28, -50, 34, -34],
          [26, -24, 42, -28, 44, -10],
          [-44, -10, -34, -16, -28, -4],
          [-12, -34, 2, -42, 16, -30],
        ];
        for (const [x0, y0, cx, cy, x1, y1] of swirls) {
          c.beginPath();
          c.moveTo(x0, y0);
          c.quadraticCurveTo(cx, cy, x1, y1);
          c.stroke();
        }
      },
    }
  );

  // Overlapping soft tangential curl tufts for dimensional charm & secondary bounce!
  drawSoftCurlyTuft(ctx, -36, -34, 15, 11, deg(-38 - bounce * 4), 1, 'light');
  drawSoftCurlyTuft(ctx, -6, -54, 17, 11.5, deg(-12 - bounce * 6), 1, 'light');
  drawSoftCurlyTuft(ctx, 24, -46, 16, 11, deg(24 + bounce * 6), -1, 'mid');
  drawSoftCurlyTuft(ctx, 41, -18, 13.5, 10, deg(68 + bounce * 4), -1, 'mid');
  drawSoftCurlyTuft(ctx, -42, -12, 13.5, 10, deg(-102 - bounce * 4), 1, 'mid');

  // Forehead soft sweeping bangs curls (gentle C-curls above brows)
  drawSoftCurlyTuft(ctx, -17 + turn * 4, -27, 14, 9.5, deg(148 - bounce * 3), -1, 'mid');
  drawSoftCurlyTuft(ctx, 4 + turn * 5, -30, 15.5, 10, deg(165 - bounce * 3), 1, 'light');
  drawSoftCurlyTuft(ctx, 23 + turn * 4, -25, 13.5, 9, deg(28 + bounce * 3), 1, 'mid');

  // Soft playful wispy top curl strands (tiny delicate ink flourishes like character_sheet.jpg!)
  setInkStyle(ctx, 1.75, PALETTE.inkDark);
  ctx.beginPath();
  ctx.moveTo(-2, -63);
  ctx.quadraticCurveTo(6, -72, 15, -66);
  ctx.moveTo(-26, -56);
  ctx.quadraticCurveTo(-36, -64, -41, -55);
  ctx.moveTo(38, -46);
  ctx.quadraticCurveTo(49, -51, 51, -40);
  ctx.stroke();

  ctx.restore(); // hair bounce
  ctx.restore(); // head tilt
}

/**
 * Draw full articulated Boy character!
 * Origin (x, y) is ground plane directly beneath his bare feet.
 */
export function drawBoy(ctx, pose = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    facing = 'front',
    runPhase = null,
    walkPhase = null,
    breathPhase = 0,
    headTilt = 0,
    headTurn = null,
    blink = 0,
    eyeGazeX = 0,
    eyeGazeY = 0,
    mood = 'happy',
    viseme = 'smile',
    mouthOpen = 0,
    armPose = 'relaxed',
    sittingOnStool = false,
    showShadow = true,
  } = pose;

  const flipX = facing === 'left' ? -1 : 1;
  const resolvedTurn =
    headTurn !== null
      ? headTurn
      : facing === 'right' || facing === 'left'
      ? 0.3
      : facing === 'threeQuarter'
      ? 0.18
      : 0;

  const isRunning = runPhase !== null;
  const isWalking = !isRunning && walkPhase !== null;
  const phase = isRunning ? runPhase : isWalking ? walkPhase : 0;

  const breath = Math.sin(breathPhase);
  const runBob = isRunning ? Math.abs(Math.sin(phase)) * -10 : isWalking ? Math.abs(Math.sin(phase)) * -6 : 0;
  const torsoLean = isRunning ? 0.21 : isWalking ? 0.05 : sittingOnStool ? 0.03 : 0;
  const hairBounce = isRunning
    ? Math.sin(phase * 2 - 0.8) * 0.9
    : isWalking
    ? Math.sin(phase * 2 - 0.6) * 0.3
    : breath * 0.08;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flipX, scale);

  if (showShadow && !sittingOnStool) {
    const shadowScale = isRunning ? 0.82 + Math.cos(phase * 2) * 0.09 : 1;
    drawGroundShadow(ctx, isRunning ? 6 : 0, 2, 54 * shadowScale, 10.5 * shadowScale, 0.23);
  }

  const pelvisX = isRunning ? 6 : 0;
  const pelvisY = sittingOnStool ? -116 : isRunning ? -128 + runBob + breath * 1.0 : -136 + runBob + breath * 1.2;

  // --- LEG KINEMATICS ---
  const thighLen = 58;
  const shinLen = 64;

  const backHipX = pelvisX - (isRunning ? 6 : 17);
  const backHipY = pelvisY + 4;
  const frontHipX = pelvisX + (isRunning ? 8 : 17);
  const frontHipY = pelvisY + 4;

  let backAnkleX, backAnkleY, frontAnkleX, frontAnkleY, backFootA, frontFootA;
  let bendBack = 1;
  let bendFront = 1;

  if (sittingOnStool) {
    const swingA = Math.sin(breathPhase * 1.4) * 12;
    const swingB = Math.sin(breathPhase * 1.4 + 1.2) * 12;
    backAnkleX = backHipX + 36 + swingA;
    backAnkleY = backHipY + 86;
    frontAnkleX = frontHipX + 42 + swingB;
    frontAnkleY = frontHipY + 88;
    backFootA = 0.2 + swingA * 0.01;
    frontFootA = 0.16 + swingB * 0.01;
    bendBack = -1;
    bendFront = -1;
  } else if (isRunning) {
    const s1 = Math.sin(phase);
    const c1 = Math.cos(phase);
    const s2 = Math.sin(phase + Math.PI);
    const c2 = Math.cos(phase + Math.PI);

    // Joyfully dynamic running stride: bent front knee driving forward + lifted trailing bare foot kicking up!
    frontAnkleX = frontHipX + s1 * 52;
    frontAnkleY = Math.min(-14, -18 - Math.max(0, c1) * 24 - Math.max(0, -s1) * 48);
    frontFootA = clamp(-s1 * 0.26 + Math.max(0, -s1) * 0.42, -0.35, 0.58);

    backAnkleX = backHipX + s2 * 56;
    backAnkleY = Math.min(-14, -18 - Math.max(0, c2) * 24 - Math.max(0, -s2) * 50);
    backFootA = clamp(-s2 * 0.26 + Math.max(0, -s2) * 0.42, -0.35, 0.58);

    bendBack = -1;
    bendFront = -1;
  } else if (isWalking) {
    const s1 = Math.sin(phase);
    const c1 = Math.cos(phase);
    const s2 = Math.sin(phase + Math.PI);
    const c2 = Math.cos(phase + Math.PI);

    frontAnkleX = frontHipX + s1 * 34;
    frontAnkleY = -12 - Math.max(0, c1) * 14;
    frontFootA = -s1 * 0.22;

    backAnkleX = backHipX + s2 * 34;
    backAnkleY = -12 - Math.max(0, c2) * 14;
    backFootA = -s2 * 0.22;

    bendBack = -1;
    bendFront = -1;
  } else {
    backAnkleX = -24;
    backAnkleY = -12;
    backFootA = -0.04;
    frontAnkleX = 24;
    frontAnkleY = -12;
    frontFootA = 0.04;
    bendBack = -1;
    bendFront = 1;
  }

  const backIK = solve2BoneIK(backHipX, backHipY, backAnkleX, backAnkleY, thighLen, shinLen, bendBack);
  const frontIK = solve2BoneIK(frontHipX, frontHipY, frontAnkleX, frontAnkleY, thighLen, shinLen, bendFront);

  // --- UPPER BODY & ARM KINEMATICS ---
  const torsoLen = 102;
  const shoulderCenterX = pelvisX + Math.sin(torsoLean) * torsoLen;
  const shoulderCenterY = pelvisY - Math.cos(torsoLean) * torsoLen;

  const shoulderSpread = isRunning ? 18 : 36;
  const backShX = isRunning ? shoulderCenterX + shoulderSpread : shoulderCenterX - shoulderSpread;
  const backShY = shoulderCenterY + 6;
  const frontShX = isRunning ? shoulderCenterX - shoulderSpread : shoulderCenterX + shoulderSpread;
  const frontShY = shoulderCenterY + 7;

  const upperArmL = 44;
  const forearmL = 42;

  let backWristX, backWristY, frontWristX, frontWristY;
  let backBend = 1;
  let frontBend = -1;
  let backHandMode = 'relaxed';
  let frontHandMode = 'relaxed';

  const resolvedArmPose = isRunning ? 'running' : armPose;

  if (resolvedArmPose === 'running') {
    const swing = Math.sin(phase);
    // Natural joyful running arm pump facing RIGHT:
    // Near arm pumps cleanly clear BEHIND hip when front leg drives forward; far arm pumps UP & FORWARD!
    const frontSwing = -swing;
    const backSwing = swing;

    frontWristX = frontShX + frontSwing * 28 - 4;
    frontWristY = frontShY + 48 - Math.max(0, frontSwing) * 26;
    // Human elbows facing right ALWAYS flex forward/up -> bendDir = +1! (Zero awkward arm-across-chest!)
    frontBend = 1;

    backWristX = backShX + backSwing * 42 + 12;
    backWristY = backShY + 34 - Math.max(0, backSwing) * 24;
    backBend = 1;

    frontHandMode = 'running';
    backHandMode = 'running';
  } else if (resolvedArmPose === 'openJoy') {
    frontWristX = frontShX + 52;
    frontWristY = frontShY - 34 + breath * 3;
    backWristX = backShX - 52;
    backWristY = backShY - 34 + breath * 3;
    frontBend = 1;
    backBend = -1;
    frontHandMode = 'openJoy';
    backHandMode = 'openJoy';
  } else if (resolvedArmPose === 'pointingRight') {
    frontWristX = frontShX + 66;
    frontWristY = frontShY - 22 + breath * 2;
    backWristX = backShX - 16;
    backWristY = backShY + 70;
    frontBend = 1; // elbow naturally below line to raised pointing hand!
    backBend = 1;
    frontHandMode = 'pointing';
    backHandMode = 'relaxed';
  } else if (resolvedArmPose === 'restingStool') {
    frontWristX = frontShX + 10;
    frontWristY = frontShY + 76;
    backWristX = backShX - 10;
    backWristY = backShY + 76;
    frontBend = -1;
    backBend = 1;
  } else {
    const sway = breath * 2.0;
    backWristX = backShX - 10 - sway * 0.4;
    backWristY = backShY + 76;
    frontWristX = frontShX + 10 + sway * 0.4;
    frontWristY = frontShY + 76;
    backBend = 1;
    frontBend = -1;
  }

  const backArmIK = solve2BoneIK(backShX, backShY, backWristX, backWristY, upperArmL, forearmL, backBend);
  const frontArmIK = solve2BoneIK(frontShX, frontShY, frontWristX, frontWristY, upperArmL, forearmL, frontBend);

  // LAYER 1: BACK ARM
  drawBoyArm(ctx, backShX, backShY, backArmIK.x, backArmIK.y, backWristX, backWristY, {
    isBack: true,
    handMode: backHandMode,
    side: -1,
  });

  // LAYER 2: BACK LEG
  drawBoyLeg(ctx, backHipX, backHipY, backIK.x, backIK.y, backAnkleX, backAnkleY, backFootA, {
    isBack: true,
    side: -1,
    isFrontFoot: !isRunning && !isWalking,
  });

  // LAYER 3: FRONT LEG
  drawBoyLeg(ctx, frontHipX, frontHipY, frontIK.x, frontIK.y, frontAnkleX, frontAnkleY, frontFootA, {
    isBack: false,
    side: 1,
    isFrontFoot: !isRunning && !isWalking,
  });

  // LAYER 4: DENIM PELVIS / WAISTBAND / POCKETS
  ctx.save();
  ctx.translate(pelvisX, pelvisY);
  ctx.rotate(torsoLean * 0.5);

  const pelvisGrad = ctx.createLinearGradient(-34, -22, 34, 18);
  pelvisGrad.addColorStop(0, PALETTE.denimHighlight);
  pelvisGrad.addColorStop(0.5, PALETTE.denimBase);
  pelvisGrad.addColorStop(1, PALETTE.denimShadow);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-34, -18);
      c.quadraticCurveTo(0, -14, 34, -18);
      c.bezierCurveTo(37, 0, 35, 14, 24, 18);
      c.lineTo(2, 16);
      c.lineTo(0, 12);
      c.lineTo(-2, 16);
      c.lineTo(-24, 18);
      c.bezierCurveTo(-35, 14, -37, 0, -34, -18);
      c.closePath();
    },
    {
      fill: pelvisGrad,
      strokeWidth: 2.15,
      strokeColor: PALETTE.inkDark,
      textureFn: (c) => drawDenimTexture(c, -40, -22, 80, 46, 0.12),
      innerPassFn: (c) => {
        setInkStyle(c, 1.4, 'rgba(54, 78, 98, 0.65)');
        c.beginPath();
        c.moveTo(-33, -9);
        c.quadraticCurveTo(0, -6, 33, -9);
        c.stroke();

        c.beginPath();
        c.arc(2, -13, 3.0, 0, Math.PI * 2);
        c.fillStyle = '#c5b49b';
        c.fill();
        setInkStyle(c, 1.3, PALETTE.inkDark);
        c.stroke();

        c.beginPath();
        c.moveTo(0, -8);
        c.lineTo(0, 11);
        c.quadraticCurveTo(6, 8, 6, -6);
        setInkStyle(c, 1.3, 'rgba(54, 78, 98, 0.72)');
        c.stroke();

        setInkStyle(c, 1.4, 'rgba(54, 78, 98, 0.72)');
        c.beginPath();
        c.moveTo(-33, -4);
        c.quadraticCurveTo(-18, -3, -15, -13);
        c.moveTo(33, -4);
        c.quadraticCurveTo(18, -3, 15, -13);
        c.stroke();
      },
    }
  );
  ctx.restore();

  // LAYER 5: CREAM WAFFLE-KNIT TORSO SHIRT
  ctx.save();
  ctx.translate(pelvisX, pelvisY);
  ctx.rotate(torsoLean);

  const shirtGrad = ctx.createLinearGradient(-44, -110, 46, -6);
  shirtGrad.addColorStop(0, PALETTE.creamHighlight);
  shirtGrad.addColorStop(0.52, PALETTE.creamBase);
  shirtGrad.addColorStop(0.88, PALETTE.creamShadow);
  shirtGrad.addColorStop(1, PALETTE.creamDeep);

  const bExp = breath * 1.3;
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-18, -106 - bExp * 0.5);
      c.bezierCurveTo(-36, -102, -45 - bExp, -90, -43 - bExp, -70);
      c.bezierCurveTo(-41, -44, -39, -24, -37, -11);
      c.bezierCurveTo(-22, -6, -6, -14, 0, -14);
      c.bezierCurveTo(10, -14, 24, -7, 37, -11);
      c.bezierCurveTo(39, -24, 41, -44, 43 + bExp, -70);
      c.bezierCurveTo(45 + bExp, -90, 36, -102, 18, -106 - bExp * 0.5);
      c.quadraticCurveTo(0, -92, -18, -106 - bExp * 0.5);
      c.closePath();
    },
    {
      fill: shirtGrad,
      strokeWidth: 2.2,
      strokeColor: PALETTE.inkDark,
      rimColor: 'rgba(255, 253, 245, 0.7)',
      rimOffset: { x: -2.0, y: -1.8 },
      textureFn: (c) => drawWaffleTexture(c, -48, -110, 96, 106, 7.2, 0.2),
      innerPassFn: (c) => {
        c.beginPath();
        c.moveTo(-20, -104);
        c.quadraticCurveTo(0, -88, 20, -104);
        setInkStyle(c, 2.1, 'rgba(136, 112, 88, 0.55)');
        c.stroke();

        setInkStyle(c, 1.35, 'rgba(132, 108, 84, 0.45)');
        c.beginPath();
        c.moveTo(-26, -24);
        c.quadraticCurveTo(-14, -16, -4, -18);
        c.moveTo(28, -28);
        c.quadraticCurveTo(16, -20, 8, -17);
        c.moveTo(-34, -70);
        c.quadraticCurveTo(-28, -56, -32, -40);
        c.stroke();
      },
    }
  );

  // Cute warm neck
  const neckGrad = ctx.createLinearGradient(0, -124, 0, -96);
  neckGrad.addColorStop(0, PALETTE.skinShadow);
  neckGrad.addColorStop(0.45, PALETTE.skinBase);
  neckGrad.addColorStop(1, PALETTE.skinLight);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-12, -120);
      c.lineTo(12, -120);
      c.lineTo(13, -100);
      c.quadraticCurveTo(0, -93, -13, -100);
      c.closePath();
    },
    {
      fill: neckGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
    }
  );

  // LAYER 6: BOY'S HEAD & FLUFFY CURLY CHESTNUT HAIR
  ctx.save();
  ctx.translate(0, -155 - bExp * 0.8);
  drawBoyHead(ctx, {
    headTurn: resolvedTurn,
    headTilt: headTilt - torsoLean * 0.45,
    hairBounce,
    breathPhase,
    blink,
    eyeGazeX,
    eyeGazeY,
    mood,
    viseme,
    mouthOpen,
  });
  ctx.restore();

  ctx.restore(); // torso transform

  // LAYER 7: FRONT ARM (shoulder blends smoothly into waffle-knit shirt silhouette!)
  drawBoyArm(ctx, frontShX, frontShY, frontArmIK.x, frontArmIK.y, frontWristX, frontWristY, {
    isBack: false,
    handMode: frontHandMode,
    side: 1,
    blendShoulder: true,
    outerShoulderCap: !isRunning,
  });

  ctx.restore();
}
