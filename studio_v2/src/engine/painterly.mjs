/**
 * Painterly Watercolor & Gouache 2D Rendering Library
 * Studio Ghibli / Cartoon Saloon storybook aesthetic for "Казка Пирожок"
 */

import { createCanvas } from '@napi-rs/canvas';

export const PALETTE = {
  // Warm sepia ink lines (NEVER harsh pure #000000)
  inkDark: '#472d1e',
  inkMid: '#5c3c28',
  inkSoft: 'rgba(82, 53, 35, 0.56)',
  inkFine: 'rgba(92, 60, 40, 0.36)',
  inkWarm: '#6b442c',

  // Paper & sunlight
  paperBase: '#faf5eb',
  paperWarm: '#f3ead9',
  sunGold: 'rgba(255, 241, 200, 0.58)',
  sunRim: 'rgba(255, 248, 224, 0.72)',
  sunGoldRim: 'rgba(255, 230, 158, 0.78)',
  sunGoldSoft: 'rgba(255, 220, 138, 0.36)',

  // Skin (warm peach-ivory)
  skinLight: '#fde9d6',
  skinBase: '#f7d2b4',
  skinMid: '#edc09f',
  skinShadow: '#dfa684',
  skinDeepShadow: '#c78969',
  blush: '#e78770',
  lipBoy: '#c96f5d',
  lipMom: '#d3786a',
  mouthInterior: '#7a332d',
  tongue: '#df7b72',

  // Chestnut curly/wavy hair
  hairDeep: '#4a2815',
  hairShadow: '#61371d',
  hairBase: '#7c4a2a',
  hairMid: '#9a5f38',
  hairLight: '#be804f',
  hairHighlight: '#daa16e',

  // Boy's wardrobe (cream waffle-knit shirt + light rolled denim)
  creamHighlight: '#fffcf5',
  creamBase: '#f4eadb',
  creamShadow: '#ded0bc',
  creamDeep: '#c7b59e',
  denimHighlight: '#a5bfd0',
  denimBase: '#7c9ab0',
  denimMid: '#68869d',
  denimShadow: '#526e84',
  denimCuff: '#b4c9d6',
  denimStitch: 'rgba(220, 205, 178, 0.75)',

  // Modern Mom's wardrobe (dusty-rose tee, oatmeal linen apron, warm-beige midi skirt, white sneakers)
  roseHighlight: '#e4bcb7',
  roseBase: '#cc9b96',
  roseShadow: '#aa7772',
  roseDeep: '#8c5c58',

  apronHighlight: '#f4efe5',
  apronBase: '#e5ddd0',
  apronShadow: '#cbc0ae',
  apronDeep: '#b3a592',

  skirtHighlight: '#e6cda9',
  skirtBase: '#ceac84',
  skirtShadow: '#ad8962',
  skirtDeep: '#8d6c49',

  sneakerWhite: '#fbf9f4',
  sneakerLight: '#f1ede4',
  sneakerShadow: '#dcd4c7',
  sneakerSole: '#e7e0d5',

  // White Dove (pearlescent white + luminous aura + crystal sky-blue eyes)
  dovePure: '#fffefb',
  doveHighlight: '#ffffff',
  doveCream: '#f6eddd',
  doveWarmShadow: '#e4d5be',
  doveCoolShadow: '#d8e0ea',
  doveFeatherInk: '#8d7560',
  doveBeakLight: '#f4c3aa',
  doveBeakBase: '#e49f83',
  doveBeakShadow: '#c77c62',
  doveFootLight: '#e89d87',
  doveFootBase: '#d6826d',
  doveFootShadow: '#b4624f',
  doveEyeSky: '#86d2ff',
  doveEyeMid: '#4aa8ec',
  doveEyeDeep: '#2363a3',
  doveEyeRim: '#1d4473',

  // Baking props (oven mitts & raspberry lattice pie)
  mittHighlight: '#faf3e6',
  mittBase: '#ede0cc',
  mittShadow: '#cfc0aa',
  trayBase: '#6b5b52',
  trayLight: '#918075',
  trayDark: '#473b35',
  crustLight: '#f2c179',
  crustBase: '#d9984c',
  crustShadow: '#a6682b',
  berryRuby: '#a91f3b',
  berryBright: '#e0425e',
  berryDark: '#6e1125',
};

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function deg(d) {
  return (d * Math.PI) / 180;
}

