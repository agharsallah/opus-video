// Scene 2 — "Roll call": the sketchbook critters pop up from behind the hill
// one by one, faster and faster, each with its own voice. Then they all hop
// to the beat and jump off into the montage.
import { W, H, INK, sprite, img, vignette, writeText, popText } from '../engine.js';
import { sky, sun, clouds, gulls } from './morning.js';
import { drawHill, hillY, hillTilt, clipAboveHill } from './hill.js';
import { BEAT, spring, ease, invLerp, hash } from '../../lib/util.js';

export const start = 10;
export const end = 22;

const DANCE = 18.5;
const JUMP = 21.5;

// Back row stands on the hill (cut-outs); front row rises from the bottom
// edge of the frame (stickers, closer to camera).
const BACK = [
  { name: 'stickChick', h: 235, at: 17.0, sfx: 'cheep', word: 'cheep!' },
  { name: 'bunny', h: 235, at: 14.0, sfx: 'boing', word: 'boing!' },
  { name: 'mouse', h: 250, at: 14.5, sfx: 'squeak', word: 'squeak' },
  { name: 'owlBlue', h: 225, at: 13.0, sfx: 'hoot', word: 'hoo!' },
  { name: 'fox', h: 290, at: 12.0, sfx: 'yip', word: 'yip!' },
  { name: 'cat', h: 215, at: 11.0, sfx: 'meow', word: 'meow' },
  { name: 'duck', h: 225, at: 15.0, sfx: 'quack', word: 'quack!' },
  { name: 'owlBrown', h: 235, at: 16.5, sfx: 'hoot', pitch: 0.8, word: 'hoo' },
  { name: 'donkey', h: 175, at: 17.75, sfx: 'heehaw', word: 'hee-haw!' },
];
const FRONT = [
  { name: 'roundBird', x: 175, h: 250, at: 18.25, sfx: 'tweet', pitch: 1.2, word: 'tweet' },
  { name: 'fluffBird', x: 440, h: 300, at: 16.0, sfx: 'tweet', pitch: 0.9, word: 'chirp!' },
  { name: 'beanBird', x: 700, h: 300, at: 18.0, sfx: 'boop', word: 'boop' },
  { name: 'chick', x: 960, h: 360, at: 10.0, sfx: 'tweet', word: 'tweet!', frames: ['chick1', 'chick2', 'chick3', 'chick4'] },
  { name: 'birdPurple', x: 1220, h: 330, at: 17.5, sfx: 'tweet', pitch: 1.35, word: 'hi!' },
  { name: 'bunnyHead', x: 1480, h: 230, at: 17.25, sfx: 'boing', pitch: 1.4, word: 'boing' },
  { name: 'grasshopper', x: 1745, h: 330, at: 15.5, sfx: 'chirp', word: 'chirr' },
];

export const assets = [
  ...BACK.map((c) => c.name),
  ...FRONT.flatMap((c) => (c.frames ?? [c.name]).map((n) => `${n}.sticker`)),
];

let laidOut = false;
function layout() {
  if (laidOut) return;
  const ws = BACK.map((c) => (img(c.name).width / img(c.name).height) * c.h);
  const total = ws.reduce((a, v) => a + v, 0);
  const gap = (W - 120 - total) / (BACK.length - 1);
  let x = 60;
  BACK.forEach((c, i) => { c.x = x + ws[i] / 2; x += ws[i] + gap; });
  laidOut = true;
}

const panOf = (x) => (x / W) * 1.6 - 0.8;
const xs = { stickChick: 110, bunny: 300, mouse: 490, owlBlue: 660, fox: 850, cat: 1080, duck: 1300, owlBrown: 1480, donkey: 1720 };

export const cues = [
  ...[...BACK, ...FRONT].map((c) => ({ t: c.at, sfx: c.sfx, pitch: c.pitch ?? 1, pan: panOf(c.x ?? xs[c.name]), gain: 0.85 })),
  ...[...BACK, ...FRONT].map((c) => ({ t: c.at, sfx: 'pop', pitch: 0.8 + hash(c.at) * 0.5, pan: panOf(c.x ?? xs[c.name]), gain: 0.45 })),
  { t: 19.0, sfx: 'hooray', gain: 0.8 },
  ...[...'good morning!'].map((ch, i) => ({ t: 19.0 + i * 0.045, sfx: 'pop', pitch: 1.2 + i * 0.05, pan: -0.6 + i * 0.1, gain: ch === ' ' ? 0 : 0.28 })),
  { t: JUMP - 0.5, sfx: 'drumroll', dur: 0.5, gain: 0.6 },
  { t: JUMP, sfx: 'boing', pitch: 0.6, gain: 0.9 },
  { t: JUMP + 0.05, sfx: 'whoosh', pan: 0, gain: 0.8, pitch: 1.3 },
];

