/**
 * Fast Scene Preview & Motion Contact-Strip Verification Generator
 * Renders:
 *  - 12 keyframe stills across ALL scenes (01..11_outro, including 08a, 08b, 10a, 10b)
 *  - 4-frame motion contact strips for:
 *      * Scene 02 (Boy actually running barefoot across sunlit hallway)
 *      * Scene 07 (White Dove unfolding & fluttering wings in celestial light)
 *      * Scene 08b (White Dove physically nodding head smoothly up & down)
 *      * Scene 10a (Modern Mom physically stroking Boy's curly hair on wooden stool)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';

import { WIDTH, HEIGHT, FPS, renderFrame } from '../src/scenes/director.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../preview/scenes');
fs.mkdirSync(outDir, { recursive: true });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const KEYFRAMES = [
  { name: '01_title', sec: 2.35, label: 'Scene 01 — Sunlit Kitchen & Opening Title' },
  { name: '02_boy_hallway_shout', sec: 5.45, label: 'Scene 02 — Boy in Sunlit Hallway Shouting' },
  { name: '03_mom_welcome', sec: 19.3, label: 'Scene 03 — Modern Mom Walking & Welcoming' },
  { name: '04_boy_discovers_dove', sec: 25.6, label: 'Scene 04 — Boy Enters Kitchen & Sees White Dove' },
  { name: '05_dove_eye_sky', sec: 33.8, label: 'Scene 05 — Dove Crystal Sky-Blue Eye Dreamscape' },
  { name: '06_boy_asks_who', sec: 38.2, label: 'Scene 06 — Boy Asks "Хто ти?"' },
  { name: '07_dove_wings_magic', sec: 45.2, label: 'Scene 07 — Dove Spreading Wings & Speaking' },
  { name: '08a_boy_surprised', sec: 53.6, label: 'Scene 08a — Boy Surprised "Як пиріг?"' },
  { name: '08b_dove_nodding', sec: 56.6, label: 'Scene 08b — Dove Calmly Nodding Head' },
  { name: '09_mom_pie_boy_points', sec: 62.6, label: 'Scene 09 — Mom Holding Pie, Boy Points to Dove' },
  { name: '10a_mom_strokes_hair', sec: 72.4, label: 'Scene 10a — Mom Stroking Boy Hair on Stool' },
  { name: '10b_boy_understands_wide', sec: 81.4, label: 'Scene 10b — Boy Looks Back & Wide Finale' },
  { name: '11_outro_card', sec: 84.8, label: 'Scene 11 — Storybook Closing Title Card' },
];

console.log('Rendering 13 full-HD scene keyframes...');
const t0 = performance.now();
for (const kf of KEYFRAMES) {
  const f = Math.round(kf.sec * FPS);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  renderFrame(ctx, f);
  const outPath = path.join(outDir, `${kf.name}.png`);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`  [f=${f} @ ${kf.sec.toFixed(2)}s] ${kf.name}.png`);
}
const elapsed = performance.now() - t0;
console.log(`Average full-HD frame render + PNG time: ${(elapsed / KEYFRAMES.length).toFixed(1)} ms/frame`);

// Also build 2x2 HD contact strips (1920x1080) for the 4 hero continuous-motion sequences!
function renderMotionStrip(stripName, title, timestamps) {
  const strip = createCanvas(1920, 1080);
  const sctx = strip.getContext('2d');
  sctx.fillStyle = '#241811';
  sctx.fillRect(0, 0, 1920, 1080);

  const cellW = 948;
  const cellH = 516;
  const positions = [
    [8, 40],
    [964, 40],
    [8, 560],
    [964, 560],
  ];

  sctx.fillStyle = '#f8e6bd';
  sctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  sctx.fillText(title, 18, 28);

  for (let i = 0; i < 4; i++) {
    const sec = timestamps[i];
    const f = Math.round(sec * FPS);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    renderFrame(ctx, f);

    const [px, py] = positions[i];
    sctx.drawImage(canvas, px, py, cellW, cellH);

    // Subtle timestamp badge
    sctx.fillStyle = 'rgba(34, 20, 12, 0.72)';
    sctx.fillRect(px + 10, py + 10, 168, 30);
    sctx.fillStyle = '#fff5dc';
    sctx.font = 'bold 17px "DejaVu Sans", sans-serif';
    sctx.fillText(`t=${sec.toFixed(2)}s (f=${f})`, px + 18, py + 31);
  }

  const outPath = path.join(outDir, `${stripName}.png`);
  fs.writeFileSync(outPath, strip.toBuffer('image/png'));
  console.log(`  [STRIP] ${stripName}.png`);
}

console.log('Rendering 4-frame motion contact strips...');
renderMotionStrip('strip_02_boy_running', 'Scene 02 Motion Strip — Boy Running Barefoot & Shouting in Sunlit Hallway', [4.25, 5.2, 8.2, 11.4]);
renderMotionStrip('strip_07_dove_wings', 'Scene 07 Motion Strip — White Dove Unfolding & Fluttering Wings + Beak Lip-Sync', [41.4, 42.6, 44.8, 47.4]);
renderMotionStrip('strip_08b_dove_nodding', 'Scene 08b Motion Strip — White Dove Physically Nodding Head (3 Gentle Nods)', [55.15, 55.62, 56.12, 56.62]);
renderMotionStrip('strip_10a_mom_stroking', 'Scene 10a Motion Strip — Modern Mom Physically Stroking Boy Curly Hair on Stool', [68.2, 68.75, 69.3, 72.1]);

// Pure raw RGBA benchmark (no PNG encoding!) to project exact render time for 2,633 frames!
const b0 = performance.now();
for (let i = 0; i < 20; i++) {
  renderFrame(ctx, 180 + i * 100);
  ctx.getImageData(0, 0, WIDTH, HEIGHT);
}
const bMs = (performance.now() - b0) / 20;
console.log(`Raw RGBA frame speed (single core): ${bMs.toFixed(1)} ms/frame (~${((bMs * 2633) / 2000).toFixed(0)}s projected on 2 workers!)`);
