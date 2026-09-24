// Drawing toolkit shared by all scenes: assets, sprites with a hand-made
// "boil", paper, ink lines, handwriting and watercolour shapes.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { ROOT, BUILD_DIR, boxBlur } from '../extract/common.js';
import { clamp, hash, noise1, rng } from '../lib/util.js';

export const W = 1920;
export const H = 1080;

export const INK = '#1f1b18';
export const COLORS = {
  cream: '#fbf4e6', sun: '#f7c948', sky: '#9fd0ee', leaf: '#9cc56b', lavender: '#a58fd6',
  coral: '#f08a7e', pink: '#f4a7b9', orange: '#f5a25d', teal: '#5fbfb4', night: '#1d2650',
  dusk: '#f3a683', plum: '#6b4d8f', water: '#7fc4e6',
};

const fontDir = path.join(ROOT, 'assets', 'fonts');
GlobalFonts.registerFromPath(path.join(fontDir, 'CaveatBrush-Regular.ttf'), 'Brush');
GlobalFonts.registerFromPath(path.join(fontDir, 'PatrickHand-Regular.ttf'), 'Hand');

// ---------------------------------------------------------------------------
// Assets (lazy, cached)
// ---------------------------------------------------------------------------
const index = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, 'assets', 'index.json'), 'utf8'));
const cache = new Map();

export async function preload(names) {
  await Promise.all(names.map(async (key) => {
    if (cache.has(key)) return;
    let file;
    if (key.startsWith('tex:')) file = path.join(BUILD_DIR, 'textures', `${key.slice(4)}.jpg`);
    else if (key === 'paper') file = path.join(BUILD_DIR, 'paper.png');
    else if (key.endsWith('.sticker')) file = path.join(BUILD_DIR, 'assets', `${key.slice(0, -8)}.sticker.png`);
    else file = path.join(BUILD_DIR, 'assets', `${key}.png`);
    cache.set(key, await loadImage(fs.readFileSync(file)));
  }));
}

export function img(key) {
  const im = cache.get(key);
  if (!im) throw new Error(`asset not preloaded: ${key}`);
  return im;
}
export const assetInfo = (name) => index[name];

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------
// Draw an asset anchored at (x, y). Size by `h` (display height) or `scale`.
// `boil` adds the stop-motion wobble of hand-animated paper cut-outs.
export function sprite(ctx, key, o = {}) {
  const im = img(key);
  const {
    x = 0, y = 0, ax = 0.5, ay = 1, rot = 0, sx = 1, sy = 1, alpha = 1, flip = false,
    boil = 1, seed = 0, t = 0, shadow = 0, composite = null, filter = null,
  } = o;
  if (alpha <= 0.001 || sx === 0 || sy === 0) return;
  const s = o.h ? o.h / im.height : o.w ? o.w / im.width : o.scale ?? 1;
  const step = Math.floor(t * 8);
  const jx = boil ? (hash(seed, step, 1) - 0.5) * 3 * boil : 0;
  const jy = boil ? (hash(seed, step, 2) - 0.5) * 3 * boil : 0;
  const jr = boil ? (hash(seed, step, 3) - 0.5) * 0.02 * boil : 0;
  ctx.save();
  ctx.translate(x + jx, y + jy);
  ctx.rotate(rot + jr);
  ctx.scale(s * sx * (flip ? -1 : 1), s * sy);
  ctx.globalAlpha *= clamp(alpha);
  if (composite) ctx.globalCompositeOperation = composite;
  if (filter) ctx.filter = filter;
  if (shadow) {
    // Pre-blurred silhouette, drawn offset: far cheaper than shadowBlur.
    const sh = shadowOf(key);
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.3 * Math.min(1, shadow);
    ctx.drawImage(sh.canvas, -ax * im.width - sh.pad, -ay * im.height - sh.pad + (9 * shadow) / s, im.width + 2 * sh.pad, im.height + 2 * sh.pad);
    ctx.globalAlpha = a0;
  }
  ctx.drawImage(im, -ax * im.width, -ay * im.height);
  ctx.restore();
}

