export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeInOutCubic = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const easeInOutQuint = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
};

export const easeOutCubic = (t: number): number => {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
};

export const easeOutQuart = (t: number): number => {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 4);
};

export const easeInOutSine = (t: number): number => {
  const x = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * x) - 1) / 2;
};

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Deterministic PRNG (Mulberry32) so particle & atmosphere rendering is 100%
 * flicker-free across multi-process Remotion renders.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export interface CameraTransform {
  scale: number;
  /** Translation in percent of viewport width (-50..+50) */
  txPct: number;
  /** Translation in percent of viewport height (-50..+50) */
  tyPct: number;
  /** Subtle roll rotation in degrees */
  rotateDeg: number;
}

/**
 * Given a desired zoom `scale` and normalized focal point `(focusX, focusY)` in [0..1]
 * on the source illustration, computes CSS translate percentages that frame the focal
 * point while mathematically guaranteeing ZERO black border exposure even with rotation.
 */
export const computeClampedCamera = (
  scale: number,
  focusX: number,
  focusY: number,
  rotateDeg = 0
): CameraTransform => {
  // Extra safety margin when subtly rotated
  const rotRad = (Math.abs(rotateDeg) * Math.PI) / 180;
  const rotSafety = Math.sin(rotRad) * 0.6 + 0.004;
  const safeScale = Math.max(scale, 1.02 + rotSafety * 2);

  // Desired shift to place (focusX, focusY) at screen center (0.5, 0.5)
  const desiredTx = (0.5 - focusX) * safeScale;
  const desiredTy = (0.5 - focusY) * safeScale;

  // Max safe shift before exposing image edge
  const maxShift = Math.max(0, 0.5 * (safeScale - 1) - rotSafety);
  const tx = clamp(desiredTx, -maxShift, maxShift);
  const ty = clamp(desiredTy, -maxShift, maxShift);

  return {
    scale: safeScale,
    txPct: tx * 100,
    tyPct: ty * 100,
    rotateDeg,
  };
};
