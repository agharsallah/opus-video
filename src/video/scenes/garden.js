// Scene 4 — "The garden": we pull out of the sunflower, the flowers grow on
// the beat, butterflies and a pose-swapping bee arrive, then the veggie gang
// marches in and dances until a big drawn wave sweeps everything away.
import { W, H, INK, sprite, img, paper, vignette, writeText } from '../engine.js';
import { sun, clouds, gulls } from './morning.js';
import { drawHill, makeHill, hillY } from './hill.js';
import { BEAT, clamp, ease, spring, invLerp } from '../../lib/util.js';

export const start = 32;
export const end = 44;

const GROUND = makeHill(905, 7000);
const gy = (x) => hillY(x, GROUND);

const SUN_X = 1010, SUN_HEAD_Y = 440, SUN_H = 440;
const FLOWERS = [
  { name: 'lavender', x: 190, h: 330, at: 33.5 },
  { name: 'flowerBush', x: 450, h: 400, at: 34.0 },
  { name: 'flowerStems', x: 640, h: 600, at: 34.5 },
  { name: 'forgetMeNot', x: 800, h: 400, at: 35.0 },
  { name: 'poppy', x: 1270, h: 420, at: 35.5 },
  { name: 'dandelion', x: 1440, h: 330, at: 36.0 },
  { name: 'bellFlowers', x: 1600, h: 380, at: 36.5 },
  { name: 'roseBush', x: 1790, h: 280, at: 37.0 },
];
const BUTTERFLIES = [
  { name: 'butterflyPink', at: 34.25, from: [-200, 300], c: [480, 330], a: [260, 110], f: [0.55, 1.1], h: 170 },
  { name: 'butterflyBlue', at: 35.25, from: [W + 200, 200], c: [1450, 260], a: [240, 90], f: [0.6, 1.3], h: 150 },
  { name: 'butterflyGreen', at: 36.25, from: [-200, 150], c: [760, 200], a: [300, 80], f: [0.45, 0.9], h: 150 },
  { name: 'butterflyPurple', at: 37.25, from: [W + 200, 500], c: [1620, 520], a: [180, 120], f: [0.7, 1.2], h: 190 },
];
const BEE_AT = 37.5;
const DRAGON = [37.75, 40.75];
const PARADE = 38.0; // veggies start marching
const DANCE = 40.0;
const WAVE = 43.0;
const VEG = [
  { name: 'carrot', h: 440 },
  { name: 'pumpkin', h: 220 },
  { name: 'corn', h: 380 },
  { name: 'avocado', h: 350 },
  { name: 'mushroom', h: 290 },
  { name: 'grapes', h: 390 },
  { name: 'watermelon', h: 200 },
  { name: 'turnip', h: 340 },
];
VEG.forEach((v, i) => { v.x = 150 + i * 232; });

export const assets = [
  'paper', 'peekSun', 'cloud1', 'cloud2', 'sunflower', 'sleepyBee', 'dragonfly', 'ladybug',
  ...FLOWERS.map((f) => f.name), ...BUTTERFLIES.map((b) => b.name),
  'bee1', 'bee2', 'bee3', 'bee4', ...VEG.map((v) => `${v.name}.sticker`),
];

const SCALE = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];
export const cues = [
  { t: start, sfx: 'boom', gain: 0.8 },
  { t: start, sfx: 'whoosh', gain: 0.6, pitch: 0.7, pan: 0 },
  ...FLOWERS.map((f, i) => ({ t: f.at, sfx: 'grow', note: SCALE[i], pan: f.x / W * 1.6 - 0.8, gain: 0.7 })),
  ...BUTTERFLIES.map((b) => ({ t: b.at, sfx: 'flutter', dur: 1.2, pan: b.from[0] < 0 ? -0.9 : 0.9, panTo: b.c[0] / W * 1.6 - 0.8, gain: 0.5 })),
  { t: BEE_AT, sfx: 'buzz', dur: WAVE - BEE_AT, panLfo: 0.61, gain: 0.35 },
  ...DRAGON.map((t, i) => ({ t, sfx: 'zip', pan: i ? 0.9 : -0.9, panTo: i ? -0.9 : 0.9, gain: 0.6 })),
  // Parade: every hop is a woodblock step.
  ...Array.from({ length: 10 }, (_, k) => ({ t: PARADE + k * BEAT, sfx: 'step', pitch: k % 2 ? 1.2 : 1, gain: 0.55 })),
  { t: DANCE, sfx: 'hup', gain: 0.8, pan: -0.6 },
  ...Array.from({ length: 6 }, (_, k) => ({ t: DANCE + 0.5 + k * BEAT, sfx: 'boop', pitch: [1, 1.26, 1.5, 1.26, 1.68, 2][k], pan: -0.7 + k * 0.28, gain: 0.5 })),
  { t: WAVE - 0.3, sfx: 'gasp', gain: 0.7 },
  { t: WAVE, sfx: 'wave', gain: 1.0 },
];

