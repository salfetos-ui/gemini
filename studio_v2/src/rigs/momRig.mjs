/**
 * Full Articulated 2D Painterly Rig — Modern Mom (Early 30s)
 * Matches approved character_sheet.jpg STRICTLY:
 * - Warm chestnut hair in a chic messy bun with soft swaying face-framing locks
 * - Modern soft dusty-rose short-sleeve cotton T-shirt (showing bare forearms — NO sweater!)
 * - Sleek minimalist oatmeal-linen 2-pocket apron
 * - Flowing warm-beige A-line midi skirt with animated pleat sway
 * - Clean white modern sneakers
 * - Optional prop mode: cream quilted oven mitts holding a steaming golden lattice ruby-raspberry pie!
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
  buildContinuous2SegmentPath,
  drawSoftBlush,
  drawLinenTexture,
  drawGroundShadow,
  drawStorybookEye,
  drawExpressiveMouth,
} from '../engine/painterly.mjs';

/**
 * Draw clean modern white low-top sneaker
 */
function drawWhiteSneaker(ctx, ankleX, ankleY, angle, isFront = true, side = 1) {
  ctx.save();
  ctx.translate(ankleX, ankleY);
  ctx.rotate(angle);
  if (isFront && side < 0) {
    ctx.scale(-1, 1);
  }

  const upperGrad = ctx.createLinearGradient(-12, -8, 28, 12);
  upperGrad.addColorStop(0, PALETTE.sneakerWhite);
  upperGrad.addColorStop(0.65, PALETTE.sneakerLight);
  upperGrad.addColorStop(1, PALETTE.sneakerShadow);

  // Main sneaker body
  const buildShoe = (c) => {
    c.beginPath();
    c.moveTo(-11, -7);
    c.bezierCurveTo(-15, 2, -14, 13, -8, 16);
    c.lineTo(28, 16);
    c.bezierCurveTo(36, 15, 37, 8, 30, 5);
    c.bezierCurveTo(21, 3, 14, -2, 10, -7);
    c.quadraticCurveTo(0, -3, -11, -7);
    c.closePath();
  };

  paintShape(ctx, buildShoe, {
    fill: upperGrad,
    strokeWidth: 2.0,
    strokeColor: PALETTE.inkDark,
    innerPassFn: (c) => {
      // Clean flat modern white rubber sole band
      c.fillStyle = PALETTE.sneakerSole;
      c.fillRect(-16, 10.5, 56, 7.5);
      setInkStyle(c, 1.35, PALETTE.inkMid);
      c.beginPath();
      c.moveTo(-13, 10.8);
      c.lineTo(35, 10.8);
      c.stroke();

      // Toe cap seam
      setInkStyle(c, 1.1, 'rgba(110, 88, 70, 0.42)');
      c.beginPath();
      c.moveTo(22, 10.5);
      c.quadraticCurveTo(24, 5, 28, 4.5);
      c.stroke();

      // Heel panel seam
      c.beginPath();
      c.moveTo(-4, -4);
      c.quadraticCurveTo(-2, 4, -5, 10.5);
      c.stroke();
    },
  });

  // Crisp criss-cross shoelaces + tiny bow loop
  setInkStyle(ctx, 1.45, PALETTE.inkMid);
  ctx.beginPath();
  ctx.moveTo(10, -3);
  ctx.lineTo(15, 0.5);
  ctx.moveTo(13.5, -1);
  ctx.lineTo(18.5, 2.2);
  ctx.moveTo(17, 1);
  ctx.lineTo(21.5, 3.8);
  ctx.stroke();

  // Small shoelace bow
  ctx.beginPath();
  ctx.ellipse(9.5, -5.8, 3.6, 1.9, -0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw graceful bare hand for Mom (or quilted oven mitt when holding pie!)
 */
function drawMomHand(ctx, wx, wy, angle, opts = {}) {
  const { mode = 'relaxed', side = 1, wearingMitt = false } = opts;

  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(angle);
  ctx.scale(1, side);

  if (wearingMitt) {
    // Modern cream quilted oven mitt
    const mittGrad = ctx.createLinearGradient(-4, -14, 24, 14);
    mittGrad.addColorStop(0, PALETTE.mittHighlight);
    mittGrad.addColorStop(0.55, PALETTE.mittBase);
    mittGrad.addColorStop(1, PALETTE.mittShadow);

    const buildMitt = (c) => {
      c.beginPath();
      c.moveTo(-8, -11);
      c.lineTo(8, -12);
      // Thumb pocket
      c.bezierCurveTo(14, -17, 21, -14, 19, -8);
      c.lineTo(16, -6);
      // Rounded padded mitten front
      c.bezierCurveTo(28, -5, 30, 8, 20, 12);
      c.lineTo(-8, 12);
      c.closePath();
    };

    paintShape(ctx, buildMitt, {
      fill: mittGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        // Subtle diamond quilting stitches
        setInkStyle(c, 0.9, 'rgba(138, 114, 92, 0.45)');
        c.beginPath();
        for (let q = -6; q <= 26; q += 8) {
          c.moveTo(q, -16);
          c.lineTo(q + 14, 16);
          c.moveTo(q + 14, -16);
          c.lineTo(q, 16);
        }
        c.stroke();

        // Cuff trim band
        c.fillStyle = PALETTE.roseBase;
        c.fillRect(-10, -13, 6.5, 26);
        setInkStyle(c, 1.4, PALETTE.inkDark);
        c.beginPath();
        c.moveTo(-3.5, -12);
        c.lineTo(-3.5, 12);
        c.stroke();
      },
    });
    ctx.restore();
    return;
  }

  const handGrad = ctx.createLinearGradient(-4, -8, 22, 10);
  handGrad.addColorStop(0, PALETTE.skinLight);
  handGrad.addColorStop(0.6, PALETTE.skinBase);
  handGrad.addColorStop(1, PALETTE.skinShadow);

  const buildHand = (c) => {
    c.beginPath();
    if (mode === 'stroking' || mode === 'openWelcome') {
      // Gentle loving open fingers slightly curved gracefully
      c.moveTo(-3, -5);
      // Thumb
      c.bezierCurveTo(3, -11, 10, -11.5, 11, -8);
      c.bezierCurveTo(11, -5.5, 7, -4, 9, -3);
      // Graceful slender index + middle + ring + pinky
      c.bezierCurveTo(17, -5, 25, -4, 25.5, -1.2);
      c.bezierCurveTo(25.5, 1.2, 19, 1.2, 17, 1.5);
      c.bezierCurveTo(23, 2, 26.5, 3.8, 25, 6.0);
      c.bezierCurveTo(23, 8.2, 15, 6.5, 13, 7.2);
      c.bezierCurveTo(17, 8.5, 18, 10.5, 14, 11);
      c.bezierCurveTo(9, 11.5, 2, 10, -3, 6.5);
      c.closePath();
    } else {
      // Elegant relaxed hand
      c.moveTo(-3, -5);
      c.bezierCurveTo(3, -9, 9, -8.5, 10.5, -5.5);
      c.bezierCurveTo(16, -5, 23, -2, 23, 1.5);
      c.bezierCurveTo(23, 5, 18, 8.5, 12, 9);
      c.bezierCurveTo(6, 10, 0, 9, -3, 5.5);
      c.closePath();
    }
  };

  paintShape(ctx, buildHand, {
    fill: handGrad,
    strokeWidth: 1.85,
    strokeColor: PALETTE.inkDark,
    innerPassFn: (c) => {
      if (mode !== 'stroking' && mode !== 'openWelcome') {
        setInkStyle(c, 1.05, 'rgba(110, 68, 48, 0.45)');
        c.beginPath();
        c.moveTo(13, 0.5);
        c.quadraticCurveTo(18, 1.5, 21.5, 3.0);
        c.moveTo(11.5, 4.0);
        c.quadraticCurveTo(16, 5.2, 19, 6.2);
        c.stroke();
      }
    },
  });

  ctx.restore();
}

/**
 * Draw Mom's articulated arm:
 * Modern dusty-rose SHORT SLEEVE ending mid-upper-arm -> bare slender upper arm & forearm -> graceful hand (or mitt!)
 */
function drawMomArm(ctx, sx, sy, ex, ey, wx, wy, opts = {}) {
  const { isBack = false, handMode = 'relaxed', side = 1, wearingMitt = false } = opts;

  const udx = ex - sx;
  const udy = ey - sy;
  const ulen = Math.hypot(udx, udy) || 1;
  const uux = udx / ulen;
  const uuy = udy / ulen;

  // Short sleeve covers top ~54% of upper arm (modern cotton T-shirt!)
  const sleeveEndX = sx + uux * (ulen * 0.54);
  const sleeveEndY = sy + uuy * (ulen * 0.54);

  const skinGrad = ctx.createLinearGradient(sx - 12, sy, wx + 12, wy);
  skinGrad.addColorStop(0, isBack ? PALETTE.skinMid : PALETTE.skinLight);
  skinGrad.addColorStop(0.55, isBack ? PALETTE.skinShadow : PALETTE.skinBase);
  skinGrad.addColorStop(1, PALETTE.skinShadow);

  // 1. ONE seamless continuous bare arm (naturally full upper arm -> silky rounded elbow -> organically tapered wrist!)
  const armStartX = sleeveEndX - uux * 10;
  const armStartY = sleeveEndY - uuy * 10;
  paintShape(
    ctx,
    (c) => buildContinuous2SegmentPath(c, armStartX, armStartY, ex, ey, wx, wy, 10.8, 9.0, 6.7),
    {
      fill: skinGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
      rimColor: isBack ? null : 'rgba(255, 240, 206, 0.45)',
      rimOffset: { x: -1.6, y: -1.4 },
      innerPassFn: (c) => {
        // Subtle soft shadow cast by short sleeve hem onto upper bare arm
        const shGrad = c.createRadialGradient(sleeveEndX, sleeveEndY, 2, sleeveEndX, sleeveEndY, 17);
        shGrad.addColorStop(0, 'rgba(155, 96, 72, 0.30)');
        shGrad.addColorStop(1, 'rgba(155, 96, 72, 0)');
        c.fillStyle = shGrad;
        c.fillRect(sleeveEndX - 22, sleeveEndY - 22, 44, 44);
      },
    }
  );

  // 2. Graceful hand or quilted oven mitt
  const handAngle = Math.atan2(wy - ey, wx - ex);
  drawMomHand(ctx, wx, wy, handAngle, { mode: handMode, side, wearingMitt });

  // 3. Modern Dusty-Rose SHORT Sleeve (smooth outward shoulder cap -> soft cotton hem!)
  const sleeveGrad = ctx.createLinearGradient(sx - 16, sy - 10, sleeveEndX + 16, sleeveEndY + 10);
  if (isBack) {
    sleeveGrad.addColorStop(0, PALETTE.roseBase);
    sleeveGrad.addColorStop(1, PALETTE.roseShadow);
  } else {
    sleeveGrad.addColorStop(0, PALETTE.roseHighlight);
    sleeveGrad.addColorStop(0.52, PALETTE.roseBase);
    sleeveGrad.addColorStop(1, PALETTE.roseShadow);
  }

  const nx = -uuy;
  const ny = uux;
  const aPlus = Math.atan2(ny, nx);
  const aMinus = aPlus + Math.PI;
  const rSh = 13.8;
  const rHem = 13.4;

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(sx + nx * rSh, sy + ny * rSh);
      c.lineTo(sleeveEndX + nx * rHem, sleeveEndY + ny * rHem);
      // Soft slightly arched cotton short-sleeve hem
      c.quadraticCurveTo(
        sleeveEndX + uux * 3.5,
        sleeveEndY + uuy * 3.5,
        sleeveEndX - nx * rHem,
        sleeveEndY - ny * rHem
      );
      c.lineTo(sx - nx * rSh, sy - ny * rSh);
      // Outward shoulder cap passing through (-uux, -uuy) -> anticlockwise=true!
      c.arc(sx, sy, rSh, aMinus, aPlus, true);
      c.closePath();
    },
    {
      fill: sleeveGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      rimColor: isBack ? 'rgba(255, 232, 176, 0.42)' : PALETTE.sunGoldRim,
      rimOffset: { x: -2.0, y: -1.8 },
      innerPassFn: (c) => {
        setInkStyle(c, 1.0, 'rgba(116, 72, 68, 0.48)');
        c.beginPath();
        c.moveTo(sleeveEndX - nx * (rHem - 1) - uux * 3.5, sleeveEndY - ny * (rHem - 1) - uuy * 3.5);
        c.quadraticCurveTo(
          sleeveEndX,
          sleeveEndY,
          sleeveEndX + nx * (rHem - 1) - uux * 3.5,
          sleeveEndY + ny * (rHem - 1) - uuy * 3.5
        );
        c.stroke();
      },
    }
  );
}