const shadowCache = new Map();
function shadowOf(key) {
  if (shadowCache.has(key)) return shadowCache.get(key);
  const im = img(key);
  const k = 0.25, r = 5;
  const w = Math.ceil(im.width * k) + 4 * r, h = Math.ceil(im.height * k) + 4 * r;
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.drawImage(im, 2 * r, 2 * r, im.width * k, im.height * k);
  const data = x.getImageData(0, 0, w, h);
  let a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = data.data[i * 4 + 3] / 255;
  for (let p = 0; p < 3; p++) a = boxBlur(a, w, h, r);
  for (let i = 0; i < a.length; i++) {
    data.data[i * 4] = 50; data.data[i * 4 + 1] = 34; data.data[i * 4 + 2] = 20;
    data.data[i * 4 + 3] = Math.min(255, a[i] * 255);
  }
  x.putImageData(data, 0, 0);
  const entry = { canvas: c, pad: (2 * r) / k };
  shadowCache.set(key, entry);
  return entry;
}

// Size helper: scale that makes an asset `h` pixels tall.
export const heightScale = (key, h) => h / img(key).height;

// Pop-in scale: 0 before t0, springy overshoot, settles to 1.
export function pop(t, t0, dur = 0.55) {
  if (t < t0) return 0;
  const u = (t - t0) / dur;
  if (u >= 1) return 1;
  return 1 - Math.exp(-6 * u) * Math.cos(2 * Math.PI * 1.35 * u) * (1 - u);
}