// Hop to the beat after the dance starts; sway gently before.
function motion(t, c, i, front) {
  let y = 0, rot = Math.sin(t * 2.1 + i) * 0.035, sx = 1, sy = 1;
  const since = t - c.at;
  // Arrival squash.
  if (since > 0 && since < 0.8) {
    const k = Math.exp(-since * 7) * Math.sin(since * 28);
    sx *= 1 - 0.12 * k; sy *= 1 + 0.12 * k;
  }
  if (t >= DANCE && t < JUMP - 0.5) {
    const u = ((t - DANCE) / BEAT + (i % 2) * 0.5) % 1;
    y = -Math.sin(Math.PI * u) * (front ? 30 : 20);
    const land = Math.exp(-u * 10);
    sx *= 1 + 0.1 * land; sy *= 1 - 0.1 * land;
    rot = (Math.floor((t - DANCE) / BEAT) % 2 ? 1 : -1) * 0.07 * Math.sin(Math.PI * u);
  } else if (t >= JUMP - 0.5 && t < JUMP) {
    const k = invLerp(JUMP - 0.5, JUMP, t);
    sy *= 1 - 0.14 * ease.outQuad(k); sx *= 1 + 0.1 * ease.outQuad(k);
  } else if (t >= JUMP) {
    const k = (t - JUMP) / 0.5;
    y = -ease.inQuad(k) * 1400 - k * 200 * (hash(i) - 0.5);
    sy *= 1 + 0.25 * Math.exp(-k * 3); sx *= 1 - 0.12 * Math.exp(-k * 3);
    rot += (hash(i, 3) - 0.5) * k * 0.8;
  }
  return { y, rot, sx, sy };
}

function speech(ctx, t, c, x, y) {
  const since = t - c.at;
  if (since < 0 || since > 0.9) return;
  const k = spring(since, 2.2, 6);
  const a = 1 - invLerp(0.6, 0.9, since);
  ctx.save();
  ctx.translate(x, y - since * 40);
  ctx.rotate((hash(c.at) - 0.5) * 0.3);
  ctx.scale(k, k);
  writeText(ctx, c.word, 0, 0, { size: 64, font: 'Brush', color: INK, alpha: a });
  ctx.restore();
  // Little "pop" ticks.
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let j = 0; j < 5; j++) {
    const ang = -Math.PI / 2 + (j - 2) * 0.45;
    const r0 = 30 + since * 120, r1 = r0 + 24;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * r0, y + 70 + Math.sin(ang) * r0);
    ctx.lineTo(x + Math.cos(ang) * r1, y + 70 + Math.sin(ang) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

export function draw(ctx, t) {
  layout();
  sky(ctx, t, 1);
  gulls(ctx, t);
  clouds(ctx, t);
  sun(ctx, t);
  drawHill(ctx, t);

  // Back row rises from behind the horizon.
  ctx.save();
  clipAboveHill(ctx);
  BACK.forEach((c, i) => {
    if (t < c.at) return;
    const m = motion(t, c, i, false);
    const rise = spring(t - c.at, 1.6, 5.5);
    const gy = hillY(c.x) + 14;
    sprite(ctx, c.name, {
      x: c.x, y: gy + (1 - rise) * (c.h + 30) + m.y, h: c.h,
      rot: hillTilt(c.x) + m.rot, sx: m.sx, sy: m.sy, seed: i + 10, t,
    });
  });
  ctx.restore();

  // Front row rises from below the frame.
  FRONT.forEach((c, i) => {
    if (t < c.at) return;
    const m = motion(t, c, i + 1, true);
    const rise = spring(t - c.at, 1.5, 5);
    let key = c.name;
    if (c.frames) {
      // Swap between the four drawn poses: stop-motion from a character sheet.
      const rate = t >= DANCE ? BEAT / 2 : BEAT;
      key = c.frames[Math.floor(Math.max(0, t - c.at) / rate) % c.frames.length];
    }
    const base = H + c.h * 0.32;
    sprite(ctx, `${key}.sticker`, {
      x: c.x, y: base + (1 - rise) * c.h * 0.9 + m.y, h: c.h,
      rot: m.rot, sx: m.sx, sy: m.sy, seed: i + 40, t, shadow: 1,
    });
  });

  // Speech words above everyone.
  BACK.forEach((c) => speech(ctx, t, c, c.x, hillY(c.x) - c.h - 60));
  FRONT.forEach((c) => speech(ctx, t, c, c.x, H - c.h * 0.68 - 70));

  if (t >= 19 && t < JUMP + 0.3) {
    popText(ctx, 'good morning!', 960, 410, t, 19.0, { size: 170, font: 'Brush', stagger: 0.045, out: JUMP - 0.2 });
  }
  vignette(ctx, 0.28);
}
