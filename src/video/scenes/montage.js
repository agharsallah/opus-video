// Scene 3 — "Little worlds": the horizon becomes a planet whose surface is a
// close-up of a different watercolour on every beat. Cuts accelerate while a
// handwritten line assembles word by word; the last world is the sunflower,
// which swallows the frame and match-cuts into the garden.
import { W, H, INK, img, sprite, grain, inkLine, arcPoints, writeText, vignette, motionLines } from '../engine.js';
import { BEAT, clamp, ease, spring, invLerp, hash } from '../../lib/util.js';

export const start = 22;
export const end = 32;

// Cut times: 2-beat, then 1-beat, half-beat, quarter-beat, then hold.
const cuts = [];
{
  let t = start;
  const push = (n, d) => { for (let i = 0; i < n; i++) { cuts.push(t); t += d; } };
  push(4, BEAT * 2); // 22..26
  push(4, BEAT); // 26..28
  push(8, BEAT / 2); // 28..30
  push(8, BEAT / 4); // 30..31
  cuts.push(t); // 31: final sunflower hold
}

const WORLDS = [
  ['ladybug', '#9fd0ee'], ['lake', '#f6d27a'], ['purpleWing', '#f4c9a8'], ['treeCanopy', '#f7b7a3'],
  ['fox', '#bfe0c2'], ['roses', '#fbe7b5'], ['pinkWing', '#b8e1dd'], ['octopus', '#f3a683'],
  ['grapes', '#b39ddb'], ['pumpkin', '#8fc1e3'], ['jelly', '#27335f'], ['pines', '#f5c3cf'],
  ['watermelon', '#a5d6a7'], ['beeStripes', '#5c6bc0'], ['wave', '#ffcc80'], ['fluffBird', '#fff3c4'],
  ['lavender', '#ffe0b2'], ['sunStripes', '#9575cd'], ['corn', '#e57373'], ['carrot', '#80cbc4'],
  ['avocadoHouse', '#f8bbd0'], ['owl', '#ffab91'], ['waterfall', '#f06292'], ['grapes', '#fff59d'],
  ['sunflowerCore', '#9fd0ee'],
];

// A critter visits the rim of each of the first eight worlds.
const GUESTS = [
  { name: 'kittenWalk', kind: 'walk', h: 200, dir: 1, sfx: 'meow', pitch: 1.5 },
  { name: 'duck', kind: 'walk', h: 240, dir: -1, sfx: 'quack', pitch: 1.2 },
  { name: 'butterflyBlue', kind: 'fly', h: 210, dir: 1, sfx: 'flutter' },
  { name: 'owlBlue', kind: 'peek', h: 290, x: 1420, sfx: 'hoot', pitch: 1.1 },
  { name: 'kittenSit', kind: 'peek', h: 260, x: 500, sfx: 'meow', pitch: 1.8 },
  { name: 'bee1', kind: 'zoom', h: 210, dir: -1, sfx: 'buzz' },
  { name: 'chick2', kind: 'peek', h: 260, x: 1440, sfx: 'tweet', pitch: 1.3 },
  { name: 'jellyPink', kind: 'peek', h: 250, x: 480, sfx: 'bloop' },
];

export const assets = [...new Set(WORLDS.map(([n]) => `tex:${n}`)), 'paper', ...GUESTS.map((g) => `${g.name}.sticker`)];

const WORDS = [
  { text: 'every', at: 22.0 }, { text: 'page', at: 24.0 }, { text: 'is a', at: 26.0 },
  { text: 'little', at: 28.0 }, { text: 'world', at: 30.0 },
];

// One pluck per cut walking up the arpeggios of C - G - Am - F.
const ARP = ['C5', 'E5', 'G5', 'C6', 'B4', 'D5', 'G5', 'B5', 'A4', 'C5', 'E5', 'A5', 'F5', 'A5', 'C6', 'F6',
  'G5', 'B5', 'D6', 'G6', 'A5', 'C6', 'E6', 'A6', 'C7'];
export const cues = [
  { t: start, sfx: 'whoosh', gain: 0.4, pitch: 0.8 },
  ...cuts.map((t, i) => ({ t, sfx: 'pluck', note: ARP[i % ARP.length], pan: (hash(i, 9) - 0.5) * 0.8, gain: i < 24 ? 0.75 : 0.9 })),
  ...cuts.slice(0, 24).map((t, i) => ({ t, sfx: 'tick', pan: (hash(i, 5) - 0.5), gain: 0.3 })),
  ...WORDS.map((w) => ({ t: w.at, sfx: 'scribble', dur: 0.35, gain: 0.35 })),
  { t: 31.0, sfx: 'riser', dur: 1.0, gain: 0.7 },
  ...GUESTS.map((g, i) => ({ t: cuts[i] + (g.kind === 'peek' ? 0.12 : 0.05), sfx: g.sfx, pitch: g.pitch ?? 1, dur: 0.8, gain: 0.55, pan: g.x ? g.x / W - 0.5 : -0.5 * (g.dir ?? 1), panTo: g.x ? undefined : 0.5 * (g.dir ?? 1) })),
];

