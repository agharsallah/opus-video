// Scene 7 — "Night": an ink-blue wash lowers over the page. Stars twinkle
// on, the moon smiles, and every window in the sketchbook village lights up
// one by one like a music box. Owls hoot, a kitten snores, a shooting star.
import { W, H, INK, img, sprite, grain, vignette, writeText, sparkle, createCanvas } from '../engine.js';
import { drawHill, makeHill, hillY } from './hill.js';
import { WINDOWS } from './windows.js';
import { clamp, ease, spring, invLerp, hash, noise1, lerp } from '../../lib/util.js';

export const start = 58.4;
export const end = 66;
export const lead = 1.2; // the night wash lowers over the dusk from 57.2

const CURTAIN0 = 57.2, CURTAIN1 = 58.5;
const STARS_AT = 58.6, MOON_AT = 59.0, WIN_AT = 59.6, WIN_STEP = 0.125;
const OWLS = [61.0, 62.0], MEOW = 62.4, SNORES = [62.9, 64.1], DREAMS = 63.0, SHOOT = 64.6;

const HILL = makeHill(840, 3200);
const HOUSES = [
  { name: 'houseStone', x: 880, h: 150, back: true },
  { name: 'houseBlue', x: 1480, h: 200, back: true },
  { name: 'treehouse', x: 190, h: 1000, sink: 90 },
  { name: 'windowCats', x: 760, h: 250 },
  { name: 'housesRow', x: 1060, h: 270 },
  { name: 'houseMushroom', x: 1360, h: 225 },
  { name: 'houseAvocado', x: 1570, h: 300 },
  { name: 'houseCarrot', x: 1800, h: 340 },
];
// All windows, lit left to right as a cascade.
const LIGHTS = [];
HOUSES.forEach((hs) => (WINDOWS[hs.name] ?? []).forEach(([u, v]) => LIGHTS.push({ hs, u, v })));
LIGHTS.sort((p, q) => p.hs.x + p.u * 300 - (q.hs.x + q.u * 300));
LIGHTS.forEach((l, i) => { l.at = WIN_AT + i * WIN_STEP; });

const STARS = Array.from({ length: 34 }, (_, i) => ({
  x: 60 + hash(i, 1) * (W - 120), y: 40 + hash(i, 2) * 420, r: 8 + hash(i, 3) * 14, at: STARS_AT + i * 0.05,
})).filter((s) => Math.hypot(s.x - 1640, s.y - 190) > 150 && s.x > 520);

export const assets = [
  'paper', 'kittenSleep.sticker', 'owlBrown.sticker', 'owlBlue.sticker',
  ...HOUSES.map((h) => `${h.name}.sticker`),
];

const PENTA = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'A6', 'G6', 'E6', 'D6'];
export const cues = [
  ...STARS.filter((_, i) => i % 3 === 0).map((s, i) => ({ t: s.at, sfx: 'twinkle', note: PENTA[(i * 2) % PENTA.length], pan: s.x / W * 1.6 - 0.8, gain: 0.35 })),
  { t: MOON_AT, sfx: 'shimmer', gain: 0.5, pan: -0.6 },
  ...LIGHTS.map((l, i) => ({ t: l.at, sfx: 'musicbox', note: PENTA[i % PENTA.length], pan: (l.hs.x / W) * 1.6 - 0.8, gain: 0.5 })),
  ...OWLS.map((t, i) => ({ t, sfx: 'hoot', pitch: i ? 1.15 : 0.85, pan: i ? 0.3 : -0.7, gain: 0.7 })),
  { t: MEOW, sfx: 'meow', pitch: 1.1, pan: -0.3, gain: 0.6 },
  ...SNORES.map((t) => ({ t, sfx: 'snore', gain: 0.6, pan: 0.05 })),
  { t: DREAMS, sfx: 'scribble', dur: 1.3, gain: 0.35 },
  { t: SHOOT, sfx: 'shootingStar', gain: 0.7, pan: 0.8, panTo: -0.8 },
  { t: 65.5, sfx: 'riser', dur: 0.5, gain: 0.5 },
];

// Night versions of the paper cut-outs: dimmed and cooled once, cached.
const dimCache = new Map();
function dim(key) {
  if (dimCache.has(key)) return dimCache.get(key);
  const im = img(key);
  const c = createCanvas(im.width, im.height);
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(28,36,84,0.62)';
  x.fillRect(0, 0, im.width, im.height);
  dimCache.set(key, c);
  return c;
}