/**
 * Seeded deterministic PRNG for organic watercolor grain & freckles
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simple 2-bone analytical Inverse Kinematics solver in 2D
 * Returns elbow/knee joint coordinates { x, y }
 */
export function solve2BoneIK(sx, sy, tx, ty, l1, l2, bendDir = 1) {
  const dx = tx - sx;
  const dy = ty - sy;
  const maxDist = Math.max(0.001, l1 + l2 - 0.5);
  const minDist = Math.abs(l1 - l2) + 0.5;
  const dist = clamp(Math.hypot(dx, dy), minDist, maxDist);
  const baseAngle = Math.atan2(dy, dx);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const angleA = Math.acos(cosA);
  const jointAngle = baseAngle + bendDir * angleA;
  return {
    x: sx + Math.cos(jointAngle) * l1,
    y: sy + Math.sin(jointAngle) * l1,
    angle1: jointAngle,
    angle2: Math.atan2(ty - (sy + Math.sin(jointAngle) * l1), tx - (sx + Math.cos(jointAngle) * l1)),
  };
}

/**
 * Configure warm sepia storybook ink stroke
 */
export function setInkStyle(ctx, width = 2.0, color = PALETTE.inkDark) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/**
 * Paint a shape with gouache gradient fill, optional clipped watercolor shadow,
 * sunlit rim highlight, texture overlay, and warm sepia ink outline.
 */