const cutIndex = (t) => {
  let i = 0;
  while (i + 1 < cuts.length && t >= cuts[i + 1]) i++;
  return i;
};

// Arc top rises through the montage; at the end the world fills the frame.
function arcTop(t) {
  const base = 600 - 90 * ease.inOutSine(invLerp(start, 31, t));
  const fill = ease.inCubic(invLerp(31.2, 32, t));
  return base - fill * 1400;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function draw(ctx, t) {
  const i = cutIndex(t);
  const [tex, bg] = WORLDS[Math.min(i, WORLDS.length - 1)];
  const local = t - cuts[i];

  // Coloured paper sky.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, t, 0.75);

  const top = arcTop(t);
  const R = 1500 + (top < 0 ? -top * 1.2 : 0);
  const cy = top + R;

  const guest = GUESTS[i];
  const rimY = (x) => cy - Math.sqrt(Math.max(0, R * R - (x - W / 2) ** 2));
  const rimTilt = (x) => Math.asin(clamp((x - W / 2) / R, -1, 1));
  const dur = cuts[i + 1] - cuts[i];
  if (guest?.kind === 'peek') {
    const up = spring(local - 0.08, 1.8, 5) * (1 - ease.inBack(invLerp(dur - 0.2, dur, local)));
    sprite(ctx, `${guest.name}.sticker`, { x: guest.x, y: rimY(guest.x) + 30 + (1 - up) * guest.h, h: guest.h, rot: rimTilt(guest.x), seed: i, t, shadow: 0.6 });
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const im = img(`tex:${tex}`);
  const bandH = H - Math.max(0, top) + 40;
  const zoomEnd = 1 + 1.6 * ease.inCubic(invLerp(31.2, 32, t));
  const kb = (1.04 + local * 0.05) * zoomEnd;
  const s = Math.max(W / im.width, bandH / im.height) * kb;
  const dw = im.width * s, dh = im.height * s;
  const drift = (hash(i) - 0.5) * 60 * local;
  ctx.drawImage(im, (W - dw) / 2 + drift, Math.max(0, top) - 20 + (bandH - dh) / 2, dw, dh);
  ctx.restore();

  // Inked rim with boil.
  const span = Math.min(Math.PI / 2, Math.asin(Math.min(1, (W / 2 + 60) / R)));
  const pts = arcPoints(W / 2, cy, R, -Math.PI / 2 - span, -Math.PI / 2 + span, 140, 2.5, 30 + i);
  inkLine(ctx, pts, { width: 7, seed: 40 + i, t });

  if (guest && guest.kind !== 'peek') {
    const u = local / dur;
    const d = guest.dir;
    let x = W / 2 + d * (u - 0.5) * (guest.kind === 'zoom' ? 2600 : 1300);
    let y = rimY(x) + 8, rot = rimTilt(x), sy = 1;
    if (guest.kind === 'walk') {
      const step = Math.abs(Math.sin(local * Math.PI * 4));
      y -= step * 14; rot += Math.sin(local * Math.PI * 4) * 0.08;
    } else if (guest.kind === 'fly') {
      y = rimY(x) - 60 + Math.sin(local * 9) * 50;
      sy = 0.6 + 0.4 * Math.abs(Math.cos(local * 26));
    } else {
      y = rimY(x) - 60;
      motionLines(ctx, x - d * 130, y - 100, d > 0 ? 0 : Math.PI, 120, 0.8, i);
    }
    sprite(ctx, `${guest.name}.sticker`, { x, y, h: guest.h, rot, sy, flip: d < 0, seed: i, t, shadow: 0.6 });
  }

  // The handwritten line: the current word pops in above the world.
  let wi = -1;
  WORDS.forEach((w, k) => { if (t >= w.at) wi = k; });
  if (wi >= 0 && t < 31.6) {
    const w = WORDS[wi];
    const k = spring(t - w.at, 2.0, 6);
    const color = luminance(bg) < 0.45 ? '#fbf4e6' : INK;
    const size = wi === 4 ? 170 + 60 * ease.inQuad(invLerp(30, 31.5, t)) : 160;
    ctx.save();
    ctx.translate(W / 2, Math.max(150, top - 250) + Math.sin(t * 4) * 4);
    ctx.rotate(Math.sin(t * 2.3) * 0.03);
    ctx.scale(k, k);
    writeText(ctx, w.text, 0, 0, { size, font: 'Brush', color, alpha: 1 - invLerp(31.3, 31.6, t) });
    ctx.restore();
  }
  vignette(ctx, 0.3);

  // Quick white flash into the garden.
  const flash = clamp(1 - Math.abs(t - 32) / 0.12);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,250,235,${flash * 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
}
