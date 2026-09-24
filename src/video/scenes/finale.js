// Scene 8 — "Finale": morning bursts back, every character pops into a
// ring on sixteenth notes, the closing line writes itself, everybody jumps,
// and a classic cartoon iris closes on the chick. The end.
import { W, H, INK, sprite, paper, grain, vignette, writeText, star, heart } from '../engine.js';
import { BEAT, ease, spring, invLerp, hash, rng } from '../../lib/util.js';

export const start = 66;
export const end = 78;
export const lead = 0.5;

const BURST = 65.6;
const RING_AT = 66.25, RING_STEP = 0.125;
const LINE1 = 70.0, LINE2 = 71.4, HOPS = 72.5, JUMP = 74.0, IRIS0 = 75.2, IRIS1 = 76.5, THE_END = 76.7;

const CAST = [
  'fox', 'butterflyPink', 'bunny', 'carrot', 'owlBlue', 'roundBird', 'jellyPink', 'duck', 'grapes',
  'mouse', 'octoLove', 'cat', 'sleepyBee', 'corn', 'owlBrown', 'fluffBird', 'watermelon', 'donkey',
  'ladybug', 'beanBird', 'avocado', 'grasshopper', 'butterflyPurple', 'pumpkin', 'birdPurple',
  'mushroom', 'stickChick', 'fish', 'bunnyHead', 'turnip',
];
const ORDER = (() => {
  const r = rng(12);
  const idx = CAST.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
})();
const RING = CAST.map((name, i) => {
  const a = -Math.PI / 2 + (i / CAST.length) * Math.PI * 2;
  const wide = ['donkey', 'butterflyPurple', 'watermelon', 'pumpkin', 'cat'].includes(name);
  return {
    name, a, x: W / 2 + Math.cos(a) * 820, y: H / 2 + 30 + Math.sin(a) * 420,
    h: wide ? 130 : name === 'fish' ? 190 : 175, at: RING_AT + ORDER.indexOf(i) * RING_STEP,
    rot: (hash(i, 7) - 0.5) * 0.4,
  };
});
const CHICK = ['chick1', 'chick2', 'chick3', 'chick4'];

export const assets = ['paper', ...CAST.map((n) => `${n}.sticker`), ...CHICK.map((n) => `${n}.sticker`)];

const UP = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'];
export const cues = [
  { t: BURST, sfx: 'sunrise', gain: 0.8 },
  ...RING.map((c, i) => ({ t: c.at, sfx: 'popNote', note: UP[(ORDER.indexOf(i)) % UP.length], pan: (c.x / W) * 1.6 - 0.8, gain: 0.45 })),
  { t: LINE1, sfx: 'scribble', dur: 1.2, gain: 0.5, pan: -0.3, panTo: 0.3 },
  { t: LINE2, sfx: 'scribble', dur: 1.2, gain: 0.5, pan: -0.3, panTo: 0.3 },
  ...Array.from({ length: 3 }, (_, k) => ({ t: HOPS + k * BEAT, sfx: 'step', pitch: 1 + k * 0.12, gain: 0.5 })),
  { t: JUMP - 0.5, sfx: 'drumroll', dur: 0.5, gain: 0.6 },
  { t: JUMP, sfx: 'boing', pitch: 0.8, gain: 0.8 },
  { t: JUMP, sfx: 'confetti', gain: 0.8 },
  { t: JUMP + 0.05, sfx: 'hooray', gain: 0.9 },
  { t: IRIS0, sfx: 'iris', dur: IRIS1 - IRIS0, gain: 0.55 },
  { t: IRIS1 - 0.35, sfx: 'tweet', pitch: 1.1, gain: 0.7 },
  { t: THE_END, sfx: 'ding', gain: 0.8 },
];

