import { SceneId, SceneTiming } from "../types";
import {
  CameraTransform,
  clamp,
  computeClampedCamera,
  easeInOutCubic,
  easeInOutQuint,
  easeInOutSine,
  easeOutCubic,
  lerp,
  smoothstep,
} from "./easing";

export type SunbeamSide = "left" | "right" | "none";
export type PaletteMood = "warm-gold" | "rose-warm" | "celestial" | "radiant" | "finale";

export interface SceneVisualProfile {
  sunbeamSide: SunbeamSide;
  sunbeamIntensity: number;
  mood: PaletteMood;
  particleDensity: number; // 0.5..1.5
  bokehIntensity: number; // 0..1
  warmthBoost: number; // 0..1
}

export const SCENE_VISUAL_PROFILES: Record<SceneId, SceneVisualProfile> = {
  scene_01: {
    sunbeamSide: "left",
    sunbeamIntensity: 0.9,
    mood: "warm-gold",
    particleDensity: 1.0,
    bokehIntensity: 0.35,
    warmthBoost: 0.35,
  },
  scene_02: {
    sunbeamSide: "left",
    sunbeamIntensity: 0.65,
    mood: "rose-warm",
    particleDensity: 0.9,
    bokehIntensity: 0.25,
    warmthBoost: 0.3,
  },
  scene_03: {
    sunbeamSide: "left",
    sunbeamIntensity: 0.75,
    mood: "warm-gold",
    particleDensity: 0.85,
    bokehIntensity: 0.3,
    warmthBoost: 0.4,
  },
  scene_04: {
    sunbeamSide: "right",
    sunbeamIntensity: 0.95,
    mood: "warm-gold",
    particleDensity: 1.15,
    bokehIntensity: 0.45,
    warmthBoost: 0.3,
  },
  scene_05: {
    sunbeamSide: "left",
    sunbeamIntensity: 0.75,
    mood: "celestial",
    particleDensity: 1.35,
    bokehIntensity: 0.95,
    warmthBoost: 0.1,
  },
  scene_06: {
    sunbeamSide: "right",
    sunbeamIntensity: 0.85,
    mood: "warm-gold",
    particleDensity: 1.0,
    bokehIntensity: 0.55,
    warmthBoost: 0.25,
  },
  scene_07: {
    sunbeamSide: "right",
    sunbeamIntensity: 1.0,
    mood: "radiant",
    particleDensity: 1.45,
    bokehIntensity: 0.85,
    warmthBoost: 0.2,
  },
  scene_08a: {
    sunbeamSide: "right",
    sunbeamIntensity: 0.75,
    mood: "warm-gold",
    particleDensity: 0.9,
    bokehIntensity: 0.35,
    warmthBoost: 0.25,
  },
  scene_08b: {
    sunbeamSide: "right",
    sunbeamIntensity: 0.85,
    mood: "celestial",
    particleDensity: 1.05,
    bokehIntensity: 0.5,
    warmthBoost: 0.2,
  },
  scene_09: {
    sunbeamSide: "right",
    sunbeamIntensity: 0.88,
    mood: "rose-warm",
    particleDensity: 1.0,
    bokehIntensity: 0.4,
    warmthBoost: 0.45,
  },
  scene_10: {
    sunbeamSide: "right",
    sunbeamIntensity: 0.95,
    mood: "finale",
    particleDensity: 1.3,
    bokehIntensity: 0.75,
    warmthBoost: 0.35,
  },
  scene_11_outro: {
    sunbeamSide: "none",
    sunbeamIntensity: 0,
    mood: "warm-gold",
    particleDensity: 0.8,
    bokehIntensity: 0.4,
    warmthBoost: 0.2,
  },
};

/**
 * Evaluates smooth eased 2.5D camera choreography for each scene.
 * `progress` is 0..1 across the scene duration; `localTimeSec` is seconds from scene start.
 */
