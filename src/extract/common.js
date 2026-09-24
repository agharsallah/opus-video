// Shared image helpers for turning phone photos of a sketchbook into clean,
// transparent drawing assets.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const INPUT_DIR = path.join(ROOT, 'input-pictures');
export const BUILD_DIR = path.join(ROOT, 'build');

export const SHEETS = [
  'creature 1', 'creature 2', 'creature 3', 'creature 4',
  'flowers', 'nature', 'nature 2', 'veg',
];

export async function loadRGB(file, width) {
  let img = sharp(path.join(INPUT_DIR, `${file}.jpg`)).rotate().removeAlpha();
  if (width) img = img.resize({ width });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// ---------------------------------------------------------------------------
// Paper lighting model: a smooth 2D polynomial per channel, fitted only to the
// pixels that look like paper (iteratively rejecting darker paint/ink pixels).
// Coordinates are normalised to [-1, 1] so the fit is resolution independent.
// ---------------------------------------------------------------------------
const DEG = 4;
const TERMS = [];
for (let i = 0; i <= DEG; i++) for (let j = 0; j <= DEG - i; j++) TERMS.push([i, j]);

function basis(u, v, out) {
  for (let k = 0; k < TERMS.length; k++) out[k] = u ** TERMS[k][0] * v ** TERMS[k][1];
  return out;
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function fitPaper(img) {
  const { data, width, height } = img;
  const step = Math.max(1, Math.round(width / 300));
  const samples = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 3;
      samples.push({ u: (x / width) * 2 - 1, v: (y / height) * 2 - 1, c: [data[i], data[i + 1], data[i + 2]] });
    }
  }
  const phi = new Float64Array(TERMS.length);
  let coefs = null;
  let keep = samples.map(() => true);
  for (let iter = 0; iter < 6; iter++) {
    coefs = [0, 1, 2].map((ch) => {
      const A = TERMS.map(() => new Float64Array(TERMS.length));
      const b = new Float64Array(TERMS.length);
      samples.forEach((s, n) => {
        if (!keep[n]) return;
        basis(s.u, s.v, phi);
        for (let r = 0; r < TERMS.length; r++) {
          b[r] += phi[r] * s.c[ch];
          for (let q = 0; q < TERMS.length; q++) A[r][q] += phi[r] * phi[q];
        }
      });
      return solve(A.map((r) => [...r]), [...b]);
    });
    // Paper is the brightest, least saturated thing on the page: drop anything
    // noticeably darker than the current fit in any channel.
    const tol = iter < 2 ? 0.1 : 0.06;
    keep = samples.map((s) => {
      basis(s.u, s.v, phi);
      for (let ch = 0; ch < 3; ch++) {
        const bg = dot(coefs[ch], phi);
        if (s.c[ch] < bg * (1 - tol)) return false;
      }
      return true;
    });
  }
  return coefs;
}

function dot(c, phi) {
  let s = 0;
  for (let k = 0; k < c.length; k++) s += c[k] * phi[k];
  return s;
}

// Divide the photo by the paper model so the paper becomes ~white everywhere.
// (x0, y0, fullW, fullH) place a crop inside the full page for the model.
export function flatten(img, coefs, { x0 = 0, y0 = 0, fullW = img.width, fullH = img.height } = {}) {
  const { data, width, height } = img;
  const out = new Float32Array(width * height * 3);
  const phi = new Float64Array(TERMS.length);
  // The polynomial is smooth: evaluate on a coarse grid and interpolate.
  const G = 16;
  const gw = Math.ceil(width / G) + 1;
  const gh = Math.ceil(height / G) + 1;
  const grid = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const u = ((x0 + gx * G) / fullW) * 2 - 1;
      const v = ((y0 + gy * G) / fullH) * 2 - 1;
      basis(u, v, phi);
      for (let ch = 0; ch < 3; ch++) grid[(gy * gw + gx) * 3 + ch] = dot(coefs[ch], phi);
    }
  }
  for (let y = 0; y < height; y++) {
    const fy = y / G, iy = Math.floor(fy), ty = fy - iy;
    for (let x = 0; x < width; x++) {
      const fx = x / G, ix = Math.floor(fx), tx = fx - ix;
      const i = (y * width + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        const a = grid[(iy * gw + ix) * 3 + ch], b = grid[(iy * gw + ix + 1) * 3 + ch];
        const c = grid[((iy + 1) * gw + ix) * 3 + ch], d = grid[((iy + 1) * gw + ix + 1) * 3 + ch];
        const bg = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
        out[i + ch] = Math.min(1.08, data[i + ch] / Math.max(1, bg * 0.97));
      }
    }
  }
  return out;
}

// "Inkiness": how far the darkest channel is from white paper, 0..1.
export function inkMap(flat, width, height) {
  const m = new Float32Array(width * height);
  for (let p = 0, i = 0; p < m.length; p++, i += 3) {
    const lo = Math.min(flat[i], flat[i + 1], flat[i + 2]);
    m[p] = Math.max(0, Math.min(1, 1 - lo));
  }
  return m;
}

export function dilate(mask, width, height, r) {
  // Separable square dilation on a 0/1 Uint8Array.
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    let run = -1e9;
    for (let x = 0; x < width; x++) { if (mask[y * width + x]) run = x; if (x - run <= r) tmp[y * width + x] = 1; }
    run = 1e9;
    for (let x = width - 1; x >= 0; x--) { if (mask[y * width + x]) run = x; if (run - x <= r) tmp[y * width + x] = 1; }
  }
  for (let x = 0; x < width; x++) {
    let run = -1e9;
    for (let y = 0; y < height; y++) { if (tmp[y * width + x]) run = y; if (y - run <= r) out[y * width + x] = 1; }
    run = 1e9;
    for (let y = height - 1; y >= 0; y--) { if (tmp[y * width + x]) run = y; if (run - y <= r) out[y * width + x] = 1; }
  }
  return out;
}

export function erode(mask, width, height, r) {
  const inv = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, width, height, r);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

// Fill enclosed holes: everything not reachable from the border becomes solid.
export function fillHoles(mask, width, height) {
  const out = new Uint8Array(mask.length).fill(1);
  const stack = [];
  const push = (x, y) => {
    const i = y * width + x;
    if (!mask[i] && out[i]) { out[i] = 0; stack.push(i); }
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width, y = (i / width) | 0;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return out;
}

export function components(mask, width, height) {
  const label = new Int32Array(mask.length).fill(-1);
  const comps = [];
  const stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = comps.length;
    const c = { id, area: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
    label[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      const x = i % width, y = (i / width) | 0;
      c.area++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const j of [i - 1, i + 1, i - width, i + width]) {
        if (j < 0 || j >= mask.length || !mask[j] || label[j] >= 0) continue;
        if ((j === i - 1 || j === i + 1) && ((j / width) | 0) !== y) continue;
        label[j] = id; stack.push(j);
      }
    }
    comps.push(c);
  }
  return { label, comps };
}

export function boxBlur(src, width, height, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < height; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * width + Math.min(width - 1, Math.max(0, x))];
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = acc / n;
      acc += src[y * width + Math.min(width - 1, x + r + 1)] - src[y * width + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(height - 1, Math.max(0, y)) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc / n;
      acc += tmp[Math.min(height - 1, y + r + 1) * width + x] - tmp[Math.max(0, y - r) * width + x];
    }
  }
  return out;
}