function sunburst(ctx, t) {
  const cols = ['#ffd98a', '#ffc2b5', '#bfe3c8', '#bcd9f2', '#e3cdf3', '#fff0b3'];
  ctx.save();
  ctx.translate(W / 2, H / 2 + 30);
  ctx.rotate(t * 0.08);
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2, a1 = a0 + Math.PI / 18;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1500, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function dance(t, i) {
  let y = 0, rot = 0, sx = 1, sy = 1;
  if (t >= HOPS && t < JUMP - 0.5) {
    const u = ((t - HOPS) / BEAT + (i % 2) * 0.5) % 1;
    y = -Math.sin(Math.PI * u) * 34;
    const land = Math.exp(-u * 10);
    sx = 1 + 0.1 * land; sy = 1 - 0.1 * land;
    rot = (i % 2 ? 1 : -1) * 0.1 * Math.sin(Math.PI * u);
  } else if (t >= JUMP - 0.5 && t < JUMP) {
    const k = invLerp(JUMP - 0.5, JUMP, t);
    sy = 1 - 0.15 * k; sx = 1 + 0.1 * k;
  } else if (t >= JUMP) {
    const k = t - JUMP;
    y = -Math.max(0, Math.sin(Math.min(Math.PI, k * Math.PI / 0.7))) * 160;
    rot = Math.sin(k * 10 + i) * 0.1 * Math.exp(-k);
  } else {
    y = Math.sin(t * 2.4 + i) * 6;
  }
  return { y, rot, sx, sy };
}

export function draw(ctx, t) {
  ctx.save();
  if (t < start + 0.1) {
    // Sunrise burst: a circle of morning grows out of the night.
    const r = ease.outCubic(invLerp(BURST, start + 0.1, t)) * 1300;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2);
    ctx.clip();
  }
  paper(ctx, t, { tint: '#ffe8b8', tintAlpha: 0.25 });
  sunburst(ctx, t);
  grain(ctx, t, 0.35);

  // The ring of friends.
  RING.forEach((c, i) => {
    if (t < c.at) return;
    const k = spring(t - c.at, 1.8, 5.5);
    const d = dance(t, i);
    sprite(ctx, `${c.name}.sticker`, {
      x: c.x, y: c.y + c.h / 2 + d.y, h: c.h * k, rot: c.rot + d.rot, sx: d.sx, sy: d.sy, seed: 400 + i, t, shadow: 0.9,
    });
  });

  // The chick, centre stage, cycling through its four poses.
  const ck = spring(t - 66.1, 1.4, 5);
  if (ck > 0) {
    const frame = t > IRIS1 - 0.4 ? 'chick4' : CHICK[Math.floor(t / (BEAT / 2)) % 4];
    const d = dance(t, 1);
    sprite(ctx, `${frame}.sticker`, { x: W / 2, y: 900 + d.y, h: 270 * ck, sx: d.sx, sy: d.sy, rot: d.rot, seed: 500, t, shadow: 1 });
  }

  // Closing line.
  const l1 = invLerp(LINE1, LINE1 + 1.2, t), l2 = invLerp(LINE2, LINE2 + 1.2, t);
  const bounce = t >= JUMP ? -Math.max(0, Math.sin(Math.min(Math.PI, (t - JUMP) * Math.PI / 0.7))) * 40 : 0;
  writeText(ctx, 'drawn by hand,', W / 2, 400 + bounce, { size: 150, font: 'Brush', progress: l1, rot: -0.03 });
  writeText(ctx, 'brought to life.', W / 2, 560 + bounce, { size: 150, font: 'Brush', progress: l2, rot: -0.01 });

  // Confetti on the big jump: watercolour dots, stars and hearts.
  if (t >= JUMP) {
    const cols = ['#f4a7b9', '#f7c948', '#9fd0ee', '#9cc56b', '#a58fd6', '#f5a25d'];
    for (let i = 0; i < 70; i++) {
      const lt = t - JUMP;
      const a = hash(i, 1) * Math.PI * 2, v = 500 + hash(i, 2) * 900;
      const x = W / 2 + Math.cos(a) * v * lt;
      const y = H / 2 + Math.sin(a) * v * lt * 0.7 + 600 * lt * lt;
      if (y > H + 50) continue;
      const kind = i % 7;
      if (kind === 0) star(ctx, x, y, 22, { fill: '#ffe08a', rot: lt * 5 + i, seed: i, t, lw: 3 });
      else if (kind === 1) heart(ctx, x, y, 38, { rot: lt * 3 + i });
      else {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.ellipse(x, y, 12 + hash(i, 5) * 10, 8 + hash(i, 6) * 8, lt * 4 + i, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  vignette(ctx, 0.25);
  ctx.restore();

  // Iris out on the chick, then "the end".
  if (t >= IRIS0) {
    const u = ease.inOutCubic(invLerp(IRIS0, IRIS1, t));
    const r = (1 - u) * 1400 + 0.001;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, 800, r, 0, Math.PI * 2, true);
    ctx.fillStyle = '#17130f';
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.arc(W / 2, 800, r, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }
  if (t >= IRIS1) {
    ctx.fillStyle = '#17130f';
    ctx.fillRect(0, 0, W, H);
    const k = spring(t - THE_END, 1.6, 5);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    writeText(ctx, 'the end', 0, 0, { size: 170, font: 'Brush', color: '#fbf4e6', rot: -0.04 });
    ctx.restore();
    heart(ctx, W / 2 + 250, H / 2 - 70, 46 * k, { stroke: null, rot: 0.2 });
    const fade = invLerp(end - 0.8, end, t);
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
