import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { SceneTiming } from "../types";
import { clamp, easeInOutCubic, lerp } from "../utils/easing";
import { evaluateSceneCamera } from "../utils/sceneChoreography";
import { SceneVfxLayer } from "./SceneVfxLayer";

interface SceneLayerProps {
  scene: SceneTiming;
  currentTimeSec: number;
  opacity: number;
  /** 0..1 peak golden cross-dissolve warmth when entering/leaving */
  transitionGlow?: number;
}

/**
 * Renders one illustrated storybook scene with:
 * - Smooth eased 2.5D camera choreography (scale, clamped pan, subtle breathing roll)
 * - Scene-space tracked VFX (steam, aroma ribbons, oven glow, celestial dove aura)
 * - Subtle color-grade harmony & soft golden light bloom during page-turn dissolves
 */
export const SceneLayer: React.FC<SceneLayerProps> = ({
  scene,
  currentTimeSec,
  opacity,
  transitionGlow = 0,
}) => {
  if (!scene.imageFile || opacity <= 0.002) {
    return null;
  }

  const duration = Math.max(0.1, scene.endSec - scene.startSec);
  const localTimeSec = clamp(currentTimeSec - scene.startSec, -1, duration + 2);
  const progress = clamp((currentTimeSec - scene.startSec) / duration, 0, 1);

  const cam = evaluateSceneCamera(scene, progress, Math.max(0, localTimeSec));

  // Subtle golden cross-dissolve bloom intensity
  const glowAmt = clamp(transitionGlow, 0, 1);

  // Delicate subtle scale entrance lift on cross-dissolve
  const entryScale = lerp(1.015, 1.0, easeInOutCubic(opacity));
  const finalScale = cam.scale * entryScale;

  return (
    <AbsoluteFill
      style={{
        opacity: clamp(opacity, 0, 1),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transformOrigin: "center center",
          transform: `translate3d(${cam.txPct.toFixed(3)}%, ${cam.tyPct.toFixed(3)}%, 0) scale(${finalScale.toFixed(5)}) rotate(${cam.rotateDeg.toFixed(3)}deg)`,
        }}
      >
        <Img
          src={staticFile(`scenes/${scene.imageFile}`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <SceneVfxLayer scene={scene} localTimeSec={Math.max(0, localTimeSec)} progress={progress} />
      </div>

      {/* Subtle golden-light dissolve sheen */}
      {glowAmt > 0.02 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(255, 240, 198, 0.32) 0%, rgba(255, 220, 150, 0.14) 55%, rgba(255, 210, 130, 0) 100%)",
            mixBlendMode: "screen",
            opacity: glowAmt * 0.65,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