export const evaluateSceneCamera = (
  scene: SceneTiming,
  progress: number,
  localTimeSec: number
): CameraTransform => {
  const p = clamp(progress, 0, 1);
  // Subtle organic cinema handheld breathing (never robotic!)
  const breathX = Math.sin(localTimeSec * 0.65) * 0.0035;
  const breathY = Math.cos(localTimeSec * 0.52) * 0.003;
  const breathRoll = Math.sin(localTimeSec * 0.42) * 0.14;

  switch (scene.id) {
    case "scene_01": {
      // Gentle dreamlike push-in across sunlit kitchen toward warm title alcove
      const e = easeInOutSine(p);
      const scale = lerp(1.03, 1.11, e);
      const fx = lerp(0.42, 0.54, e) + breathX;
      const fy = lerp(0.49, 0.48, e) + breathY;
      return computeClampedCamera(scale, fx, fy, breathRoll * 0.7);
    }

    case "scene_02": {
      // Energetic joyous follow-pan left-to-right + zoom-in following running boy
      const e = easeOutCubic(p);
      const scale = lerp(1.06, 1.14, e);
      const fx = lerp(0.32, 0.57, easeInOutCubic(p)) + breathX;
      const fy = lerp(0.54, 0.46, e) + Math.sin(localTimeSec * 3.2) * 0.0035;
      const roll = lerp(-0.35, 0.2, e) + breathRoll * 0.6;
      return computeClampedCamera(scale, fx, fy, roll);
    }

    case "scene_03": {
      // Warm gentle push-in toward Mom's welcoming smile, biased left to 100% crop dark far-right pantry doorway
      const e = easeInOutCubic(p);
      const scale = lerp(1.29, 1.36, e);
      const fx = lerp(0.38, 0.41, e) + breathX;
      const fy = lerp(0.50, 0.42, e) + breathY;
      return computeClampedCamera(scale, fx, fy, breathRoll * 0.4);
    }

    case "scene_04": {
      // Hushed horizontal drift left-to-right from boy toward sunlit windowsill & White Dove
      const e = easeInOutSine(p);
      const scale = lerp(1.1, 1.14, easeInOutCubic(p));
      const fx = lerp(0.35, 0.65, e) + breathX;
      const fy = lerp(0.51, 0.48, e) + breathY;
      return computeClampedCamera(scale, fx, fy, lerp(-0.2, 0.15, e));
    }

    case "scene_05": {
      // Intimate poetic push-in toward Dove's clear sky-blue eye (0.498, 0.238)
      const e = easeInOutQuint(p);
      const scale = lerp(1.04, 1.16, e);
      const fx = lerp(0.51, 0.498, e) + breathX * 0.6;
      const fy = lerp(0.45, 0.30, e) + breathY * 0.6;
      return computeClampedCamera(scale, fx, fy, breathRoll * 0.45);
    }

    case "scene_06": {
      // Subtle gentle rocking focus between boy (0.38) and dove (0.72)
      const e = easeInOutSine(p);
      const scale = lerp(1.04, 1.11, e);
      const rock = Math.sin(p * Math.PI * 1.45) * 0.055;
      const fx = 0.47 + rock + breathX;
      const fy = lerp(0.50, 0.46, e) + breathY;
      return computeClampedCamera(scale, fx, fy, breathRoll * 0.5);
    }

    case "scene_07": {
      // Radiant breathing bloom + gentle majestic upward lift as Dove speaks
      const e = easeInOutCubic(p);
      const speakPulse = Math.sin(localTimeSec * 1.8) * 0.008;
      const scale = lerp(1.03, 1.13, e) + speakPulse;
      const fx = lerp(0.50, 0.51, e) + breathX * 0.5;
      const fy = lerp(0.56, 0.41, e) + breathY * 0.5;
      return computeClampedCamera(scale, fx, fy, breathRoll * 0.4);
    }

    case "scene_08a": {
      // Expressive subtle punch-in (1.04->1.12) on boy's wide-eyed face + playful pulse synced to "Як пиріг?"
      const e = easeOutCubic(p);
      const duration = Math.max(0.1, scene.endSec - scene.startSec);
      const beatStart = scene.beatSplitSec
        ? clamp((scene.beatSplitSec - scene.startSec) / duration, 0.25, 0.8)
        : 0.58;
      const secondBeat = smoothstep(beatStart - 0.05, beatStart + 0.14, p) * (1 - smoothstep(0.9, 1.0, p) * 0.2);
      const scale = lerp(1.04, 1.11, e) + secondBeat * 0.028;
      const fx = 0.50 + breathX * 0.7;
      const fy = lerp(0.49, 0.45, e) + breathY * 0.7;
      const playfulTilt = Math.sin(p * Math.PI * 2) * 0.25;
      return computeClampedCamera(scale, fx, fy, playfulTilt);
    }

    case "scene_08b": {
      // Calm wise White Dove gently nodding its head ("А голуб стояв і лише головою кивав")
      const e = easeInOutSine(p);
      const scale = lerp(1.06, 1.11, e);
      // Gentle rhythmic nodding micro-motion (~2 soft deliberate bows)
      const nodWave = Math.sin(localTimeSec * 2.15);
      const nodDown = Math.pow(Math.max(0, nodWave), 1.6);
      const fx = lerp(0.53, 0.55, e) - nodDown * 0.006;
      const fy = lerp(0.50, 0.49, e) - nodDown * 0.015; // shifts image down slightly on bow
      const nodRoll = -nodDown * 0.85; // subtle gentle head-bow tilt
      return computeClampedCamera(scale, fx, fy, nodRoll);
    }

    case "scene_09": {
      // Warm golden pan from boy (right) across to Mom & steaming raspberry lattice pie (left-center x≈42%)
      const e = easeInOutCubic(p);
      const scale = lerp(1.05, 1.13, e);
      const fx = lerp(0.58, 0.42, e) + breathX;
      const fy = lerp(0.54, 0.48, e) + breathY;
      return computeClampedCamera(scale, fx, fy, breathRoll * 0.5);
    }

    case "scene_10": {
      // TWO-BEAT CINEMATIC CAMERA MOVE:
      // Beat 10a: Intimate medium close-up on Mom & Boy (left half: x~0.33, y~0.39)
      // Beat 10b: Silky poetic pull-back & pan right uniting Mom + Boy + Pie + Luminous White Dove!
      const duration = Math.max(0.1, scene.endSec - scene.startSec);
      const splitRatio = scene.beatSplitSec
        ? clamp((scene.beatSplitSec - scene.startSec) / duration, 0.28, 0.75)
        : 0.54;

      if (p < splitRatio) {
        // Beat 10a: Tender intimate close-up on Mom & smiling Boy (Dove cleanly off-screen right for dramatic Beat 10b reveal!)
        const tA = easeInOutSine(p / splitRatio);
        const scale = lerp(1.66, 1.58, tA);
        const fx = lerp(0.28, 0.31, tA) + breathX * 0.5;
        const fy = lerp(0.35, 0.37, tA) + breathY * 0.5;
        return computeClampedCamera(scale, fx, fy, breathRoll * 0.4);
      } else {
        // Beat 10b: Sweeping emotional pull-back revealing raspberry pie & glowing White Dove on windowsill
        const tB = easeInOutQuint((p - splitRatio) / Math.max(0.05, 1 - splitRatio));
        const scale = lerp(1.58, 1.03, tB);
        const fx = lerp(0.31, 0.50, tB) + breathX * 0.5;
        const fy = lerp(0.37, 0.50, tB) + breathY * 0.5;
        return computeClampedCamera(scale, fx, fy, breathRoll * (1 - tB * 0.6) * 0.4);
      }
    }

    case "scene_11_outro":
    default:
      return computeClampedCamera(1.02, 0.5, 0.5, 0);
  }
};
