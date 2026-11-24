import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp, easeInOutCubic, easeOutCubic, easeOutQuart, lerp } from "../utils/easing";

interface TitleCardProps {
  /** Time in seconds from start of Scene 01 */
  localTimeSec: number;
  /** Total duration of Scene 01 in seconds */
  durationSec: number;
}

/**
 * Storybook opening title card synced to Narrator's "Казка Пирожок":
 * - Eyebrow: КНИГА ВЕДМЕДІВ • КАЗКА 1
 * - Poetic golden calligraphy title: Пирожок
 * - Animated golden light sweep + delicate filigree divider + soft warm atmospheric halo
 */
export const TitleCard: React.FC<TitleCardProps> = ({ localTimeSec, durationSec }) => {
  // Smooth choreography adapted to scene_01 duration (typically 4.5s - 7.5s)
  const enterStart = 0.25;
  const enterDur = Math.min(1.35, durationSec * 0.28);
  const exitDur = Math.min(1.0, durationSec * 0.22);
  const exitStart = Math.max(enterStart + enterDur + 0.4, durationSec - exitDur - 0.15);

  const inProgress = clamp((localTimeSec - enterStart) / enterDur, 0, 1);
  const outProgress = clamp((localTimeSec - exitStart) / exitDur, 0, 1);

  const inEase = easeOutQuart(inProgress);
  const outEase = easeInOutCubic(outProgress);
  const masterOpacity = inEase * (1 - outEase);

  if (masterOpacity <= 0.002) {
    return null;
  }

  // Staggered typography reveal
  const eyebrowIn = easeOutCubic(clamp((localTimeSec - (enterStart + 0.05)) / 0.95, 0, 1));
  const titleIn = easeOutQuart(clamp((localTimeSec - (enterStart + 0.22)) / 1.15, 0, 1));
  const dividerIn = easeInOutCubic(clamp((localTimeSec - (enterStart + 0.14)) / 1.0, 0, 1));

  // Subtle floating lift on entrance and gentle dissolve rise on exit
  const yShift = lerp(22, 0, titleIn) - lerp(0, 14, outEase);
  const letterSpacingPx = lerp(14, 4, titleIn);

  // Animated golden light sweep passing across "Пирожок"
  const sweepPhase = clamp((localTimeSec - (enterStart + 0.7)) / 2.2, 0, 1);
  const sweepPosPct = lerp(-40, 145, easeInOutCubic(sweepPhase));

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "center",
        alignItems: "center",
        opacity: masterOpacity,
      }}
    >
      {/* Soft warm atmospheric scrim behind title in sunlit kitchen center for effortless legibility */}
      <div
        style={{
          position: "absolute",
          left: "52%",
          top: "49%",
          transform: "translate(-50%, -50%)",
          width: 1120,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(46, 26, 12, 0.34) 0%, rgba(56, 33, 16, 0.16) 44%, rgba(56, 33, 16, 0) 76%)",
        }}
      />

      {/* Centered Storybook Title Lockup (poised in the sunlit open kitchen alcove) */}
      <div
        style={{
          position: "relative",
          transform: `translate3d(42px, ${(yShift - 24).toFixed(2)}px, 0)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Eyebrow: КНИГА ВЕДМЕДІВ • КАЗКА 1 */}
        <div
          style={{
            fontFamily: "'Montserrat', 'DejaVu Sans', sans-serif",
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "#FCE8B8",
            textShadow:
              "0 2px 14px rgba(42, 22, 8, 0.72), 0 0 28px rgba(255, 222, 148, 0.35)",
            opacity: eyebrowIn,
            transform: `translateY(${lerp(12, 0, eyebrowIn).toFixed(2)}px)`,
            marginBottom: 18,
          }}
        >
          КНИГА ВЕДМЕДІВ &nbsp;•&nbsp; КАЗКА 1
        </div>

        {/* Ornamental golden hairline divider with diamond star */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 14,
            opacity: dividerIn * 0.92,
          }}
        >
          <div
            style={{
              width: lerp(0, 150, dividerIn),
              height: 1.5,
              background:
                "linear-gradient(90deg, rgba(255,228,162,0) 0%, rgba(255,228,162,0.92) 100%)",
              boxShadow: "0 0 10px rgba(255, 224, 150, 0.55)",
            }}
          />
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M8 0 L10 6 L16 8 L10 10 L8 16 L6 10 L0 8 L6 6 Z"
              fill="#FFE9AE"
              opacity={0.95}
            />
          </svg>
          <div
            style={{
              width: lerp(0, 150, dividerIn),
              height: 1.5,
              background:
                "linear-gradient(270deg, rgba(255,228,162,0) 0%, rgba(255,228,162,0.92) 100%)",
              boxShadow: "0 0 10px rgba(255, 224, 150, 0.55)",
            }}
          />
        </div>

        {/* Main Golden Serif Calligraphy Title: Пирожок */}
        <div
          style={{
            position: "relative",
            fontFamily: "'Cormorant Garamond', 'DejaVu Serif', Georgia, serif",
            fontWeight: 600,
            fontStyle: "italic",
            fontSize: 152,
            lineHeight: 1.05,
            letterSpacing: `${letterSpacingPx.toFixed(2)}px`,
            padding: "0 28px",
            opacity: titleIn,
          }}
        >
          {/* Warm mahogany drop-shadow base layer */}
          <span
            style={{
              position: "absolute",
              inset: 0,
              padding: "0 28px",
              color: "transparent",
              textShadow:
                "0 8px 26px rgba(38, 19, 6, 0.68), 0 2px 6px rgba(56, 28, 10, 0.55), 0 0 42px rgba(255, 214, 130, 0.42)",
              userSelect: "none",
            }}
            aria-hidden
          >
            Пирожок
          </span>

          {/* Metallic warm ivory-gold gradient ink with animated sunlit sheen sweep */}
          <span
            style={{
              position: "relative",
              backgroundImage: `linear-gradient(112deg, #FFF7DF 0%, #FCE19B 34%, #FFFFFF ${sweepPosPct.toFixed(1)}%, #F4C874 68%, #FFF3CE 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              display: "inline-block",
            }}
          >
            Пирожок
          </span>
        </div>

        {/* Bottom delicate golden flourish */}
        <div
          style={{
            marginTop: 18,
            width: lerp(0, 220, dividerIn),
            height: 1,
            background:
              "linear-gradient(90deg, rgba(255,228,162,0) 0%, rgba(255,232,175,0.75) 50%, rgba(255,228,162,0) 100%)",
            opacity: dividerIn * 0.85,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
