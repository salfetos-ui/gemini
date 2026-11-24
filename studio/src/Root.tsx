import React, { useEffect, useState } from "react";
import { AbsoluteFill, Composition, continueRender, delayRender, staticFile } from "remotion";
import { KazkaPyrozhok, KazkaPyrozhokProps } from "./KazkaPyrozhok";
import rawTimeline from "./data/timeline.generated.json";
import { FilmTimeline } from "./types";

const timeline = rawTimeline as FilmTimeline;
const fps = timeline.fps || 30;
const durationInFrames = Math.max(30, Math.round(timeline.totalDurationSec * fps));

const useFontsReady = () => {
  const [handle] = useState(() => delayRender("Loading local Cyrillic fonts for plate"));
  useEffect(() => {
    const linkId = "kazka-plate-fonts-css";
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    const done = () => {
      Promise.allSettled([
        document.fonts.load("italic 600 140px 'Cormorant Garamond'", "ПирожокКазка"),
        document.fonts.load("500 24px 'Montserrat'", "КНИГА ВЕДМЕДІВ КАЗКА 1"),
      ])
        .then(() => document.fonts.ready)
        .finally(() => continueRender(handle));
    };
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = staticFile("fonts.css");
      link.onload = done;
      link.onerror = () => continueRender(handle);
      document.head.appendChild(link);
    } else {
      done();
    }
  }, [handle]);
};

/**
 * Transparent 1920x1080 Ukrainian Cyrillic Opening Title Plate rendered by Chromium HarfBuzz
 * for pixel-perfect hybrid Skia compositing.
 */
const TitleOverlayPlate: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          transform: "translate3d(42px, -24px, 0)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Montserrat', 'DejaVu Sans', sans-serif",
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "#FCE8B8",
            textShadow:
              "0 2px 14px rgba(42, 22, 8, 0.78), 0 0 28px rgba(255, 222, 148, 0.38)",
            marginBottom: 18,
          }}
        >
          КНИГА ВЕДМЕДІВ &nbsp;•&nbsp; КАЗКА 1
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 14,
            opacity: 0.94,
          }}
        >
          <div
            style={{
              width: 150,
              height: 1.5,
              background:
                "linear-gradient(90deg, rgba(255,228,162,0) 0%, rgba(255,228,162,0.94) 100%)",
              boxShadow: "0 0 10px rgba(255, 224, 150, 0.55)",
            }}
          />
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M8 0 L10 6 L16 8 L10 10 L8 16 L6 10 L0 8 L6 6 Z"
              fill="#FFE9AE"
              opacity={0.96}
            />
          </svg>
          <div
            style={{
              width: 150,
              height: 1.5,
              background:
                "linear-gradient(270deg, rgba(255,228,162,0) 0%, rgba(255,228,162,0.94) 100%)",
              boxShadow: "0 0 10px rgba(255, 224, 150, 0.55)",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            fontFamily: "'Cormorant Garamond', 'DejaVu Serif', Georgia, serif",
            fontWeight: 600,
            fontStyle: "italic",
            fontSize: 152,
            lineHeight: 1.05,
            letterSpacing: "4px",
            padding: "0 32px",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              padding: "0 32px",
              color: "transparent",
              textShadow:
                "0 8px 26px rgba(38, 19, 6, 0.72), 0 2px 6px rgba(56, 28, 10, 0.58), 0 0 42px rgba(255, 214, 130, 0.45)",
            }}
          >
            Пирожок
          </span>
          <span
            style={{
              position: "relative",
              backgroundImage:
                "linear-gradient(112deg, #FFF7DF 0%, #FCE19B 38%, #FFFDF4 56%, #F4C874 74%, #FFF3CE 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              display: "inline-block",
            }}
          >
            Пирожок
          </span>
        </div>

        <div
          style={{
            marginTop: 18,
            width: 220,
            height: 1,
            background:
              "linear-gradient(90deg, rgba(255,228,162,0) 0%, rgba(255,232,175,0.78) 50%, rgba(255,228,162,0) 100%)",
            opacity: 0.88,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Transparent 1920x1080 Ukrainian Cyrillic Closing Card Typography Plate.
 */
const ClosingOverlayPlate: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" style={{ marginBottom: 24, opacity: 0.88 }}>
          <path
            d="M14 1 L16.8 11.2 L27 14 L16.8 16.8 L14 27 L11.2 16.8 L1 14 L11.2 11.2 Z"
            fill="#B9873E"
          />
        </svg>

        <div
          style={{
            fontFamily: "'Montserrat', 'DejaVu Sans', sans-serif",
            fontWeight: 500,
            fontSize: 25,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#7A5226",
            marginBottom: 22,
          }}
        >
          Книга Ведмедів
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
          <div
            style={{
              width: 140,
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
              width: 140,
              height: 1.5,
              background:
                "linear-gradient(270deg, rgba(185,135,62,0) 0%, rgba(185,135,62,0.85) 100%)",
            }}
          />
        </div>

        <div
          style={{
            fontFamily: "'Cormorant Garamond', 'DejaVu Serif', Georgia, serif",
            fontWeight: 600,
            fontStyle: "italic",
            fontSize: 94,
            lineHeight: 1.12,
            letterSpacing: "0.03em",
            color: "#4B2E14",
            textShadow: "0 2px 18px rgba(255, 248, 232, 0.78)",
          }}
        >
          Казка «Пирожок»
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KazkaPyrozhok"
        component={KazkaPyrozhok as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={durationInFrames}
        fps={fps}
        width={timeline.width || 1920}
        height={timeline.height || 1080}
        defaultProps={
          {
            timeline,
            includeAudioInRemotion: true,
          } satisfies KazkaPyrozhokProps
        }
      />
      <Composition
        id="TitleOverlayPlate"
        component={TitleOverlayPlate}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ClosingOverlayPlate"
        component={ClosingOverlayPlate}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
