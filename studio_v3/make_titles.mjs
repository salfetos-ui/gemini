import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require('/home/antigravity/salfetos-ui/gemini/studio/node_modules/@napi-rs/canvas');

const FONTS_DIR = '/home/antigravity/salfetos-ui/gemini/studio/public/fonts';
const CACHE_DIR = '/home/antigravity/salfetos-ui/gemini/studio_v3/cache';
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Register Cyrillic + Latin subsets for Cormorant Garamond (600 & 700) and Montserrat (500 & 600)
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'CormorantGaramond_27.woff2'), 'CormorantBoldCyr');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'CormorantGaramond_30.woff2'), 'CormorantBoldLat');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'CormorantGaramond_22.woff2'), 'CormorantSemiCyr');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'CormorantGaramond_25.woff2'), 'CormorantSemiLat');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Montserrat_37.woff2'), 'MontserratMedCyr');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Montserrat_40.woff2'), 'MontserratMedLat');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Montserrat_42.woff2'), 'MontserratSemiCyr');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Montserrat_45.woff2'), 'MontserratSemiLat');

function drawTrackedText(ctx, text, cx, y, letterSpacing) {
  const chars = [...text];
  let totalW = 0;
  const widths = chars.map((ch) => {
    const w = ctx.measureText(ch).width;
    totalW += w;
    return w;
  });
  totalW += letterSpacing * Math.max(0, chars.length - 1);
  let x = cx - totalW / 2;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i] + letterSpacing;
  }
}

function drawOrnamentLine(ctx, cx, y, halfLen, color) {
  ctx.save();
  const grad = ctx.createLinearGradient(cx - halfLen, y, cx + halfLen, y);
  grad.addColorStop(0.0, 'rgba(184, 134, 65, 0.0)');
  grad.addColorStop(0.25, color);
  grad.addColorStop(0.5, color);
  grad.addColorStop(0.75, color);
  grad.addColorStop(1.0, 'rgba(184, 134, 65, 0.0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.0;

  ctx.beginPath();
  ctx.moveTo(cx - halfLen, y);
  ctx.lineTo(cx - 16, y);
  ctx.moveTo(cx + 16, y);
  ctx.lineTo(cx + halfLen, y);
  ctx.stroke();

  // Center diamond flourish
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, y - 6.5);
  ctx.lineTo(cx + 6.5, y);
  ctx.lineTo(cx, y + 6.5);
  ctx.lineTo(cx - 6.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 1. OPENING TITLE OVERLAY (transparent RGBA 1920x1080)
{
  const W = 1920, H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const cx = W * 0.50;
  const cy = H * 0.43;

  // Soft sunlit warm cream radial halo behind title (100% seamlessly feathered, zero rim)
  ctx.save();
  ctx.translate(cx, cy + 16);
  ctx.scale(1.0, 0.50);
  const halo = ctx.createRadialGradient(0, 0, 40, 0, 0, 560);
  halo.addColorStop(0.0, 'rgba(255, 248, 232, 0.86)');
  halo.addColorStop(0.45, 'rgba(255, 245, 224, 0.58)');
  halo.addColorStop(0.76, 'rgba(255, 240, 212, 0.16)');
  halo.addColorStop(1.0, 'rgba(255, 240, 212, 0.0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 560, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Top ornamental rule
  drawOrnamentLine(ctx, cx, cy - 92, 230, 'rgba(176, 126, 56, 0.88)');

  // Eyebrow: КНИГА ВЕДМЕДІВ · КАЗКА 1
  ctx.font = '600 25px "MontserratSemiCyr", "MontserratSemiLat", sans-serif';
  ctx.fillStyle = '#7D5126';
  ctx.shadowColor = 'rgba(255, 249, 236, 0.9)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 1;
  ctx.textBaseline = 'middle';
  drawTrackedText(ctx, 'КНИГА ВЕДМЕДІВ  ·  КАЗКА 1', cx, cy - 52, 5.2);

  // Main Title: Пирожок
  ctx.font = '700 132px "CormorantBoldCyr", "CormorantBoldLat", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Soft ivory outer glow for legibility
  ctx.shadowColor = 'rgba(255, 248, 230, 0.95)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#4A2B13';
  ctx.fillText('Пирожок', cx, cy + 44);

  // Crisp deep warm espresso-gold ink pass
  ctx.shadowColor = 'rgba(90, 48, 16, 0.22)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#4A2B13';
  ctx.fillText('Пирожок', cx, cy + 44);

  // Bottom ornamental rule
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawOrnamentLine(ctx, cx, cy + 126, 260, 'rgba(176, 126, 56, 0.88)');

  fs.writeFileSync(path.join(CACHE_DIR, 'title_opening.png'), canvas.toBuffer('image/png'));
  console.log('Generated title_opening.png');
}

// 2. CLOSING TITLE CARD (full velvety warm parchment 1920x1080)
{
  const W = 1920, H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Velvety warm sunlit cream-parchment gradient (no harsh dark/black!)
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.44, 60, W * 0.5, H * 0.5, W * 0.72);
  bg.addColorStop(0.0, '#FFFBF0');
  bg.addColorStop(0.42, '#FAF0DA');
  bg.addColorStop(0.78, '#EFE0BE');
  bg.addColorStop(1.0, '#E2CCA2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle golden sunbeam glow from top-right
  const glow = ctx.createRadialGradient(W * 0.74, H * 0.16, 20, W * 0.74, H * 0.16, 780);
  glow.addColorStop(0.0, 'rgba(255, 232, 168, 0.42)');
  glow.addColorStop(0.55, 'rgba(255, 224, 150, 0.14)');
  glow.addColorStop(1.0, 'rgba(255, 224, 150, 0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Double hairline storybook frame
  ctx.strokeStyle = 'rgba(176, 128, 62, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(72, 62, W - 144, H - 124);
  ctx.strokeStyle = 'rgba(176, 128, 62, 0.30)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(86, 76, W - 172, H - 152);

  // Corner diamonds
  const corners = [[72, 62], [W - 72, 62], [72, H - 62], [W - 72, H - 62]];
  ctx.fillStyle = 'rgba(176, 128, 62, 0.72)';
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    ctx.fill();
  }

  const cx = W * 0.5;
  const cy = H * 0.48;

  drawOrnamentLine(ctx, cx, cy - 118, 250, 'rgba(176, 126, 56, 0.85)');

  // Eyebrow: КНИГА ВЕДМЕДІВ
  ctx.font = '600 28px "MontserratSemiCyr", "MontserratSemiLat", sans-serif';
  ctx.fillStyle = '#85582B';
  ctx.textBaseline = 'middle';
  drawTrackedText(ctx, 'КНИГА ВЕДМЕДІВ', cx, cy - 68, 7.5);

  // Main Closing Title: Казка «Пирожок»
  ctx.font = '700 106px "CormorantBoldCyr", "CormorantBoldLat", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(95, 56, 20, 0.16)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#4A2B13';
  ctx.fillText('Казка «Пирожок»', cx, cy + 28);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawOrnamentLine(ctx, cx, cy + 122, 290, 'rgba(176, 126, 56, 0.85)');

  fs.writeFileSync(path.join(CACHE_DIR, 'title_closing.png'), canvas.toBuffer('image/png'));
  console.log('Generated title_closing.png');
}