/**
 * Draw steaming golden lattice ruby-raspberry pie on a warm bronze baking tray!
 */
export function drawRaspberryPieOnTray(ctx, x, y, breathPhase = 0, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 1. Warm dark bronze rectangular/oval baking tray
  const trayGrad = ctx.createLinearGradient(-56, -8, 56, 14);
  trayGrad.addColorStop(0, PALETTE.trayLight);
  trayGrad.addColorStop(0.5, PALETTE.trayBase);
  trayGrad.addColorStop(1, PALETTE.trayDark);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.ellipse(0, 6, 56, 15, 0, 0, Math.PI * 2);
    },
    {
      fill: trayGrad,
      strokeWidth: 2.1,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        // Inner tray rim highlight
        setInkStyle(c, 1.3, 'rgba(235, 220, 200, 0.35)');
        c.beginPath();
        c.ellipse(0, 5, 49, 11.5, 0, 0, Math.PI * 2);
        c.stroke();
      },
    }
  );

  // 2. Pie dish / golden crust side wall
  const dishGrad = ctx.createLinearGradient(-42, -12, 42, 10);
  dishGrad.addColorStop(0, '#f3eadb');
  dishGrad.addColorStop(0.5, '#ddd0bc');
  dishGrad.addColorStop(1, '#b8a690');

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-40, -10);
      c.lineTo(-34, 4);
      c.bezierCurveTo(-18, 12, 18, 12, 34, 4);
      c.lineTo(40, -10);
      c.closePath();
    },
    {
      fill: dishGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
    }
  );

  // 3. Ruby-red glistening raspberry filling dome
  const berryGrad = ctx.createRadialGradient(-8, -18, 4, 0, -12, 40);
  berryGrad.addColorStop(0, PALETTE.berryBright);
  berryGrad.addColorStop(0.55, PALETTE.berryRuby);
  berryGrad.addColorStop(1, PALETTE.berryDark);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.ellipse(0, -12, 38, 15.5, 0, 0, Math.PI * 2);
    },
    {
      fill: berryGrad,
      strokeWidth: 1.8,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        // Glistening jam specular highlights peeking between lattice
        c.fillStyle = 'rgba(255, 195, 205, 0.52)';
        const glints = [
          [-16, -14],
          [-2, -18],
          [14, -14],
          [-8, -8],
          [9, -7],
        ];
        for (const [gx, gy] of glints) {
          c.beginPath();
          c.ellipse(gx, gy, 3.6, 1.7, -0.2, 0, Math.PI * 2);
          c.fill();
        }

        // Golden-brown lattice pastry strips woven across the raspberry filling!
        const stripGrad = c.createLinearGradient(-35, -24, 35, 0);
        stripGrad.addColorStop(0, PALETTE.crustLight);
        stripGrad.addColorStop(0.55, PALETTE.crustBase);
        stripGrad.addColorStop(1, PALETTE.crustShadow);

        c.strokeStyle = stripGrad;
        c.lineWidth = 5.5;
        c.lineCap = 'round';
        // Diagonal A
        for (let i = -24; i <= 24; i += 14) {
          c.beginPath();
          c.moveTo(i - 16, -26);
          c.quadraticCurveTo(i, -13, i + 16, 4);
          c.stroke();
        }
        // Diagonal B
        for (let i = -24; i <= 24; i += 14) {
          c.beginPath();
          c.moveTo(i + 16, -26);
          c.quadraticCurveTo(i, -13, i - 16, 4);
          c.stroke();
        }
        // Crisp sepia lattice edges
        setInkStyle(c, 1.15, 'rgba(92, 54, 24, 0.65)');
        for (let i = -24; i <= 24; i += 14) {
          c.beginPath();
          c.moveTo(i - 14, -26);
          c.quadraticCurveTo(i + 2, -13, i + 18, 4);
          c.moveTo(i + 14, -26);
          c.quadraticCurveTo(i - 2, -13, i - 18, 4);
          c.stroke();
        }
      },
    }
  );

  // 4. Scalloped crimped golden outer pie crust ring
  const crustGrad = ctx.createLinearGradient(-44, -22, 44, -2);
  crustGrad.addColorStop(0, PALETTE.crustLight);
  crustGrad.addColorStop(0.55, PALETTE.crustBase);
  crustGrad.addColorStop(1, PALETTE.crustShadow);

  const scallops = 18;
  for (let i = 0; i < scallops; i++) {
    const a = (i / scallops) * Math.PI * 2;
    const sx = Math.cos(a) * 39;
    const sy = -11.5 + Math.sin(a) * 14.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 5.4, 3.8, a * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = crustGrad;
    ctx.fill();
    setInkStyle(ctx, 1.4, PALETTE.inkDark);
    ctx.stroke();
  }

  // 5. Soft rising aromatic steam ribbons!
  ctx.save();
  for (let s = -1; s <= 1; s++) {
    const ph = breathPhase * 1.4 + s * 1.7;
    const sx = s * 16 + Math.sin(ph) * 4;
    const baseY = -26;
    const h = 36 + Math.sin(ph * 0.7) * 6;
    const steamGrad = ctx.createLinearGradient(sx, baseY, sx, baseY - h);
    steamGrad.addColorStop(0, 'rgba(255, 252, 246, 0.55)');
    steamGrad.addColorStop(0.6, 'rgba(255, 250, 242, 0.34)');
    steamGrad.addColorStop(1, 'rgba(255, 250, 242, 0)');

    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.bezierCurveTo(
      sx - 8 * Math.cos(ph),
      baseY - h * 0.35,
      sx + 9 * Math.cos(ph),
      baseY - h * 0.72,
      sx + Math.sin(ph) * 6,
      baseY - h
    );
    ctx.strokeStyle = steamGrad;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Mom's graceful expressive head + chic messy chestnut bun & face-framing waves
 */
export function drawMomHead(ctx, opts = {}) {
  const {
    headTurn = 0,
    headTilt = 0,
    breathPhase = 0,
    blink = 0,
    eyeGazeX = 0,
    eyeGazeY = 0,
    mood = 'welcoming',
    viseme = 'smile',
    mouthOpen = 0,
  } = opts;

  const turn = clamp(headTurn, -0.75, 0.75);
  const lockSway = Math.sin(breathPhase * 0.9) * 2.5;

  ctx.save();
  ctx.rotate(headTilt);

  // 1. Fuller Soft Chic Messy Top-Back Bun (plush swirled chestnut strands + sunlit golden rim!)
  const bunX = 14 - turn * 17;
  const bunY = -48;
  const bunGrad = ctx.createRadialGradient(bunX - 8, bunY - 10, 3, bunX, bunY, 31);
  bunGrad.addColorStop(0, PALETTE.hairHighlight);
  bunGrad.addColorStop(0.32, PALETTE.hairLight);
  bunGrad.addColorStop(0.68, PALETTE.hairBase);
  bunGrad.addColorStop(1, PALETTE.hairDeep);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(bunX - 24, bunY + 10);
      c.bezierCurveTo(bunX - 29, bunY - 11, bunX - 11, bunY - 28, bunX + 4, bunY - 25);
      c.bezierCurveTo(bunX + 18, bunY - 28, bunX + 31, bunY - 11, bunX + 27, bunY + 7);
      c.bezierCurveTo(bunX + 24, bunY + 19, bunX + 9, bunY + 22, bunX - 5, bunY + 19);
      c.quadraticCurveTo(bunX - 18, bunY + 18, bunX - 24, bunY + 10);
      c.closePath();
    },
    {
      fill: bunGrad,
      strokeWidth: 2.05,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: -2.2, y: -2.2 },
      innerPassFn: (c) => {
        // Soft plush swirling bun strand curves
        setInkStyle(c, 1.35, 'rgba(66, 36, 18, 0.54)');
        c.beginPath();
        c.moveTo(bunX - 18, bunY + 4);
        c.bezierCurveTo(bunX - 10, bunY - 14, bunX + 12, bunY - 16, bunX + 20, bunY - 2);
        c.moveTo(bunX - 14, bunY + 12);
        c.bezierCurveTo(bunX - 2, bunY - 3, bunX + 16, bunY + 1, bunX + 19, bunY + 11);
        c.moveTo(bunX - 8, bunY - 12);
        c.quadraticCurveTo(bunX + 4, bunY - 21, bunX + 16, bunY - 13);
        c.stroke();

        // Warm sunlit golden highlight ribbon across top of messy bun
        drawSunlitRimArc(
          c,
          (cc) => {
            cc.beginPath();
            cc.moveTo(bunX - 15, bunY - 11);
            cc.quadraticCurveTo(bunX - 1, bunY - 21, bunX + 14, bunY - 13);
          },
          2.6,
          0.62
        );
      },
    }
  );

  // Airy stray messy-bun curl wisps
  setInkStyle(ctx, 1.45, PALETTE.inkDark);
  ctx.beginPath();
  ctx.moveTo(bunX + 18, bunY - 14);
  ctx.quadraticCurveTo(bunX + 29, bunY - 20, bunX + 30, bunY - 8);
  ctx.moveTo(bunX - 15, bunY - 16);
  ctx.quadraticCurveTo(bunX - 25, bunY - 23, bunX - 23, bunY - 12);
  ctx.moveTo(bunX + 23, bunY + 4);
  ctx.quadraticCurveTo(bunX + 31, bunY + 10, bunX + 25, bunY + 16);
  ctx.stroke();

  // 2. Lush Soft Wavy Back Hair Volume behind temples, ears & nape
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-40, -10);
      c.bezierCurveTo(-48, -36, -24, -54, 2, -52);
      c.bezierCurveTo(28, -51, 46, -30, 41, 4);
      c.bezierCurveTo(39, 22, 27, 35, 16, 35);
      c.lineTo(-18, 34);
      c.bezierCurveTo(-31, 29, -42, 14, -40, -10);
      c.closePath();
    },
    {
      fill: PALETTE.hairDeep,
      strokeWidth: 2.05,
      strokeColor: PALETTE.inkDark,
    }
  );

  // Soft loose nape tendrils gently swaying
  setInkStyle(ctx, 1.9, PALETTE.hairBase);
  ctx.beginPath();
  ctx.moveTo(-24, 24);
  ctx.quadraticCurveTo(-29 + lockSway * 0.5, 38, -21 + lockSway, 47);
  ctx.moveTo(24, 22);
  ctx.quadraticCurveTo(30 + lockSway * 0.4, 36, 25 + lockSway * 0.8, 45);
  ctx.stroke();

  // 3. Delicate ears
  for (const side of [-1, 1]) {
    const earVis = side === -1 ? clamp(1 - turn * 0.6, 0.3, 1) : clamp(1 + turn * 0.6, 0.3, 1);
    ctx.save();
    ctx.translate(side * 32.5 - turn * 5, 4);
    ctx.scale(side * earVis, 1);
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.ellipse(0, 0, 6.2, 10.2, 0.1, 0, Math.PI * 2);
      },
      {
        fill: PALETTE.skinBase,
        strokeWidth: 1.8,
        strokeColor: PALETTE.inkDark,
      }
    );
    ctx.restore();
  }

  // 4. Warm Gentle Rounded Heart-Oval Face Contour (soft cheekbones & rounded chin — NO sharp V-chin!)
  const faceGrad = ctx.createRadialGradient(-9 + turn * 6, -10, 4, 0, 4, 46);
  faceGrad.addColorStop(0, PALETTE.skinLight);
  faceGrad.addColorStop(0.58, PALETTE.skinBase);
  faceGrad.addColorStop(0.9, PALETTE.skinMid);
  faceGrad.addColorStop(1, PALETTE.skinShadow);

  const chinX = turn * 2.6;
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(0, -36);
      c.bezierCurveTo(26, -36, 34.5, -15, 33, 7);
      // Soft fuller lower cheeks tapering gently into a warm rounded chin (smooth horizontal tangent!)
      c.bezierCurveTo(31.5, 24.5, 18.5, 39.2, chinX, 39.6);
      c.bezierCurveTo(-18.5, 39.2, -31.5, 24.5, -33, 7);
      c.bezierCurveTo(-34.5, -15, -26, -36, 0, -36);
      c.closePath();
    },
    {
      fill: faceGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      rimColor: 'rgba(255, 244, 212, 0.52)',
      rimOffset: { x: -2.0, y: -1.5 },
    }
  );

  // 5. Facial Features
  const fx = turn * 10;

  // Subtle warm-peach sunlit cheek blush!
  drawSoftBlush(ctx, fx - 18.5, 13.5, 11.4, 7.0, mood === 'tender' ? 0.50 : 0.42, { peach: true });
  drawSoftBlush(ctx, fx + 18.5, 13.5, 11.4, 7.0, mood === 'tender' ? 0.50 : 0.42, { peach: true });

  // Warm loving hazel-brown almond eyes
  const eyeY = 2.0;
  const eyeSpacing = 14.2;
  drawStorybookEye(ctx, {
    x: fx - eyeSpacing * (1 - turn * 0.14),
    y: eyeY,
    rx: 7.8,
    ry: 6.4,
    gazeX: eyeGazeX,
    gazeY: eyeGazeY,
    blink: mood === 'serene' ? Math.max(blink, 0.92) : blink,
    irisDark: '#4a2b17',
    irisMid: '#724929',
    irisWarm: '#bd874e',
    isMom: true,
    side: -1,
  });
  drawStorybookEye(ctx, {
    x: fx + eyeSpacing * (1 + turn * 0.14),
    y: eyeY,
    rx: 7.8,
    ry: 6.4,
    gazeX: eyeGazeX,
    gazeY: eyeGazeY,
    blink: mood === 'serene' ? Math.max(blink, 0.92) : blink,
    irisDark: '#4a2b17',
    irisMid: '#724929',
    irisWarm: '#bd874e',
    isMom: true,
    side: 1,
  });

  // Expressive delicate arched eyebrows
  const browLift = mood === 'welcoming' ? -1.8 : mood === 'tender' ? -0.6 : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(fx + side * (eyeSpacing * (1 + side * turn * 0.12)), eyeY - 10.5 + browLift);
    ctx.beginPath();
    ctx.moveTo(-7.2, 1.6);
    ctx.quadraticCurveTo(0, -2.5, 7.2, 1.0);
    setInkStyle(ctx, 2.1, '#58341d');
    ctx.stroke();
    ctx.restore();
  }

  // Delicate storybook nose
  const noseX = fx + turn * 2.8;
  ctx.beginPath();
  ctx.moveTo(noseX - 0.5, 4);
  ctx.quadraticCurveTo(noseX + turn * 1.5, 11, noseX + 1.8, 13.5);
  ctx.quadraticCurveTo(noseX - 0.5, 15.2, noseX - 2.6, 13.8);
  setInkStyle(ctx, 1.5, PALETTE.inkMid);
  ctx.stroke();

  // Gentle warm smiling / speaking mouth
  drawExpressiveMouth(ctx, fx + turn * 1.8, 24.5, 0.88, viseme, mouthOpen, {
    isMom: true,
    mood,
  });

  // 6. Richer Soft Wavy Crown Volume + Fuller Flowing Face-Framing Curtain Bangs! (Matches character_sheet.jpg!)
  const hairGradL = ctx.createLinearGradient(-44, -48, 4, 34);
  hairGradL.addColorStop(0, PALETTE.hairHighlight);
  hairGradL.addColorStop(0.26, PALETTE.hairLight);
  hairGradL.addColorStop(0.62, PALETTE.hairBase);
  hairGradL.addColorStop(1, PALETTE.hairShadow);

  const hairGradR = ctx.createLinearGradient(-4, -48, 44, 34);
  hairGradR.addColorStop(0, PALETTE.hairLight);
  hairGradR.addColorStop(0.45, PALETTE.hairBase);
  hairGradR.addColorStop(1, PALETTE.hairDeep);

  const partX = -2 + turn * 8;

  // Left lush billowing crown & flowing S-wave curtain bang framing left temple, cheek & jaw
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(partX, -37);
      // Airy lifted wavy crown sweeping generously over left temple!
      c.bezierCurveTo(partX - 18, -54, -46, -42, -45, -11);
      // Soft S-wave flare outward at cheekbone then curving softly inward near jaw
      c.bezierCurveTo(-45, 7, -38 + lockSway * 0.5, 24, -27 + lockSway, 42);
      // Graceful tapered wavy curtain tip returning up along cheek
      c.bezierCurveTo(-31 + lockSway * 0.5, 29, -31, 14, -28, 1);
      c.bezierCurveTo(-25, -14, partX - 12, -20, partX, -37);
      c.closePath();
    },
    {
      fill: hairGradL,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: -2.2, y: -2.2 },
      innerPassFn: (c) => {
        // Warm sunlit golden-chestnut sheen ribbon along crown & temple wave
        drawSunlitRimArc(
          c,
          (cc) => {
            cc.beginPath();
            cc.moveTo(partX - 6, -41);
            cc.bezierCurveTo(-26, -42, -40, -28, -39, -6);
          },
          2.6,
          0.56
        );
        // Delicate flowing wavy hair strand lines
        setInkStyle(c, 1.15, 'rgba(72, 40, 20, 0.45)');
        c.beginPath();
        c.moveTo(partX - 7, -36);
        c.bezierCurveTo(-29, -30, -39, -8, -33 + lockSway * 0.5, 25);
        c.moveTo(partX - 3, -33);
        c.bezierCurveTo(-21, -24, -31, -4, -29 + lockSway * 0.35, 16);
        c.stroke();
      },
    }
  );

  // Right lush billowing crown & flowing S-wave curtain bang framing right temple, cheek & jaw
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(partX, -37);
      // Airy lifted wavy crown sweeping generously over right temple!
      c.bezierCurveTo(partX + 20, -55, 46, -42, 45, -11);
      // Soft S-wave flare outward at cheekbone then curving softly inward near jaw
      c.bezierCurveTo(45, 7, 38 + lockSway * 0.5, 24, 27 + lockSway, 42);
      // Graceful tapered wavy curtain tip returning up along cheek
      c.bezierCurveTo(31 + lockSway * 0.5, 29, 31, 14, 28, 1);
      c.bezierCurveTo(25, -14, partX + 12, -20, partX, -37);
      c.closePath();
    },
    {
      fill: hairGradR,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
      rimColor: 'rgba(255, 232, 168, 0.46)',
      rimOffset: { x: -1.6, y: -2.0 },
      innerPassFn: (c) => {
        setInkStyle(c, 2.2, 'rgba(228, 178, 120, 0.40)');
        c.beginPath();
        c.moveTo(partX + 7, -40);
        c.bezierCurveTo(28, -40, 39, -26, 38, -6);
        c.stroke();
        setInkStyle(c, 1.15, 'rgba(72, 40, 20, 0.45)');
        c.beginPath();
        c.moveTo(partX + 7, -36);
        c.bezierCurveTo(29, -30, 39, -8, 33 + lockSway * 0.5, 25);
        c.moveTo(partX + 3, -33);
        c.bezierCurveTo(21, -24, 31, -4, 29 + lockSway * 0.35, 16);
        c.stroke();
      },
    }
  );

  // Soft airy face-framing stray hair wisps curling delicately off the curtain bangs
  setInkStyle(ctx, 1.35, PALETTE.inkDark);
  ctx.beginPath();
  ctx.moveTo(-36, 16);
  ctx.quadraticCurveTo(-42 + lockSway * 0.5, 28, -35 + lockSway, 37);
  ctx.moveTo(36, 16);
  ctx.quadraticCurveTo(42 + lockSway * 0.5, 28, 35 + lockSway, 37);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw full articulated Modern Mom character!
 * Origin (x, y) is ground plane directly beneath her white sneakers.
 */
