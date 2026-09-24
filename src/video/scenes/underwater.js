// Scene 5 — "Underwater": the drawn wave washes the garden away. Veggies
// tumble past, jellyfish pulse on the beat, and a shy octopus falls for a
// pink jellyfish (shy -> wow -> sad -> love, all from the character sheet).
import { W, H, INK, sprite, img, grain, vignette, wash, bubble, heart, writeText } from '../engine.js';
import { BEAT, clamp, ease, spring, invLerp, hash, noise1, lerp } from '../../lib/util.js';

export const start = 44;
export const end = 54;
export const lead = 1.0; // the wave wipe starts at 43.0 over the garden

const WAVE0 = 43.0, WAVE1 = 44.3;
const OCTO = { x: 640, y: 930, h: 360 };
const STORY = { shy: 45.0, jellyIn: 46.0, wow: 47.0, away: 47.75, sad: 48.5, back: 49.5, kiss: 50.5, surface: 52.5 };

const JELLIES = [
  { name: 'jellyOrange', x: 1560, h: 400, t0: 44.2, speed: 60, ph: 0 },
  { name: 'jellyGreen', x: 1230, h: 260, t0: 45.2, speed: 75, ph: 0.25 },
  { name: 'jellySquid', x: 300, h: 300, t0: 44.6, speed: 70, ph: 0.5 },
  { name: 'jellyYellow', x: 1780, h: 240, t0: 46.5, speed: 90, ph: 0.75 },
  { name: 'jellyBell', x: 980, h: 280, t0: 47.4, speed: 80, ph: 0.4 },
];
const VEG = ['carrot', 'pumpkin', 'corn', 'avocado', 'mushroom', 'grapes', 'watermelon', 'turnip'];
const FISH = [
  { at: 44.9, dir: 1, y: 330, h: 300, dur: 3.2 },
  { at: 48.0, dir: -1, y: 560, h: 170, dur: 2.6, school: 3 },
  { at: 51.0, dir: 1, y: 420, h: 300, dur: 2.6 },
];

export const assets = [
  'paper', 'waveProp.sticker', 'fish.sticker', 'octoShy.sticker', 'octoWow.sticker', 'octoSad.sticker', 'octoLove.sticker',
  ...JELLIES.map((j) => `${j.name}.sticker`), 'jellyPink.sticker', ...VEG.map((v) => `${v}.sticker`),
];

export const cues = [
  { t: WAVE1, sfx: 'splash', gain: 0.8 },
  { t: 44.4, sfx: 'bubbles', dur: 1.6, gain: 0.5 },
  ...VEG.map((_, i) => ({ t: 44.35 + i * 0.12, sfx: 'blub', pitch: 0.8 + i * 0.06, pan: -0.8 + i * 0.22, gain: 0.35 })),
  { t: STORY.shy, sfx: 'bloop', pitch: 0.7, pan: -0.3, gain: 0.7 },
  ...FISH.map((f) => ({ t: f.at, sfx: 'swish', pan: -f.dir, panTo: f.dir, gain: 0.45 })),
  { t: STORY.jellyIn, sfx: 'harp', dur: 1, gain: 0.6, pan: 0.4 },
  { t: STORY.wow, sfx: 'boing', pitch: 1.3, pan: -0.3, gain: 0.8 },
  { t: STORY.wow + 0.05, sfx: 'blush', gain: 0.5, pan: -0.3 },
  { t: STORY.sad, sfx: 'sadTrombone', gain: 0.7, pan: -0.3 },
  { t: STORY.back, sfx: 'harp', dur: 1, gain: 0.6, pan: 0.2 },
  { t: STORY.kiss, sfx: 'kiss', gain: 0.9, pan: -0.2 },
  { t: STORY.kiss + 0.08, sfx: 'shimmer', gain: 0.7 },
  ...[0, 1, 2, 3, 4].map((k) => ({ t: STORY.kiss + 0.2 + k * 0.25, sfx: 'pop', pitch: 1.5 + k * 0.15, pan: -0.4 + k * 0.1, gain: 0.3 })),
  ...JELLIES.map((j) => ({ t: j.t0 + 0.3, sfx: 'bloop', pitch: 0.5 + hash(j.x) * 0.4, pan: j.x / W - 0.5, gain: 0.3 })),
  { t: STORY.surface, sfx: 'riser', dur: 1.5, gain: 0.5 },
];

function waveX(t) {
  return lerp(-1100, W + 1100, ease.inOutSine(invLerp(WAVE0, WAVE1, t)));
}

// The torn edge between garden and sea, just ahead of the crest.
const edgeX = (wx, y, t) => wx - 120 + noise1(y * 0.012 + t * 2, 2) * 50 + noise1(y * 0.05, 5) * 12;

