import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp, easeInOutCubic, easeOutCubic, easeOutQuart, lerp } from "../utils/easing";

interface ClosingCardProps {
  localTimeSec: number;
  durationSec: number;
  opacity: number;
}

/**
 * Poetic cream-and-gold storybook closing card ("Книга Ведмедів • Казка «Пирожок»")
 * dissolving smoothly from warm golden light into velvety warm parchment-dusk and finally warm black.
 */
export const ClosingCard: React.FC<ClosingCardProps> = ({
  localTimeSec,
  durationSec,
  opacity,
}) => {
  if (opacity <= 0.002) {
    return null;
  }

  // Gentle entrance of text after initial golden light bloom
  const textIn = easeOutQuart(clamp((localTimeSec - 0.35) / 1.25, 0, 1));
  const dividerIn = easeInOutCubic(clamp((localTimeSec - 0.5) / 1.1, 0, 1));
  const subtitleIn = easeOutCubic(clamp((localTimeSec - 0.65) / 1.2, 0, 1));

  // Final fade to warm black over the last 1.35s
  const fadeOutDur = Math.min(1.45, durationSec * 0.32);
  const fadeOutStart = Math.max(durationSec - fadeOutDur, 1.5);
  const fadeOut = easeInOutCubic(clamp((localTimeSec - fadeOutStart) / fadeOutDur, 0, 1));

  // Initial golden light bloom easing down gently
  const introBloom = 1 - easeOutCubic(clamp(localTimeSec / 1.2, 0, 1));

  const yOffset = lerp(18, 0, textIn);
  const contentOpacity = 1 - fadeOut;

  return (
    <AbsoluteFill
      style={{
        opacity: clamp(opacity, 0, 1),
        overflow: "hidden",
        background: "#120B06",
      }}
    >
      {/* Velvety warm cream-to-champagne-gold parchment background */}
      <AbsoluteFill
        style={{
          opacity: contentOpacity,
          background:
            "radial-gradient(ellipse at 50% 44%, #FBF3E2 0%, #F2E1C2 42%, #DEC39A 78%, #C4A173 100%)",
        }}
      />

      {/* Soft warm inner vignette framing the storybook page */}
      <AbsoluteFill
        style={{
          opacity: contentOpacity,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255, 250, 238, 0.25) 0%, rgba(120, 78, 36, 0.08) 60%, rgba(58, 32, 12, 0.42) 100%)",
        }}
      />

      {/* Delicate ornamental double frame hairline */}
      <div
        style={{
          position: "absolute",
          inset: 58,
          border: "1px solid rgba(158, 114, 58, 0.26)",
          pointerEvents: "none",
          opacity: dividerIn * contentOpacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 68,
          border: "1px solid rgba(158, 114, 58, 0.14)",
          pointerEvents: "none",
          opacity: dividerIn * contentOpacity,
        }}
      />

      {/* Poetic Closing Typography */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: contentOpacity,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            transform: `translateY(${yOffset.toFixed(2)}px)`,
          }}
        >
          {/* Top tiny golden star ornament */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            style={{
              marginBottom: 24,
              opacity: dividerIn * 0.85,
              transform: `scale(${lerp(0.6, 1, dividerIn).toFixed(3)})`,
            }}
          >
            <path
              d="M14 1 L16.8 11.2 L27 14 L16.8 16.8 L14 27 L11.2 16.8 L1 14 L11.2 11.2 Z"
              fill="#B9873E"
            />
          </svg>

          {/* Series Title: Книга Ведмедів */}
          <div
            style={{
              fontFamily: "'Montserrat', 'DejaVu Sans', sans-serif",
              fontWeight: 500,
              fontSize: 25,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#7A5226",
              opacity: textIn,
              marginBottom: 22,
            }}
          >
            Книга Ведмедів
          </div>

          {/* Ornamental golden divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 24,
              opacity: dividerIn,
            }}
          >
            <div
              style={{
                width: lerp(0, 140, dividerIn),
                height: 1.5,
                background:
                  "linear-gradient(90deg, rgba(185,135,62,0) 0%, rgba(185,135,62,0.85) 100%)",
              }}
            />
            <div
              style={{
                width: 7,
                height: 7,
                transform: "rotate(45deg)",
                background: "#C49144",
              }}
            />
            <div
              style={{
                width: lerp(0, 140, dividerIn),
                height: 1.5,
                background:
                  "linear-gradient(270deg, rgba(185,135,62,0) 0%, rgba(185,135,62,0.85) 100%)",
              }}
            />
          </div>

          {/* Main Poetic Closing Line: Казка «Пирожок» */}
          <div
            style={{
              fontFamily: "'Cormorant Garamond', 'DejaVu Serif', Georgia, serif",
              fontWeight: 600,
              fontStyle: "italic",
              fontSize: 94,
              lineHeight: 1.12,
              letterSpacing: "0.03em",
              color: "#4B2E14",
              textShadow: "0 2px 18px rgba(255, 248, 232, 0.75)",
              opacity: subtitleIn,
              transform: `translateY(${lerp(12, 0, subtitleIn).toFixed(2)}px)`,
            }}
          >
            Казка «Пирожок»
          </div>
        </div>
      </AbsoluteFill>

      {/* Initial warm golden light bloom transition dissolving smoothly from Scene 10 */}
      {introBloom > 0.01 && (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(255, 246, 214, 0.85) 0%, rgba(255, 230, 175, 0.45) 60%, rgba(255, 224, 160, 0.15) 100%)",
            opacity: introBloom * 0.78,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