export function paintShape(ctx, buildPath, opts = {}) {
  const {
    fill,
    strokeWidth = 2.0,
    strokeColor = PALETTE.inkDark,
    rimColor = null,
    rimOffset = { x: -2.5, y: -2.0 },
    shadowColor = null,
    shadowOffset = { x: 3.0, y: 2.5 },
    textureFn = null,
    innerPassFn = null,
    noStroke = false,
  } = opts;

  ctx.save();
  buildPath(ctx);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (textureFn || innerPassFn || rimColor || shadowColor) {
    ctx.save();
    ctx.clip();

    if (textureFn) {
      textureFn(ctx);
    }

    if (innerPassFn) {
      innerPassFn(ctx);
    }

    if (shadowColor) {
      ctx.save();
      ctx.translate(-shadowOffset.x, -shadowOffset.y);
      buildPath(ctx);
      ctx.lineWidth = strokeWidth * 3.2;
      ctx.strokeStyle = shadowColor;
      ctx.stroke();
      ctx.restore();
    }

    if (rimColor) {
      // Translate inward (opposite the light direction) so the sunlit edge sits cleanly INSIDE the clip!
      ctx.save();
      ctx.translate(-rimOffset.x * 1.15, -rimOffset.y * 1.15);
      buildPath(ctx);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Soft luminous outer golden wash
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = strokeWidth * 3.6;
      ctx.strokeStyle = rimColor;
      ctx.stroke();
      // Crisp sunlit inner rim edge
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = strokeWidth * 1.85;
      ctx.strokeStyle = rimColor;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  if (!noStroke && strokeWidth > 0) {
    buildPath(ctx);
    setInkStyle(ctx, strokeWidth, strokeColor);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paint a soft, luminous warm-golden sunlit rim highlight along an arbitrary curve.
 * Uses a two-pass painterly glow (wide warm gold wash + bright cream-gold core).
 */
export function drawSunlitRimArc(ctx, buildCurve, width = 3.2, alpha = 0.68) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  buildCurve(ctx);
  ctx.strokeStyle = `rgba(255, 218, 128, ${alpha * 0.45})`;
  ctx.lineWidth = width * 2.1;
  ctx.stroke();

  buildCurve(ctx);
  ctx.strokeStyle = `rgba(255, 244, 198, ${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a tapered calligraphic brush stroke along a polyline of { x, y, w } points
 */
export function drawTaperedCurve(ctx, points, color = PALETTE.inkDark) {
  if (!points || points.length < 2) return;
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const hw = (p.w ?? 2) * 0.5;
    left.push({ x: p.x + nx * hw, y: p.y + ny * hw });
    right.push({ x: p.x - nx * hw, y: p.y - ny * hw });
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) {
    ctx.lineTo(left[i].x, left[i].y);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    ctx.lineTo(right[i].x, right[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * Build a mathematically verified smooth tapered limb contour between (x1,y1) -> (x2,y2)
 * with OUTWARD-facing rounded caps and subtle anatomical curve (no inverted-arc pinches!).
 */
export function buildTaperedLimbPath(ctx, x1, y1, x2, y2, r1, r2, bulge = 0.08) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Left-hand normal in Y-down canvas coordinates: (-uy, ux)
  const nx = -uy;
  const ny = ux;

  const mx = (x1 + x2) * 0.5;
  const my = (y1 + y2) * 0.5;
  const rm = (r1 + r2) * 0.5 * (1 + bulge);

  // Angle of normal (+n) and opposite normal (-n)
  const aPlus = Math.atan2(ny, nx);
  const aMinus = aPlus + Math.PI;
  // Verify outward sweep: start cap should pass through (-ux, -uy), end cap through (+ux, +uy).
  // In Y-down coordinates, increasing angle rotates clockwise:
  // ux, uy is at angle theta; nx=-uy, ny=ux is at theta + PI/2; -ux,-uy is at theta + PI; -nx,-ny is at theta - PI/2.
  // So start cap from aPlus (theta+PI/2) -> theta+PI -> aMinus (theta+3PI/2) is CLOCKWISE (anticlockwise=false)!
  // Wait: let's trace around perimeter clockwise:
  // Start at P1 + n*r1 (angle aPlus)
  // -> side 1 along +n to P2 + n*r2 (angle aPlus)
  // -> end cap at P2 from aPlus -> theta (outward +u!) -> aMinus is COUNTER-CLOCKWISE (anticlockwise=true)!
  // -> side 2 along -n from P2 - n*r2 to P1 - n*r1 (angle aMinus)
  // -> start cap at P1 from aMinus -> theta+PI (outward -u!) -> aPlus is COUNTER-CLOCKWISE (anticlockwise=true)!
  ctx.beginPath();
  ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
  ctx.quadraticCurveTo(mx + nx * rm, my + ny * rm, x2 + nx * r2, y2 + ny * r2);
  ctx.arc(x2, y2, r2, aPlus, aMinus, true);
  ctx.quadraticCurveTo(mx - nx * rm, my - ny * rm, x1 - nx * r1, y1 - ny * r1);
  ctx.arc(x1, y1, r1, aMinus, aPlus, true);
  ctx.closePath();
}

/**
 * Build ONE seamless continuous anatomical 2-segment limb path (e.g. shoulder -> elbow -> wrist)
 * Smoothly joins both segments with natural rounded outer elbow/knee and soft inner bend, ZERO seam cuts!
 */
export function buildContinuous2SegmentPath(ctx, x0, y0, x1, y1, x2, y2, r0, r1, r2) {
  const dx1 = x1 - x0;
  const dy1 = y1 - y0;
  const len1 = Math.hypot(dx1, dy1) || 1;
  const u1x = dx1 / len1;
  const u1y = dy1 / len1;
  const n1x = -u1y;
  const n1y = u1x;

  const dx2 = x2 - x1;
  const dy2 = y2 - y1;
  const len2 = Math.hypot(dx2, dy2) || 1;
  const u2x = dx2 / len2;
  const u2y = dy2 / len2;
  const n2x = -u2y;
  const n2y = u2x;

  // Mitered/averaged joint normal at P1 (clamped so sharp bends stay smooth and natural)
  let jnx = n1x + n2x;
  let jny = n1y + n2y;
  const jLen = Math.hypot(jnx, jny);
  if (jLen < 0.25) {
    jnx = n1x;
    jny = n1y;
  } else {
    jnx /= jLen;
    jny /= jLen;
  }

  // Cross product tells which side is outer vs inner bend
  const cross = u1x * u2y - u1y * u2x;
  const bendStrength = Math.abs(cross);
  const miterPlus = cross > 0 ? 1.05 + bendStrength * 0.08 : 0.92;
  const miterMinus = cross < 0 ? 1.05 + bendStrength * 0.08 : 0.92;

  const a1Plus = Math.atan2(n1y, n1x);
  const a1Minus = a1Plus + Math.PI;
  const a2Plus = Math.atan2(n2y, n2x);
  const a2Minus = a2Plus + Math.PI;

  const p0PlusX = x0 + n1x * r0;
  const p0PlusY = y0 + n1y * r0;
  const p1PlusX = x1 + jnx * r1 * miterPlus;
  const p1PlusY = y1 + jny * r1 * miterPlus;
  const p2PlusX = x2 + n2x * r2;
  const p2PlusY = y2 + n2y * r2;

  const p2MinusX = x2 - n2x * r2;
  const p2MinusY = y2 - n2y * r2;
  const p1MinusX = x1 - jnx * r1 * miterMinus;
  const p1MinusY = y1 - jny * r1 * miterMinus;
  const p0MinusX = x0 - n1x * r0;
  const p0MinusY = y0 - n1y * r0;

  // Smooth anatomical corner-rounding anchor points before & after the elbow/knee joint
  // Eliminates sharp C0 elbow kinks and creates graceful, organically tapered limb curves!
  const tPre = 0.78;
  const tPost = 0.22;

  const prePlusX = lerp(p0PlusX, p1PlusX, tPre) + n1x * 0.8;
  const prePlusY = lerp(p0PlusY, p1PlusY, tPre) + n1y * 0.8;
  const postPlusX = lerp(p1PlusX, p2PlusX, tPost) + n2x * 1.1;
  const postPlusY = lerp(p1PlusY, p2PlusY, tPost) + n2y * 1.1;

  const preMinusX = lerp(p0MinusX, p1MinusX, tPre) - n1x * 0.8;
  const preMinusY = lerp(p0MinusY, p1MinusY, tPre) - n1y * 0.8;
  const postMinusX = lerp(p1MinusX, p2MinusX, tPost) - n2x * 1.1;
  const postMinusY = lerp(p1MinusY, p2MinusY, tPost) - n2y * 1.1;

  ctx.beginPath();
  ctx.moveTo(p0PlusX, p0PlusY);
  // Segment 1 (+ side) with gentle anatomical muscle contour
  ctx.quadraticCurveTo(
    lerp(p0PlusX, prePlusX, 0.5) + n1x * 1.2,
    lerp(p0PlusY, prePlusY, 0.5) + n1y * 1.2,
    prePlusX,
    prePlusY
  );
  // Silky rounded elbow/knee transition (+ side)
  ctx.quadraticCurveTo(p1PlusX, p1PlusY, postPlusX, postPlusY);
  // Segment 2 (+ side) gently tapered forearm/calf curve
  ctx.quadraticCurveTo(
    lerp(postPlusX, p2PlusX, 0.45) + n2x * 1.35,
    lerp(postPlusY, p2PlusY, 0.45) + n2y * 1.35,
    p2PlusX,
    p2PlusY
  );
  // End cap at P2 (outward along +u2)
  ctx.arc(x2, y2, r2, a2Plus, a2Minus, true);
  // Segment 2 (- side)
  ctx.quadraticCurveTo(
    lerp(p2MinusX, postMinusX, 0.55) - n2x * 1.35,
    lerp(p2MinusY, postMinusY, 0.55) - n2y * 1.35,
    postMinusX,
    postMinusY
  );
  // Silky rounded elbow/knee transition (- side)
  ctx.quadraticCurveTo(p1MinusX, p1MinusY, preMinusX, preMinusY);
  // Segment 1 (- side)
  ctx.quadraticCurveTo(
    lerp(preMinusX, p0MinusX, 0.5) - n1x * 1.2,
    lerp(preMinusY, p0MinusY, 0.5) - n1y * 1.2,
    p0MinusX,
    p0MinusY
  );
  // Start cap at P0 (outward along -u1)
  ctx.arc(x0, y0, r0, a1Minus, a1Plus, true);
  ctx.closePath();
}

/**
 * Draw soft rosy watercolor cheek blush with optional delicate freckles/hatch strokes
 */
export function drawSoftBlush(ctx, x, y, rx, ry, intensity = 0.45, opts = {}) {
  const { freckles = false, hatches = false, peach = false } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / Math.max(0.01, rx));
  const grad = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
  if (peach) {
    grad.addColorStop(0, `rgba(240, 144, 114, ${intensity})`);
    grad.addColorStop(0.55, `rgba(246, 168, 134, ${intensity * 0.52})`);
    grad.addColorStop(1, 'rgba(246, 168, 134, 0)');
  } else {
    grad.addColorStop(0, `rgba(232, 130, 108, ${intensity})`);
    grad.addColorStop(0.55, `rgba(235, 145, 120, ${intensity * 0.48})`);
    grad.addColorStop(1, 'rgba(235, 145, 120, 0)');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (hatches) {
    ctx.save();
    setInkStyle(ctx, 1.1, `rgba(205, 102, 85, ${intensity * 0.65})`);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * rx * 0.36 - 2, y + ry * 0.28);
      ctx.lineTo(x + i * rx * 0.36 + 2.5, y - ry * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (freckles) {
    ctx.save();
    ctx.fillStyle = `rgba(176, 102, 74, ${intensity * 0.65})`;
    const dots = [
      [-0.35, -0.05, 1.05],
      [0.12, 0.18, 0.95],
      [0.42, -0.1, 0.85],
    ];
    for (const [fx, fy, fr] of dots) {
      ctx.beginPath();
      ctx.arc(x + fx * rx, y + fy * ry, fr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Draw subtle waffle-knit fabric texture clipped inside current clip region
 */
export function drawWaffleTexture(ctx, x, y, w, h, spacing = 7.5, alpha = 0.2) {
  ctx.save();
  ctx.strokeStyle = `rgba(166, 142, 115, ${alpha})`;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += spacing) {
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
  }
  for (let gy = y; gy <= y + h; gy += spacing) {
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
  }
  ctx.stroke();

  // Subtle recessed waffle dimples
  ctx.fillStyle = `rgba(176, 152, 124, ${alpha * 0.55})`;
  for (let gx = x + spacing * 0.5; gx < x + w; gx += spacing) {
    for (let gy = y + spacing * 0.5; gy < y + h; gy += spacing) {
      ctx.fillRect(gx - 1.1, gy - 1.1, 2.2, 2.2);
    }
  }
  ctx.restore();
}

/**
 * Draw subtle woven oatmeal-linen grain clipped inside Mom's apron
 */
export function drawLinenTexture(ctx, x, y, w, h, alpha = 0.15) {
  ctx.save();
  const rng = mulberry32(4109);
  ctx.strokeStyle = `rgba(155, 138, 118, ${alpha})`;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (let gy = y; gy <= y + h; gy += 5.5) {
    ctx.moveTo(x, gy + (rng() - 0.5) * 0.6);
    ctx.lineTo(x + w, gy + (rng() - 0.5) * 0.6);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(165, 148, 128, ${alpha * 0.7})`;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += 7.5) {
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw subtle diagonal denim twill grain clipped inside jeans
 */
export function drawDenimTexture(ctx, x, y, w, h, alpha = 0.12) {
  ctx.save();
  ctx.strokeStyle = `rgba(60, 88, 112, ${alpha})`;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  const step = 6;
  for (let d = -h; d < w + h; d += step) {
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d - h * 0.65, y + h);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Cached warm watercolor paper background tile
 */
let _paperTile = null;
export function getWatercolorPaperTile() {
  if (_paperTile) return _paperTile;
  const size = 256;
  const tile = createCanvas(size, size);
  const tctx = tile.getContext('2d');
  tctx.fillStyle = PALETTE.paperBase;
  tctx.fillRect(0, 0, size, size);

  const rng = mulberry32(8821);
  // Soft organic warm paper fibers & washes
  for (let i = 0; i < 420; i++) {
    const px = rng() * size;
    const py = rng() * size;
    const r = 1.5 + rng() * 8;
    const warm = rng() > 0.5;
    tctx.fillStyle = warm
      ? `rgba(224, 206, 178, ${0.04 + rng() * 0.05})`
      : `rgba(255, 252, 244, ${0.06 + rng() * 0.06})`;
    tctx.beginPath();
    tctx.arc(px, py, r, 0, Math.PI * 2);
    tctx.fill();
  }
  // Fine tooth speckles
  for (let i = 0; i < 900; i++) {
    const px = rng() * size;
    const py = rng() * size;
    tctx.fillStyle = `rgba(175, 152, 124, ${0.03 + rng() * 0.045})`;
    tctx.fillRect(px, py, 1.3, 1.3);
  }
  _paperTile = tile;
  return tile;
}

/**
 * Fill canvas with authentic warm storybook watercolor paper + soft sunlit glow
 */
export function drawWatercolorPaperBackground(ctx, w, h) {
  ctx.save();
  const tile = getWatercolorPaperTile();
  const pat = ctx.createPattern(tile, 'repeat');
  ctx.fillStyle = pat || PALETTE.paperBase;
  ctx.fillRect(0, 0, w, h);

  // Subtle warm vignette around edges
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(255, 252, 244, 0.18)');
  vig.addColorStop(0.7, 'rgba(240, 228, 208, 0.08)');
  vig.addColorStop(1, 'rgba(205, 184, 156, 0.24)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Soft warm ambient occlusion contact shadow under feet
 */
export function drawGroundShadow(ctx, x, y, rx, ry, alpha = 0.22) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / Math.max(0.01, rx));
  const grad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
  grad.addColorStop(0, `rgba(112, 82, 58, ${alpha})`);
  grad.addColorStop(0.6, `rgba(130, 96, 68, ${alpha * 0.45})`);
  grad.addColorStop(1, 'rgba(130, 96, 68, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Studio-grade storybook expressive eye (used by Boy and Mom)
 */
export function drawStorybookEye(ctx, opts) {
  const {
    x,
    y,
    rx = 11,
    ry = 12,
    gazeX = 0,
    gazeY = 0,
    blink = 0,
    irisDark = '#4a2614',
    irisMid = '#734124',
    irisWarm = '#b57842',
    isMom = false,
    side = 1, // -1 left eye, +1 right eye
    surprised = 0,
  } = opts;

  const b = clamp(blink, 0, 1);
  const openRy = ry * (1 + surprised * 0.14) * (1 - b * 0.94);

  ctx.save();
  ctx.translate(x, y);

  if (b > 0.86) {
    // Serene closed smiling/blinking eyelid arc
    const curveY = isMom ? 2.5 : 2.0;
    ctx.beginPath();
    ctx.moveTo(-rx * 1.05, 0.5);
    ctx.quadraticCurveTo(0, curveY + 2.5, rx * 1.05, 0.5);
    setInkStyle(ctx, isMom ? 2.4 : 2.2, PALETTE.inkDark);
    ctx.stroke();

    if (isMom) {
      // Delicate outer lash flick
      ctx.beginPath();
      ctx.moveTo(side * rx * 0.92, 0.8);
      ctx.quadraticCurveTo(side * rx * 1.18, 0.2, side * rx * 1.28, -1.8);
      setInkStyle(ctx, 1.8, PALETTE.inkDark);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Sclera shape (soft almond for Mom, big warm rounded-oval for Boy)
  const buildEyeClip = (c) => {
    c.beginPath();
    if (isMom) {
      c.moveTo(-rx * 1.08, 1.0);
      c.bezierCurveTo(-rx * 0.55, -openRy * 1.18, rx * 0.55, -openRy * 1.18, rx * 1.08, 0.5);
      c.bezierCurveTo(rx * 0.55, openRy * 0.92, -rx * 0.55, openRy * 0.92, -rx * 1.08, 1.0);
    } else {
      c.ellipse(0, 0, rx, openRy, 0, 0, Math.PI * 2);
    }
    c.closePath();
  };

  // Warm ivory sclera fill (never sterile harsh white)
  const scleraGrad = ctx.createLinearGradient(0, -openRy, 0, openRy);
  scleraGrad.addColorStop(0, '#ebe0d4');
  scleraGrad.addColorStop(0.28, '#fffcf7');
  scleraGrad.addColorStop(1, '#f7efe5');

  buildEyeClip(ctx);
  ctx.fillStyle = scleraGrad;
  ctx.fill();

  // Clip iris & pupil inside sclera
  ctx.save();
  buildEyeClip(ctx);
  ctx.clip();

  const irisR = Math.min(rx, ry) * (isMom ? 0.68 : 0.78) * (1 - surprised * 0.08);
  const gx = clamp(gazeX, -1, 1) * rx * 0.24;
  const gy = clamp(gazeY, -1, 1) * ry * 0.18;

  // Iris gradient (deep upper chestnut -> warm golden-amber lower glow)
  const irisGrad = ctx.createRadialGradient(gx, gy + irisR * 0.28, irisR * 0.1, gx, gy, irisR);
  irisGrad.addColorStop(0, irisWarm);
  irisGrad.addColorStop(0.55, irisMid);
  irisGrad.addColorStop(0.9, irisDark);
  irisGrad.addColorStop(1, '#341a0d');

  ctx.beginPath();
  ctx.arc(gx, gy, irisR, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Subtle warm lower amber crescent highlight inside iris
  ctx.beginPath();
  ctx.arc(gx, gy + irisR * 0.22, irisR * 0.62, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fillStyle = 'rgba(232, 168, 96, 0.35)';
  ctx.fill();

  // Deep warm dark pupil
  const pupilR = irisR * (isMom ? 0.46 : 0.5) * (1 - surprised * 0.08);
  ctx.beginPath();
  ctx.arc(gx, gy - irisR * 0.02, pupilR, 0, Math.PI * 2);
  ctx.fillStyle = '#26140c';
  ctx.fill();

  // Soft upper eyelid shadow cast onto sclera & iris
  const lidShadow = ctx.createLinearGradient(0, -openRy, 0, -openRy * 0.15);
  lidShadow.addColorStop(0, 'rgba(84, 50, 32, 0.34)');
  lidShadow.addColorStop(1, 'rgba(84, 50, 32, 0)');
  ctx.fillStyle = lidShadow;
  ctx.fillRect(-rx * 1.3, -openRy * 1.2, rx * 2.6, openRy * 1.15);

  // Crisp bright primary catchlight (upper-left)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(
    gx - irisR * 0.34,
    gy - irisR * 0.34,
    irisR * 0.26,
    irisR * 0.22,
    -0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Tiny secondary specular glint (lower-right)
  ctx.fillStyle = 'rgba(255, 250, 238, 0.85)';
  ctx.beginPath();
  ctx.arc(gx + irisR * 0.34, gy + irisR * 0.3, irisR * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Upper lush curved eyelash line
  ctx.beginPath();
  if (isMom) {
    ctx.moveTo(-rx * 1.12, 1.2);
    ctx.bezierCurveTo(-rx * 0.52, -openRy * 1.24, rx * 0.55, -openRy * 1.22, rx * 1.14, 0.4);
  } else {
    ctx.moveTo(-rx * 1.02, 0.4);
    ctx.bezierCurveTo(-rx * 0.55, -openRy * 1.22, rx * 0.55, -openRy * 1.22, rx * 1.02, 0.4);
  }
  setInkStyle(ctx, isMom ? 2.8 : 2.5, PALETTE.inkDark);
  ctx.stroke();

  // Delicate outer eyelash sweep for Mom
  if (isMom) {
    ctx.beginPath();
    ctx.moveTo(side * rx * 0.94, 0.1);
    ctx.quadraticCurveTo(side * rx * 1.22, -openRy * 0.18, side * rx * 1.34, -openRy * 0.42);
    setInkStyle(ctx, 2.0, PALETTE.inkDark);
    ctx.stroke();
  }

  // Subtle soft lower lid line
  ctx.beginPath();
  ctx.moveTo(-rx * 0.65, openRy * 0.78);
  ctx.quadraticCurveTo(0, openRy * 1.04, rx * 0.65, openRy * 0.78);
  setInkStyle(ctx, 1.1, 'rgba(92, 58, 38, 0.42)');
  ctx.stroke();

  // Delicate upper eyelid fold crease
  ctx.beginPath();
  ctx.moveTo(-rx * 0.85, -openRy * 1.18 - 2.0);
  ctx.quadraticCurveTo(0, -openRy * 1.52 - 2.2, rx * 0.85, -openRy * 1.14 - 1.8);
  setInkStyle(ctx, 1.05, 'rgba(116, 74, 48, 0.42)');
  ctx.stroke();

  ctx.restore();
}

/**
 * Studio-grade lip-sync mouth renderer supporting all 7 animation visemes
 * viseme: 'closed' | 'smile' | 'ah' | 'oh' | 'ee' | 'wide' | 'surprisedO'
 */
export function drawExpressiveMouth(ctx, x, y, scale = 1, viseme = 'smile', mouthOpen = 0, opts = {}) {
  const { isMom = false, mood = 'happy' } = opts;
  const open = clamp(mouthOpen, 0, 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const lipColor = isMom ? PALETTE.lipMom : PALETTE.lipBoy;
  const inkW = isMom ? 1.85 : 2.0;

  if (viseme === 'closed') {
    ctx.beginPath();
    const dip = mood === 'thoughtful' ? -0.5 : 1.5;
    ctx.moveTo(-9, 0);
    ctx.quadraticCurveTo(0, dip, 9, 0);
    setInkStyle(ctx, inkW, PALETTE.inkDark);
    ctx.stroke();
    if (isMom) {
      // Soft lower lip hint
      ctx.beginPath();
      ctx.moveTo(-4.5, 3.2);
      ctx.quadraticCurveTo(0, 4.6, 4.5, 3.2);
      setInkStyle(ctx, 1.2, 'rgba(204, 114, 102, 0.55)');
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (viseme === 'smile' && open < 0.12) {
    const w = isMom ? 12.5 : 13.5;
    const h = mood === 'joyful' ? 6.2 : 4.5;
    if (isMom) {
      // Subtle warm rose upper/lower lip tint
      ctx.beginPath();
      ctx.moveTo(-w, -0.5);
      ctx.quadraticCurveTo(0, h + 3.2, w, -0.5);
      ctx.quadraticCurveTo(0, h * 0.4, -w, -0.5);
      ctx.fillStyle = 'rgba(216, 126, 114, 0.42)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-w, -1.0);
    ctx.quadraticCurveTo(0, h + 1.2, w, -1.0);
    setInkStyle(ctx, inkW, PALETTE.inkDark);
    ctx.stroke();

    // Cute subtle cheek corner dimples
    ctx.beginPath();
    ctx.arc(-w - 0.5, -1.2, 0.9, 0, Math.PI * 2);
    ctx.arc(w + 0.5, -1.2, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(92, 58, 38, 0.45)';
    ctx.fill();

    // Tiny lower lip shadow
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, h + 3.6);
    ctx.quadraticCurveTo(0, h + 5.0, w * 0.35, h + 3.6);
    setInkStyle(ctx, 1.0, 'rgba(148, 92, 68, 0.38)');
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Open mouth visemes
  let mw = 11;
  let mh = 9;
  let topCurve = -1.5;
  let showTeeth = true;

  if (viseme === 'ah') {
    mw = 10.5 + open * 2.5;
    mh = 8.5 + open * 6.5;
    topCurve = -1.2;
  } else if (viseme === 'wide' || (viseme === 'smile' && open >= 0.12)) {
    mw = 14 + open * 2.5;
    mh = 6.5 + open * 7.5;
    topCurve = -2.2;
  } else if (viseme === 'ee') {
    mw = 13.5 + open * 1.5;
    mh = 4.2 + open * 2.6;
    topCurve = -0.8;
  } else if (viseme === 'oh') {
    mw = 6.8 + open * 1.6;
    mh = 8.5 + open * 4.5;
    topCurve = -3.8;
    showTeeth = false;
  } else if (viseme === 'surprisedO') {
    mw = 7.4 + open * 1.8;
    mh = 10.5 + open * 4.5;
    topCurve = -5.2;
    showTeeth = false;
  }

  const buildMouth = (c) => {
    c.beginPath();
    if (viseme === 'oh' || viseme === 'surprisedO') {
      c.ellipse(0, mh * 0.22, mw, mh * 0.68, 0, 0, Math.PI * 2);
    } else {
      c.moveTo(-mw, topCurve);
      c.quadraticCurveTo(0, topCurve + 2.2, mw, topCurve);
      c.bezierCurveTo(mw * 0.92, mh * 1.15, -mw * 0.92, mh * 1.15, -mw, topCurve);
    }
    c.closePath();
  };

  // Warm shadowed mouth interior
  buildMouth(ctx);
  const intGrad = ctx.createLinearGradient(0, -mh * 0.4, 0, mh);
  intGrad.addColorStop(0, '#5a231e');
  intGrad.addColorStop(1, PALETTE.mouthInterior);
  ctx.fillStyle = intGrad;
  ctx.fill();

  ctx.save();
  buildMouth(ctx);
  ctx.clip();

  // Warm soft tongue cushion
  ctx.beginPath();
  ctx.ellipse(0, mh * 0.85, mw * 0.72, mh * 0.46, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.tongue;
  ctx.fill();

  // Soft ivory upper teeth bar
  if (showTeeth) {
    ctx.beginPath();
    ctx.roundRect(-mw * 0.85, topCurve - 1.5, mw * 1.7, Math.min(4.0, mh * 0.36), 2);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
  }
  ctx.restore();

  // Warm lip border & sepia outline
  if (isMom) {
    buildMouth(ctx);
    setInkStyle(ctx, 2.8, 'rgba(211, 120, 106, 0.45)');
    ctx.stroke();
  }
  buildMouth(ctx);
  setInkStyle(ctx, inkW, PALETTE.inkDark);
  ctx.stroke();

  // Subtle lower lip highlight
  ctx.beginPath();
  ctx.moveTo(-mw * 0.35, mh + 2.6);
  ctx.quadraticCurveTo(0, mh + 3.8, mw * 0.35, mh + 2.6);
  setInkStyle(ctx, 1.0, `rgba(175, 102, 84, ${isMom ? 0.55 : 0.32})`);
  ctx.stroke();

  ctx.restore();
}