function backdrop(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#bfe7ef');
  g.addColorStop(0.55, '#7cc0e0');
  g.addColorStop(1, '#4f8fc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Pigment blooms.
  wash(ctx, 400, 300, 520, 260, '#9fd8ea', { seed: 3, alpha: 0.35 });
  wash(ctx, 1500, 650, 600, 300, '#5a9fd0', { seed: 8, alpha: 0.3 });
  wash(ctx, 900, 150, 700, 180, '#d8f2f4', { seed: 11, alpha: 0.35 });
  // Light rays, swaying.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const x = 150 + i * 330 + Math.sin(t * 0.6 + i) * 60;
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,255,240,0.28)');
    gr.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - 40, -10);
    ctx.lineTo(x + 50, -10);
    ctx.lineTo(x + 260 + i * 10, H);
    ctx.lineTo(x + 110, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Sandy floor with an inked edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 950 + noise1(x * 0.004, 4) * 30);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(236,210,150,0.9)';
  ctx.fill();
  ctx.beginPath();
  for (let x = 0; x <= W; x += 20) {
    const y = 950 + noise1(x * 0.004, 4) * 30 + (hash(x, Math.floor(t * 8)) - 0.5) * 1.5;
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
  // Seaweed.
  for (let s = 0; s < 7; s++) {
    const x0 = 90 + s * 290 + (s % 2) * 60;
    const n = 12, len = 230 + (s % 3) * 70;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push([x0 + Math.sin(t * 1.6 + s + k * 3) * 26 * k, 960 - k * len]);
    }
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.stroke();
    ctx.strokeStyle = s % 2 ? '#7fb35a' : '#5f9e6a'; ctx.lineWidth = 13; ctx.stroke();
    ctx.restore();
  }
  grain(ctx, t, 0.7);
}

// Jellyfish pulse on every beat: contract, then glide upwards.
function jelly(ctx, t, key, x, y, h, ph, seed) {
  const u = ((t / BEAT) + ph) % 1;
  const pulse = Math.exp(-u * 5);
  sprite(ctx, `${key}.sticker`, { x: x + Math.sin(t * 0.9 + seed) * 20, y, h, ay: 0.4, sx: 1 + 0.1 * pulse, sy: 1 - 0.14 * pulse, rot: Math.sin(t * 0.8 + seed) * 0.08, seed, t, shadow: 0.5 });
}

