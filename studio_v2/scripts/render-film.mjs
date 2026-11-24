/**
 * Parallel 2-Worker Full-HD Renderer & Broadcast Audio Muxer for "Казка Пирожок"
 * Renders all 2,633 frames (1920x1080 @ 30fps, 87.76s) across 2 CPU cores,
 * concatenates seamlessly, and muxes with master_audio.wav (AAC 320k 48kHz)!
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOTAL_FRAMES, FPS, WIDTH, HEIGHT } from '../src/scenes/director.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const tmpDir = path.resolve(__dirname, '../.render_chunks');
const outDir = path.join(rootDir, 'output');
const audioPath = path.join(rootDir, 'assets/audio/master_audio.wav');
const finalMp4 = path.join(outDir, 'kazka_pyrozhok_1080p.mp4');

fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const workers = Math.max(1, Math.min(2, os.cpus().length));
const chunkSize = Math.ceil(TOTAL_FRAMES / workers);

console.log(`=== Казка Пирожок — Studio v2 Full-Motion 2D Render ===`);
console.log(`Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps | Total Frames: ${TOTAL_FRAMES} (${(TOTAL_FRAMES / FPS).toFixed(2)}s)`);
console.log(`Parallel Workers: ${workers} | Audio: ${audioPath}`);
console.log(`Output Target: ${finalMp4}`);

const tStart = performance.now();
const chunkPaths = [];
const workerProcs = [];

for (let i = 0; i < workers; i++) {
  const startF = i * chunkSize;
  const endF = Math.min(TOTAL_FRAMES, (i + 1) * chunkSize);
  if (startF >= endF) continue;
  const chunkFile = path.join(tmpDir, `chunk_${i}.mp4`);
  chunkPaths.push(chunkFile);

  const p = new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'render-worker.mjs'), String(startF), String(endF), chunkFile, `W${i}`],
      { stdio: 'inherit' }
    );
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker W${i} failed with exit code ${code}`));
    });
  });
  workerProcs.push(p);
}

await Promise.all(workerProcs);

// Concatenate video chunks & mux cleanly with locked broadcast master_audio.wav!
const concatListPath = path.join(tmpDir, 'concat.txt');
fs.writeFileSync(concatListPath, chunkPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n');

console.log('Concatenating chunks & muxing master_audio.wav -> final MP4...');
await new Promise((resolve, reject) => {
  const mux = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'warning',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-i',
      audioPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '320k',
      '-ar',
      '48000',
      '-shortest',
      '-movflags',
      '+faststart',
      finalMp4,
    ],
    { stdio: 'inherit' }
  );
  mux.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg mux exited with code ${code}`));
  });
});

// Clean up temp chunk files
fs.rmSync(tmpDir, { recursive: true, force: true });

const totalSec = (performance.now() - tStart) / 1000;
const stats = fs.statSync(finalMp4);
console.log(`\nDONE! Rendered ${finalMp4} (${(stats.size / (1024 * 1024)).toFixed(2)} MB) in ${totalSec.toFixed(1)}s!`);
