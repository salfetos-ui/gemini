import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AtmosphereCanvas } from "./components/AtmosphereCanvas";
import { ClosingCard } from "./components/ClosingCard";
import { FilmGrainOverlay } from "./components/FilmGrainOverlay";
import { SceneLayer } from "./components/SceneLayer";
import { TitleCard } from "./components/TitleCard";
import { FilmTimeline, SceneTiming } from "./types";
import { clamp, easeInOutCubic, easeInOutSine, lerp, smoothstep } from "./utils/easing";
import { PaletteMood, SCENE_VISUAL_PROFILES } from "./utils/sceneChoreography";

export interface KazkaPyrozhokProps {
  timeline: FilmTimeline;
  /** Set false when muxing audio separately via FFmpeg for maximum AAC 320kbps fidelity */
  includeAudioInRemotion?: boolean;
}

const isCelestialMood = (mood: PaletteMood): number => {
  if (mood === "celestial") return 0.92;
  if (mood === "radiant") return 0.85;
  if (mood === "finale") return 0.35;
  return 0;
};

/**
 * Ensures local Cyrillic fonts (`Cormorant Garamond` & `Montserrat`) are loaded into
 * Chromium before any frame is captured — zero network dependency, zero fallback tofu boxes!
 */
const useLocalStorybookFonts = () => {
  const [handle] = useState(() => delayRender("Loading local Cyrillic storybook fonts"));

  useEffect(() => {
    const linkId = "kazka-local-fonts-css";
    let link = document.getElementById(linkId) as HTMLLinkElement | null;

    const finish = () => {
      const loads = [
        document.fonts.load("italic 600 120px 'Cormorant Garamond'", "ПирожокКазка"),
        document.fonts.load("500 24px 'Montserrat'", "КНИГА ВЕДМЕДІВ КАЗКА 1"),
      ];
      Promise.allSettled(loads)
        .then(() => document.fonts.ready)
        .finally(() => continueRender(handle));
    };

    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = staticFile("fonts.css");
      link.onload = finish;
      link.onerror = () => continueRender(handle);
      document.head.appendChild(link);
    } else {
      finish();
    }
  }, [handle]);
};

