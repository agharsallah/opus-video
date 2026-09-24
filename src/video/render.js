// Renders the film frame by frame with @napi-rs/canvas and pipes raw frames
// into ffmpeg, muxing the JavaScript-synthesised soundtrack.
//
//   node src/video/render.js                 full film -> out/sketchbook.mp4
//   node src/video/render.js --still 12.5    one frame -> build/stills/
//   node src/video/render.js --sheet 10 22 0.5   contact sheet of a range
//   node src/video/render.js --clip 10 22    preview mp4 of a range (with audio)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { W, H, preload } from './engine.js';
import { SCENES, DURATION } from './scenes/index.js';
import { ROOT, BUILD_DIR } from '../extract/common.js';

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name);
const FPS = Number(process.env.FPS ?? 30);

await preload([...new Set(SCENES.flatMap((s) => s.assets))]);

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingQuality = 'high';

function renderFrame(t) {
  ctx.save();
  ctx.fillStyle = '#fbf4e6';
  ctx.fillRect(0, 0, W, H);
  for (const s of SCENES) {
    const from = s.start - (s.lead ?? 0), to = s.end + (s.tail ?? 0);
    if (t >= from && t < to) {
      ctx.save();
      s.draw(ctx, t);
      ctx.restore();
    }
  }
  ctx.restore();
}

async function still(t, file) {
  renderFrame(t);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await canvas.encode('jpeg', 90));
}

if (flag('--still') >= 0) {
  const times = args.slice(flag('--still') + 1).map(Number);
  for (const t of times) {
    const file = path.join(BUILD_DIR, 'stills', `t${t.toFixed(2)}.jpg`);
    const t0 = performance.now();
    await still(t, file);
    console.log(`${file} (${(performance.now() - t0).toFixed(0)} ms)`);
  }
} else if (flag('--sheet') >= 0) {
  const [a, z, step = 0.5] = args.slice(flag('--sheet') + 1).map(Number);
  const cols = 6, tw = 320, th = 180;
  const times = [];
  for (let t = a; t < z - 1e-6; t += step) times.push(t);
  const sheet = createCanvas(cols * tw, Math.ceil(times.length / cols) * th);
  const sx = sheet.getContext('2d');
  for (let i = 0; i < times.length; i++) {
    renderFrame(times[i]);
    sx.drawImage(canvas, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    sx.fillStyle = '#d00';
    sx.font = '16px sans-serif';
    sx.fillText(times[i].toFixed(2), (i % cols) * tw + 4, Math.floor(i / cols) * th + 16);
  }
  const file = path.join(BUILD_DIR, 'stills', `sheet_${a}_${z}.jpg`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await sheet.encode('jpeg', 85));
  console.log(file);
} else {
  const clip = flag('--clip') >= 0 ? args.slice(flag('--clip') + 1).map(Number) : [0, DURATION];
  const [a, z] = clip;
  const full = flag('--clip') < 0;
  const out = full ? path.join(ROOT, 'out', 'sketchbook.mp4') : path.join(BUILD_DIR, `clip_${a}_${z}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const wav = path.join(BUILD_DIR, 'soundtrack.wav');
  const hasAudio = fs.existsSync(wav);
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    ...(hasAudio ? ['-ss', String(a), '-t', String(z - a), '-i', wav] : []),
    '-c:v', 'libx264', '-preset', full ? 'slow' : 'veryfast', '-crf', full ? '15' : '20',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'animation',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '256k'] : []),
    '-movflags', '+faststart', '-shortest', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round((z - a) * FPS);
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    renderFrame(a + f / FPS);
    const buf = ctx.getImageData(0, 0, W, H).data;
    if (!ff.stdin.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength))) {
      await new Promise((r) => ff.stdin.once('drain', r));
    }
    if (f % FPS === 0) {
      const el = (performance.now() - t0) / 1000;
      process.stdout.write(`\r  frame ${f}/${frames}  ${(f / el || 0).toFixed(1)} fps  eta ${((frames - f) / (f / el || 1)).toFixed(0)}s   `);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`\n${out}${hasAudio ? '' : ' (no soundtrack yet: run pnpm audio)'}`);
}
