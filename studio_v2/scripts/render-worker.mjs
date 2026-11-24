/**
 * Parallel Video Chunk Worker for "Казка Пирожок"
 * Renders frame range [startFrame, endFrame) at 1920x1080 30fps and pipes raw RGBA directly to ffmpeg!
 */

import { spawn } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { WIDTH, HEIGHT, FPS, renderFrame } from '../src/scenes/director.mjs';

const startFrame = parseInt(process.argv[2], 10);
const endFrame = parseInt(process.argv[3], 10);
const outFile = process.argv[4];
const workerId = process.argv[5] || 'W0';

if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame) || !outFile) {
  console.error('Usage: node render-worker.mjs <startFrame> <endFrame> <outMp4> [workerId]');
  process.exit(1);
}

const total = endFrame - startFrame;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const ff = spawn(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${WIDTH}x${HEIGHT}`,
    '-r',
    String(FPS),
    '-i',
    'pipe:0',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outFile,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] }
);

let ffError = null;
ff.on('error', (err) => {
  ffError = err;
});

function writeFrame(buf) {
  return new Promise((resolve, reject) => {
    if (ffError) return reject(ffError);
    if (ff.stdin.write(buf)) {
      resolve();
    } else {
      ff.stdin.once('drain', resolve);
    }
  });
}

const t0 = performance.now();
for (let f = startFrame; f < endFrame; f++) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  renderFrame(ctx, f);
  const raw = canvas.data();
  await writeFrame(raw);

  const done = f - startFrame + 1;
  if (done % 120 === 0 || done === total) {
    const sec = (performance.now() - t0) / 1000;
    const fps = done / Math.max(0.01, sec);
    const pct = ((done / total) * 100).toFixed(1);
    console.log(`[${workerId}] ${done}/${total} (${pct}%) | ${fps.toFixed(1)} fps | elapsed ${sec.toFixed(1)}s`);
  }
}

ff.stdin.end();

await new Promise((resolve, reject) => {
  ff.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg worker ${workerId} exited with code ${code}`));
  });
});

console.log(`[${workerId}] Finished chunk: ${outFile}`);
