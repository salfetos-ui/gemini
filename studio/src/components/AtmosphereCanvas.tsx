import React, { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, lerp, mulberry32 } from "../utils/easing";
import { PaletteMood, SunbeamSide } from "../utils/sceneChoreography";

interface AtmosphereCanvasProps {
  sunbeamSide: SunbeamSide;
  sunbeamIntensity: number;
  mood: PaletteMood;
  particleDensity: number;
  bokehIntensity: number;
  warmthBoost: number;
  celestialBlend: number;
  globalOpacity?: number;
}

interface Particle {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  radius: number;
  depth: 0 | 1 | 2;
  phase: number;
  twinkleSpeed: number;
  swayAmp: number;
  swayFreq: number;
  hueSlot: number;
}

interface Sunbeam {
  offsetPct: number;
  width: number;
  angleDeg: number;
  phase: number;
  speed: number;
  baseAlpha: number;
}

const PARTICLE_COUNT = 64;
// Render soft atmospheric light/bokeh/vignette at 960x540 and let Chromium bilinearly upscale to 1920x1080 (4x faster, visually silky!)
const CW = 960;
const CH = 540;
const SCALE = 0.5;

function makeGlowSprite(
  size: number,
  coreColor: string,
  midColor: string,
  isBokeh: boolean
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const half = size / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  if (isBokeh) {
    g.addColorStop(0, coreColor);
    g.addColorStop(0.65, midColor);
    g.addColorStop(0.92, midColor.replace(/[\d.]+\)$/, "0.18)"));
    g.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    g.addColorStop(0, "rgba(255,253,245,1)");
    g.addColorStop(0.35, coreColor);
    g.addColorStop(0.7, midColor);
    g.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/**
 * High-speed deterministic HTML5 Canvas 2.5D Atmospheric Renderer:
 * - Pre-baked glow/bokeh sprites (50x faster than per-frame createRadialGradient!)
 * - 960x540 soft bilinear atmospheric buffer (4x fewer pixels, identical cinematic softness!)
 * - Volumetric swaying sunlit god-rays, 64 multi-depth dust motes & bokeh orbs, warm vignette.
 */
export const AtmosphereCanvas: React.FC<AtmosphereCanvasProps> = ({
  sunbeamSide,
  sunbeamIntensity,
  mood,
  particleDensity,
  bokehIntensity,
  warmthBoost,
  celestialBlend,
  globalOpacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sprites = useMemo(() => {
    return {
      goldMote: makeGlowSprite(32, "rgba(255,232,166,0.82)", "rgba(255,220,130,0.22)", false),
      roseMote: makeGlowSprite(32, "rgba(255,205,186,0.80)", "rgba(255,188,166,0.20)", false),
      skyMote: makeGlowSprite(32, "rgba(165,232,255,0.84)", "rgba(130,218,255,0.22)", false),
      goldBokeh: makeGlowSprite(64, "rgba(255,235,174,0.72)", "rgba(255,222,145,0.42)", true),
      skyBokeh: makeGlowSprite(64, "rgba(175,234,255,0.72)", "rgba(135,218,255,0.42)", true),
    };
  }, []);

  const particles = useMemo<Particle[]>(() => {
    const rng = mulberry32(20261124);
    const list: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const rDepth = rng();
      const depth: 0 | 1 | 2 = rDepth < 0.45 ? 0 : rDepth < 0.82 ? 1 : 2;
      const radius =
        depth === 0
          ? lerp(1.6, 3.2, rng())
          : depth === 1
            ? lerp(3.5, 7.2, rng())
            : lerp(14, 34, rng());
      const speedMult = depth === 0 ? 0.55 : depth === 1 ? 1.0 : 1.55;
      list.push({
        x0: rng() * 1920,
        y0: rng() * 1080,
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
    return list;
  }, []);

  const sunbeams = useMemo<Sunbeam[]>(
    () => [
      { offsetPct: 0.05, width: 220, angleDeg: 26, phase: 0.0, speed: 0.45, baseAlpha: 0.13 },
      { offsetPct: 0.18, width: 310, angleDeg: 31, phase: 1.3, speed: 0.36, baseAlpha: 0.16 },
      { offsetPct: 0.31, width: 185, angleDeg: 35, phase: 2.6, speed: 0.52, baseAlpha: 0.11 },
      { offsetPct: 0.44, width: 260, angleDeg: 39, phase: 4.1, speed: 0.41, baseAlpha: 0.10 },
      { offsetPct: 0.12, width: 150, angleDeg: 22, phase: 5.2, speed: 0.58, baseAlpha: 0.09 },
    ],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = frame / fps;
    ctx.clearRect(0, 0, CW, CH);
    if (globalOpacity <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = clamp(globalOpacity, 0, 1);

    // 1. VOLUMETRIC SUNLIT GOD-RAYS
    if (sunbeamSide !== "none" && sunbeamIntensity > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const isRight = sunbeamSide === "right";
      const r = Math.round(lerp(255, 224, celestialBlend * 0.45));
      const g = Math.round(lerp(233, 242, celestialBlend * 0.45));
      const b = Math.round(lerp(172, 255, celestialBlend * 0.6));

      for (const beam of sunbeams) {
        const sway = Math.sin(t * beam.speed + beam.phase);
        const breath = 0.68 + 0.32 * Math.sin(t * (beam.speed * 1.35) + beam.phase + 0.8);
        const alpha = beam.baseAlpha * sunbeamIntensity * breath;
        if (alpha <= 0.004) continue;

        const originX =
          (isRight ? 1920 * (1 - beam.offsetPct * 0.72) : 1920 * (beam.offsetPct * 0.72)) * SCALE +
          sway * 19;
        const originY = -60;
        const rad = ((isRight ? 180 - beam.angleDeg : beam.angleDeg) * Math.PI) / 180;
        const length = 825;
        const bw = beam.width * SCALE;

        ctx.save();
        ctx.translate(originX, originY);
        ctx.rotate(rad - Math.PI / 2 + sway * 0.025);

        const grad = ctx.createLinearGradient(0, 0, 0, length);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(alpha * 1.15).toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.55).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-bw * 0.38, 0);
        ctx.lineTo(bw * 0.38, 0);
        ctx.lineTo(bw * 1.15, length);
        ctx.lineTo(-bw * 1.15, length);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 2. FLOATING GOLDEN DUST MOTES & LUMINOUS CELESTIAL BOKEH (PRE-BAKED SPRITES!)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const activeCount = Math.min(
      PARTICLE_COUNT,
      Math.round(PARTICLE_COUNT * clamp(particleDensity, 0.4, 1.5) * 0.85)
    );

    for (let i = 0; i < activeCount; i++) {
      const p = particles[i];
      if (p.depth === 2 && bokehIntensity < 0.05) continue;

      const pad = 60;
      const spanX = 1920 + pad * 2;
      const spanY = 1080 + pad * 2;
      const rawX = p.x0 + p.vx * t + Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;
      const rawY = p.y0 + p.vy * t + Math.cos(t * p.swayFreq * 0.8 + p.phase) * p.swayAmp * 0.4;
      const x = ((((rawX + pad) % spanX) + spanX) % spanX - pad) * SCALE;
      const y = ((((rawY + pad) % spanY) + spanY) % spanY - pad) * SCALE;

      const twinkle =
        0.42 + 0.58 * Math.pow(0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.phase), 1.6);

      const alpha =
        p.depth === 0
          ? 0.45 * twinkle
          : p.depth === 1
            ? 0.68 * twinkle
            : 0.28 * bokehIntensity * (0.65 + 0.35 * twinkle);

      if (alpha < 0.015) continue;

      const isSky = celestialBlend > 0.22 && p.hueSlot > 1 - celestialBlend * 0.65;
      const sprite =
        p.depth === 2
          ? isSky
            ? sprites.skyBokeh
            : sprites.goldBokeh
          : isSky
            ? sprites.skyMote
            : mood === "rose-warm" && p.hueSlot > 0.6
              ? sprites.roseMote
              : sprites.goldMote;

      if (!sprite) continue;
      const drawR =
        (p.depth === 2 ? p.radius * lerp(0.85, 1.38, bokehIntensity) : p.radius) * SCALE;

      ctx.globalAlpha = clamp(alpha * globalOpacity, 0, 1);
      ctx.drawImage(sprite, x - drawR, y - drawR, drawR * 2, drawR * 2);
    }
    ctx.restore();

    // 3. WARM SUNLIGHT WASH + STORYBOOK CINEMATIC VIGNETTE
    ctx.globalAlpha = clamp(globalOpacity, 0, 1);
    if (warmthBoost > 0.05 && sunbeamSide !== "none") {
      const wx = sunbeamSide === "right" ? CW * 0.92 : CW * 0.08;
      const warmGrad = ctx.createRadialGradient(wx, CH * 0.22, 30, wx, CH * 0.35, CW * 0.72);
      warmGrad.addColorStop(0, `rgba(255, 224, 150, ${(0.18 * warmthBoost).toFixed(3)})`);
      warmGrad.addColorStop(1, "rgba(255, 224, 150, 0)");
      ctx.fillStyle = warmGrad;
      ctx.fillRect(0, 0, CW, CH);
    }

    const vig = ctx.createRadialGradient(CW * 0.5, CH * 0.48, CW * 0.34, CW * 0.5, CH * 0.5, CW * 0.72);
    vig.addColorStop(0, "rgba(32, 20, 10, 0)");
    vig.addColorStop(0.76, "rgba(36, 22, 12, 0.07)");
    vig.addColorStop(1, "rgba(28, 16, 8, 0.28)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CW, CH);

    ctx.restore();
  }, [
    frame,
    fps,
    sprites,
    particles,
    sunbeams,
    sunbeamSide,
    sunbeamIntensity,
    mood,
    particleDensity,
    bokehIntensity,
    warmthBoost,
    celestialBlend,
    globalOpacity,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
};