// ---------------------------------------------------------------------------
// Paper, light and wash
// ---------------------------------------------------------------------------
export function paper(ctx, t, { tint = null, tintAlpha = 0, drift = 1 } = {}) {
  const p = img('paper');
  const ox = -120 - Math.sin(t * 0.05) * 60 * drift, oy = -80 - Math.cos(t * 0.04) * 40 * drift;
  ctx.drawImage(p, ox, oy, p.width, p.height);
  if (tint && tintAlpha > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = tintAlpha;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Re-apply the real paper grain on top of flat colour (multiply).
export function grain(ctx, t, alpha = 0.8) {
  const p = img('paper');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.drawImage(p, -200 - Math.sin(t * 0.05) * 60, -100, p.width, p.height);
  ctx.restore();
}

export function vignette(ctx, strength = 0.35, color = '40,25,10') {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// A soft watercolour blob: layered, jittered translucent polygons with a
// darker "pooling" edge, the way real pigment dries.
export function wash(ctx, cx, cy, rx, ry, color, { seed = 1, alpha = 0.5, layers = 5, wobble = 0.16 } = {}) {
  const r = rng(seed * 7919 + 13);
  ctx.save();
  ctx.fillStyle = color;
  for (let l = 0; l < layers; l++) {
    ctx.globalAlpha = alpha / layers * 1.6;
    ctx.beginPath();
    const n = 28;
    const ph = r() * 10;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + wobble * (noise1(a * 1.3 + ph, seed + l) + 0.5 * noise1(a * 4 + ph, seed + l + 9)) - l * 0.03;
      const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Ink
// ---------------------------------------------------------------------------
// Draw a hand-inked polyline, revealed up to `progress` (0..1), with pressure
// variation and a gentle boil.
export function inkLine(ctx, pts, { progress = 1, width = 5, color = INK, seed = 3, t = 0, boil = 1 } = {}) {
  if (progress <= 0 || pts.length < 2) return;
  const step = Math.floor(t * 8);
  const n = pts.length - 1;
  const upto = progress * n;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let prev = null;
  for (let i = 0; i <= Math.ceil(upto); i++) {
    const k = Math.min(i, upto);
    const i0 = Math.floor(k), f = k - i0;
    const a = pts[Math.min(i0, n)], c = pts[Math.min(i0 + 1, n)];
    const x = a[0] + (c[0] - a[0]) * f + (hash(seed, i0, step) - 0.5) * 1.6 * boil;
    const y = a[1] + (c[1] - a[1]) * f + (hash(seed, i0, step, 7) - 0.5) * 1.6 * boil;
    if (prev) {
      ctx.lineWidth = width * (0.75 + 0.45 * (noise1(i * 0.15, seed) * 0.5 + 0.5));
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    prev = [x, y];
  }
  ctx.restore();
  return prev; // pen tip
}

// Points along a big circle arc (the "little world" horizon).
export function arcPoints(cx, cy, r, a0, a1, n = 120, wob = 0, seed = 1) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const rr = r + wob * noise1(i * 0.12, seed);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

// Hand-drawn star / heart / bubble / gull / sparkle glyphs.
export function star(ctx, x, y, r, { fill = '#ffe9a0', stroke = INK, rot = 0, seed = 1, t = 0, lw = 3 } = {}) {
  const step = Math.floor(t * 8);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = (i % 2 ? r * 0.45 : r) * (1 + (hash(seed, i, step) - 0.5) * 0.12);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}

export function heart(ctx, x, y, s, { fill = '#f27a93', stroke = INK, rot = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s / 100, s / 100);
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-10, 18, -52, 0, -48, -26);
  ctx.bezierCurveTo(-44, -52, -8, -52, 0, -24);
  ctx.bezierCurveTo(8, -52, 46, -52, 49, -24);
  ctx.bezierCurveTo(52, 2, 10, 18, 0, 30);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 5; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.restore();
}

export function bubble(ctx, x, y, r, { alpha = 1, seed = 1, t = 0 } = {}) {
  const step = Math.floor(t * 8);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (1 + (hash(seed, step) - 0.5) * 0.06), r, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = 'rgba(31,27,24,0.8)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, Math.PI * 1.1, Math.PI * 1.7);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.stroke();
  ctx.restore();
}

export function gull(ctx, x, y, s, flap, color = INK) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = 'round';
  const lift = Math.sin(flap) * s * 0.35;
  ctx.beginPath();
  ctx.moveTo(-s, -lift);
  ctx.quadraticCurveTo(-s * 0.45, -s * 0.5 - lift * 0.3, 0, 0);
  ctx.quadraticCurveTo(s * 0.45, -s * 0.5 - lift * 0.3, s, -lift);
  ctx.stroke();
  ctx.restore();
}

export function sparkle(ctx, x, y, r, { color = '#fff4c2', alpha = 1, rot = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.22 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Speed / motion lines behind something that just moved.
export function motionLines(ctx, x, y, dir, len, alpha, seed = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 22 + (hash(seed, i) - 0.5) * 10;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(dir) * 10 - Math.sin(dir) * off, y - Math.sin(dir) * 10 + Math.cos(dir) * off);
    ctx.lineTo(x - Math.cos(dir) * (10 + len * (0.6 + 0.4 * hash(seed, i, 2))) - Math.sin(dir) * off,
      y - Math.sin(dir) * (10 + len) + Math.cos(dir) * off);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Handwriting
// ---------------------------------------------------------------------------
const textCache = new Map();
function textCanvas(str, font, size, color) {
  const key = `${str}|${font}|${size}|${color}`;
  if (textCache.has(key)) return textCache.get(key);
  const m = createCanvas(4, 4).getContext('2d');
  m.font = `${size}px ${font}`;
  const w = Math.ceil(m.measureText(str).width + size * 0.4);
  const h = Math.ceil(size * 1.5);
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.font = `${size}px ${font}`;
  x.fillStyle = color;
  x.textBaseline = 'middle';
  x.fillText(str, size * 0.2, h / 2);
  textCache.set(key, c);
  return c;
}

// Text revealed left-to-right as if being written (progress 0..1).
export function writeText(ctx, str, x, y, { size = 120, font = 'Brush', color = INK, progress = 1, rot = 0, alpha = 1, align = 'center' } = {}) {
  if (progress <= 0) return null;
  const c = textCanvas(str, font, size, color);
  const ox = align === 'center' ? -c.width / 2 : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  const w = c.width * clamp(progress);
  ctx.drawImage(c, 0, 0, w, c.height, ox, -c.height / 2, w, c.height);
  ctx.restore();
  return [x + ox + w, y];
}

// Text whose letters pop in one by one (times are per-letter start offsets).
export function popText(ctx, str, x, y, t, t0, { size = 120, font = 'Brush', color = INK, stagger = 0.06, seed = 5, out = null } = {}) {
  const m = createCanvas(4, 4).getContext('2d');
  m.font = `${size}px ${font}`;
  const total = m.measureText(str).width;
  let cx = x - total / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const w = m.measureText(ch).width;
    let s = pop(t, t0 + i * stagger, 0.5);
    if (out != null) s *= 1 - ease01((t - (out + i * 0.03)) / 0.2);
    if (s > 0.01 && ch !== ' ') {
      const c = textCanvas(ch, font, size, color);
      ctx.save();
      ctx.translate(cx + w / 2, y + Math.sin(t * 5 + i) * 3);
      ctx.rotate((hash(seed, i) - 0.5) * 0.16);
      ctx.scale(s, s);
      ctx.drawImage(c, -c.width / 2, -c.height / 2);
      ctx.restore();
    }
    cx += w;
  }
}
const ease01 = (u) => clamp(u) ** 2;

export { createCanvas };