export function drawMom(ctx, pose = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    facing = 'front', // 'front' | 'right' | 'left'
    walkPhase = null,
    skirtSway = 0, // -1..1 gentle breeze or turn sway
    breathPhase = 0,
    headTilt = 0,
    headTurn = null,
    blink = 0,
    eyeGazeX = 0,
    eyeGazeY = 0,
    mood = 'welcoming', // 'welcoming' | 'warm' | 'tender' | 'serene'
    viseme = 'smile',
    mouthOpen = 0,
    armMode = 'relaxed', // 'relaxed' | 'openWelcome' | 'holdingPie' | 'strokingHair' | 'handsOnShoulders'
    strokePhase = 0, // 0..1 continuous gentle hair-stroking motion!
    leanDown = 0, // 0..1 smooth loving bend/kneel down toward boy!
    showShadow = true,
  } = pose;

  const flipX = facing === 'left' ? -1 : 1;
  const resolvedTurn =
    headTurn !== null
      ? headTurn
      : facing === 'right' || facing === 'left'
      ? 0.28
      : 0;

  const lean = clamp(leanDown, 0, 1);
  const breath = Math.sin(breathPhase);
  const isWalking = walkPhase !== null;
  const walkBob = isWalking ? Math.abs(Math.sin(walkPhase)) * -5 : 0;
  const sway = skirtSway + (isWalking ? Math.sin(walkPhase) * 0.35 : Math.sin(breathPhase * 0.7) * 0.08);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flipX, scale);

  // Soft warm ambient occlusion contact shadow
  if (showShadow) {
    drawGroundShadow(ctx, lean * 8, 2, 66, 12, 0.23);
  }

  // Waist & pelvis anchor (drops and leans lovingly forward when leanDown > 0!)
  const waistX = lean * 14;
  const waistY = -282 + lean * 44 + walkBob + breath * 1.2;
  const torsoTilt = lean * 0.34 + (isWalking ? 0.03 : 0);

  // === LAYER 1: SLENDER LOWER LEGS & CLEAN WHITE MODERN SNEAKERS ===
  const legSpread = 22;
  const walkStride = isWalking ? Math.sin(walkPhase) * 24 : 0;
  const walkLiftL = isWalking ? Math.max(0, Math.cos(walkPhase)) * 10 : 0;
  const walkLiftR = isWalking ? Math.max(0, -Math.cos(walkPhase)) * 10 : 0;

  const leftAnkleX = -legSpread - walkStride - lean * 4;
  const leftAnkleY = -15 - walkLiftL;
  const rightAnkleX = legSpread + walkStride + lean * 4;
  const rightAnkleY = -15 - walkLiftR;

  // Draw slender calves emerging beneath midi skirt down to sneakers
  const drawCalf = (ax, ay, topX, isBack) => {
    const legGrad = ctx.createLinearGradient(ax - 10, ay - 90, ax + 10, ay);
    legGrad.addColorStop(0, isBack ? PALETTE.skinMid : PALETTE.skinLight);
    legGrad.addColorStop(0.55, isBack ? PALETTE.skinShadow : PALETTE.skinBase);
    legGrad.addColorStop(1, PALETTE.skinShadow);

    paintShape(
      ctx,
      (c) => buildTaperedLimbPath(c, topX, ay - 96, ax, ay, 11.5, 6.8, 0.1),
      {
        fill: legGrad,
        strokeWidth: 1.9,
        strokeColor: PALETTE.inkDark,
      }
    );
  };

  drawCalf(leftAnkleX, leftAnkleY, waistX - 18, true);
  drawWhiteSneaker(ctx, leftAnkleX, leftAnkleY, isWalking ? -Math.sin(walkPhase) * 0.14 : -0.02, true, -1);

  drawCalf(rightAnkleX, rightAnkleY, waistX + 18, false);
  drawWhiteSneaker(ctx, rightAnkleX, rightAnkleY, isWalking ? Math.sin(walkPhase) * 0.14 : 0.02, true, 1);

  // === LAYER 2: FLOWING WARM-BEIGE A-LINE MIDI SKIRT (WITH ANIMATED PLEAT SWAY!) ===
  const skirtTopY = waistY + 6;
  const skirtHemY = -88 + lean * 24 + walkBob * 0.5;
  const skirtSwayPx = sway * 16;

  const skirtGrad = ctx.createLinearGradient(waistX - 58, skirtTopY, waistX + 64, skirtHemY);
  skirtGrad.addColorStop(0, PALETTE.skirtHighlight);
  skirtGrad.addColorStop(0.42, PALETTE.skirtBase);
  skirtGrad.addColorStop(0.82, PALETTE.skirtShadow);
  skirtGrad.addColorStop(1, PALETTE.skirtDeep);

  const buildSkirt = (c) => {
    c.beginPath();
    c.moveTo(waistX - 31, skirtTopY);
    c.lineTo(waistX + 31, skirtTopY);
    c.bezierCurveTo(
      waistX + 46,
      lerp(skirtTopY, skirtHemY, 0.45),
      waistX + 66 + skirtSwayPx,
      lerp(skirtTopY, skirtHemY, 0.8),
      waistX + 70 + skirtSwayPx,
      skirtHemY - 4
    );
    // Scalloped flowing A-line pleated hem wave!
    const pleats = 6;
    for (let i = pleats; i >= 0; i--) {
      const t = i / pleats;
      const hx = lerp(waistX - 66 + skirtSwayPx, waistX + 70 + skirtSwayPx, t);
      const hy = skirtHemY + (i % 2 === 0 ? 3.5 : -4.5);
      if (i < pleats) {
        const prevT = (i + 1) / pleats;
        const px = lerp(waistX - 66 + skirtSwayPx, waistX + 70 + skirtSwayPx, prevT);
        const mx = (px + hx) * 0.5;
        const my = skirtHemY + (i % 2 === 0 ? 8.5 : -6.5);
        c.quadraticCurveTo(mx, my, hx, hy);
      }
    }
    c.bezierCurveTo(
      waistX - 64 + skirtSwayPx,
      lerp(skirtTopY, skirtHemY, 0.8),
      waistX - 44,
      lerp(skirtTopY, skirtHemY, 0.45),
      waistX - 31,
      skirtTopY
    );
    c.closePath();
  };

  paintShape(ctx, buildSkirt, {
    fill: skirtGrad,
    strokeWidth: 2.15,
    strokeColor: PALETTE.inkDark,
    innerPassFn: (c) => {
      // Soft vertical sunlit & shadowed pleat folds!
      const pleatCount = 5;
      for (let i = 1; i <= pleatCount; i++) {
        const t = i / (pleatCount + 1);
        const topX = lerp(waistX - 24, waistX + 24, t);
        const botX = lerp(waistX - 58 + skirtSwayPx, waistX + 60 + skirtSwayPx, t);
        // Shadow trough of pleat
        c.beginPath();
        c.moveTo(topX, skirtTopY + 12);
        c.quadraticCurveTo((topX + botX) * 0.5 + skirtSwayPx * 0.2, lerp(skirtTopY, skirtHemY, 0.55), botX, skirtHemY + 4);
        setInkStyle(c, 5.5, 'rgba(128, 92, 58, 0.24)');
        c.stroke();

        // Crisp delicate fold crease line
        setInkStyle(c, 1.35, 'rgba(96, 66, 42, 0.55)');
        c.stroke();

        // Sunlit highlight ridge right next to trough
        c.beginPath();
        c.moveTo(topX - 4, skirtTopY + 18);
        c.quadraticCurveTo((topX + botX) * 0.5 - 5, lerp(skirtTopY, skirtHemY, 0.55), botX - 8, skirtHemY - 2);
        setInkStyle(c, 3.2, 'rgba(248, 228, 198, 0.26)');
        c.stroke();
      }
    },
  });

  // --- COMPUTE UPPER BODY & ARM KINEMATICS ---
  const torsoLen = 102;
  const shoulderCenterX = waistX + Math.sin(torsoTilt) * torsoLen;
  const shoulderCenterY = waistY - Math.cos(torsoTilt) * torsoLen;

  const shSpread = 36;
  const backShX = shoulderCenterX - shSpread;
  const backShY = shoulderCenterY + 6;
  const frontShX = shoulderCenterX + shSpread;
  const frontShY = shoulderCenterY + 6;

  const upperArmL = 56;
  const forearmL = 54;

  let backWristX, backWristY, frontWristX, frontWristY;
  let backBend = 1;
  let frontBend = -1;
  let backHandMode = 'relaxed';
  let frontHandMode = 'relaxed';
  let wearingMitts = false;

  if (armMode === 'openWelcome') {
    // Warm welcoming open arms! Soft graceful wide arc with gentle natural elbow curve!
    backWristX = backShX - 80;
    backWristY = backShY + 38 + breath * 3;
    frontWristX = frontShX + 80;
    frontWristY = frontShY + 38 + breath * 3;
    backBend = -1; // left elbow dips softly DOWN
    frontBend = 1; // right elbow dips softly DOWN
    backHandMode = 'openWelcome';
    frontHandMode = 'openWelcome';
  } else if (armMode === 'holdingPie') {
    // Both elbows relax cleanly at her sides, forearms bringing quilted mitts neatly to tray edges!
    const pieHover = breath * 2.2;
    backWristX = shoulderCenterX - 50 + lean * 8;
    backWristY = waistY - 12 + pieHover;
    frontWristX = shoulderCenterX + 50 + lean * 8;
    frontWristY = waistY - 12 + pieHover;
    backBend = 1; // left elbow flares softly outward-left
    frontBend = -1; // right elbow flares softly outward-right
    wearingMitts = true;
  } else if (armMode === 'strokingHair') {
    // Continuous tender hair-stroking motion! (strokePhase 0..1 glides smoothly across boy's curls)
    const glide = Math.sin(strokePhase * Math.PI * 2);
    const arcY = Math.cos(strokePhase * Math.PI * 2) * 7;
    frontWristX = frontShX + 66 + glide * 16;
    frontWristY = frontShY + 42 + lean * 20 + arcY;
    frontBend = 1; // elbow curves gently downward in a soft tender arc
    frontHandMode = 'stroking';

    // Back arm rests gently at her hip/waist for warm maternal balance
    backWristX = waistX - 28;
    backWristY = waistY + 6;
    backBend = 1;
    backHandMode = 'relaxed';
  } else if (armMode === 'handsOnShoulders') {
    frontWristX = frontShX + 52;
    frontWristY = frontShY + 64 + lean * 14;
    backWristX = backShX + 26;
    backWristY = backShY + 68 + lean * 14;
    frontBend = 1;
    backBend = 1;
    frontHandMode = 'stroking';
    backHandMode = 'stroking';
  } else {
    // Charming modern character_sheet.jpg pose: left hand gently on hip, right arm gracefully relaxed!
    backWristX = waistX - 31;
    backWristY = waistY + 4;
    backBend = 1;
    backHandMode = 'relaxed';

    frontWristX = frontShX + 12 + breath * 1.5;
    frontWristY = frontShY + 102;
    frontBend = -1;
    frontHandMode = 'relaxed';
  }

  const backArmIK = solve2BoneIK(backShX, backShY, backWristX, backWristY, upperArmL, forearmL, backBend);
  const frontArmIK = solve2BoneIK(frontShX, frontShY, frontWristX, frontWristY, upperArmL, forearmL, frontBend);

  // === LAYER 3: BACK ARM ===
  if (armMode !== 'holdingPie') {
    drawMomArm(ctx, backShX, backShY, backArmIK.x, backArmIK.y, backWristX, backWristY, {
      isBack: true,
      handMode: backHandMode,
      side: -1,
      wearingMitt: wearingMitts,
    });
  }

  // === LAYER 4: TORSO (DUSTY-ROSE SHORT-SLEEVE T-SHIRT + SLEEK OATMEAL-LINEN 2-POCKET APRON!) ===
  ctx.save();
  ctx.translate(waistX, waistY);
  ctx.rotate(torsoTilt);

  // 4a. Soft Dusty-Rose Modern Cotton T-Shirt Torso
  const teeGrad = ctx.createLinearGradient(-38, -106, 38, 6);
  teeGrad.addColorStop(0, PALETTE.roseHighlight);
  teeGrad.addColorStop(0.52, PALETTE.roseBase);
  teeGrad.addColorStop(1, PALETTE.roseShadow);

  const bExp = breath * 1.1;
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-16, -104);
      c.bezierCurveTo(-32, -102, -41 - bExp, -92, -39 - bExp, -74);
      c.bezierCurveTo(-36, -46, -32, -18, -30, 6);
      c.lineTo(30, 6);
      c.bezierCurveTo(32, -18, 36, -46, 39 + bExp, -74);
      c.bezierCurveTo(41 + bExp, -92, 32, -102, 16, -104);
      // Soft scoop tee neckline
      c.quadraticCurveTo(0, -84, -16, -104);
      c.closePath();
    },
    {
      fill: teeGrad,
      strokeWidth: 2.1,
      strokeColor: PALETTE.inkDark,
      rimColor: PALETTE.sunGoldRim,
      rimOffset: { x: -2.2, y: -1.8 },
      innerPassFn: (c) => {
        // Soft t-shirt neckline rib trim
        setInkStyle(c, 1.4, 'rgba(118, 72, 68, 0.55)');
        c.beginPath();
        c.moveTo(-17, -102);
        c.quadraticCurveTo(0, -81, 17, -102);
        c.stroke();
      },
    }
  );

  // 4b. Graceful bare collarbone & slender neck
  const neckGrad = ctx.createLinearGradient(0, -134, 0, -86);
  neckGrad.addColorStop(0, PALETTE.skinShadow);
  neckGrad.addColorStop(0.35, PALETTE.skinBase);
  neckGrad.addColorStop(1, PALETTE.skinLight);

  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-10.5, -130);
      c.lineTo(10.5, -130);
      c.lineTo(14, -102);
      c.quadraticCurveTo(0, -85, -14, -102);
      c.closePath();
    },
    {
      fill: neckGrad,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        // Subtle delicate collarbone shadows
        setInkStyle(c, 1.0, 'rgba(176, 118, 88, 0.45)');
        c.beginPath();
        c.moveTo(-12, -96);
        c.quadraticCurveTo(-5, -94, -1.5, -96);
        c.moveTo(12, -96);
        c.quadraticCurveTo(5, -94, 1.5, -96);
        c.stroke();
      },
    }
  );

  // 4c. Sleek Minimalist Oatmeal-Linen Apron (shoulder straps + bib + waist tie + 2 front pockets!)
  const apronGrad = ctx.createLinearGradient(-46, -98, 52, 134);
  apronGrad.addColorStop(0, PALETTE.apronHighlight);
  apronGrad.addColorStop(0.45, PALETTE.apronBase);
  apronGrad.addColorStop(0.85, PALETTE.apronShadow);
  apronGrad.addColorStop(1, PALETTE.apronDeep);

  // Slender shoulder straps
  for (const side of [-1, 1]) {
    paintShape(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(side * 16, -103);
        c.lineTo(side * 22.5, -101);
        c.lineTo(side * 27, -64);
        c.lineTo(side * 20.5, -64);
        c.closePath();
      },
      {
        fill: PALETTE.apronBase,
        strokeWidth: 1.85,
        strokeColor: PALETTE.inkDark,
      }
    );
  }

  // Apron upper bib
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-25, -66);
      c.quadraticCurveTo(0, -64, 25, -66);
      c.bezierCurveTo(27, -40, 29, -16, 30, 2);
      c.lineTo(-30, 2);
      c.bezierCurveTo(-29, -16, -27, -40, -25, -66);
      c.closePath();
    },
    {
      fill: apronGrad,
      strokeWidth: 2.0,
      strokeColor: PALETTE.inkDark,
      textureFn: (c) => drawLinenTexture(c, -34, -70, 68, 76, 0.14),
      innerPassFn: (c) => {
        // Gentle bust/fabric contour drape folds
        setInkStyle(c, 1.15, 'rgba(130, 114, 96, 0.45)');
        c.beginPath();
        c.moveTo(-22, -26);
        c.quadraticCurveTo(-8, -18, 6, -21);
        c.moveTo(-18, -10);
        c.quadraticCurveTo(0, -5, 18, -12);
        c.stroke();
      },
    }
  );

  // Apron lower panel (hanging gracefully down over the midi skirt!)
  const apronSway = sway * 11;
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-31, 4);
      c.lineTo(31, 4);
      c.bezierCurveTo(42, 46, 52 + apronSway, 96, 54 + apronSway, 134);
      c.quadraticCurveTo(apronSway * 0.8, 144, -52 + apronSway, 134);
      c.bezierCurveTo(-50 + apronSway, 96, -40, 46, -31, 4);
      c.closePath();
    },
    {
      fill: apronGrad,
      strokeWidth: 2.1,
      strokeColor: PALETTE.inkDark,
      rimColor: 'rgba(255, 252, 244, 0.55)',
      rimOffset: { x: -2.0, y: -1.5 },
      textureFn: (c) => drawLinenTexture(c, -60, 0, 130, 150, 0.15),
      innerPassFn: (c) => {
        // Two neat rectangular minimalist front apron pockets (matches character_sheet.jpg!)
        for (const [px, pw] of [[-38 + apronSway * 0.35, 23], [14 + apronSway * 0.35, 25]]) {
          const py = 36;
          const ph = 34;
          c.beginPath();
          c.roundRect(px, py, pw, ph, 2.5);
          c.fillStyle = 'rgba(220, 210, 194, 0.45)';
          c.fill();
          setInkStyle(c, 1.55, PALETTE.inkDark);
          c.stroke();

          // Pocket top hem stitch
          setInkStyle(c, 0.95, 'rgba(112, 96, 80, 0.52)');
          c.beginPath();
          c.moveTo(px + 2, py + 5.5);
          c.lineTo(px + pw - 2, py + 5.5);
          c.stroke();
        }

        // Soft vertical linen fall folds
        setInkStyle(c, 1.25, 'rgba(130, 114, 96, 0.42)');
        c.beginPath();
        c.moveTo(-12, 16);
        c.quadraticCurveTo(-10 + apronSway * 0.4, 72, -16 + apronSway * 0.8, 128);
        c.moveTo(14, 16);
        c.quadraticCurveTo(18 + apronSway * 0.4, 72, 22 + apronSway * 0.8, 126);
        c.stroke();
      },
    }
  );

  // Sleek waist-tie band cleanly cinching waist
  paintShape(
    ctx,
    (c) => {
      c.beginPath();
      c.roundRect(-32.5, -3.5, 65, 9.5, 3.5);
    },
    {
      fill: PALETTE.apronBase,
      strokeWidth: 1.95,
      strokeColor: PALETTE.inkDark,
      innerPassFn: (c) => {
        setInkStyle(c, 1.0, 'rgba(124, 108, 92, 0.45)');
        c.beginPath();
        c.moveTo(-28, 1.2);
        c.lineTo(28, 1.2);
        c.stroke();
      },
    }
  );

  // === LAYER 5: MOM'S HEAD & CHIC MESSY BUN ===
  ctx.save();
  ctx.translate(0, -158 - bExp * 0.6);
  drawMomHead(ctx, {
    headTurn: resolvedTurn,
    headTilt: headTilt - torsoTilt * 0.35 + lean * 0.14,
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

  // === LAYER 6: HOLDING PIE SPECIAL DEPTH ORDER vs NORMAL FRONT ARM ===
  if (armMode === 'holdingPie') {
    // Draw back arm -> pie tray -> front arm & quilted mitts gripping tray sides!
    drawMomArm(ctx, backShX, backShY, backArmIK.x, backArmIK.y, backWristX, backWristY, {
      isBack: true,
      handMode: 'relaxed',
      side: -1,
      wearingMitt: true,
    });
    const pieX = (backWristX + frontWristX) * 0.5 + 4;
    const pieY = (backWristY + frontWristY) * 0.5 - 6;
    drawRaspberryPieOnTray(ctx, pieX, pieY, breathPhase, 1.08);
    drawMomArm(ctx, frontShX, frontShY, frontArmIK.x, frontArmIK.y, frontWristX, frontWristY, {
      isBack: false,
      handMode: 'relaxed',
      side: 1,
      wearingMitt: true,
    });
  } else {
    drawMomArm(ctx, frontShX, frontShY, frontArmIK.x, frontArmIK.y, frontWristX, frontWristY, {
      isBack: false,
      handMode: frontHandMode,
      side: 1,
      wearingMitt: false,
    });
  }

  ctx.restore();
}