function octopus(ctx, t) {
  if (t < STORY.shy) return;
  let key = 'octoShy';
  if (t >= STORY.wow) key = 'octoWow';
  if (t >= STORY.sad) key = 'octoSad';
  if (t >= STORY.kiss) key = 'octoLove';
  const since = [STORY.wow, STORY.sad, STORY.kiss].reduce((a, s) => (t >= s ? t - s : a), t - STORY.shy);
  const rise = spring(t - STORY.shy, 1.2, 4);
  const [sx, sy] = [1 + 0.12 * Math.exp(-since * 6) * Math.sin(since * 30), 1 - 0.12 * Math.exp(-since * 6) * Math.sin(since * 30)];
  const bob = Math.sin(t * 2.2) * 10;
  const hop = t >= STORY.kiss ? -Math.abs(Math.sin((t - STORY.kiss) * Math.PI * 2)) * 30 : 0;
  sprite(ctx, `${key}.sticker`, { x: OCTO.x, y: OCTO.y + (1 - rise) * 500 + bob + hop, h: OCTO.h, sx, sy, seed: 71, t, shadow: 0.7 });
  // Blush when surprised.
  if (t >= STORY.wow && t < STORY.sad) {
    const a = clamp((t - STORY.wow) / 0.2);
    ctx.save();
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = '#f26d8d';
    for (const dx of [-70, 55]) { ctx.beginPath(); ctx.ellipse(OCTO.x + dx, OCTO.y - 250 + bob, 26, 14, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    const k = spring(t - STORY.wow, 2.5, 6);
    ctx.save();
    ctx.translate(OCTO.x + 150, OCTO.y - 360);
    ctx.scale(k, k);
    writeText(ctx, '!', 0, 0, { size: 150, font: 'Brush' });
    ctx.restore();
  }
}

function pinkJelly(ctx, t) {
  if (t < STORY.jellyIn) return;
  let x, y;
  const home = [OCTO.x + 330, OCTO.y - 330];
  if (t < STORY.away) {
    const u = ease.outCubic(invLerp(STORY.jellyIn, STORY.jellyIn + 1.2, t));
    x = lerp(W + 200, home[0], u); y = lerp(250, home[1], u);
  } else if (t < STORY.back) {
    const u = ease.inOutSine(invLerp(STORY.away, STORY.away + 1.4, t));
    x = lerp(home[0], 1450, u); y = lerp(home[1], 180, u);
  } else if (t < STORY.kiss) {
    const u = ease.inOutSine(invLerp(STORY.back, STORY.kiss, t));
    x = lerp(1450, OCTO.x + 180, u); y = lerp(180, OCTO.y - 300, u);
  } else {
    x = OCTO.x + 180 + Math.sin((t - STORY.kiss) * 2) * 30; y = OCTO.y - 300 + Math.cos((t - STORY.kiss) * 2) * 20;
  }
  jelly(ctx, t, 'jellyPink', x, y, 220, 0.1, 5);
}

export function draw(ctx, t) {
  const wx = waveX(t);
  ctx.save();
  if (t < WAVE1) {
    // Reveal everything behind the wave's front, along a wobbly edge.
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    for (let y = -10; y <= H + 10; y += 30) ctx.lineTo(edgeX(wx, y, t), y);
    ctx.lineTo(-10, H + 10);
    ctx.closePath();
    ctx.clip();
  }
  backdrop(ctx, t);

  JELLIES.forEach((j, i) => {
    if (t < j.t0) return;
    const y = H + 250 - (t - j.t0) * j.speed * 2.2;
    jelly(ctx, t, j.name, j.x, y, j.h, j.ph, 20 + i);
  });

  // Veggies tumble through the water and float away.
  VEG.forEach((v, i) => {
    const lt = t - (WAVE0 + 0.5 + i * 0.1);
    if (lt < 0 || lt > 3.5) return;
    const x = 120 + i * 240 + lt * 160 + Math.sin(lt * 2 + i) * 40;
    const y = 900 - lt * 330 + Math.sin(lt * 3 + i) * 30 - (hash(i) * 150);
    sprite(ctx, `${v}.sticker`, { x, y, h: 220, ay: 0.5, rot: lt * (hash(i, 2) - 0.5) * 6, seed: i, t, shadow: 0.5 });
    if (Math.floor(lt * 6) % 2 === 0) bubble(ctx, x + 60, y - 110 - (lt * 60) % 40, 10, { seed: i, t });
  });

  FISH.forEach((f, fi) => {
    const u = (t - f.at) / f.dur;
    if (u < 0 || u > 1) return;
    const n = f.school ?? 1;
    for (let k = 0; k < n; k++) {
      const x = f.dir > 0 ? lerp(-300, W + 300, u) - k * 190 * f.dir : lerp(W + 300, -300, u) - k * 190 * f.dir;
      const y = f.y + Math.sin(u * 12 + k) * 30 + k * 70;
      const wig = Math.sin(t * 16 + k) * 0.12;
      sprite(ctx, 'fish.sticker', { x, y, h: f.h, ay: 0.5, rot: (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + wig, flip: f.dir < 0, seed: 80 + fi * 3 + k, t, shadow: 0.5,
        filter: k ? `hue-rotate(${k * 110}deg)` : null });
    }
  });

  octopus(ctx, t);
  pinkJelly(ctx, t);

  // Hearts after the kiss.
  if (t >= STORY.kiss) {
    for (let k = 0; k < 9; k++) {
      const lt = t - STORY.kiss - k * 0.12;
      if (lt < 0) continue;
      const x = OCTO.x + 60 + (hash(k) - 0.5) * 420 + Math.sin(lt * 3 + k) * 30;
      const y = OCTO.y - 380 - lt * 170;
      heart(ctx, x, y, 40 + hash(k, 1) * 50, { rot: Math.sin(lt * 4 + k) * 0.3, alpha: clamp(1 - lt / 3) * ease.outBack(clamp(lt * 3)) });
    }
  }

  // Ambient bubbles.
  for (let k = 0; k < 14; k++) {
    const period = 3 + hash(k) * 3;
    const lt = ((t + hash(k, 3) * period) % period) / period;
    const x = 60 + hash(k, 7) * (W - 120) + Math.sin(lt * 8 + k) * 16;
    bubble(ctx, x, H - lt * (H + 80), 7 + hash(k, 9) * 16, { seed: k, t, alpha: 0.9 });
  }

  // Surfacing: tilt up toward the bright surface.
  const sf = ease.inCubic(invLerp(STORY.surface, end, t));
  if (sf > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(255,236,200,${sf})`);
    g.addColorStop(1, `rgba(255,214,170,${sf * 0.7})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  vignette(ctx, 0.35, '10,30,60');
  ctx.restore();

  // Torn-paper edge along the reveal, then the paper wave prop on top.
  if (t < WAVE1 + 0.1) {
    ctx.save();
    ctx.beginPath();
    for (let y = -10; y <= H + 10; y += 30) {
      const x = edgeX(wx, y, t);
      y < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.shadowColor = 'rgba(60,40,20,0.35)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#fbf4e6';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.restore();
    sprite(ctx, 'waveProp.sticker', { x: wx, y: 560, h: 980, ay: 0.5, seed: 4, t, rot: Math.sin(t * 7) * 0.03, sy: 1 + Math.sin(t * 9) * 0.03, shadow: 1.2 });
    for (let k = 0; k < 12; k++) {
      const dx = -300 - hash(k) * 700, dy = -250 + hash(k, 2) * 600;
      bubble(ctx, wx + dx, 560 + dy - ((t * 300 + k * 50) % 160), 12 + hash(k, 3) * 20, { seed: k, t });
    }
  }
}