function camera(t) {
  // Pull out from the sunflower's heart.
  const u = ease.inOutCubic(invLerp(start, start + 1.8, t));
  const z = 5.5 - 4.5 * u;
  const F = [SUN_X, SUN_HEAD_Y];
  const S = [960 + (F[0] - 960) * u, 540 + (F[1] - 540) * u];
  return { z, F, S };
}

function sunflower(ctx, t) {
  const sway = Math.sin(t * 1.4) * 14;
  const hx = SUN_X + sway, hy = SUN_HEAD_Y;
  // Stem and leaves in ink + watercolour green.
  ctx.save();
  ctx.lineCap = 'round';
  const stem = () => { ctx.beginPath(); ctx.moveTo(SUN_X, gy(SUN_X) + 4); ctx.quadraticCurveTo(SUN_X - 20, 700, hx, hy + 120); };
  ctx.strokeStyle = INK; ctx.lineWidth = 22; stem(); ctx.stroke();
  ctx.strokeStyle = '#8fbf5a'; ctx.lineWidth = 14; stem(); ctx.stroke();
  for (const [lx, ly, dir] of [[SUN_X - 8, 720, -1], [SUN_X - 4, 640, 1]]) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(dir * (0.7 + Math.sin(t * 1.4 + dir) * 0.08));
    ctx.beginPath();
    ctx.ellipse(dir * 60, 0, 62, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(143,191,90,0.9)';
    ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * 110, 0); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  sprite(ctx, 'sunflower', { x: hx, y: hy, h: SUN_H, ay: 0.5, rot: sway * 0.004, seed: 77, t });
}

function butterflyPos(b, t) {
  const lt = t - b.at;
  const loop = [b.c[0] + b.a[0] * Math.sin(lt * b.f[0] * 2), b.c[1] + b.a[1] * Math.sin(lt * b.f[1] * 2 + 1)];
  const k = ease.outCubic(lt / 1.4);
  return [b.from[0] + (loop[0] - b.from[0]) * k, b.from[1] + (loop[1] - b.from[1]) * k];
}

function veggie(ctx, t, v, i) {
  // March in from the right on the beat, then dance in place.
  if (t < PARADE) return;
  const hopU = ((t - PARADE) / BEAT) % 1;
  const march = clamp((t - PARADE - i * 0.12) / (DANCE - PARADE - i * 0.12));
  const startX = W + 200 + i * 240;
  let x = startX + (v.x - startX) * ease.outQuad(march);
  let y = 1075;
  let rot = 0, sx = 1, sy = 1;
  if (t < DANCE + 0.2) {
    y -= Math.sin(Math.PI * hopU) * 38;
    rot = Math.sin(Math.PI * 2 * hopU) * 0.08;
    const land = Math.exp(-hopU * 12);
    sx = 1 + 0.12 * land; sy = 1 - 0.12 * land;
  } else if (t < WAVE - 0.4) {
    // Dance: alternating hops + sway, the carrot leads.
    const u = ((t - DANCE) / BEAT + (i % 2) * 0.5) % 1;
    y -= Math.sin(Math.PI * u) * (i === 0 ? 70 : 45);
    rot = (Math.floor((t - DANCE) / BEAT + (i % 2) * 0.5) % 2 ? 1 : -1) * 0.12 * Math.sin(Math.PI * u);
    const land = Math.exp(-u * 10);
    sx = 1 + 0.1 * land; sy = 1 - 0.1 * land;
  } else {
    // Uh-oh: they see the wave, jump in surprise and tremble.
    const k = t - (WAVE - 0.4);
    y -= spring(k, 2, 5) * 60;
    x += Math.sin(t * 60 + i) * 3;
    sy = 1.08;
  }
  sprite(ctx, `${v.name}.sticker`, { x, y, h: v.h, rot, sx, sy, seed: 200 + i, t, shadow: 1 });
}