export const KazkaPyrozhok: React.FC<KazkaPyrozhokProps> = ({
  timeline,
  includeAudioInRemotion = true,
}) => {
  useLocalStorybookFonts();

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const scenes = timeline.scenes;

  // Compute each scene's visible opacity with overlapping golden cross-dissolves.
  // Scene i starts fading IN at `scene[i].startSec - transitionSec * 0.5` and finishes
  // fading IN at `scene[i].startSec + transitionSec * 0.5`.
  // Scene i stays at 1.0 beneath scene i+1 while scene i+1 cross-fades on top, then turns off.
  interface ActiveSceneState {
    scene: SceneTiming;
    index: number;
    opacity: number;
    transitionGlow: number;
    weight: number;
  }

  const activeScenes: ActiveSceneState[] = [];
  let dominantIndex = 0;

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const next = scenes[i + 1];
    const transIn = i === 0 ? 0 : Math.max(0.35, sc.transitionSec || 0.75);
    const transOut = next ? Math.max(0.35, next.transitionSec || 0.75) : 0;

    const inStart = i === 0 ? 0 : sc.startSec - transIn * 0.5;
    const inEnd = i === 0 ? 0 : sc.startSec + transIn * 0.5;
    const outEnd = next ? next.startSec + transOut * 0.5 : sc.endSec + 0.5;

    if (t < inStart - 0.05 || t > outEnd + 0.05) {
      continue;
    }

    const fadeIn = i === 0 ? 1 : easeInOutSine(clamp((t - inStart) / Math.max(0.01, inEnd - inStart), 0, 1));

    // Peak golden glow right around the cross-dissolve midpoint
    const inGlow = i === 0 ? 0 : Math.sin(fadeIn * Math.PI);

    // Compute blending weight for atmospheric transitions (sunbeams, particle palette)
    let outWeight = 1;
    if (next) {
      const nextInStart = next.startSec - transOut * 0.5;
      const nextInEnd = next.startSec + transOut * 0.5;
      if (t > nextInStart) {
        outWeight = 1 - easeInOutSine(clamp((t - nextInStart) / Math.max(0.01, nextInEnd - nextInStart), 0, 1));
      }
    }

    const weight = fadeIn * outWeight;
    if (weight >= 0.5) {
      dominantIndex = i;
    }

    activeScenes.push({
      scene: sc,
      index: i,
      opacity: fadeIn,
      transitionGlow: inGlow,
      weight,
    });
  }

  // Blend atmospheric parameters smoothly across active scenes
  let totalW = 0;
  let sunbeamIntensity = 0;
  let particleDensity = 0;
  let bokehIntensity = 0;
  let warmthBoost = 0;
  let celestialBlend = 0;

  for (const item of activeScenes) {
    const prof = SCENE_VISUAL_PROFILES[item.scene.id];
    const w = Math.max(0.0001, item.weight);
    totalW += w;
    sunbeamIntensity += prof.sunbeamIntensity * w;
    particleDensity += prof.particleDensity * w;
    bokehIntensity += prof.bokehIntensity * w;
    warmthBoost += prof.warmthBoost * w;

    // Special Beat 10b celestial lift during Scene 10 reveal of the White Dove!
    let sceneCelestial = isCelestialMood(prof.mood);
    if (item.scene.id === "scene_10") {
      const dur = Math.max(0.1, item.scene.endSec - item.scene.startSec);
      const prog = clamp((t - item.scene.startSec) / dur, 0, 1);
      const split = item.scene.beatSplitSec
        ? clamp((item.scene.beatSplitSec - item.scene.startSec) / dur, 0.28, 0.75)
        : 0.54;
      const beatB = smoothstep(split - 0.04, split + 0.35, prog);
      sceneCelestial = lerp(0.05, 0.72, beatB);
    }
    celestialBlend += sceneCelestial * w;
  }

  if (totalW > 0) {
    sunbeamIntensity /= totalW;
    particleDensity /= totalW;
    bokehIntensity /= totalW;
    warmthBoost /= totalW;
    celestialBlend /= totalW;
  }

  const dominantScene = scenes[dominantIndex] || scenes[0];
  const dominantProfile = SCENE_VISUAL_PROFILES[dominantScene.id];

  // Gentle opening fade-in from warm espresso black (0.0s -> 0.75s)
  const openingFadeIn = easeInOutCubic(clamp(t / 0.75, 0, 1));

  // Fade atmospheric particles softly out during final 1.2s of closing card
  const outroFadeOut =
    1 -
    easeInOutCubic(
      clamp((t - (timeline.totalDurationSec - 1.35)) / 1.25, 0, 1)
    );

  // Check if Scene 01 is active for Opening Title Card
  const scene01 = scenes.find((s) => s.id === "scene_01");

  return (
    <AbsoluteFill style={{ backgroundColor: "#120B06", overflow: "hidden" }}>
      {/* Master Audio Track (when present & enabled) */}
      {includeAudioInRemotion && timeline.hasAudio && timeline.audioFile && (
        <Audio src={staticFile(`audio/${timeline.audioFile}`)} />
      )}

      {/* Scene Layers rendered in chronological order so newer scenes cross-dissolve seamlessly on top */}
      {activeScenes.map(({ scene, opacity, transitionGlow }) => {
        if (scene.id === "scene_11_outro") {
          return (
            <ClosingCard
              key={scene.id}
              localTimeSec={Math.max(0, t - scene.startSec)}
              durationSec={Math.max(1, scene.endSec - scene.startSec)}
              opacity={opacity}
            />
          );
        }
        return (
          <SceneLayer
            key={scene.id}
            scene={scene}
            currentTimeSec={t}
            opacity={opacity}
            transitionGlow={transitionGlow}
          />
        );
      })}

      {/* Living 2.5D Atmospheric Layer: Volumetric God-Rays + Multi-Depth Golden/Sky-Blue Particles + Vignette */}
      <AtmosphereCanvas
        sunbeamSide={dominantProfile.sunbeamSide}
        sunbeamIntensity={sunbeamIntensity}
        mood={dominantProfile.mood}
        particleDensity={particleDensity}
        bokehIntensity={bokehIntensity}
        warmthBoost={warmthBoost}
        celestialBlend={celestialBlend}
        globalOpacity={openingFadeIn * outroFadeOut}
      />

      {/* Opening Title Card synced to Scene 01 ("Казка Пирожок") — NO dialogue subtitles! */}
      {scene01 && t <= scene01.endSec + 0.6 && (
        <TitleCard
          localTimeSec={t - scene01.startSec}
          durationSec={Math.max(2, scene01.endSec - scene01.startSec)}
        />
      )}

      {/* Subtle 35mm Warm Painterly Film Grain Texture */}
      <FilmGrainOverlay opacity={0.042 * outroFadeOut} />

      {/* Warm espresso-black opening curtain dissolve */}
      {openingFadeIn < 0.998 && (
        <AbsoluteFill
          style={{
            backgroundColor: "#120B06",
            opacity: 1 - openingFadeIn,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
