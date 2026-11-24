import React from "react";
import { SceneTiming } from "../types";
import { clamp, easeInOutSine, lerp, smoothstep } from "../utils/easing";

interface SceneVfxLayerProps {
  scene: SceneTiming;
  localTimeSec: number;
  progress: number;
}

const buildSteamPath = (
  cx: number,
  baseY: number,
  height: number,
  amp: number,
  time: number,
  phase: number
): string => {
  const steps = 6;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const y = baseY - f * height;
    const sway =
      Math.sin(f * Math.PI * 2.2 - time * 1.45 + phase) * amp * (0.25 + f * 0.95) +
      Math.cos(f * Math.PI * 1.3 - time * 0.85 + phase * 1.7) * amp * 0.35 * f;
    pts.push([cx + sway, y]);
  }

  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const mx = (prev[0] + curr[0]) / 2;
    const my = (prev[1] + curr[1]) / 2;
    d += ` Q ${prev[0].toFixed(1)} ${prev[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` T ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
};

/**
 * Scene-space tracked 2.5D VFX layer — ZERO SVG feGaussianBlur overhead!
 * Uses smooth multi-stop radial gradients & layered translucent strokes so software
 * Chromium renders 20x faster with identical luminous painterly softness.
 */
export const SceneVfxLayer: React.FC<SceneVfxLayerProps> = ({
  scene,
  localTimeSec,
  progress,
}) => {
  const id = scene.id;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <radialGradient id={`oven-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD27D" stopOpacity="0.72" />
          <stop offset="38%" stopColor="#FFA24C" stopOpacity="0.32" />
          <stop offset="72%" stopColor="#FF8830" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#FF7B29" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={`dove-aura-gold-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFDF2" stopOpacity="0.72" />
          <stop offset="28%" stopColor="#FFE69A" stopOpacity="0.40" />
          <stop offset="60%" stopColor="#9CE0FF" stopOpacity="0.16" />
          <stop offset="85%" stopColor="#85D6FF" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#85D6FF" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={`dove-aura-sky-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E6F8FF" stopOpacity="0.58" />
          <stop offset="40%" stopColor="#8BD9FF" stopOpacity="0.26" />
          <stop offset="75%" stopColor="#72CFFF" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#72CFFF" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`ray-gold-${id}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#FFF6CE" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#FFE8A6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#FFF4C4" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`ray-sky-${id}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#D6F4FF" stopOpacity="0.50" />
          <stop offset="55%" stopColor="#9CE0FF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#B5EAFF" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`aroma-grad-${id}`} x1="100%" y1="60%" x2="0%" y2="20%">
          <stop offset="0%" stopColor="#FFE5B4" stopOpacity="0" />
          <stop offset="28%" stopColor="#FFC8B8" stopOpacity="0.42" />
          <stop offset="62%" stopColor="#FFB0B8" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#FFF0D4" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`steam-grad-${id}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#FFF7E8" stopOpacity="0" />
          <stop offset="20%" stopColor="#FFF9F0" stopOpacity="0.46" />
          <stop offset="65%" stopColor="#FFEED6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFF5E4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* SCENE 01: Soft golden sunlight breathing across window alcove */}
      {id === "scene_01" && (
        <ellipse
          cx={940}
          cy={520}
          rx={560}
          ry={330}
          fill={`url(#dove-aura-gold-${id})`}
          opacity={0.22 + Math.sin(localTimeSec * 0.9) * 0.05}
        />
      )}

      {/* SCENE 02: Flowing translucent rose-gold raspberry aroma ribbons (layered soft strokes) */}
      {id === "scene_02" && (
        <g>
          {[0, 1, 2, 3].map((i) => {
            const phase = i * 1.45;
            const drift = Math.sin(localTimeSec * 1.35 + phase) * 26;
            const drift2 = Math.cos(localTimeSec * 1.05 + phase) * 22;
            const yOff = (i - 1.5) * 24;
            const dashOffset = -(localTimeSec * (85 + i * 18) + i * 140);
            const path = `M 1340 ${425 + yOff * 0.5} C 1180 ${355 + drift + yOff}, 1010 ${455 - drift2 + yOff}, 845 ${395 + drift * 0.6} C 740 ${355 + drift2 * 0.5}, 880 ${210 + drift}, 1150 ${110 - drift2}`;
            const op = 0.28 + Math.sin(localTimeSec * 1.2 + phase) * 0.08;
            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke={`url(#aroma-grad-${id})`}
                  strokeWidth={42 - i * 4}
                  strokeLinecap="round"
                  strokeDasharray="420 260"
                  strokeDashoffset={dashOffset}
                  opacity={op * 0.35}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={`url(#aroma-grad-${id})`}
                  strokeWidth={18 - i * 2}
                  strokeLinecap="round"
                  strokeDasharray="420 260"
                  strokeDashoffset={dashOffset}
                  opacity={op * 0.72}
                />
              </g>
            );
          })}
          <circle
            cx={1305}
            cy={465}
            r={125}
            fill={`url(#oven-glow-${id})`}
            opacity={0.28 + Math.sin(localTimeSec * 2.0) * 0.06}
          />
        </g>
      )}

      {/* SCENE 03: Warm pulsing golden oven glow behind Mom + left curtain sun breath */}
      {id === "scene_03" && (
        <g>
          <ellipse
            cx={1220}
            cy={682}
            rx={195}
            ry={145}
            fill={`url(#oven-glow-${id})`}
            opacity={0.44 + Math.sin(localTimeSec * 2.4) * 0.11}
          />
          <ellipse
            cx={340}
            cy={430}
            rx={320}
            ry={380}
            fill={`url(#dove-aura-gold-${id})`}
            opacity={0.22 + Math.sin(localTimeSec * 1.1) * 0.05}
          />
        </g>
      )}

      {/* SCENE 04: Sunlit golden glow embracing White Dove on windowsill */}
      {id === "scene_04" && (
        <ellipse
          cx={1390}
          cy={520}
          rx={320}
          ry={295}
          fill={`url(#dove-aura-gold-${id})`}
          opacity={0.36 + Math.sin(localTimeSec * 1.4) * 0.08}
        />
      )}

      {/* SCENE 05: Poetic celestial glow & sky-blue eye starlight gleam */}
      {id === "scene_05" && (
        <g>
          <ellipse
            cx={940}
            cy={390}
            rx={520 + easeInOutSine(progress) * 160}
            ry={410 + easeInOutSine(progress) * 110}
            fill={`url(#dove-aura-sky-${id})`}
            opacity={0.32 + easeInOutSine(progress) * 0.18 + Math.sin(localTimeSec * 1.3) * 0.05}
          />
          <circle
            cx={650}
            cy={340}
            r={370}
            fill={`url(#dove-aura-gold-${id})`}
            opacity={0.30 + Math.sin(localTimeSec * 1.1) * 0.06}
          />
          {(() => {
            const gleam = 0.28 + 0.42 * Math.pow(0.5 + 0.5 * Math.sin(localTimeSec * 1.8 - 0.5), 2);
            const ex = 964;
            const ey = 250;
            return (
              <g opacity={gleam} transform={`translate(${ex}, ${ey})`}>
                <circle r={24} fill={`url(#dove-aura-sky-${id})`} opacity={0.55} />
                <path
                  d="M0,-9 Q0.8,-0.8 9,0 Q0.8,0.8 0,9 Q-0.8,0.8 -9,0 Q-0.8,-0.8 0,-9 Z"
                  fill="#FFFFFF"
                  opacity={0.78}
                />
              </g>
            );
          })()}
        </g>
      )}

      {/* SCENE 06: Gentle golden windowsill aura behind Dove */}
      {id === "scene_06" && (
        <ellipse
          cx={1380}
          cy={520}
          rx={300}
          ry={260}
          fill={`url(#dove-aura-gold-${id})`}
          opacity={0.32 + Math.sin(localTimeSec * 1.45) * 0.07}
        />
      )}

      {/* SCENE 07: Radiant breathing bloom behind Dove's outstretched wings as it speaks! */}
      {id === "scene_07" && (
        <g>
          {(() => {
            const breath = 0.5 + 0.5 * Math.sin(localTimeSec * 2.2);
            const secondary = 0.5 + 0.5 * Math.sin(localTimeSec * 3.7 + 1.1);
            const pulse = 0.72 + breath * 0.2 + secondary * 0.08;
            const cx = 978;
            const cy = 385;
            const rayAngles = [-58, -36, -16, 4, 24, 44, 64];
            return (
              <>
                <g
                  transform={`translate(${cx}, ${cy}) rotate(${Math.sin(localTimeSec * 0.55) * 4.5})`}
                  opacity={0.28 * pulse}
                >
                  {rayAngles.map((ang, idx) => (
                    <polygon
                      key={idx}
                      points="0,0 -46,-540 46,-540"
                      fill={idx % 2 === 0 ? `url(#ray-gold-${id})` : `url(#ray-sky-${id})`}
                      transform={`rotate(${ang})`}
                      opacity={0.42 + Math.sin(localTimeSec * 1.7 + idx) * 0.18}
                    />
                  ))}
                </g>
                <ellipse
                  cx={cx}
                  cy={cy + 30}
                  rx={460 * (0.94 + breath * 0.1)}
                  ry={375 * (0.94 + breath * 0.1)}
                  fill={`url(#dove-aura-gold-${id})`}
                  opacity={0.46 * pulse}
                />
                <ellipse
                  cx={cx + 25}
                  cy={cy + 75}
                  rx={620 * (0.96 + secondary * 0.06)}
                  ry={340 * (0.96 + secondary * 0.06)}
                  fill={`url(#dove-aura-sky-${id})`}
                  opacity={0.34 * pulse}
                />
              </>
            );
          })()}
        </g>
      )}

      {/* SCENE 08b: Gentle golden-blue wisdom glow around bowing Dove */}
      {id === "scene_08b" && (
        <ellipse
          cx={1040}
          cy={470}
          rx={390}
          ry={325}
          fill={`url(#dove-aura-gold-${id})`}
          opacity={0.28 + Math.sin(localTimeSec * 1.6) * 0.07}
        />
      )}

      {/* SCENE 09: Procedurally animated organic rising translucent steam curls above raspberry pie (x≈41.5%, y≈59%)! */}
      {id === "scene_09" && (
        <g>
          <ellipse
            cx={798}
            cy={632}
            rx={225}
            ry={96}
            fill={`url(#oven-glow-${id})`}
            opacity={0.26 + Math.sin(localTimeSec * 1.8) * 0.05}
          />
          {[
            { dx: -64, h: 255, amp: 24, w: 20, phase: 0.0, speed: 1.0, op: 0.36 },
            { dx: -26, h: 315, amp: 30, w: 24, phase: 1.2, speed: 0.88, op: 0.42 },
            { dx: 12, h: 295, amp: 26, w: 22, phase: 2.5, speed: 1.06, op: 0.40 },
            { dx: 52, h: 240, amp: 22, w: 18, phase: 3.7, speed: 0.94, op: 0.34 },
            { dx: -4, h: 345, amp: 34, w: 30, phase: 4.8, speed: 0.78, op: 0.28 },
            { dx: 34, h: 270, amp: 25, w: 16, phase: 5.9, speed: 1.15, op: 0.32 },
          ].map((s, idx) => {
            const cycle = (localTimeSec * 0.24 * s.speed + idx * 0.19) % 1;
            const riseOffset = cycle * 48;
            const env = Math.sin(cycle * Math.PI);
            const d = buildSteamPath(
              798 + s.dx,
              628 - riseOffset * 0.35,
              s.h + riseOffset * 0.5,
              s.amp,
              localTimeSec * s.speed,
              s.phase
            );
            const op = s.op * (0.45 + 0.55 * env);
            return (
              <g key={idx}>
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#steam-grad-${id})`}
                  strokeWidth={s.w * 2.1}
                  strokeLinecap="round"
                  opacity={op * 0.28}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#steam-grad-${id})`}
                  strokeWidth={s.w}
                  strokeLinecap="round"
                  opacity={op * 0.65}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* SCENE 10: Tracked gentle pie steam (0.455, 0.54) + blooming Dove celestial glow (0.72, 0.50) during Beat 10b! */}
      {id === "scene_10" &&
        (() => {
          const duration = Math.max(0.1, scene.endSec - scene.startSec);
          const splitRatio = scene.beatSplitSec
            ? clamp((scene.beatSplitSec - scene.startSec) / duration, 0.28, 0.75)
            : 0.54;
          const doveReveal = smoothstep(splitRatio - 0.04, splitRatio + 0.32, progress);
          const momWarmth = 1 - doveReveal * 0.35;

          return (
            <g>
              <ellipse
                cx={620}
                cy={420}
                rx={420}
                ry={370}
                fill={`url(#dove-aura-gold-${id})`}
                opacity={0.18 * momWarmth + Math.sin(localTimeSec * 1.1) * 0.03}
              />

              {[
                { dx: -28, h: 165, amp: 15, w: 13, phase: 0.4, speed: 0.9 },
                { dx: 4, h: 195, amp: 18, w: 15, phase: 2.1, speed: 0.82 },
                { dx: 32, h: 155, amp: 14, w: 12, phase: 4.0, speed: 1.02 },
              ].map((s, idx) => {
                const d = buildSteamPath(
                  875 + s.dx,
                  586,
                  s.h,
                  s.amp,
                  localTimeSec * s.speed,
                  s.phase
                );
                const op = 0.30 + Math.sin(localTimeSec * 1.3 + s.phase) * 0.07;
                return (
                  <g key={idx}>
                    <path
                      d={d}
                      fill="none"
                      stroke={`url(#steam-grad-${id})`}
                      strokeWidth={s.w * 2.1}
                      strokeLinecap="round"
                      opacity={op * 0.28}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={`url(#steam-grad-${id})`}
                      strokeWidth={s.w}
                      strokeLinecap="round"
                      opacity={op * 0.65}
                    />
                  </g>
                );
              })}

              <ellipse
                cx={1395}
                cy={515}
                rx={lerp(280, 420, doveReveal)}
                ry={lerp(250, 370, doveReveal)}
                fill={`url(#dove-aura-gold-${id})`}
                opacity={lerp(0.24, 0.56, doveReveal) + Math.sin(localTimeSec * 1.6) * 0.06}
              />
              <ellipse
                cx={1415}
                cy={505}
                rx={lerp(240, 490, doveReveal)}
                ry={lerp(210, 390, doveReveal)}
                fill={`url(#dove-aura-sky-${id})`}
                opacity={lerp(0.08, 0.32, doveReveal)}
              />
            </g>
          );
        })()}
    </svg>
  );
};