export function draw(ctx, t) {
  paper(ctx, t, { tint: '#ffe3a8', tintAlpha: 0.18 });
  const { z, F, S } = camera(t);
  ctx.save();
  ctx.translate(S[0], S[1]);
  ctx.scale(z, z);
  ctx.translate(-F[0], -F[1]);

  gulls(ctx, t);
  clouds(ctx, t);
  drawHill(ctx, t, { hill: GROUND });

  // Flowers grow up from the ground on the half-beats.
  FLOWERS.forEach((f, i) => {
    if (t < f.at) return;
    const g = spring(t - f.at, 1.6, 5.5);
    const sway = Math.sin(t * 1.3 + i * 0.8) * 0.035;
    sprite(ctx, f.name, { x: f.x, y: gy(f.x) + 6, h: f.h, sy: g, sx: 0.7 + 0.3 * g, rot: sway, seed: 100 + i, t });
  });
  sunflower(ctx, t);

  // Ladybug strolls along the ground.
  if (t > 37.5) {
    const x = -80 + (t - 37.5) * 150;
    sprite(ctx, 'ladybug', { x, y: gy(x) + 4 - Math.abs(Math.sin(t * 10)) * 4, h: 70, rot: Math.PI / 2 + Math.sin(t * 10) * 0.05, ax: 0.5, ay: 0.5, seed: 9, t });
  }

  // Sleepy bee bobbing by the lavender.
  sprite(ctx, 'sleepyBee', { x: 230 + Math.sin(t * 0.8) * 30, y: 470 + Math.sin(t * 1.6) * 25, h: 110, ay: 0.5, rot: Math.sin(t * 1.6) * 0.1, seed: 12, t, alpha: invLerp(33, 33.6, t) });

  // Butterflies: flap by squashing across the body axis.
  BUTTERFLIES.forEach((b, i) => {
    if (t < b.at) return;
    const [x, y] = butterflyPos(b, t);
    const [px] = butterflyPos(b, t - 0.05);
    const flap = 0.3 + 0.7 * Math.abs(Math.cos((t - b.at) * 13 + i));
    sprite(ctx, b.name, { x, y, h: b.h, ay: 0.5, sx: flap, flip: x < px, rot: Math.sin(t * 3 + i) * 0.15, seed: 300 + i, t });
  });

  // The bee flies a figure-eight around the sunflower, swapping its 4 poses.
  if (t > BEE_AT) {
    const lt = t - BEE_AT;
    const x = SUN_X + 460 * Math.sin(lt * 1.25), y = 380 + 130 * Math.sin(lt * 2.5);
    const dx = Math.cos(lt * 1.25);
    const frame = `bee${1 + (Math.floor(t * 10) % 4)}`;
    const k = ease.outBack(clamp(lt / 0.6));
    sprite(ctx, frame, { x, y, h: 150 * k, ay: 0.5, flip: dx < 0, rot: Math.sin(lt * 6) * 0.1, seed: 55, t: 0, boil: 0 });
  }

  // Dragonfly darts across twice.
  DRAGON.forEach((d, i) => {
    const u = (t - d) / 0.9;
    if (u < 0 || u > 1) return;
    const dir = i ? -1 : 1;
    const x = W / 2 + dir * (ease.inOutCubic(u) - 0.5) * (W + 500);
    const y = 180 + Math.sin(u * 9) * 30;
    sprite(ctx, 'dragonfly', { x, y, h: 130, ay: 0.5, flip: dir < 0, rot: dir * 0.15, seed: 60, t });
  });

  sun(ctx, t, 1);
  VEG.forEach((v, i) => veggie(ctx, t, v, i));
  ctx.restore();

  if (t > DANCE && t < WAVE - 0.4) {
    const k = spring(t - DANCE, 2, 6);
    ctx.save();
    ctx.translate(560, 740);
    ctx.rotate(-0.12);
    ctx.scale(k, k);
    writeText(ctx, 'hup! hup!', 0, 0, { size: 80, font: 'Brush', alpha: 1 - invLerp(DANCE + 1.2, DANCE + 1.6, t) });
    ctx.restore();
  }
  if (t > WAVE - 0.35 && t < WAVE + 0.3) {
    ctx.save();
    ctx.translate(960, 620);
    const k = spring(t - (WAVE - 0.35), 2.4, 5);
    ctx.scale(k, k);
    writeText(ctx, 'uh-oh!', 0, 0, { size: 150, font: 'Brush' });
    ctx.restore();
  }
  vignette(ctx, 0.26);
}