function drawDim(ctx, key, { x, y, h, ax = 0.5, ay = 1, rot = 0, extra = 0 }) {
  const c = dim(key);
  const s = h / c.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,20,0.4)';
  ctx.shadowBlur = 20;
  ctx.drawImage(c, -ax * c.width, -ay * c.height);
  ctx.shadowColor = 'transparent';
  if (extra) {
    ctx.globalAlpha = extra;
    ctx.fillStyle = 'rgba(10,14,40,1)';
  }
  ctx.restore();
  return s;
}

function moon(ctx, t) {
  const k = spring(t - MOON_AT, 1.2, 4);
  if (k <= 0) return;
  const x = 1640, y = 190 + (1 - k) * 60, r = 95;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
  glow.addColorStop(0, 'rgba(255,240,190,0.35)');
  glow.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  // Crescent: the part of the disc outside an offset disc, as one outline.
  const dx = -r * 0.55, dy = -r * 0.25, r2 = r * 0.85;
  const x2 = x + dx, y2 = y + dy;
  const pts = [];
  const a0 = Math.atan2(y - y2, x - x2);
  for (let i = 0; i <= 200; i++) {
    const a = a0 - Math.PI + (i / 200) * 2 * Math.PI;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (Math.hypot(px - x2, py - y2) >= r2) pts.push([px, py]);
  }
  const inner = [];
  for (let i = 0; i <= 200; i++) {
    const a = a0 - Math.PI + (i / 200) * 2 * Math.PI;
    const px = x2 + Math.cos(a) * r2, py = y2 + Math.sin(a) * r2;
    if (Math.hypot(px - x, py - y) <= r) inner.push([px, py]);
  }
  ctx.beginPath();
  [...pts, ...inner.reverse()].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = '#fbe7a1';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Sleepy face.
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x + r * 0.5, y + r * 0.05, 10, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y + r * 0.45, 14, 0.15 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function sky(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141b44');
  g.addColorStop(0.6, '#26336b');
  g.addColorStop(1, '#3a4a86');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Pigment blooms in the wash.
  ctx.save();
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = i % 2 ? '#3b2f6e' : '#1a3a6a';
    ctx.beginPath();
    ctx.ellipse(200 + i * 330, 250 + (i % 3) * 120, 300, 120, i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  grain(ctx, t, 0.55);
}

export function draw(ctx, t) {
  ctx.save();
  if (t < CURTAIN1) {
    // The night wash lowers from the top with a wobbly wet edge.
    const u = ease.inOutSine(invLerp(CURTAIN0, CURTAIN1, t));
    const edge = (x) => lerp(-80, H + 160, u) + noise1(x * 0.004, 3) * 70 + noise1(x * 0.02, 8) * 14;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(W + 10, -10);
    for (let x = W + 10; x >= -10; x -= 30) ctx.lineTo(x, edge(x));
    ctx.closePath();
    ctx.clip();
  }
  sky(ctx, t);

  STARS.forEach((s, i) => {
    const k = spring(t - s.at, 2, 5);
    if (k <= 0) return;
    const tw = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7);
    sparkle(ctx, s.x, s.y, s.r * k * tw, { color: '#fff1b8', rot: i });
  });
  moon(ctx, t);

  // Shooting star.
  const su = (t - SHOOT) / 0.8;
  if (su > 0 && su < 1.4) {
    const x = lerp(W + 50, 700, ease.outQuad(clamp(su))), y = lerp(80, 330, ease.outQuad(clamp(su)));
    const a = 1 - clamp((su - 1) / 0.4);
    ctx.save();
    const tr = ctx.createLinearGradient(x, y, x + 380, y - 130);
    tr.addColorStop(0, `rgba(255,244,190,${0.9 * a})`);
    tr.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.strokeStyle = tr;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 380, y - 130); ctx.stroke();
    ctx.restore();
    sparkle(ctx, x, y, 34 * a, { color: '#fff8d8', rot: t * 6 });
  }

  // Village. Back houses first, a touch darker.
  const lightsDrawn = [];
  HOUSES.forEach((hs) => {
    const y = hillY(hs.x, HILL) + (hs.back ? -40 : 30) + (hs.sink ?? 0);
    const s = drawDim(ctx, `${hs.name}.sticker`, { x: hs.x, y, h: hs.h });
    hs.s = s; hs.y = y;
    if (hs.back) {
      ctx.save(); ctx.globalAlpha = 0.3; ctx.restore();
    }
    lightsDrawn.push(hs);
    if (hs.name === 'treehouse') drawHill(ctx, t, { hill: HILL, color: '#34466e', deep: '#243257' });
  });

  // Window lights: the lit drawing shows through a soft glowing pane.
  LIGHTS.forEach((l, i) => {
    const k = spring(t - l.at, 2.2, 5);
    if (k <= 0) return;
    const im = img(`${l.hs.name}.sticker`);
    const s = l.hs.h / im.height;
    const cx = l.hs.x + (l.u - 0.5) * im.width * s, cy = l.hs.y - (1 - l.v) * im.height * s;
    const flick = 0.92 + 0.08 * noise1(t * 6, i);
    const r = (l.hs.name === 'windowCats' ? 44 : 15) * Math.min(1.5, l.hs.h / 300) * k * flick + 4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(im, l.hs.x - im.width * s / 2, l.hs.y - im.height * s, im.width * s, im.height * s);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
    g.addColorStop(0, `rgba(255,200,90,${0.32 * flick})`);
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Owls keep watch.
  OWLS.forEach((at, i) => {
    const key = i ? 'owlBlue.sticker' : 'owlBrown.sticker';
    const [x, y] = i ? [1790, hillY(1800, HILL) - 300] : [520, hillY(250, HILL) - 520];
    const k = spring(t - (at - 0.6), 1.5, 5);
    if (k <= 0) return;
    const hoot = t > at && t < at + 0.5 ? 1 + 0.1 * Math.sin((t - at) * 35) * (1 - (t - at) / 0.5) : 1;
    drawDim(ctx, key, { x, y: y + (1 - k) * 40, h: 120 * k, rot: Math.sin(t * 1.5 + i) * 0.05 });
    // Glowing eyes.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,220,120,${0.6 * k})`;
    for (const dx of [-14, 14]) { ctx.beginPath(); ctx.arc(x + dx, y - 80 * hoot, 9, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });

  // The sleepy kitten and its z's.
  const kx = 980, ky = 1040;
  const breathe = 1 + 0.03 * Math.sin(t * 2.4);
  drawDim(ctx, 'kittenSleep.sticker', { x: kx, y: ky, h: 170 * breathe });
  SNORES.forEach((sn) => {
    for (let z = 0; z < 3; z++) {
      const lt = t - sn - z * 0.25;
      if (lt < 0 || lt > 1.8) continue;
      ctx.save();
      ctx.translate(kx + 90 + lt * 60 + Math.sin(lt * 4) * 12, ky - 150 - lt * 110);
      ctx.rotate(-0.2);
      writeText(ctx, 'z', 0, 0, { size: 50 + z * 16, font: 'Brush', color: '#fbf4e6', alpha: 1 - lt / 1.8 });
      ctx.restore();
    }
  });

  // Fireflies.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = clamp((t - 60.5 - i * 0.12) * 2);
    if (a <= 0) continue;
    const x = 100 + hash(i, 4) * (W - 200) + Math.sin(t * 0.7 + i) * 60;
    const y = 700 + hash(i, 5) * 300 + Math.cos(t * 0.9 + i * 2) * 40;
    const blink = 0.5 + 0.5 * Math.sin(t * 4 + i * 3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, `rgba(230,255,140,${0.9 * a * blink})`);
    g.addColorStop(1, 'rgba(200,255,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  const du = invLerp(DREAMS, DREAMS + 1.3, t);
  writeText(ctx, 'sweet dreams', 1060, 200, { size: 130, font: 'Brush', color: '#fbf4e6', progress: du, alpha: 1 - invLerp(65.3, 65.7, t), rot: -0.04 });

  vignette(ctx, 0.45, '5,8,25');
  ctx.restore();

  // Wet, darker pigment at the lowering edge of the wash.
  if (t < CURTAIN1) {
    const u = ease.inOutSine(invLerp(CURTAIN0, CURTAIN1, t));
    const edge = (x) => lerp(-80, H + 160, u) + noise1(x * 0.004, 3) * 70 + noise1(x * 0.02, 8) * 14;
    ctx.save();
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 30) x < 0 ? ctx.moveTo(x, edge(x)) : ctx.lineTo(x, edge(x));
    ctx.strokeStyle = 'rgba(15,20,60,0.55)';
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();
  }
}
